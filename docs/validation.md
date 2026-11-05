# Observed validation — 5 November 2026

- Production Next.js webpack build: passed, with TypeScript and generated routes.
- TypeScript domain/API tests: 10 passed (sample data size, metric aggregation, K-Means, heuristic bounds, A/B validity/significance, derived recommendations, health, malformed/oversized API requests, labeled demo generation).
- Python tests: 8 passed (Logistic Regression and Random Forest train/predict, held-out split, insufficient-label rejection, K-Means, all eight LangGraph nodes and human-review output, health/auth boundary, Analyst write denial, organization-isolated model lookup). Three dependency/platform warnings; no failures.
- Dependency audit after upgrading Zod: zero known vulnerabilities at the time of validation.
- Browser checks: dashboard chart rendering, create campaign → generate labeled demo strategy → save → campaign table; customer creation and search; K-Means segmentation updates customer groups; illustrative prediction history. All use sample data.
- Vercel deployment returned READY; public `/api/health` returned status ok, browser-demo storage, demo-templates AI, and not-configured delivery.
- GitHub push to main succeeded. Automatic Vercel/GitHub linking failed with a Vercel repository access error; direct CLI deployment succeeded.

Not executed: live Supabase migration/RLS integration tests, real email signup/reset delivery, paid AI provider generation, external marketing OAuth/delivery, or a deployed Python service. These need external project configuration. Unit-level role/model isolation checks are not a substitute for live PostgreSQL RLS testing. Comprehensive component and automated cross-browser tests remain follow-up work.
