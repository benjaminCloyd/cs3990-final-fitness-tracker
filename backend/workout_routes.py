from auth.authenticate import authenticate
from auth.jwt_handler import TokenData
from beanie import PydanticObjectId
from database.connection import Database
from fastapi import APIRouter, Depends, HTTPException, status
from models import Exercise, ExerciseRequest, Session, SessionRequest

workout_router = APIRouter()
session_database = Database(Session)


# ── helpers ───────────────────────────────────────────────────────────────────


def epley_1rm(weight: float, reps: int) -> float:
    return float(weight) if reps == 1 else weight * (1 + reps / 30)


def session_to_dict(s: Session) -> dict:
    return {
        "id": str(s.id),
        "name": s.name,
        "date": s.date,
        "owner": s.owner,
        "exercises": [ex.model_dump() for ex in s.exercises],
    }


async def get_session_or_404(session_id: str, user: TokenData) -> Session:
    """Fetch a session by ID and enforce ownership (admins bypass)."""
    try:
        oid = PydanticObjectId(session_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid session ID format.")
    session = await session_database.get(oid)
    if not session:
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found.")
    if user.role != "admin" and session.owner != user.username:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this session.",
        )
    return session


def _sort_sessions(sessions: list[Session]) -> list[Session]:
    def key(s: Session):
        try:
            m, d, y = s.date.split("/")
            return (int(y), int(m), int(d))
        except Exception:
            return (0, 0, 0)
    return sorted(sessions, key=key, reverse=True)


# ── sessions ──────────────────────────────────────────────────────────────────


@workout_router.get("")
async def get_all_sessions(user: TokenData = Depends(authenticate)) -> list:
    if user.role == "admin":
        sessions = await session_database.get_all()
    else:
        sessions = await Session.find(Session.owner == user.username).to_list()
    return [session_to_dict(s) for s in _sort_sessions(sessions)]


@workout_router.post("", status_code=201)
async def create_session(
    body: SessionRequest, user: TokenData = Depends(authenticate)
) -> dict:
    session = Session(name=body.name, date=body.date, exercises=[], owner=user.username)
    await session_database.save(session)
    return session_to_dict(session)


@workout_router.get("/progress/{exercise_name}")
async def get_progress(
    exercise_name: str, user: TokenData = Depends(authenticate)
) -> list:
    if user.role == "admin":
        sessions = await session_database.get_all()
    else:
        sessions = await Session.find(Session.owner == user.username).to_list()

    history = []
    for s in sessions:
        for ex in s.exercises:
            if ex.name.lower() == exercise_name.lower():
                history.append(
                    {"date": s.date, "session_name": s.name, "best_1rm": ex.best_1rm}
                )

    def sort_key(x):
        try:
            m, d, y = x["date"].split("/")
            return (int(y), int(m), int(d))
        except Exception:
            return (0, 0, 0)

    return sorted(history, key=sort_key)


@workout_router.get("/{session_id}")
async def get_session(session_id: str, user: TokenData = Depends(authenticate)) -> dict:
    return session_to_dict(await get_session_or_404(session_id, user))


@workout_router.delete("/{session_id}")
async def delete_session(
    session_id: str, user: TokenData = Depends(authenticate)
) -> dict:
    session = await get_session_or_404(session_id, user)
    await session_database.delete(session.id)
    return {"msg": f"Session '{session.name}' deleted."}


# ── exercises ─────────────────────────────────────────────────────────────────


@workout_router.post("/{session_id}/exercises", status_code=201)
async def add_exercise(
    session_id: str, body: ExerciseRequest, user: TokenData = Depends(authenticate)
) -> dict:
    session = await get_session_or_404(session_id, user)
    next_id = max((ex.id for ex in session.exercises), default=0) + 1
    sets = [{"weight": s.weight, "reps": s.reps} for s in body.sets]
    best = round(max(epley_1rm(s["weight"], s["reps"]) for s in sets), 1)
    exercise = Exercise(
        id=next_id, name=body.name.strip().title(), sets=body.sets, best_1rm=best
    )
    session.exercises.append(exercise)
    await session.save()
    return exercise.model_dump()


@workout_router.put("/{session_id}/exercises/{exercise_id}")
async def update_exercise(
    session_id: str,
    exercise_id: int,
    body: ExerciseRequest,
    user: TokenData = Depends(authenticate),
) -> dict:
    session = await get_session_or_404(session_id, user)
    for ex in session.exercises:
        if ex.id == exercise_id:
            ex.name = body.name.strip().title()
            ex.sets = body.sets
            ex.best_1rm = round(max(epley_1rm(s.weight, s.reps) for s in body.sets), 1)
            await session.save()
            return ex.model_dump()
    raise HTTPException(status_code=404, detail=f"Exercise {exercise_id} not found.")


@workout_router.delete("/{session_id}/exercises/{exercise_id}")
async def delete_exercise(
    session_id: str,
    exercise_id: int,
    user: TokenData = Depends(authenticate),
) -> dict:
    session = await get_session_or_404(session_id, user)
    for i, ex in enumerate(session.exercises):
        if ex.id == exercise_id:
            session.exercises.pop(i)
            await session.save()
            return {"msg": f"Exercise '{ex.name}' deleted."}
    raise HTTPException(status_code=404, detail=f"Exercise {exercise_id} not found.")
