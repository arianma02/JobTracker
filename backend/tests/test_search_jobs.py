import pytest


def create_job(client, title, company="Example AB", notes=None):
    response = client.post(
        "/api/jobs", json={"title": title, "company": company, "notes": notes}
    )
    assert response.status_code == 201
    return response.json()


@pytest.mark.parametrize("field", ["title", "company", "notes"])
def test_text_search_checks_each_field_without_case_sensitivity(client, field):
    data = {"title": "Developer", "company": "Example AB", "notes": None}
    data[field] = "PyThOn opportunity"
    created = client.post("/api/jobs", json=data)
    assert created.status_code == 201
    create_job(client, "Unrelated job")

    response = client.get("/api/jobs", params={"q": "  python  "})

    assert response.status_code == 200
    page = response.json()
    assert page["total"] == 1
    assert len(page["items"]) == 1
    assert page["items"][0]["id"] == created.json()["id"]


@pytest.mark.parametrize("query", ["%", "_", "\\", "' OR true --"])
def test_search_treats_special_characters_as_text(client, query):
    matching_job = create_job(client, f"Role {query} opportunity")
    create_job(client, "Other role")

    response = client.get("/api/jobs", params={"q": query})

    assert response.status_code == 200
    page = response.json()
    assert page["total"] == 1
    assert page["items"][0]["id"] == matching_job["id"]


def test_blank_search_returns_all_jobs(client):
    create_job(client, "Python developer")
    create_job(client, "Java developer")

    response = client.get("/api/jobs", params={"q": " \t "})

    assert response.status_code == 200
    assert response.json()["total"] == 2


def test_search_with_no_matches_returns_empty_page(client):
    create_job(client, "Python developer")

    response = client.get("/api/jobs", params={"q": "Unrelated"})

    assert response.status_code == 200
    assert response.json() == {"items": [], "total": 0, "limit": 20, "offset": 0}


def test_review_status_filter(client):
    interested_job = create_job(client, "Python developer")
    create_job(client, "Java developer")
    changed = client.patch(
        f"/api/jobs/{interested_job['id']}", json={"review_status": "interested"}
    )
    assert changed.status_code == 200

    response = client.get("/api/jobs", params={"review_status": "interested"})

    assert response.status_code == 200
    assert response.json()["total"] == 1
    assert response.json()["items"][0]["id"] == interested_job["id"]


def test_application_status_filter(client):
    applied_job = create_job(client, "Python developer")
    create_job(client, "Java developer")
    changed = client.patch(
        f"/api/jobs/{applied_job['id']}", json={"application_status": "applied"}
    )
    assert changed.status_code == 200

    response = client.get("/api/jobs", params={"application_status": "applied"})

    assert response.status_code == 200
    assert response.json()["total"] == 1
    assert response.json()["items"][0]["id"] == applied_job["id"]


def test_text_and_both_status_filters_must_all_match(client):
    matching_job = create_job(client, "Python developer")
    create_job(client, "Python still to review")
    already_applied = create_job(client, "Python already applied")
    different_title = create_job(client, "Java developer")

    changes = [
        (matching_job["id"], {"review_status": "interested"}),
        (already_applied["id"], {"review_status": "interested", "application_status": "applied"}),
        (different_title["id"], {"review_status": "interested"}),
    ]
    for job_id, fields in changes:
        assert client.patch(f"/api/jobs/{job_id}", json=fields).status_code == 200

    response = client.get(
        "/api/jobs",
        params={"q": "python", "review_status": "interested", "application_status": "not_applied"},
    )

    assert response.status_code == 200
    page = response.json()
    assert page["total"] == 1
    assert len(page["items"]) == 1
    assert page["items"][0]["id"] == matching_job["id"]


def test_filtered_total_is_independent_of_page_size_and_offset(client):
    first_match = create_job(client, "Python developer")
    create_job(client, "Java developer")
    second_match = create_job(client, "Python tester")

    first_response = client.get("/api/jobs", params={"q": "python", "limit": 1, "offset": 0})
    second_response = client.get("/api/jobs", params={"q": "python", "limit": 1, "offset": 1})

    assert first_response.status_code == second_response.status_code == 200
    first_page = first_response.json()
    second_page = second_response.json()
    assert first_page["total"] == second_page["total"] == 2
    assert len(first_page["items"]) == len(second_page["items"]) == 1
    assert {first_page["items"][0]["id"], second_page["items"][0]["id"]} == {
        first_match["id"], second_match["id"]
    }

    empty_page = client.get("/api/jobs", params={"q": "python", "offset": 2}).json()
    assert empty_page["items"] == []
    assert empty_page["total"] == 2


@pytest.mark.parametrize(
    "parameters",
    [{"q": "x" * 201}, {"review_status": "applied"}, {"application_status": "interested"}],
)
def test_invalid_search_parameters_are_rejected(client, parameters):
    response = client.get("/api/jobs", params=parameters)

    assert response.status_code == 422
