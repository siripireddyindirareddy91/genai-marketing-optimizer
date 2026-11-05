# API reference

Frontend: `GET /api/health`, `POST /api/generate` (JSON: kind, product, description, audience, objective, channel, tone, language, offer, budget). Generation returns `{mode: 'demo' | 'live', content}`. Connected mode requires `Authorization: Bearer <Supabase access token>`.

Python: OpenAPI at `/docs`, JSON at `/openapi.json`. All `/api/*` routes verify the Supabase user and organization. Writers must be Admin or Marketing Manager.

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/health` | Public service readiness |
| GET | `/api/auth/me` | Verified user and membership |
| GET | `/api/dashboard/overview`, `/api/dashboard/analytics` | Aggregated workspace values |
| GET/POST | `/api/customers`, `/api/products`, `/api/campaigns` | Read/create workspace records |
| PUT/DELETE | `/api/{resource}/{id}` | Update/delete workspace records |
| POST | `/api/ml/train` | `{model: 'logistic' | 'random_forest', rows: [{engagement, visits, purchases, recency, spending, converted}]}` |
| POST | `/api/ml/predict` | One customer feature object; requires trained organization model |
| GET | `/api/ml/metrics` | Held-out evaluation for current organization model |
| POST | `/api/segmentation/run` | `{customers: [...], clusters: 7}` |
| POST | `/api/ml/customer-insights` | Historical heuristics, not learned churn/CLV forecasts |
| POST | `/api/agents/run` | `{business, product, customers, campaigns, approved: false}` |

The browser normally reads/writes `workspace_state` directly through the Supabase SDK and RLS. Demo mode uses localStorage and does not call an unavailable Python backend. No delivery endpoint exists.
