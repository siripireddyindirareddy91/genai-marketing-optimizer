import os
import time
import logging
from collections import defaultdict
from typing import Literal
import httpx
from fastapi import FastAPI, Depends, HTTPException, Header, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, ConfigDict
from .ml import train, predict, segment, customer_insights
from .agents import build_graph

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(name)s %(message)s')
app = FastAPI(title='MarketingGen AI', version='1.0.0')
app.add_middleware(CORSMiddleware, allow_origins=os.getenv('ALLOWED_ORIGINS', 'http://localhost:3000').split(','), allow_credentials=True, allow_methods=['GET', 'POST', 'PUT', 'DELETE'], allow_headers=['Authorization', 'Content-Type'])
models = {}
rate = defaultdict(list)

@app.middleware('http')
async def limit_requests(request: Request, call_next):
    from fastapi.responses import JSONResponse
    if int(request.headers.get('content-length', '0')) > 2_000_000:
        return JSONResponse({'detail': 'Request too large'}, status_code=413)
    ip = request.client.host if request.client else 'unknown'
    now = time.time()
    rate[ip] = [t for t in rate[ip] if now - t < 60]
    if len(rate[ip]) >= 60:
        return JSONResponse({'detail': 'Rate limit exceeded'}, status_code=429)
    rate[ip].append(now)
    return await call_next(request)

async def workspace(authorization: str | None = Header(default=None)):
    url, key = os.getenv('SUPABASE_URL'), os.getenv('SUPABASE_ANON_KEY')
    if not url or not key:
        raise HTTPException(503, 'Configure SUPABASE_URL and SUPABASE_ANON_KEY to enable the Python service. Public unauthenticated data APIs are disabled.')
    if not authorization or not authorization.startswith('Bearer '):
        raise HTTPException(401, 'Authentication required')
    headers = {'Authorization': authorization, 'apikey': key}
    async with httpx.AsyncClient(timeout=15) as client:
        user = await client.get(url + '/auth/v1/user', headers=headers)
        if user.status_code != 200:
            raise HTTPException(401, 'Invalid access token')
        membership = await client.get(url + '/rest/v1/organization_members?select=organization_id,role&limit=1', headers=headers)
        if membership.status_code != 200 or not membership.json():
            raise HTTPException(403, 'Organization membership required')
        return {**membership.json()[0], 'headers': headers, 'user': user.json()}

async def editor(ctx=Depends(workspace)):
    if ctx['role'] not in ('Admin', 'Marketing Manager'):
        raise HTTPException(403, 'Editor role required')
    return ctx

class CustomerFeatures(BaseModel):
    model_config = ConfigDict(extra='ignore')
    id: str = ''
    engagement: float = Field(default=0, ge=0, le=100)
    visits: float = Field(default=0, ge=0)
    purchases: float = Field(default=0, ge=0)
    recency: float = Field(default=0, ge=0)
    spending: float = Field(default=0, ge=0)
    converted: Literal[0, 1] | None = None

class TrainingRequest(BaseModel):
    rows: list[CustomerFeatures] = Field(min_length=40, max_length=10000)
    model: Literal['logistic', 'random_forest'] = 'logistic'

class SegmentRequest(BaseModel):
    customers: list[CustomerFeatures] = Field(min_length=2, max_length=10000)
    clusters: int = Field(default=7, ge=2, le=20)

class WorkflowRequest(BaseModel):
    business: str = Field(max_length=200)
    product: str = Field(max_length=200)
    customers: list[dict] = Field(default_factory=list, max_length=5000)
    campaigns: list[dict] = Field(default_factory=list, max_length=500)
    approved: bool = False

@app.get('/health')
def health():
    return {'status': 'ok', 'service': 'MarketingGen AI', 'model_storage': 'process memory; retrain after restart'}

@app.get('/api/auth/me')
async def me(ctx=Depends(workspace)):
    return {'user': ctx['user'], 'organization_id': ctx['organization_id'], 'role': ctx['role']}

@app.post('/api/ml/train')
def train_model(data: TrainingRequest, ctx=Depends(editor)):
    try:
        rows = [r.model_dump() for r in data.rows]
        if any(r['converted'] is None for r in rows):
            raise ValueError('Every observation requires an actual historical converted label')
        pipeline, evaluation = train(rows, data.model)
        models[ctx['organization_id']] = (pipeline, data.model, evaluation)
        return {'model': data.model, 'metrics': evaluation, 'features': ['engagement', 'visits', 'purchases', 'recency', 'spending'], 'warning': 'Use pre-conversion feature snapshots; repeated customer observations require group/time-aware validation. Model is held in process memory.'}
    except (ValueError, TypeError) as exc:
        raise HTTPException(422, str(exc)) from exc

