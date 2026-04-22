from beanie import Document
from pydantic import BaseModel
from typing import List


# ── embedded sub-models ───────────────────────────────────────────────────────


class SetEntry(BaseModel):
    weight: float
    reps: int


class Exercise(BaseModel):
    id: int
    name: str
    sets: List[SetEntry]
    best_1rm: float


# ── request bodies ────────────────────────────────────────────────────────────


class ExerciseRequest(BaseModel):
    name: str
    sets: List[SetEntry]


class SessionRequest(BaseModel):
    name: str
    date: str


class SignupRequest(BaseModel):
    """Used for signup so callers cannot self-assign an admin role."""
    username: str
    password: str


# ── beanie documents ──────────────────────────────────────────────────────────


class Session(Document):
    name: str
    date: str
    exercises: List[Exercise] = []
    owner: str = ""          # username of the creating user

    class Settings:
        name = "sessions"


class User(Document):
    username: str
    password: str            # bcrypt hashed
    role: str = "user"       # "user" | "admin"

    class Settings:
        name = "users"


# ── response models ───────────────────────────────────────────────────────────


class TokenResponse(BaseModel):
    username: str
    role: str
    access_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    username: str
    role: str
