import psycopg
import pytest


def test_new_job_defaults(database_connection):
    with database_connection.cursor() as cursor:
        cursor.execute(
            "INSERT INTO jobs (title, company) VALUES (%s, %s) RETURNING *",
            ("Python developer", "Example AB"),
        )
        job = cursor.fetchone()

    assert job["id"] is not None
    assert job["source"] == "manual"
    assert job["review_status"] == "to_review"
    assert job["application_status"] == "not_applied"
    assert job["notes"] is None
    assert job["first_seen_at"].utcoffset().total_seconds() == 0


@pytest.mark.parametrize("title, company", [(" ", "Example AB"), ("Developer", " ")])
def test_blank_required_fields_are_rejected(database_connection, title, company):
    with pytest.raises(psycopg.errors.CheckViolation):
        with database_connection.cursor() as cursor:
            cursor.execute(
                "INSERT INTO jobs (title, company) VALUES (%s, %s)",
                (title, company),
            )


@pytest.mark.parametrize(
    "review_status, application_status",
    [("applied", "not_applied"), ("to_review", "interested")],
)
def test_statuses_cannot_use_each_others_values(
    database_connection, review_status, application_status
):
    with pytest.raises(psycopg.errors.CheckViolation):
        with database_connection.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO jobs (title, company, review_status, application_status)
                VALUES (%s, %s, %s, %s)
                """,
                ("Python developer", "Example AB", review_status, application_status),
            )


def test_review_and_application_statuses_are_independent(database_connection):
    with database_connection.cursor() as cursor:
        cursor.execute(
            """
            INSERT INTO jobs (title, company, review_status, application_status)
            VALUES (%s, %s, %s, %s)
            RETURNING review_status, application_status
            """,
            ("Python developer", "Example AB", "interested", "rejected"),
        )
        job = cursor.fetchone()

    assert job == {"review_status": "interested", "application_status": "rejected"}


def test_oversized_notes_are_rejected(database_connection):
    with pytest.raises(psycopg.errors.CheckViolation):
        with database_connection.cursor() as cursor:
            cursor.execute(
                "INSERT INTO jobs (title, company, notes) VALUES (%s, %s, %s)",
                ("Python developer", "Example AB", "x" * 20001),
            )
