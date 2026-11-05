# Deployment guide

1. Deploy repository root to Vercel (Next.js; npm ci; npm run build). No environment variables are necessary for the demo.
2. Optionally provision Supabase free tier, apply the SQL migration, configure Auth site/redirect URLs, and add public Supabase URL/anon key in Vercel.
3. Optionally add server-only OPENAI_API_KEY and OPENAI_MODEL. Redeploy after changing public build-time variables.
4. Deploy `backend/` separately with its Dockerfile or Render blueprint; set SUPABASE_URL, SUPABASE_ANON_KEY, ALLOWED_ORIGINS and optional OpenAI settings. No paid upgrades are required for demo functionality.
5. Add the Python service URL as NEXT_PUBLIC_BACKEND_URL in Vercel and redeploy.
6. Verify frontend `/api/health`, backend `/health`, signup/login/reset, cross-tenant access denial, Analyst write denial, imports, and labeled model training.

No live marketing provider adapters are enabled. Configure and implement official OAuth/delivery services separately before publishing ads or sending consented messages. Campaign scheduling currently stores plans only.
