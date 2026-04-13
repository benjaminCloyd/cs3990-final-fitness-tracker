from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from workout_routes import workout_router

app = FastAPI(title="Weight Tracker - Weightlifting Tracker")


@app.get("/")
async def read_index():
    return FileResponse("./frontend/index.html")


app.include_router(workout_router, tags=["Workouts"], prefix="/sessions")

# router include before mount
app.mount("/", StaticFiles(directory="frontend"), name="static")