@app.get('/api/ml/metrics')
def model_metrics(ctx=Depends(workspace)):
    entry = models.get(ctx['organization_id'])
    if not entry:
        raise HTTPException(409, 'Train a model on labeled historical data first')
    return {'model': entry[1], 'metrics': entry[2]}

@app.post('/api/ml/predict')
def predict_model(data: CustomerFeatures, ctx=Depends(workspace)):
    entry = models.get(ctx['organization_id'])
    if not entry:
        raise HTTPException(409, 'Train a model on labeled historical data first')
    return {**predict(entry[0], data.model_dump()), 'model': entry[1]}

@app.post('/api/segmentation/run')
def segmentation(data: SegmentRequest, ctx=Depends(editor)):
    return {'segments': segment([r.model_dump() for r in data.customers], data.clusters), 'method': 'StandardScaler + KMeans', 'source': 'Supplied customer records'}

@app.post('/api/ml/customer-insights')
def insights(data: SegmentRequest, ctx=Depends(workspace)):
    return {'customers': customer_insights([r.model_dump() for r in data.customers])}

@app.post('/api/agents/run')
def workflow(data: WorkflowRequest, ctx=Depends(editor)):
    try:
        result = build_graph().invoke(data.model_dump())
        return {'organization_id': ctx['organization_id'], 'result': result, 'ai_mode': 'live' if os.getenv('OPENAI_API_KEY') else 'demo-template'}
    except Exception:
        logging.exception('Marketing workflow failed')
        raise HTTPException(502, 'Workflow failed. Review server logs and provider configuration.')

@app.get('/api/dashboard/overview')
@app.get('/api/dashboard/analytics')
async def dashboard(ctx=Depends(workspace)):
    async with httpx.AsyncClient(timeout=15) as client:
        response = await client.get(os.environ['SUPABASE_URL'] + '/rest/v1/workspace_state', params={'organization_id': 'eq.' + ctx['organization_id'], 'select': 'data'}, headers=ctx['headers'])
        response.raise_for_status()
        rows = response.json()
        data = rows[0]['data'] if rows else {}
        campaigns = data.get('campaigns', [])
        totals = {key: sum(c.get(key, 0) for c in campaigns) for key in ['impressions', 'clicks', 'conversions', 'revenue', 'budget']}
        return {'campaigns': len(campaigns), 'customers': len(data.get('customers', [])), **totals}

RESOURCES = {'customers', 'products', 'campaigns'}

async def state_read(ctx):
    async with httpx.AsyncClient(timeout=15) as client:
        result = await client.get(os.environ['SUPABASE_URL'] + '/rest/v1/workspace_state', params={'organization_id': 'eq.' + ctx['organization_id'], 'select': 'data'}, headers=ctx['headers'])
        if result.status_code != 200:
            raise HTTPException(502, 'Database read failed')
        rows = result.json()
        return rows[0]['data'] if rows else {}

async def state_write(ctx, state):
    async with httpx.AsyncClient(timeout=15) as client:
        response = await client.post(os.environ['SUPABASE_URL'] + '/rest/v1/workspace_state?on_conflict=organization_id', headers={**ctx['headers'], 'Prefer': 'resolution=merge-duplicates'}, json={'organization_id': ctx['organization_id'], 'data': state})
        if response.status_code not in (200, 201):
            raise HTTPException(502, 'Database write failed')

@app.get('/api/{resource}')
async def list_records(resource: str, ctx=Depends(workspace)):
    if resource not in RESOURCES:
        raise HTTPException(404, 'Unknown resource')
    return (await state_read(ctx)).get(resource, [])

@app.post('/api/{resource}')
async def create_record(resource: str, body: dict, ctx=Depends(editor)):
    import uuid
    if resource not in RESOURCES or not body.get('name'):
        raise HTTPException(422, 'Valid resource and name required')
    state = await state_read(ctx)
    record = {**body, 'id': str(uuid.uuid4())}
    state[resource] = [record, *state.get(resource, [])]
    await state_write(ctx, state)
    return record

@app.put('/api/{resource}/{record_id}')
async def update_record(resource: str, record_id: str, body: dict, ctx=Depends(editor)):
    if resource not in RESOURCES:
        raise HTTPException(404, 'Unknown resource')
    state = await state_read(ctx)
    records = state.get(resource, [])
    if not any(r['id'] == record_id for r in records):
        raise HTTPException(404, 'Record not found')
    state[resource] = [{**r, **body, 'id': record_id} if r['id'] == record_id else r for r in records]
    await state_write(ctx, state)
    return next(r for r in state[resource] if r['id'] == record_id)

@app.delete('/api/{resource}/{record_id}')
async def delete_record(resource: str, record_id: str, ctx=Depends(editor)):
    if resource not in RESOURCES:
        raise HTTPException(404, 'Unknown resource')
    state = await state_read(ctx)
    state[resource] = [r for r in state.get(resource, []) if r['id'] != record_id]
    await state_write(ctx, state)
    return {'deleted': record_id}
