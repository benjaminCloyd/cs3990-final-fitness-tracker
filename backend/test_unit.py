"""
UNIT TESTS: Low-level tests for individual functions and logic.
Verifies password hashing, JWT token handling, and data model mapping.
"""
import pytest
from backend.auth.hash_password import hash_password, verify_password
from backend.auth.jwt_handler import create_access_token, verify_access_token, TokenData
from backend.user_routes import user_to_response
from backend.models import User, MacroTargets
from datetime import datetime, timedelta, timezone
from beanie import init_beanie
from pymongo import AsyncMongoClient

class MockSettings:
    DATABASE_URL = "mongodb://localhost:27017"
    SECRET_KEY = "test_secret"
    USDA_API_KEY = "test_key"

@pytest.fixture(autouse=True)
def mock_settings(monkeypatch):
    # Patch get_settings where it is USED
    monkeypatch.setattr("auth.jwt_handler.get_settings", lambda: MockSettings())
    monkeypatch.setattr("database.connection.get_settings", lambda: MockSettings())

@pytest.mark.asyncio
async def test_password_hashing():
    password = "securepassword123"
    hashed = hash_password(password)
    assert hashed != password.encode()
    assert verify_password(password, str(hashed, "utf-8")) is True
    assert verify_password("wrongpassword", str(hashed, "utf-8")) is False

@pytest.mark.asyncio
async def test_jwt_lifecycle():
    data = {"username": "testuser", "role": "user"}
    token, expire = create_access_token(data)
    
    assert token is not None
    assert expire > datetime.now(timezone.utc)
    
    token_data = verify_access_token(token)
    assert token_data.username == "testuser"
    assert token_data.role == "user"

@pytest.mark.asyncio
async def test_user_to_response():
    # Initialize Beanie with AsyncMongoClient
    client = AsyncMongoClient("mongodb://localhost:27017/ironlog")
    await init_beanie(database=client.get_default_database(), document_models=[User])
    
    macro_targets = MacroTargets(calories=2000, protein=150, carbs=200, fat=70)
    user = User(
        username="testuser",
        password="hashed_password",
        role="user",
        height=180.0,
        weight=75.0,
        macro_targets=macro_targets
    )
    
    response = user_to_response(user)
    assert response.username == "testuser"
    assert response.role == "user"
    assert response.height == 180.0
    assert response.weight == 75.0
    assert response.macro_targets.calories == 2000
    await client.close()
