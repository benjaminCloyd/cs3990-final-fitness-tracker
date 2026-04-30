import pytest
import time
from httpx import AsyncClient, ASGITransport
from main import app
from beanie import init_beanie
from pymongo import AsyncMongoClient
from models import User, Session, Recipe, WorkoutTemplate, MealPlan, GroceryList

@pytest.fixture(scope="function")
async def client():
    mongo_client = AsyncMongoClient("mongodb://localhost:27017")
    db = mongo_client["ironlog"]
    await init_beanie(
        database=db,
        document_models=[User, Session, Recipe, WorkoutTemplate, MealPlan, GroceryList]
    )
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    await mongo_client.drop_database("ironlog")
    await mongo_client.close()

@pytest.mark.asyncio
async def test_endpoint_latency(client):
    # Test latency for a simple GET request
    start_time = time.perf_counter()
    response = await client.get("/auth/me") # Will return 401 but still measures latency
    end_time = time.perf_counter()
    
    latency = end_time - start_time
    print(f"GET /auth/me latency: {latency:.4f}s")
    
    # Assert latency is below 200ms (typical requirement)
    assert latency < 0.2

@pytest.mark.asyncio
async def test_login_performance(client):
    # Create a user first
    await client.post("/auth/signup", json={"username": "perf_user", "password": "password123"})
    
    # Measure login time (hashing is expensive)
    latencies = []
    for _ in range(5):
        start_time = time.perf_counter()
        await client.post("/auth/sign-in", data={"username": "perf_user", "password": "password123"})
        latencies.append(time.perf_counter() - start_time)
    
    avg_latency = sum(latencies) / len(latencies)
    print(f"Average login latency: {avg_latency:.4f}s")
    
    # Login usually takes more time due to bcrypt (0.1 - 0.5s is normal)
    assert avg_latency < 1.0
