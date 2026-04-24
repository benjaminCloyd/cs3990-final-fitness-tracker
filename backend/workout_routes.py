from auth.authenticate import authenticate
from auth.jwt_handler import TokenData
from beanie import PydanticObjectId
from database.connection import Database
from fastapi import APIRouter, Depends, HTTPException, status
from models import Exercise, ExerciseRequest, Session, SessionRequest, User, WorkoutTemplate, TemplateRequest
from logger import log_event

workout_router = APIRouter()
session_database = Database(Session)


# ── helpers ───────────────────────────────────────────────────────────────────


def epley_1rm(weight: float, reps: int) -> float:
    """Calculate the estimated 1-Rep Max using the Epley formula."""
    return float(weight) if reps == 1 else weight * (1 + reps / 30)


def session_to_dict(s: Session) -> dict:
    """Serialize a Session document into a frontend-ready dictionary."""
    return {
        "id": str(s.id),
        "name": s.name,
        "date": s.date,
        "owner": s.owner,
        "exercises": [ex.model_dump() for ex in s.exercises],
    }


async def get_session_or_404(session_id: str, user: TokenData) -> Session:
    """Fetch a session by ID and enforce ownership or admin bypass."""
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
    """Sort a list of sessions by date (MM/DD/YYYY) in descending order."""
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
    """List all workout sessions for the user (or all sessions for admins)."""
    if user.role == "admin":
        sessions = await session_database.get_all()
    else:
        sessions = await Session.find(Session.owner == user.username).to_list()
    return [session_to_dict(s) for s in _sort_sessions(sessions)]


@workout_router.post("", status_code=201)
async def create_session(
    body: SessionRequest, user: TokenData = Depends(authenticate)
) -> dict:
    """Initialize a new workout session for the authenticated user."""
    session = Session(name=body.name, date=body.date, exercises=[], owner=user.username)
    await session_database.save(session)
    log_event("Workout Created", f"User {user.username} started session '{session.name}'")
    return session_to_dict(session)


@workout_router.get("/progress/{exercise_name}")
async def get_progress(
    exercise_name: str, user: TokenData = Depends(authenticate)
) -> list:
    """Fetch historical 1RM data points for a specific exercise name."""
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


@workout_router.get("/relative-strength")
async def get_relative_strength(user: TokenData = Depends(authenticate)):
    """Calculate the user's Big 3 lift total relative to their body weight."""
    db_user = await User.find_one(User.username == user.username)
    if not db_user or db_user.weight <= 0:
        raise HTTPException(status_code=400, detail="User weight must be set in profile.")
    
    # Track personal bests for the "Big 3" main lifts
    main_lifts = ["Bench Press", "Squat", "Deadlift"]
    sessions = await Session.find(Session.owner == user.username).to_list()
    
    bests = {lift: 0.0 for lift in main_lifts}
    for s in sessions:
        for ex in s.exercises:
            if ex.name.title() in main_lifts:
                bests[ex.name.title()] = max(bests[ex.name.title()], ex.best_1rm)
                
    total_1rm = sum(bests.values())
    ratio = total_1rm / db_user.weight
    
    return {
        "weight_kg": db_user.weight,
        "total_1rm_lbs": total_1rm,
        "strength_ratio": round(ratio, 2),
        "bests": bests
    }


@workout_router.get("/{session_id}")
async def get_session(session_id: str, user: TokenData = Depends(authenticate)) -> dict:
    """Fetch details for a specific session."""
    return session_to_dict(await get_session_or_404(session_id, user))


@workout_router.delete("/{session_id}")
async def delete_session(
    session_id: str, user: TokenData = Depends(authenticate)
) -> dict:
    """Remove a session and all its associated exercises from the database."""
    session = await get_session_or_404(session_id, user)
    await session_database.delete(session.id)
    log_event("Workout Deleted", f"User {user.username} deleted session '{session.name}'")
    return {"msg": f"Session '{session.name}' deleted."}


# ── exercises ─────────────────────────────────────────────────────────────────


@workout_router.post("/{session_id}/exercises", status_code=201)
async def add_exercise(
    session_id: str, body: ExerciseRequest, user: TokenData = Depends(authenticate)
) -> dict:
    """Add a new exercise entry with sets and reps to a session."""
    session = await get_session_or_404(session_id, user)
    
    # Simple ID incrementing within the session scope
    next_id = max((ex.id for ex in session.exercises), default=0) + 1
    
    # Calculate initial best 1RM from the sets provided
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
    """Update an existing exercise's sets or name."""
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
    """Remove a specific exercise from a workout session."""
    session = await get_session_or_404(session_id, user)
    for i, ex in enumerate(session.exercises):
        if ex.id == exercise_id:
            session.exercises.pop(i)
            await session.save()
            return {"msg": f"Exercise '{ex.name}' deleted."}
    raise HTTPException(status_code=404, detail=f"Exercise {exercise_id} not found.")


# ── templates ─────────────────────────────────────────────────────────────────


@workout_router.get("/templates/all", response_model=list[WorkoutTemplate])
async def list_templates(user: TokenData = Depends(authenticate)):
    """Retrieve all reusable workout templates created by the user."""
    return await WorkoutTemplate.find(WorkoutTemplate.owner == user.username).to_list()


@workout_router.post("/templates", status_code=201)
async def create_template(body: TemplateRequest, user: TokenData = Depends(authenticate)):
    """Save a workout structure as a template for future use."""
    template = WorkoutTemplate(name=body.name, exercises=body.exercises, owner=user.username)
    await template.create()
    return template


@workout_router.delete("/templates/{template_id}")
async def delete_template(template_id: str, user: TokenData = Depends(authenticate)):
    """Remove a workout template from the library."""
    try:
        oid = PydanticObjectId(template_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid ID.")
    
    template = await WorkoutTemplate.get(oid)
    if not template or template.owner != user.username:
        raise HTTPException(status_code=404, detail="Template not found.")
    
    await template.delete()
    return {"message": "Template deleted"}
