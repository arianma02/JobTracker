from fastapi import FastAPI

app = FastAPI(title="JobTrack", version="0.1.0")


@app.get("/api/health")
def health():
    # This checks that the API responds, independently of database availability.
    return {"status": "ok"}
