import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient

from database import get_connection
from main import app


@pytest.fixture
def test_database(monkeypatch):
    test_url = (
        "postgresql://jobtrack_test:local_test_only@127.0.0.1:55433/jobtrack_test"
    )
    monkeypatch.setenv("JOBTRACK_DATABASE_URL", test_url)

    command.upgrade(Config("alembic.ini"), "head")


@pytest.fixture
def database_connection(test_database):
    with get_connection() as connection:
        yield connection
        # Discard test inserts so the next test starts without these records.
        connection.rollback()


@pytest.fixture
def client(test_database):
    with get_connection() as connection:
        connection.execute("TRUNCATE jobs")

    with TestClient(app) as test_client:
        yield test_client

    # API requests commit their own connections, so rollback cannot clean them up.
    with get_connection() as connection:
        connection.execute("TRUNCATE jobs")
