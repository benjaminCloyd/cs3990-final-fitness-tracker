from fastapi import APIRouter, HTTPException

from models import ExerciseRequest, SessionRequest

workout_router = APIRouter()

sessions_db: list = []
session_id_counter = 0
exercise_id_counter = 0


# helpers
def epley_1rm(weight: float, reps: int) -> float:
    if reps == 1:
        return float(weight)
    return weight * (1 + reps / 30)


def find_session(session_id: int) -> dict:
    for s in sessions_db:
        if s["id"] == session_id:
            return s
    raise HTTPException(status_code=404, detail=f"Session {session_id} not found.")


# sessions
@workout_router.get("")
async def get_all_sessions() -> list:
    def sort_key(s):
        try:
            m, d, y = s["date"].split("/")
            return (int(y), int(m), int(d))
        except Exception:
            return (0, 0, 0)

    return sorted(sessions_db, key=sort_key, reverse=True)


@workout_router.post("", status_code=201)
async def create_session(body: SessionRequest) -> dict:
    global session_id_counter
    session_id_counter += 1
    session = {
        "id": session_id_counter,
        "name": body.name,
        "date": body.date,
        "exercises": [],
    }
    sessions_db.append(session)
    return session


@workout_router.get("/progress/{exercise_name}")
async def get_progress(exercise_name: str) -> list:
    history = []
    for s in sessions_db:
        for ex in s["exercises"]:
            if ex["name"].lower() == exercise_name.lower():
                history.append(
                    {
                        "date": s["date"],
                        "session_name": s["name"],
                        "best_1rm": ex["best_1rm"],
                    }
                )

    def sort_key(x):
        try:
            m, d, y = x["date"].split("/")
            return (int(y), int(m), int(d))
        except Exception:
            return (0, 0, 0)

    return sorted(history, key=sort_key)


@workout_router.get("/{session_id}")
async def get_session(session_id: int) -> dict:
    return find_session(session_id)


@workout_router.delete("/{session_id}")
async def delete_session(session_id: int) -> dict:
    session = find_session(session_id)
    sessions_db.remove(session)
    return {"msg": f"Session '{session['name']}' deleted."}


# exercises
@workout_router.post("/{session_id}/exercises", status_code=201)
async def add_exercise(session_id: int, body: ExerciseRequest) -> dict:
    global exercise_id_counter
    exercise_id_counter += 1
    session = find_session(session_id)
    sets = [{"weight": s.weight, "reps": s.reps} for s in body.sets]
    best = round(max(epley_1rm(s["weight"], s["reps"]) for s in sets), 1)
    exercise = {
        "id": exercise_id_counter,
        "name": body.name.strip().title(),
        "sets": sets,
        "best_1rm": best,
    }
    session["exercises"].append(exercise)
    return exercise


@workout_router.put("/{session_id}/exercises/{exercise_id}")
async def update_exercise(
    session_id: int, exercise_id: int, body: ExerciseRequest
) -> dict:
    session = find_session(session_id)
    for ex in session["exercises"]:
        if ex["id"] == exercise_id:
            sets = [{"weight": s.weight, "reps": s.reps} for s in body.sets]
            ex["name"] = body.name.strip().title()
            ex["sets"] = sets
            ex["best_1rm"] = round(
                max(epley_1rm(s["weight"], s["reps"]) for s in sets), 1
            )
            return ex
    raise HTTPException(status_code=404, detail=f"Exercise {exercise_id} not found.")


@workout_router.delete("/{session_id}/exercises/{exercise_id}")
async def delete_exercise(session_id: int, exercise_id: int) -> dict:
    session = find_session(session_id)
    for i, ex in enumerate(session["exercises"]):
        if ex["id"] == exercise_id:
            session["exercises"].pop(i)
            return {"msg": f"Exercise '{ex['name']}' deleted."}
    raise HTTPException(status_code=404, detail=f"Exercise {exercise_id} not found.")
