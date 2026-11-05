# Architecture and decisions

See the root README for the architecture diagram and operating modes. The frontend holds a typed Store containing customers, products, campaigns, content, experiments, prediction history, imports and organization display settings. Demo writes are device-local. Connected writes are tenant-scoped Supabase JSON documents, audited by a database trigger. Normalized tables are an extension schema and are not the current write path.

LangGraph nodes operate on supplied records, calculate clusters and recorded channel ROAS, generate optional live AI content, and return human-review status. No external mutations are performed by agents.

Security: credentials remain server-side; Supabase RLS decides membership/writer access; organization ID comes from a verified membership; Python models are keyed by organization. Public demo contains only reserved example.com records. Real customer data should use authenticated connected mode. Browser local storage is not a secure store for sensitive production records.

Known limits: JSON document last-writer-wins updates, process-local model registry and throttles, no production event ingestion/provider delivery, no durable agent interrupts. Do not interpret integration setup instructions as implemented OAuth adapters.
