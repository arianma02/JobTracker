import psycopg
from fastapi.testclient import TestClient

import main
from main import app


def test_health_endpoint():
    # Call the app through HTTP handling without starting a separate server.
    with TestClient(app) as client:
        response = client.get("/api/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_database_unavailable(monkeypatch):
    def unavailable_connection():
        raise psycopg.OperationalError("Synthetic connection failure")

    monkeypatch.setattr(main, "get_connection", unavailable_connection)

    with TestClient(app) as client:
        response = client.get("/api/health/database")

    assert response.status_code == 503
    assert response.json() == {"detail": "Database unavailable"}
