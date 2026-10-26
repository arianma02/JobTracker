from uuid import UUID

import psycopg
from fastapi import APIRouter, HTTPException, Query

from database import get_connection
from job_identity import find_job_by_url, normalize_url
from schemas import ApplicationStatus, JobCreate, JobPatch, ReviewStatus

router = APIRouter()


@router.post("/api/jobs", status_code=201)
def create_job(job: JobCreate):
    normalized_url = None
    if job.preferred_url is not None:
        normalized_url = normalize_url(job.preferred_url)

    try:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    INSERT INTO jobs (title, company, location, notes, preferred_url)
                    VALUES (%s, %s, %s, %s, %s)
                    RETURNING *
                    """,
                    (job.title, job.company, job.location, job.notes, job.preferred_url),
                )
                created_job = cursor.fetchone()

                if normalized_url is not None:
                    cursor.execute(
                        """
                        INSERT INTO job_identifiers (job_id, namespace, value)
                        VALUES (%s, 'normalized-url', %s)
                        ON CONFLICT (namespace, value) DO NOTHING
                        RETURNING job_id
                        """,
                        (created_job["id"], normalized_url),
                    )
                    identifier = cursor.fetchone()
                    if identifier is None:
                        # Undo the new job too; the URL already belongs to another job.
                        connection.rollback()
                        existing_job = find_job_by_url(cursor, normalized_url)
                        if existing_job is None:
                            raise HTTPException(status_code=409, detail="Job changed while saving; retry")
                        raise HTTPException(
                            status_code=409,
                            detail={
                                "message": "Job already recorded",
                                "job_id": str(existing_job["id"]),
                            },
                        )
        # The connection's context commits successfully before we report creation.
    except psycopg.OperationalError:
        raise HTTPException(status_code=503, detail="Database unavailable") from None

    return created_job


@router.get("/api/jobs")
def list_jobs(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0, le=100000),
    q: str | None = Query(default=None, max_length=200),
    review_status: ReviewStatus | None = None,
    application_status: ApplicationStatus | None = None,
):
    conditions = []
    parameters = []

    if q:
        search_text = q.strip()
        if search_text:
            # Substring search treats percent signs and underscores literally.
            conditions.append(
                """
                (strpos(lower(title), lower(%s)) > 0
                 OR strpos(lower(company), lower(%s)) > 0
                 OR strpos(lower(notes), lower(%s)) > 0)
                """
            )
            parameters.extend([search_text, search_text, search_text])

    if review_status is not None:
        conditions.append("review_status = %s")
        parameters.append(review_status)

    if application_status is not None:
        conditions.append("application_status = %s")
        parameters.append(application_status)

    where_clause = ""
    if conditions:
        # These conditions are fixed SQL; user values stay in parameters.
        where_clause = " WHERE " + " AND ".join(conditions)

    try:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                count_sql = "SELECT count(*) AS total FROM jobs" + where_clause
                cursor.execute(count_sql, parameters)
                total = cursor.fetchone()["total"]

                # The ID breaks timestamp ties so the ordering is deterministic.
                list_sql = (
                    "SELECT * FROM jobs"
                    + where_clause
                    + " ORDER BY first_seen_at DESC, id DESC LIMIT %s OFFSET %s"
                )
                cursor.execute(list_sql, parameters + [limit, offset])
                jobs = cursor.fetchall()
    except psycopg.OperationalError:
        raise HTTPException(status_code=503, detail="Database unavailable") from None

    return {"items": jobs, "total": total, "limit": limit, "offset": offset}


@router.get("/api/jobs/{job_id}")
def get_job(job_id: UUID):
    try:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute("SELECT * FROM jobs WHERE id = %s", (job_id,))
                job = cursor.fetchone()
    except psycopg.OperationalError:
        raise HTTPException(status_code=503, detail="Database unavailable") from None

    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")

    return job


@router.patch("/api/jobs/{job_id}")
def update_job(job_id: UUID, job: JobPatch):
    changes = job.model_dump(exclude_unset=True)
    if not changes:
        raise HTTPException(status_code=422, detail="Provide notes or a status to update")

    try:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                # Keep the row locked until this transaction finishes its update.
                cursor.execute("SELECT * FROM jobs WHERE id = %s FOR UPDATE", (job_id,))
                current_job = cursor.fetchone()
                if current_job is None:
                    raise HTTPException(status_code=404, detail="Job not found")

                notes = current_job["notes"]
                review_status = current_job["review_status"]
                application_status = current_job["application_status"]

                if "notes" in changes:
                    notes = changes["notes"]
                if "review_status" in changes:
                    review_status = changes["review_status"]
                if "application_status" in changes:
                    application_status = changes["application_status"]

                cursor.execute(
                    """
                    UPDATE jobs
                    SET notes = %s,
                        review_status = %s,
                        application_status = %s,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = %s
                    RETURNING *
                    """,
                    (notes, review_status, application_status, job_id),
                )
                updated_job = cursor.fetchone()
    except psycopg.OperationalError:
        raise HTTPException(status_code=503, detail="Database unavailable") from None

    return updated_job
