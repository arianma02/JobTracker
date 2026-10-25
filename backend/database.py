import os

import psycopg
from psycopg.rows import dict_row

DEFAULT_DATABASE_URL = (
    "postgresql://jobtrack_dev:local_dev_only@127.0.0.1:55432/jobtrack_dev"
)


def get_connection():
    database_url = os.getenv("JOBTRACK_DATABASE_URL", DEFAULT_DATABASE_URL)

    return psycopg.connect(
        database_url,
        connect_timeout=3,
        options="-c timezone=UTC",
        row_factory=dict_row,
    )
