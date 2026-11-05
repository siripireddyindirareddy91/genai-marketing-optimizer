# Database design

Apply `supabase/migrations/001_initial.sql` once to a new Supabase project. Auth signup creates a profile, organization and Admin membership. Tenant membership functions use fixed search_path and security definer to avoid recursive RLS. Membership writes have no browser policy.

`workspace_state` is the active persistence layer: organization_id primary key, data JSONB, updated_at. Organization members can read; Admin and Marketing Manager can write; Analyst cannot write. Each document mutation creates a server-owned audit record. Normalized extension tables mirror the requested domain for future granular persistence; they are isolated with the same RLS functions. Customer email is unique per organization. A private asset bucket restricts paths by organization UUID.

Use the Settings sample-data action to load an explicitly labeled seed into a workspace, or the deterministic `seed()` function from `lib/domain.ts`. Do not seed real contact addresses. No service-role credential is required in the browser.

Before live launch, verify RLS using two organizations and a read-only Analyst, confirm the trigger on your Supabase version, and test signed storage access. These live database checks cannot run without a configured Supabase project.
