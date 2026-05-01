import pytest
import os
from pathlib import Path
from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)

from datetime import timedelta
from backend.auth.jwt_handler import create_access_token

# Helper to generate valid tokens
def get_auth_headers(role="user"):
    token, _ = create_access_token({"username": "testuser", "role": role})
    return {"Authorization": f"Bearer {token}"}

def test_upload_image():
    # Test file upload
    test_file = Path("test_image.png")
    test_file.write_bytes(b"fake_image_content")
    
    with open(test_file, "rb") as f:
        response = client.post(
            "/recipes/upload-image",
            files={"file": ("test_image.png", f, "image/png")},
            headers=get_auth_headers()
        )
    
    assert response.status_code == 200
    assert "url" in response.json()
    
    test_file.unlink()

def test_admin_file_management():
    # Test admin access to list files
    response = client.get("/recipes/admin/files", headers=get_auth_headers(role="admin"))
    # Expecting 200 if the admin role check passes
    assert response.status_code == 200
    assert isinstance(response.json(), list)

def test_non_admin_file_management():
    # Test non-admin access to list files
    response = client.get("/recipes/admin/files", headers=get_auth_headers(role="user"))
    # Expecting 403 Forbidden
    assert response.status_code == 403
