-- Run once in the Supabase SQL editor. All tenant access derives from auth.uid().
create extension if not exists pgcrypto;
create table public.organizations (id uuid primary key default gen_random_uuid(), name text not null, created_at timestamptz not null default now());
create table public.users (id uuid primary key references auth.users(id) on delete cascade, name text not null default '', created_at timestamptz not null default now());
create table public.organization_members (organization_id uuid not null references public.organizations(id) on delete cascade, user_id uuid not null references auth.users(id) on delete cascade, role text not null check(role in ('Admin','Marketing Manager','Marketing Analyst')), created_at timestamptz not null default now(), primary key(organization_id,user_id));
create index organization_members_user_idx on public.organization_members(user_id);
create function public.is_org_member(org uuid) returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from public.organization_members where organization_id=org and user_id=auth.uid()); $$;
create function public.can_edit_org(org uuid) returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from public.organization_members where organization_id=org and user_id=auth.uid() and role in ('Admin','Marketing Manager')); $$;
revoke all on function public.is_org_member(uuid), public.can_edit_org(uuid) from public;
grant execute on function public.is_org_member(uuid), public.can_edit_org(uuid) to authenticated;
alter table public.organizations enable row level security;
alter table public.users enable row level security;
alter table public.organization_members enable row level security;
create policy org_select on public.organizations for select to authenticated using(public.is_org_member(id));
create policy org_update on public.organizations for update to authenticated using(public.can_edit_org(id)) with check(public.can_edit_org(id));
create policy own_profile on public.users for all to authenticated using(id=auth.uid()) with check(id=auth.uid());
create policy own_membership on public.organization_members for select to authenticated using(user_id=auth.uid());
-- No browser policies permit creating memberships or changing roles.
create table public.workspace_state (organization_id uuid primary key references public.organizations(id) on delete cascade, data jsonb not null default '{}'::jsonb check(jsonb_typeof(data)='object'), updated_at timestamptz not null default now());
alter table public.workspace_state enable row level security;
create policy state_read on public.workspace_state for select to authenticated using(public.is_org_member(organization_id));
create policy state_insert on public.workspace_state for insert to authenticated with check(public.can_edit_org(organization_id));
create policy state_update on public.workspace_state for update to authenticated using(public.can_edit_org(organization_id)) with check(public.can_edit_org(organization_id));
create policy state_delete on public.workspace_state for delete to authenticated using(public.can_edit_org(organization_id));
create function public.create_workspace_for_user() returns trigger language plpgsql security definer set search_path=public as $$
declare org uuid;
begin
 insert into public.users(id,name) values(new.id,coalesce(new.raw_user_meta_data->>'name',''));
 insert into public.organizations(name) values(coalesce(nullif(new.raw_user_meta_data->>'organization',''),'My workspace')) returning id into org;
 insert into public.organization_members(organization_id,user_id,role) values(org,new.id,'Admin');
 return new;
end; $$;
create trigger auth_user_workspace after insert on auth.users for each row execute function public.create_workspace_for_user();
-- Normalized extension tables are ready for independent integrations. The application
-- currently persists its workspace document in workspace_state; it does not dual-write.
create table public.customers (id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id) on delete cascade,name text not null,email text not null,consent boolean not null default false,data jsonb not null default '{}',created_at timestamptz not null default now(),unique(organization_id,email));
create table public.products (id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id) on delete cascade,name text not null,price numeric(12,2) not null default 0 check(price>=0),data jsonb not null default '{}',created_at timestamptz not null default now());
create table public.campaigns (id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id) on delete cascade,name text not null,status text not null default 'Draft' check(status in ('Draft','Pending Approval','Scheduled','Active','Paused','Completed','Failed')),budget numeric(12,2) not null default 0 check(budget>=0),data jsonb not null default '{}',created_at timestamptz not null default now());
create table public.customer_segments (id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id) on delete cascade,name text not null,data jsonb not null default '{}',created_at timestamptz not null default now());
create table public.customer_segment_members (id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id) on delete cascade,customer_id uuid not null references public.customers(id) on delete cascade,segment_id uuid not null references public.customer_segments(id) on delete cascade,created_at timestamptz not null default now(),unique(customer_id,segment_id));
do $$ declare table_name text; begin
 foreach table_name in array array['campaign_variations','campaign_metrics','campaign_schedules','content_generations','conversion_predictions','ab_tests','ab_test_results','marketing_recommendations','integrations','consent_records','audit_logs'] loop
 execute format('create table public.%I (id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade, data jsonb not null default ''{}'', created_at timestamptz not null default now())',table_name);
 end loop;
 foreach table_name in array array['customers','products','campaigns','customer_segments','customer_segment_members','campaign_variations','campaign_metrics','campaign_schedules','content_generations','conversion_predictions','ab_tests','ab_test_results','marketing_recommendations','integrations','consent_records','audit_logs'] loop
 execute format('alter table public.%I enable row level security',table_name);
 execute format('create index %I on public.%I(organization_id)',table_name||'_org_idx',table_name);
 execute format('create policy tenant_read on public.%I for select to authenticated using(public.is_org_member(organization_id))',table_name);
 if table_name <> 'audit_logs' then
 execute format('create policy tenant_insert on public.%I for insert to authenticated with check(public.can_edit_org(organization_id))',table_name);
 execute format('create policy tenant_update on public.%I for update to authenticated using(public.can_edit_org(organization_id)) with check(public.can_edit_org(organization_id))',table_name);
 execute format('create policy tenant_delete on public.%I for delete to authenticated using(public.can_edit_org(organization_id))',table_name);
 end if;
 end loop;
end $$;
create function public.audit_workspace_change() returns trigger language plpgsql security definer set search_path=public as $$ begin
 insert into public.audit_logs(organization_id,data) values(coalesce(new.organization_id,old.organization_id),jsonb_build_object('actor',auth.uid(),'operation',tg_op,'resource','workspace_state','timestamp',now()));
 return coalesce(new,old);
end; $$;
create trigger audit_workspace after insert or update or delete on public.workspace_state for each row execute function public.audit_workspace_change();
-- Private object storage. Paths must begin with an organization UUID.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('marketing-assets','marketing-assets',false,2097152,array['image/png','image/jpeg','image/webp','text/csv']) on conflict(id) do nothing;
create policy assets_read on storage.objects for select to authenticated using(bucket_id='marketing-assets' and public.is_org_member(((storage.foldername(name))[1])::uuid));
create policy assets_insert on storage.objects for insert to authenticated with check(bucket_id='marketing-assets' and public.can_edit_org(((storage.foldername(name))[1])::uuid));
create policy assets_delete on storage.objects for delete to authenticated using(bucket_id='marketing-assets' and public.can_edit_org(((storage.foldername(name))[1])::uuid));
