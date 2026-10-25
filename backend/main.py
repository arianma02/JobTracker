import psycopg
from fastapi import FastAPI, HTTPException

from database import get_connection

app = FastAPI(title="JobTrack", version="0.1.0")


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
