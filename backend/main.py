import psycopg
from fastapi import FastAPI, HTTPException
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
