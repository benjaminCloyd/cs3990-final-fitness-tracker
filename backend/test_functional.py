import pytest
from httpx import AsyncClient, ASGITransport
from main import app
from beanie import init_beanie
from pymongo import AsyncMongoClient
from models import User, Session, Recipe, WorkoutTemplate, MealPlan, GroceryList

@pytest.fixture(scope="function")
async def client():
    # Setup database inside function scope
    mongo_client = AsyncMongoClient("mongodb://localhost:27017")
    db = mongo_client["ironlog"]
    await init_beanie(
        database=db,
        document_models=[User, Session, Recipe, WorkoutTemplate, MealPlan, GroceryList]
    )
    
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    
    # Cleanup
    await mongo_client.drop_database("ironlog")
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
