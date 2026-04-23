from contextlib import asynccontextmanager
from pathlib import Path

from database.connection import initialize_database
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from recipe_routes import recipe_router
from user_routes import user_router
from workout_routes import workout_router

# ── configuration ─────────────────────────────────────────────────────────────

UPLOADS_DIR = Path(__file__).parent / "uploads"
UPLOADS_DIR.mkdir(exist_ok=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Handle application startup and shutdown events."""
    await initialize_database()
    yield


app = FastAPI(title="IRONLOG", lifespan=lifespan)


# ── API routers ───────────────────────────────────────────────────────────────

app.include_router(user_router,    prefix="/auth",     tags=["Auth"])
app.include_router(workout_router, prefix="/sessions", tags=["Workouts"])
app.include_router(recipe_router,  prefix="/recipes",  tags=["Recipes & Nutrition"])


# ── static files ──────────────────────────────────────────────────────────────

# Mount the recipe image uploads directory to serve images to the frontend
app.mount("/uploads", StaticFiles(directory=UPLOADS_DIR), name="uploads")
