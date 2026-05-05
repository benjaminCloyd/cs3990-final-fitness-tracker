"""
INTEGRATION TESTS: Verifies interaction between modules and the database.
Tests the persistence and retrieval of Users and Sessions in MongoDB.
"""
import pytest
from beanie import init_beanie
from pymongo import AsyncMongoClient
from backend.models import User, Session, Recipe, WorkoutTemplate, MealPlan, GroceryList
from backend.database.connection import Database

@pytest.fixture(scope="function")
async def db_setup():
    # Use the base database name, created inside the function loop
    client = AsyncMongoClient("mongodb://localhost:27017")
    db = client["ironlog"]
    await init_beanie(
        database=db,
        document_models=[User, Session, Recipe, WorkoutTemplate, MealPlan, GroceryList]
    )
    yield db
    # Cleanup after tests
    await client.drop_database("ironlog")
    await client.close()

@pytest.mark.asyncio
async def test_user_persistence(db_setup):
    user_db = Database(User)
    user = User(username="integration_user", password="hashed_password", role="user")
    user_id = await user_db.save(user)
    
    assert user_id is not None
    
    found = await user_db.get(user_id)
    assert found.username == "integration_user"
    
    # Simple mock for update body
    class MockUpdate:
        def model_dump_json(self, **kwargs):
            return '{"height": 185.0}'
            
    await user_db.update(user_id, MockUpdate())
    updated = await user_db.get(user_id)
    assert updated.height == 185.0

@pytest.mark.asyncio
async def test_session_persistence(db_setup):
    session_db = Database(Session)
    session = Session(name="Bench Press", date="2026-04-30", owner="integration_user")
    session_id = await session_db.save(session)
    
    assert session_id is not None
    
    found = await session_db.get(session_id)
    assert found.name == "Bench Press"
    assert found.owner == "integration_user"
