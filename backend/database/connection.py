import json
from functools import lru_cache
from typing import Any

from beanie import PydanticObjectId, init_beanie
from pydantic import BaseModel
from pydantic_settings import BaseSettings, SettingsConfigDict
from pymongo import AsyncMongoClient


# ── environment settings ──────────────────────────────────────────────────────


class Settings(BaseSettings):
    """
    Application-wide settings loaded from environment variables 
    or the .env file.
    """
    DATABASE_URL: str
    SECRET_KEY: str
<<<<<<< HEAD
    USDA_API_KEY: str = "DEMO_KEY"
=======
    USDA_API_KEY: str = "place real here"
>>>>>>> a345c01e15bbe8e492da3896b9ec56e5471a6eb4

    model_config = SettingsConfigDict(env_file="../.env")


@lru_cache
def get_settings():
    """Returns a cached settings object."""
    return Settings()


# ── database initialization ───────────────────────────────────────────────────


async def initialize_database():
    """
    Establish a connection to MongoDB and initialize the Beanie ODM 
    with the application's document models.
    """
    from models import GroceryList, MealPlan, Recipe, Session, User, WorkoutTemplate

    settings = get_settings()
    client = AsyncMongoClient(settings.DATABASE_URL)
    
    # Beanie handles schema initialization and connection management
    await init_beanie(
        database=client.get_default_database(),
        document_models=[Session, User, Recipe, MealPlan, GroceryList, WorkoutTemplate],
    )


# ── database generic wrapper ──────────────────────────────────────────────────


class Database:
    """
    A generic repository wrapper for basic CRUD operations on 
    Beanie document models.
    """
    def __init__(self, model):
        self.model = model

    async def save(self, document) -> PydanticObjectId:
        """Create a new document in the collection."""
        m = await document.create()
        return m.id

    async def get(self, id: PydanticObjectId) -> Any:
        """Retrieve a document by its unique PydanticObjectId."""
        doc = await self.model.get(id)
        return doc if doc else False

    async def get_all(self) -> list[Any]:
        """Fetch all documents in the collection."""
        return await self.model.find_all().to_list()

    async def update(self, id: PydanticObjectId, body: BaseModel) -> Any:
        """Surgically update an existing document."""
        des_body = json.loads(body.model_dump_json(exclude_defaults=True))
        doc = await self.get(id)
        if not doc:
            return False
        await doc.set(des_body)
        return doc

    async def delete(self, id: PydanticObjectId) -> bool:
        """Permanently remove a document from the database."""
        doc = await self.get(id)
        if not doc:
            return False
        await doc.delete()
        return True
