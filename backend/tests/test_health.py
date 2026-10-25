from fastapi.testclient import TestClient

from main import app


def test_health_endpoint():
    # Call the app through HTTP handling without starting a separate server.
    with TestClient(app) as client:
        response = client.get("/api/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
