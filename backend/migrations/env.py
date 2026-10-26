from alembic import context
from sqlalchemy import create_engine
from sqlalchemy.engine import make_url

from database import get_database_url

# Alembic uses SQLAlchemy's connection interface with the same psycopg driver.
database_url = make_url(get_database_url())
database_url = database_url.set(drivername="postgresql+psycopg")
engine = create_engine(database_url)

with engine.connect() as connection:
    context.configure(connection=connection)

    with context.begin_transaction():
        context.run_migrations()

engine.dispose()
