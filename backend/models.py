from beanie import Document
from pydantic import BaseModel, Field
from typing import List, Optional


# ── embedded sub-models ───────────────────────────────────────────────────────


class SetEntry(BaseModel):
    """A single set within an exercise."""
    weight: float
    reps: int


class Exercise(BaseModel):
    """A logged exercise with multiple sets and a calculated best 1RM."""
    id: int
    name: str
    sets: List[SetEntry]
    best_1rm: float


class Ingredient(BaseModel):
    """An ingredient entry for a recipe, including nutritional info."""
    name: str
    quantity: str
    calories: float = 0.0
    protein: float = 0.0
    carbs: float = 0.0
    fat: float = 0.0


class MacroTargets(BaseModel):
    """User-defined daily nutritional goals."""
    calories: float = 2000.0
    protein: float = 150.0
    carbs: float = 250.0
    fat: float = 70.0


# ── request bodies ────────────────────────────────────────────────────────────


class ExerciseRequest(BaseModel):
    """Schema for adding/updating an exercise."""
    name: str
    sets: List[SetEntry]


class SessionRequest(BaseModel):
    """Schema for creating a new workout session."""
    name: str
    date: str


class SignupRequest(BaseModel):
    """Schema for user registration."""
    username: str
    password: str


class RecipeRequest(BaseModel):
    """Schema for creating or editing a recipe."""
    name: str
    ingredients: List[Ingredient]
    instructions: str = ""
    image_url: Optional[str] = None


class MealPlanRequest(BaseModel):
    """Schema for building a weekly meal plan."""
    week_start_date: str
    # Map of "Monday_Breakfast": recipe_id, etc.
    slots: dict[str, str]


class UserUpdateRequest(BaseModel):
    """Schema for updating user profile metrics."""
    height: Optional[float] = None
    weight: Optional[float] = None
    macro_targets: Optional[MacroTargets] = None


class TemplateRequest(BaseModel):
    """Schema for creating a workout template."""
    name: str
    exercises: List[ExerciseRequest]


# ── beanie documents ──────────────────────────────────────────────────────────


class Session(Document):
    """Database model for a workout session."""
    name: str
    date: str
    exercises: List[Exercise] = []
    owner: str = ""          # username of the creating user

    class Settings:
        name = "sessions"


class WorkoutTemplate(Document):
    """Database model for reusable workout structures."""
    name: str
    exercises: List[ExerciseRequest]
    owner: str

    class Settings:
        name = "templates"


class User(Document):
    """Database model for user accounts and profiles."""
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
    """Database model for saved recipes."""
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
    """Database model for weekly nutritional planning."""
    week_start_date: str     # MM/DD/YYYY
    owner: str               # username
    # Map of "Day_Slot": recipe_id
    slots: dict[str, str] = {}

    class Settings:
        name = "meal_plans"


class GroceryList(Document):
    """Database model for generated grocery lists."""
    owner: str
    items: List[Ingredient]
    is_checked: List[bool] = []

    class Settings:
        name = "grocery_lists"


# ── response models ───────────────────────────────────────────────────────────


class TokenResponse(BaseModel):
    """Response containing identity and access token."""
    username: str
    role: str
    access_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    """Sanitized(don't give password) user profile response."""
    username: str
    role: str
    height: float
    weight: float
    is_deactivated: bool
    macro_targets: MacroTargets
