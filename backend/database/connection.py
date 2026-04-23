import json
from functools import lru_cache
from typing import Any

from beanie import PydanticObjectId, init_beanie
from pydantic import BaseModel
from pydantic_settings import BaseSettings, SettingsConfigDict
from pymongo import AsyncMongoClient


class Settings(BaseSettings):
    DATABASE_URL: str
    SECRET_KEY: str
    USDA_API_KEY: str = "i2EQ0bKuE18kaXn0oqdZqWMBwcMajico0Yd0EYG8"

    model_config = SettingsConfigDict(env_file="../.env")


@lru_cache
def get_settings():
    return Settings()


async def initialize_database():
    from models import GroceryList, MealPlan, Recipe, Session, User, WorkoutTemplate

    settings = get_settings()
    client = AsyncMongoClient(settings.DATABASE_URL)
    await init_beanie(
        database=client.get_default_database(),
        document_models=[Session, User, Recipe, MealPlan, GroceryList, WorkoutTemplate],
    )


class Database:
    def __init__(self, model):
        self.model = model

    async def save(self, document) -> PydanticObjectId:
        m = await document.create()
        return m.id

    async def get(self, id: PydanticObjectId) -> Any:
        doc = await self.model.get(id)
        return doc if doc else False

    async def get_all(self) -> list[Any]:
        return await self.model.find_all().to_list()

    async def update(self, id: PydanticObjectId, body: BaseModel) -> Any:
        des_body = json.loads(body.model_dump_json(exclude_defaults=True))
        doc = await self.get(id)
        if not doc:
            return False
        await doc.set(des_body)
        return doc

    async def delete(self, id: PydanticObjectId) -> bool:
        doc = await self.get(id)
        if not doc:
            return False
        await doc.delete()
        return True
