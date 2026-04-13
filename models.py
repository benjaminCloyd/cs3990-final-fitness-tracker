from pydantic import BaseModel
from typing import List


class SetEntry(BaseModel):
    weight: float
    reps: int


class ExerciseRequest(BaseModel):
    name: str
    sets: List[SetEntry]


class Exercise(BaseModel):
    id: int
    name: str
    sets: List[SetEntry]
    best_1rm: float


class SessionRequest(BaseModel):
    name: str
    date: str


class Session(BaseModel):
    id: int
    name: str
    date: str
    exercises: List[Exercise] = []
