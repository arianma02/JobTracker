import psycopg
import pytest

from database import get_connection
from routes import jobs


def test_retrieve_a_created_job(client):
    created_response = client.post(
        "/api/jobs",
        json={
            "title": "Python developer",
            "company": "Example AB",
            "notes": "Hi",
        },
    )
    assert created_response.status_code == 201
    created_job = created_response.json()

    response = client.get(f"/api/jobs/{created_job['id']}")

    assert response.status_code == 200
    assert response.json() == created_job


def test_missing_job_returns_404(client):
    response = client.get("/api/jobs/00000000-0000-0000-0000-000000000001")

    assert response.status_code == 404
    assert response.json() == {"detail": "Job not found"}


def test_malformed_job_id_is_rejected(client):
    response = client.get("/api/jobs/not-a-uuid")

    assert response.status_code == 422


def test_empty_job_list(client):
    response = client.get("/api/jobs")

    assert response.status_code == 200
    assert response.json() == {"items": [], "total": 0, "limit": 20, "offset": 0}


def test_job_list_order_and_pagination(client):
    # Fixed IDs and dates test the tie-breaker without depending on execution speed.
    jobs = [
        ("00000000-0000-0000-0000-000000000001", "Older", "2026-01-01T00:00:00Z"),
        (
            "00000000-0000-0000-0000-000000000002",
            "Newer lower ID",
            "2026-02-01T00:00:00Z",
        ),
        (
            "00000000-0000-0000-0000-000000000003",
            "Newer higher ID",
            "2026-02-01T00:00:00Z",
        ),
    ]
    with get_connection() as connection:
        for job_id, title, first_seen_at in jobs:
            connection.execute(
                """
                INSERT INTO jobs (id, title, company, first_seen_at)
                VALUES (%s, %s, %s, %s)
                """,
                (job_id, title, "Example AB", first_seen_at),
            )

    first_response = client.get("/api/jobs?limit=2&offset=0")
    second_response = client.get("/api/jobs?limit=2&offset=2")

    assert first_response.status_code == 200
    assert second_response.status_code == 200
    first_page = first_response.json()
    second_page = second_response.json()

    assert first_page["total"] == second_page["total"] == 3
    assert first_page["limit"] == second_page["limit"] == 2
    assert first_page["offset"] == 0
    assert second_page["offset"] == 2
    assert len(first_page["items"]) == 2
    assert first_page["items"][0]["title"] == "Newer higher ID"
    assert first_page["items"][1]["title"] == "Newer lower ID"
    assert len(second_page["items"]) == 1
    assert second_page["items"][0]["title"] == "Older"


def test_offset_beyond_last_job_returns_empty_page(client):
    client.post("/api/jobs", json={"title": "Developer", "company": "Example AB"})

    response = client.get("/api/jobs?offset=10")

    assert response.status_code == 200
    assert response.json() == {"items": [], "total": 1, "limit": 20, "offset": 10}


@pytest.mark.parametrize(
    "parameters",
    [
        {"limit": 0},
        {"limit": 101},
        {"limit": "abc"},
        {"offset": -1},
        {"offset": 100001},
    ],
)
def test_invalid_pagination_is_rejected(client, parameters):
    response = client.get("/api/jobs", params=parameters)

    assert response.status_code == 422


@pytest.mark.parametrize(
    "path",
    ["/api/jobs", "/api/jobs/00000000-0000-0000-0000-000000000001"],
)
def test_reading_jobs_when_database_is_unavailable(client, monkeypatch, path):
    def unavailable_connection():
        raise psycopg.OperationalError("Synthetic connection failure")

    monkeypatch.setattr(jobs, "get_connection", unavailable_connection)

    response = client.get(path)

    assert response.status_code == 503
    assert response.json() == {"detail": "Database unavailable"}
