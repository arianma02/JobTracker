from fastapi.testclient import TestClient

from main import app


def test_database_health_with_postgres(monkeypatch):
    test_url = (
        "postgresql://jobtrack_test:local_test_only@127.0.0.1:55433/jobtrack_test"
    )

    # Use the disposable test database even if development settings are present.
    monkeypatch.setenv("JOBTRACK_DATABASE_URL", test_url)

    with TestClient(app) as client:
        response = client.get("/api/health/database")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
