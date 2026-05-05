"""
ACCEPTANCE TESTS: Formal tests verifying that system satisfies business requirements.
Checks security rules like admin-only access and login blocks for deactivated users.
"""
import pytest
from httpx import AsyncClient, ASGITransport
from backend.main import app
from beanie import init_beanie
from pymongo import AsyncMongoClient
from backend.models import User, Session, Recipe, WorkoutTemplate, MealPlan, GroceryList
from backend.auth.hash_password import hash_password

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
    
    # Pre-seed users
    admin_pw = str(hash_password("admin123"), "utf-8")
    user_pw = str(hash_password("user123"), "utf-8")
    
    await User(username="admin", password=admin_pw, role="admin").create()
    await User(username="standard", password=user_pw, role="user").create()
    await User(username="deactivated", password=user_pw, role="user", is_deactivated=True).create()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    
    # Clean up
    await mongo_client.drop_database(db.name)
    await mongo_client.close()

@pytest.mark.asyncio
async def test_admin_only_logs(client):
    # Standard user login
    login_res = await client.post("/auth/sign-in", data={"username": "standard", "password": "user123"})
    token = login_res.json()["access_token"]
    
    # Standard user tries to view logs -> 403
    res = await client.get("/auth/logs", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 403

    # Admin login
    login_res = await client.post("/auth/sign-in", data={"username": "admin", "password": "admin123"})
    token = login_res.json()["access_token"]
    
    # Admin tries to view logs -> 200
    res = await client.get("/auth/logs", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200

@pytest.mark.asyncio
async def test_deactivated_user_login(client):
    # Deactivated user tries to login -> 403
    res = await client.post("/auth/sign-in", data={"username": "deactivated", "password": "user123"})
    assert res.status_code == 403
    assert "deactivated" in res.json()["detail"].lower()
