"""Add exact identifiers for recognizing recorded jobs."""

from alembic import op

revision = "0002"
down_revision = "0001"


def upgrade():
    op.execute("""
        CREATE TABLE job_identifiers (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
            namespace VARCHAR(40) NOT NULL,
            value VARCHAR(2048) NOT NULL,
            CONSTRAINT job_identifiers_value_size CHECK (octet_length(value) <= 2048),
            CONSTRAINT job_identifiers_unique UNIQUE (namespace, value)
        )
    """)
    op.execute("CREATE INDEX job_identifiers_job_id_idx ON job_identifiers (job_id)")


def downgrade():
    op.execute("DROP TABLE job_identifiers")
