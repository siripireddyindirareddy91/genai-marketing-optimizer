import pytest
from fastapi.testclient import TestClient
from app.ml import train, predict, segment
from app.agents import build_graph
from app.main import app

def observations():
    return [dict(id=str(i), engagement=(i * 17) % 100, visits=(i * 7) % 80, purchases=i % 20, recency=(i * 11) % 180, spending=i * 37, converted=int((i * 17) % 100 > 50)) for i in range(160)]

def test_training_and_holdout():
    pipeline, evaluation = train(observations())
    assert evaluation['train_size'] == 120
    assert evaluation['test_size'] == 40
    assert 0 <= evaluation['roc_auc'] <= 1
    assert 0 <= predict(pipeline, observations()[0])['probability'] <= 1

def test_random_forest():
    pipeline, evaluation = train(observations(), 'random_forest')
    assert len(predict(pipeline, observations()[0])['features']) == 5

def test_invalid_training():
    with pytest.raises(ValueError):
        train(observations()[:3])
    with pytest.raises(ValueError):
        train([{**r, 'converted': 1} for r in observations()])

def test_segmentation():
    result = segment(observations(), 4)
    assert len(result) == 160
    assert len(set(r['cluster'] for r in result)) == 4

def test_agent_workflow_requires_human_review(monkeypatch):
    monkeypatch.delenv('OPENAI_API_KEY', raising=False)
    result = build_graph().invoke(dict(business='Example', product='Watch', customers=observations()[:20], campaigns=[], approved=False))
    assert len(result['trace']) == 8
    assert result['approval']['published'] is False
    assert result['approval']['status'] == 'pending_human_approval'
    assert 'DEMO TEMPLATE' in result['content']

def test_health_and_auth_boundary(monkeypatch):
    monkeypatch.delenv('SUPABASE_URL', raising=False)
    client = TestClient(app)
    assert client.get('/health').status_code == 200
    assert client.get('/api/customers').status_code == 503
    monkeypatch.setenv('SUPABASE_URL', 'https://example.supabase.co')
    monkeypatch.setenv('SUPABASE_ANON_KEY', 'placeholder')
    assert client.get('/api/customers').status_code == 401
