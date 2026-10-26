def record_job(
    client, title, application_status="not_applied", review_status="to_review"
):
    created = client.post("/api/jobs", json={"title": title, "company": "Example AB"})
    assert created.status_code == 201
    updated = client.patch(
        f"/api/jobs/{created.json()['id']}",
        json={"application_status": application_status, "review_status": review_status},
    )
    assert updated.status_code == 200
    return updated.json()


def test_applications_include_all_progress_statuses_regardless_of_review(client):
    record_job(client, "Not applied yet")
    expected_ids = set()
    for status in ["applied", "interviewing", "offer", "rejected", "withdrawn"]:
        job = record_job(client, f"Role {status}", status, "not_interested")
        expected_ids.add(job["id"])

    response = client.get("/api/jobs", params={"applications_only": True})

    assert response.status_code == 200
    page = response.json()
    assert page["total"] == 5
    assert {job["id"] for job in page["items"]} == expected_ids
    assert client.get("/api/jobs").json()["total"] == 6


def test_false_applications_filter_keeps_unapplied_jobs(client):
    record_job(client, "Unapplied")
    record_job(client, "Applied", "applied")

    response = client.get("/api/jobs", params={"applications_only": False})

    assert response.status_code == 200
    assert response.json()["total"] == 2


def test_applications_filter_combines_with_text_and_both_status_filters(client):
    matching = record_job(client, "Python developer", "rejected", "interested")
    record_job(client, "Python not applied", "not_applied", "interested")
    record_job(client, "Python different review", "rejected", "not_interested")
    record_job(client, "Java developer", "rejected", "interested")
    record_job(client, "Python applied", "applied", "interested")

    response = client.get(
        "/api/jobs",
        params={
            "applications_only": True,
            "q": "python",
            "review_status": "interested",
            "application_status": "rejected",
        },
    )

    assert response.status_code == 200
    assert response.json()["total"] == 1
    assert response.json()["items"][0]["id"] == matching["id"]


def test_applications_are_filtered_before_counting_and_pagination(client):
    first = record_job(client, "First application", "applied")
    record_job(client, "Not applied")
    second = record_job(client, "Second application", "interviewing")
    record_job(client, "Newest unapplied job")

    first_page = client.get(
        "/api/jobs", params={"applications_only": True, "limit": 1}
    ).json()
    second_page = client.get(
        "/api/jobs", params={"applications_only": True, "limit": 1, "offset": 1}
    ).json()
    empty_page = client.get(
        "/api/jobs", params={"applications_only": True, "offset": 2}
    ).json()

    assert first_page["total"] == second_page["total"] == empty_page["total"] == 2
    assert first_page["items"][0]["id"] == second["id"]
    assert second_page["items"][0]["id"] == first["id"]
    assert empty_page["items"] == []


def test_returning_to_not_applied_removes_application_without_deleting_job(client):
    job = record_job(client, "Developer", "applied", "interested")
    response = client.patch(
        f"/api/jobs/{job['id']}", json={"application_status": "not_applied"}
    )
    assert response.status_code == 200

    applications = client.get("/api/jobs", params={"applications_only": True}).json()
    saved_job = client.get(f"/api/jobs/{job['id']}")

    assert applications["total"] == 0
    assert applications["items"] == []
    assert saved_job.status_code == 200
    assert saved_job.json()["review_status"] == "interested"


def test_not_applied_status_cannot_match_applications_only(client):
    record_job(client, "Unapplied")

    response = client.get(
        "/api/jobs",
        params={"applications_only": True, "application_status": "not_applied"},
    )

    assert response.status_code == 200
    assert response.json()["total"] == 0
    assert response.json()["items"] == []


def test_invalid_applications_flag_is_rejected(client):
    response = client.get("/api/jobs", params={"applications_only": "perhaps"})

    assert response.status_code == 422
