"""
UNIT TESTS: Low-level tests for individual functions and logic.
Verifies password hashing, JWT token handling, and data model mapping.
"""
import pytest
from backend.auth.hash_password import hash_password, verify_password
from backend.auth.jwt_handler import create_access_token, verify_access_token
from backend.user_routes import user_to_response
from backend.models import User, MacroTargets
from datetime import datetime, timedelta, timezone
from fastapi import HTTPException

class BadSettings:
    SECRET_KEY = "wrong_secret_key_but_long_enough_to_be_secure_32_bytes"

@pytest.fixture(autouse=True)
def mock_settings(monkeypatch):
    from backend.auth import jwt_handler
    class GoodSettings:
        SECRET_KEY = "test_secret_key_with_at_least_32_bytes_of_length"
    monkeypatch.setattr(jwt_handler, "get_settings", lambda: GoodSettings())

@pytest.mark.asyncio
async def test_password_hashing():
    password = "securepassword123"
    hashed = hash_password(password)
    assert hashed != password.encode()
    assert verify_password(password, str(hashed, "utf-8")) is True
    assert verify_password("wrongpassword", str(hashed, "utf-8")) is False

def test_jwt_lifecycle():
    data = {"username": "testuser", "role": "user"}
    token, _ = create_access_token(data)
    
    token_data = verify_access_token(token)
    assert token_data.username == "testuser"
    assert token_data.role == "user"

def test_jwt_rejects_expired_token():
    data = {"username": "testuser", "role": "user"}
    # Create expired token
    token, _ = create_access_token(data, expires_delta=timedelta(seconds=-1))
    with pytest.raises(HTTPException) as exc:
        verify_access_token(token)
    assert exc.value.status_code == 403

def test_jwt_rejects_wrong_key(monkeypatch):
    from backend.auth import jwt_handler
    data = {"username": "testuser", "role": "user"}
    token, _ = create_access_token(data)
    
    monkeypatch.setattr(jwt_handler, "get_settings", lambda: BadSettings())
    
    with pytest.raises(HTTPException) as exc:
        verify_access_token(token)
    assert exc.value.status_code == 401

from types import SimpleNamespace

def test_user_to_response():
    # Use a mock object instead of the real User document
    macro_targets = MacroTargets(calories=2000, protein=150, carbs=200, fat=70)
    user = SimpleNamespace(
        username="testuser",
        role="user",
        height=180.0,
        weight=75.0,
        is_deactivated=False,
        macro_targets=macro_targets
    )
    
    response = user_to_response(user)
    assert response.username == "testuser"
    assert response.role == "user"
    assert response.height == 180.0
    assert response.weight == 75.0
    assert response.macro_targets.calories == 2000
