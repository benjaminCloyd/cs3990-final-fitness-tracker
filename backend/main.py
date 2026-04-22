from contextlib import asynccontextmanager
from pathlib import Path

from database.connection import initialize_database
from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from user_routes import user_router
from workout_routes import workout_router

STATIC_DIR = Path(__file__).parent / "static"


@asynccontextmanager
async def lifespan(app: FastAPI):
    await initialize_database()
    yield


app = FastAPI(title="IRONLOG", lifespan=lifespan)

# ── API routers (must come before the static mount) ───────────────────────────

app.include_router(user_router,    prefix="/auth",     tags=["Auth"])
app.include_router(workout_router, prefix="/sessions", tags=["Workouts"])


# ── React SPA static files ────────────────────────────────────────────────────

if STATIC_DIR.exists():
    # Serve JS/CSS/assets normally
    app.mount("/assets", StaticFiles(directory=STATIC_DIR / "assets"), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def spa_fallback(full_path: str):
        """Return index.html for any path the React router handles."""
        return FileResponse(STATIC_DIR / "index.html")
