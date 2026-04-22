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


# ── beanie documents ──────────────────────────────────────────────────────────


class Session(Document):
    name: str
    date: str
    exercises: List[Exercise] = []

    class Settings:
        name = "sessions"


class User(Document):
    username: str
    password: str  # bcrypt hashed

    class Settings:
        name = "users"


# ── response models ───────────────────────────────────────────────────────────


class TokenResponse(BaseModel):
    username: str
    access_token: str
    token_type: str = "bearer"
