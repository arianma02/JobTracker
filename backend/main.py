from typing import Literal
from uuid import UUID

import psycopg
from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field, field_validator

from database import get_connection

app = FastAPI(title="JobTrack", version="0.1.0")


class JobCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str = Field(min_length=1, max_length=300)
    company: str = Field(min_length=1, max_length=200)
    location: str | None = Field(default=None, max_length=200)
    notes: str | None = Field(default=None, max_length=20000)

    @field_validator("title", "company", "location", mode="before")
    @classmethod
    def strip_surrounding_whitespace(cls, value):
        # Trim before checking lengths, so whitespace alone is not a valid title.
        if isinstance(value, str):
            return value.strip()
        return value


class JobPatch(BaseModel):
    model_config = ConfigDict(extra="forbid")

    notes: str | None = Field(default=None, max_length=20000)
    review_status: Literal["to_review", "interested", "not_interested"] | None = None
    application_status: Literal[
        "not_applied", "applied", "interviewing", "offer", "rejected", "withdrawn"
    ] | None = None

    @field_validator("review_status", "application_status")
    @classmethod
    def status_cannot_be_cleared(cls, value):
        # Omitted defaults are not validated; an explicitly submitted null is.
        if value is None:
            raise ValueError("Status cannot be null")
        return value


@app.get("/api/health")
def health():
    # This checks that the API responds, independently of database availability.
    return {"status": "ok"}


@app.get("/api/health/database")
def database_health():
    try:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                # No application tables are needed to check the connection.
                cursor.execute("SELECT 1")
                cursor.fetchone()
    except psycopg.OperationalError:
        raise HTTPException(status_code=503, detail="Database unavailable") from None

    return {"status": "ok"}


@app.post("/api/jobs", status_code=201)
def create_job(job: JobCreate):
    try:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    INSERT INTO jobs (title, company, location, notes)
                    VALUES (%s, %s, %s, %s)
                    RETURNING *
                    """,
                    (job.title, job.company, job.location, job.notes),
                )
                created_job = cursor.fetchone()
        # The connection's context commits successfully before we report creation.
    except psycopg.OperationalError:
        raise HTTPException(status_code=503, detail="Database unavailable") from None

    return created_job


@app.get("/api/jobs")
def list_jobs(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0, le=100000),
):
    try:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute("SELECT count(*) AS total FROM jobs")
                total = cursor.fetchone()["total"]

                # The ID breaks timestamp ties so the ordering is deterministic.
                cursor.execute(
                    """
                    SELECT * FROM jobs
                    ORDER BY first_seen_at DESC, id DESC
                    LIMIT %s OFFSET %s
                    """,
                    (limit, offset),
                )
                jobs = cursor.fetchall()
    except psycopg.OperationalError:
        raise HTTPException(status_code=503, detail="Database unavailable") from None

    return {"items": jobs, "total": total, "limit": limit, "offset": offset}


@app.get("/api/jobs/{job_id}")
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


@app.patch("/api/jobs/{job_id}")
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
