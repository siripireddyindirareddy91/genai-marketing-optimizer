"""Train on explicitly supplied labels; no synthetic evaluation is presented as real."""
from typing import Literal
import numpy as np
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, roc_auc_score

FEATURES = ['engagement', 'visits', 'purchases', 'recency', 'spending']

def matrix(rows):
    return np.array([[float(row.get(k, 0)) for k in FEATURES] for row in rows])

def segment(rows, clusters=7):
    if len(rows) < 2:
        raise ValueError('At least two customers are required')
    x = StandardScaler().fit_transform(matrix(rows))
    labels = KMeans(n_clusters=min(clusters, len(rows)), random_state=42, n_init=10).fit_predict(x)
    return [{'id': row['id'], 'cluster': int(label), 'segment': f'Cluster {label + 1}'} for row, label in zip(rows, labels)]

def train(rows, model_name: Literal['logistic', 'random_forest'] = 'logistic'):
    if len(rows) < 40:
        raise ValueError('Provide at least 40 labeled historical observations')
    y = np.array([int(row['converted']) for row in rows])
    values, counts = np.unique(y, return_counts=True)
    if len(values) != 2 or min(counts) < 10 or not set(values).issubset({0, 1}):
        raise ValueError('Provide binary converted labels with at least 10 examples per class')
    x_train, x_test, y_train, y_test = train_test_split(matrix(rows), y, test_size=.25, stratify=y, random_state=42)
    classifier = LogisticRegression(max_iter=1000, random_state=42) if model_name == 'logistic' else RandomForestClassifier(n_estimators=100, max_depth=6, random_state=42)
    pipeline = Pipeline([('scale', StandardScaler()), ('model', classifier)])
    pipeline.fit(x_train, y_train)
    predicted = pipeline.predict(x_test)
    probability = pipeline.predict_proba(x_test)[:, 1]
    evaluation = dict(accuracy=accuracy_score(y_test, predicted), precision=precision_score(y_test, predicted, zero_division=0), recall=recall_score(y_test, predicted, zero_division=0), f1=f1_score(y_test, predicted, zero_division=0), roc_auc=roc_auc_score(y_test, probability), train_size=len(y_train), test_size=len(y_test))
    return pipeline, evaluation

def predict(pipeline, row):
    probability = float(pipeline.predict_proba(matrix([row]))[0, 1])
    classifier = pipeline.named_steps['model']
    importances = classifier.coef_[0] if hasattr(classifier, 'coef_') else classifier.feature_importances_
    return {'probability': probability, 'classification': 'High' if probability > .65 else 'Medium' if probability > .35 else 'Low', 'features': dict(zip(FEATURES, map(float, importances))), 'disclaimer': 'Estimated probability, not a guarantee. Validate against future observations.'}

def customer_insights(rows):
    return [{'id': r['id'], 'churn_risk_heuristic': round(min(1, max(0, float(r.get('recency', 0)) / 180 * (1 - float(r.get('engagement', 0)) / 200))), 3), 'historical_value': float(r.get('spending', 0)), 'annualized_value_estimate': round(float(r.get('spending', 0)) * 12 / max(1, float(r.get('observed_months', 12))), 2), 'method': 'Untrained recency/engagement heuristic; annualized historical spending, not a learned CLV forecast'} for r in rows]
