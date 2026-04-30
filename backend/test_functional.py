"""
FUNCTIONAL TESTS: Focuses on business requirements and output verification.
Tests the core authentication flow (Signup/Signin) from an API perspective.
"""
import pytest
from httpx import AsyncClient, ASGITransport
from main import app
from beanie import init_beanie
from pymongo import AsyncMongoClient
from models import User, Session, Recipe, WorkoutTemplate, MealPlan, GroceryList

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
async def test_auth_flow(client):
    # 1. Signup
    signup_data = {
        "username": "testfunctional",
        "password": "testpassword123"
    }
    response = await client.post("/auth/signup", json=signup_data)
    assert response.status_code == 200
    assert response.json()["message"] == "User created successfully"
    
    # 2. Duplicate Signup should fail
    response = await client.post("/auth/signup", json=signup_data)
    assert response.status_code == 409
    
    # 3. Signin
    login_data = {
        "username": "testfunctional",
        "password": "testpassword123"
    }
    response = await client.post("/auth/sign-in", data=login_data)
    assert response.status_code == 200
    token_data = response.json()
    assert "access_token" in token_data
    assert token_data["username"] == "testfunctional"
    
    # 4. Get Me (Requires Auth)
    token = token_data["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    response = await client.get("/auth/me", headers=headers)
    assert response.status_code == 200
    assert response.json()["username"] == "testfunctional"
