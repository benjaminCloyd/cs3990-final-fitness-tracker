"""
END-TO-END (E2E) TESTS: Replicates complete user flows in a full environment.
Simulates a full user journey from registration to session and recipe creation.
"""
import pytest
from httpx import AsyncClient, ASGITransport
from backend.main import app
from beanie import init_beanie
from pymongo import AsyncMongoClient
from backend.models import User, Session, Recipe, WorkoutTemplate, MealPlan, GroceryList

@pytest.fixture(scope="function")
async def client():
    # Setup database connection manually to ensure everything is registered correctly
    from backend.database.connection import get_settings
    from backend.models import User, Session, Recipe, WorkoutTemplate, MealPlan, GroceryList
    
    settings = get_settings()
    mongo_client = AsyncMongoClient(settings.DATABASE_URL)
    db = mongo_client.get_default_database()
    
    await init_beanie(
        database=db,
        document_models=[User, Session, Recipe, WorkoutTemplate, MealPlan, GroceryList]
    )
    
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    
    # Clean up
    await mongo_client.drop_database(db.name)
    await mongo_client.close()

@pytest.mark.asyncio
async def test_full_user_journey(client):
    # 1. User signs up and logs in
    await client.post("/auth/signup", json={"username": "e2e_user", "password": "password123"})
    login_res = await client.post("/auth/sign-in", data={"username": "e2e_user", "password": "password123"})
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. User creates a workout session
    session_data = {"name": "Morning Run", "date": "2026-04-30"}
    create_session_res = await client.post("/sessions", json=session_data, headers=headers)
    assert create_session_res.status_code == 201
    session_id = create_session_res.json()["id"]

    # 3. User views their sessions
    list_sessions_res = await client.get("/sessions", headers=headers)
    assert any(s["id"] == session_id for s in list_sessions_res.json())

    # 4. User creates a recipe
    recipe_data = {
        "name": "Protein Shake",
        "ingredients": [], # Simple empty list for test
        "instructions": "Mix with water"
    }
    create_recipe_res = await client.post("/recipes", json=recipe_data, headers=headers)
    assert create_recipe_res.status_code == 201
    recipe_id = create_recipe_res.json()["_id"] # Beanie/MongoDB uses _id

    # 5. User checks their profile
    me_res = await client.get("/auth/me", headers=headers)
    assert me_res.json()["username"] == "e2e_user"
