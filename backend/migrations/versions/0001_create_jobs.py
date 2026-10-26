"""Create the initial jobs table."""

from alembic import op

revision = "0001"
down_revision = None


def upgrade():
    op.execute("""
        CREATE TABLE jobs (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            title VARCHAR(300) NOT NULL,
            company VARCHAR(200) NOT NULL,
            location VARCHAR(200),
            preferred_url VARCHAR(2048),
            source VARCHAR(40) NOT NULL DEFAULT 'manual',
            review_status VARCHAR(30) NOT NULL DEFAULT 'to_review',
            application_status VARCHAR(30) NOT NULL DEFAULT 'not_applied',
            notes TEXT,
            first_seen_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            last_seen_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

            CONSTRAINT jobs_title_not_blank CHECK (length(trim(title)) > 0),
            CONSTRAINT jobs_company_not_blank CHECK (length(trim(company)) > 0),
            CONSTRAINT jobs_review_status_valid CHECK (
                review_status IN ('to_review', 'interested', 'not_interested')
            ),
            CONSTRAINT jobs_application_status_valid CHECK (
                application_status IN (
                    'not_applied', 'applied', 'interviewing',
                    'offer', 'rejected', 'withdrawn'
                )
            ),
            CONSTRAINT jobs_notes_length CHECK (length(notes) <= 20000)
        )
    """)


def downgrade():
    op.execute("DROP TABLE jobs")
