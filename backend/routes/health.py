import psycopg
from fastapi import APIRouter, HTTPException

from database import get_connection

router = APIRouter()


@router.get("/api/health")
def health():
    # This checks that the API responds, independently of database availability.
    return {"status": "ok"}


@router.get("/api/health/database")
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
