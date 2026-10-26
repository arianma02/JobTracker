import psycopg
import pytest

from database import get_connection
from routes import jobs


def create_job(client):
    response = client.post(
        "/api/jobs",
        json={"title": "Developer", "company": "Example AB", "notes": "Keep this note"},
    )
    assert response.status_code == 201
    return response.json()


def test_notes_update_is_persisted_without_changing_encounter_times(client):
    job = create_job(client)
    path = f"/api/jobs/{job['id']}"

    # A fixed old edit time avoids relying on a delay between API requests.
    with get_connection() as connection:
        connection.execute(
            "UPDATE jobs SET updated_at = %s WHERE id = %s",
            ("2000-01-01T00:00:00Z", job["id"]),
        )
    before_update = client.get(path).json()

    response = client.patch(path, json={"notes": "  Updated note  "})

    assert response.status_code == 200
    updated_job = response.json()
    assert updated_job["notes"] == "  Updated note  "
    assert updated_job["updated_at"] != before_update["updated_at"]
    for field in (
        "id",
        "title",
        "company",
        "location",
        "preferred_url",
        "source",
        "review_status",
        "application_status",
        "created_at",
        "first_seen_at",
        "last_seen_at",
    ):
        assert updated_job[field] == before_update[field]
    assert client.get(path).json() == updated_job


def test_notes_can_be_cleared(client):
    job = create_job(client)
    path = f"/api/jobs/{job['id']}"

    response = client.patch(path, json={"notes": None})

    assert response.status_code == 200
    assert client.get(path).json()["notes"] is None


@pytest.mark.parametrize(
    "field, status",
    [
        ("review_status", "to_review"),
        ("review_status", "interested"),
        ("review_status", "not_interested"),
        ("application_status", "not_applied"),
        ("application_status", "applied"),
        ("application_status", "interviewing"),
        ("application_status", "offer"),
        ("application_status", "rejected"),
        ("application_status", "withdrawn"),
    ],
)
def test_each_status_can_be_updated_independently(client, field, status):
    job = create_job(client)
    path = f"/api/jobs/{job['id']}"

    response = client.patch(path, json={field: status})

    assert response.status_code == 200
    stored_job = client.get(path).json()
    assert stored_job[field] == status
    assert stored_job["notes"] == job["notes"]
    if field == "review_status":
        assert stored_job["application_status"] == job["application_status"]
    else:
        assert stored_job["review_status"] == job["review_status"]


def test_notes_and_both_statuses_can_be_updated_together(client):
    job = create_job(client)
    changes = {
        "notes": "Application submitted",
        "review_status": "interested",
        "application_status": "applied",
    }

    response = client.patch(f"/api/jobs/{job['id']}", json=changes)

    assert response.status_code == 200
    for field, value in changes.items():
        assert response.json()[field] == value


@pytest.mark.parametrize(
    "changes",
    [
        {"review_status": "applied"},
        {"application_status": "interested"},
        {"review_status": None},
        {"application_status": None},
        {"notes": "x" * 20001},
        {"title": "Unsupported change"},
        {"notes": "Must not be saved", "review_status": "invalid"},
        {},
    ],
)
def test_invalid_changes_leave_the_job_unchanged(client, changes):
    job = create_job(client)
    path = f"/api/jobs/{job['id']}"

    response = client.patch(path, json=changes)

    assert response.status_code == 422
    assert client.get(path).json() == job


def test_update_missing_job_returns_404(client):
    response = client.patch(
        "/api/jobs/00000000-0000-0000-0000-000000000001", json={"notes": "New note"}
    )

    assert response.status_code == 404
    assert response.json() == {"detail": "Job not found"}


def test_update_malformed_id_is_rejected(client):
    response = client.patch("/api/jobs/not-a-uuid", json={"notes": "New note"})

    assert response.status_code == 422


def test_update_when_database_is_unavailable(client, monkeypatch):
    def unavailable_connection():
        raise psycopg.OperationalError("Synthetic connection failure")

    monkeypatch.setattr(jobs, "get_connection", unavailable_connection)

    response = client.patch(
        "/api/jobs/00000000-0000-0000-0000-000000000001", json={"notes": "New note"}
    )

    assert response.status_code == 503
    assert response.json() == {"detail": "Database unavailable"}
