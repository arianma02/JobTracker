from fastapi import FastAPI

from routes import health, jobs

app = FastAPI(title="JobTrack", version="0.1.0")

app.include_router(health.router)
app.include_router(jobs.router)
