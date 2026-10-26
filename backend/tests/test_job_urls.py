from concurrent.futures import ThreadPoolExecutor
from threading import Barrier

import pytest

from database import get_connection
from job_identity import normalize_url
from routes import jobs


def save_job(client, url=None):
    return client.post(
        "/api/jobs",
        json={
            "title": "Developer",
            "company": "Example AB",
            "notes": "Keep my note",
            "preferred_url": url,
        },
    )


def test_posting_url_and_comparison_key_are_stored_separately(client):
    url = "https://example.com/job?id=1&utm_source=email#details"
    response = save_job(client, url)

    assert response.status_code == 201
    job = response.json()
    assert job["preferred_url"] == url
    with get_connection() as connection:
        identifier = connection.execute(
            "SELECT namespace, value FROM job_identifiers WHERE job_id = %s",
            (job["id"],),
        ).fetchone()
    assert identifier == {
        "namespace": "normalized-url",
        "value": "https://example.com/job?id=1",
    }


def test_duplicate_url_preserves_existing_job_and_decisions(client):
    first = save_job(client, "https://example.com/job?id=1")
    assert first.status_code == 201
    path = f"/api/jobs/{first.json()['id']}"
    edited = client.patch(
        path, json={"review_status": "interested", "application_status": "applied"}
    )
    assert edited.status_code == 200
    before_duplicate = client.get(path).json()

    duplicate = client.post(
        "/api/jobs",
        json={
            "title": "Replacement title",
            "company": "Another company",
            "notes": "Replace this",
            "preferred_url": "https://EXAMPLE.com:443/job?id=1&utm_medium=x#top",
        },
    )

    assert duplicate.status_code == 409
    assert duplicate.json()["detail"]["job_id"] == first.json()["id"]
    assert client.get(path).json() == before_duplicate
    assert client.get("/api/jobs").json()["total"] == 1


def test_same_title_with_different_job_urls_stays_separate(client):
    first = save_job(client, "https://example.com/job?id=1")
    second = save_job(client, "https://example.com/job?id=2")

    assert first.status_code == second.status_code == 201
    assert first.json()["id"] != second.json()["id"]


def test_jobs_without_urls_are_not_merged(client):
    first = save_job(client)
    second = save_job(client)

    assert first.status_code == second.status_code == 201
    assert first.json()["id"] != second.json()["id"]


@pytest.mark.parametrize(
    "url",
    [
        "javascript:alert(1)",
        "file:///tmp/job",
        "/relative/job",
        "https://user:password@example.com/job",
        "https://example.com:99999/job",
        "https://example.com/a\nb",
        "https://example.com/a b",
        "https://example.com\\job",
        "https://example.com/" + "x" * 2048,
        "https://example.com/" + "é" * 1100,
    ],
)
def test_invalid_posting_url_is_rejected_without_saving(client, url):
    response = save_job(client, url)

    assert response.status_code == 422
    assert client.get("/api/jobs").json()["total"] == 0


def test_simultaneous_duplicate_urls_do_not_leave_an_extra_job(client, monkeypatch):
    barrier = Barrier(2)

    def normalize_together(url):
        normalized_url = normalize_url(url)
        barrier.wait(timeout=10)
        return normalized_url

    monkeypatch.setattr(jobs, "normalize_url", normalize_together)

    def submit():
        return save_job(client, "https://example.com/concurrent")

    with ThreadPoolExecutor(max_workers=2) as executor:
        first = executor.submit(submit)
        second = executor.submit(submit)
        responses = [first.result(timeout=15), second.result(timeout=15)]

    assert sorted(response.status_code for response in responses) == [201, 409]
    assert client.get("/api/jobs").json()["total"] == 1
    with get_connection() as connection:
        total = connection.execute(
            "SELECT count(*) AS total FROM job_identifiers"
        ).fetchone()
    assert total["total"] == 1
