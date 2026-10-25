import pytest
from alembic import command
from alembic.config import Config

from database import get_connection


@pytest.fixture
def database_connection(monkeypatch):
    test_url = (
        "postgresql://jobtrack_test:local_test_only@127.0.0.1:55433/jobtrack_test"
    )
    monkeypatch.setenv("JOBTRACK_DATABASE_URL", test_url)

    command.upgrade(Config("alembic.ini"), "head")

    with get_connection() as connection:
        yield connection
        # Discard test inserts so the next test starts without these records.
        connection.rollback()
