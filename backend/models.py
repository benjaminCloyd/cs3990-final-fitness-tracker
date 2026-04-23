from beanie import Document
from pydantic import BaseModel, Field
from typing import List, Optional


# ── embedded sub-models ───────────────────────────────────────────────────────


class SetEntry(BaseModel):
    weight: float
    reps: int


class Exercise(BaseModel):
    id: int
    name: str
    sets: List[SetEntry]
    best_1rm: float


class Ingredient(BaseModel):
    name: str
    quantity: str
    calories: float = 0.0
    protein: float = 0.0
    carbs: float = 0.0
    fat: float = 0.0


class MacroTargets(BaseModel):
    calories: float = 2000.0
    protein: float = 150.0
    carbs: float = 250.0
    fat: float = 70.0


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


class RecipeRequest(BaseModel):
    name: str
    ingredients: List[Ingredient]
    instructions: str = ""
    image_url: Optional[str] = None


class MealPlanRequest(BaseModel):
    week_start_date: str
    # Map of "Monday_Breakfast": recipe_id, etc.
    slots: dict[str, str]


class UserUpdateRequest(BaseModel):
    height: Optional[float] = None
    weight: Optional[float] = None
    macro_targets: Optional[MacroTargets] = None


class TemplateRequest(BaseModel):
    name: str
    exercises: List[ExerciseRequest]


# ── beanie documents ──────────────────────────────────────────────────────────


class Session(Document):
    name: str
    date: str
    exercises: List[Exercise] = []
    owner: str = ""          # username of the creating user

    class Settings:
        name = "sessions"


class WorkoutTemplate(Document):
    name: str
    exercises: List[ExerciseRequest] # Template exercises don't have 1RM yet
    owner: str

    class Settings:
        name = "templates"


class User(Document):
    username: str
    password: str            # bcrypt hashed
    role: str = "user"       # "user" | "admin"
    height: float = 0.0      # in cm
    weight: float = 0.0      # in kg
    is_deactivated: bool = False
    macro_targets: MacroTargets = MacroTargets()

    class Settings:
        name = "users"


class Recipe(Document):
    name: str
    ingredients: List[Ingredient]
    instructions: str = ""
    image_url: Optional[str] = None
    owner: str               # username
    calories_per_serving: float = 0.0
    protein_per_serving: float = 0.0
    carbs_per_serving: float = 0.0
    fat_per_serving: float = 0.0

    class Settings:
        name = "recipes"


class MealPlan(Document):
    week_start_date: str     # MM/DD/YYYY
    owner: str               # username
    # Map of "Day_Slot": recipe_id
    slots: dict[str, str] = {}

    class Settings:
        name = "meal_plans"


class GroceryList(Document):
    owner: str
    items: List[Ingredient]
    is_checked: List[bool] = []

    class Settings:
        name = "grocery_lists"


# ── response models ───────────────────────────────────────────────────────────


class TokenResponse(BaseModel):
    username: str
    role: str
    access_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    username: str
    role: str
    height: float
    weight: float
    is_deactivated: bool
    macro_targets: MacroTargets
