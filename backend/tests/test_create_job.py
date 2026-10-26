import psycopg
import pytest

from database import get_connection
from routes import jobs


def test_create_job_is_persisted(client):
    response = client.post(
        "/api/jobs",
        json={
            "title": "  Python developer  ",
            "company": "O'Example AB",
            "location": "  Stockholm  ",
            "notes": "  Keep my note spacing.  ",
        },
    )

    assert response.status_code == 201
    job = response.json()
    assert job["title"] == "Python developer"
    assert job["location"] == "Stockholm"
    assert job["review_status"] == "to_review"
    assert job["application_status"] == "not_applied"

    # Read using another connection to verify that the API committed the insert.
    with get_connection() as connection:
        stored_job = connection.execute(
            "SELECT * FROM jobs WHERE id = %s", (job["id"],)
        ).fetchone()

    assert stored_job["company"] == "O'Example AB"
    assert stored_job["notes"] == "  Keep my note spacing.  "


def test_create_job_with_only_required_fields(client):
    response = client.post(
        "/api/jobs", json={"title": "Developer", "company": "Example AB"}
    )

    assert response.status_code == 201
    assert response.json()["location"] is None
    assert response.json()["notes"] is None


@pytest.mark.parametrize(
    "invalid_field",
    [
        {"title": " \t "},
        {"company": " "},
        {"title": "x" * 301},
        {"company": "x" * 201},
        {"location": "x" * 201},
        {"notes": "x" * 20001},
        {"unexpected_field": "value"},
    ],
)
def test_invalid_input_does_not_create_job(client, invalid_field):
    data = {"title": "Developer", "company": "Example AB"}
    data.update(invalid_field)

    response = client.post("/api/jobs", json=data)

    assert response.status_code == 422
    with get_connection() as connection:
        result = connection.execute("SELECT count(*) AS total FROM jobs").fetchone()
    assert result["total"] == 0


def test_create_job_requires_title(client):
    response = client.post("/api/jobs", json={"company": "Example AB"})

    assert response.status_code == 422


def test_create_job_when_database_is_unavailable(client, monkeypatch):
    def unavailable_connection():
        raise psycopg.OperationalError("Synthetic connection failure")

    monkeypatch.setattr(jobs, "get_connection", unavailable_connection)

    response = client.post(
        "/api/jobs", json={"title": "Developer", "company": "Example AB"}
    )

    assert response.status_code == 503
    assert response.json() == {"detail": "Database unavailable"}
