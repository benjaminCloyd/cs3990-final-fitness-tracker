from contextlib import asynccontextmanager

from database.connection import initialize_database
from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from user_routes import user_router
from workout_routes import workout_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    await initialize_database()
    yield


app = FastAPI(title="Weight Tracker", lifespan=lifespan)


@app.get("/")
async def read_index():
    return FileResponse("./frontend/index.html")


app.include_router(user_router, prefix="/auth", tags=["Auth"])
app.include_router(workout_router, prefix="/sessions", tags=["Workouts"])

# router includes before mount
app.mount("/", StaticFiles(directory="frontend"), name="static")
