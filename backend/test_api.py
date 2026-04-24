import asyncio
import pytest
from beanie import init_beanie
from pymongo import AsyncMongoClient
from models import User, Session, Recipe, Exercise, SetEntry, Ingredient, WorkoutTemplate, MealPlan, GroceryList

# Simplified Direct Model Test
@pytest.mark.asyncio
async def test_direct_db_operations():
    client = AsyncMongoClient("mongodb://localhost:27017/ironlog_direct_test")
    await init_beanie(database=client.get_default_database(), 
                     document_models=[User, Session, Recipe, WorkoutTemplate, MealPlan, GroceryList])
    
    # 1. Test User Persistence
    user = User(username="direct_user", password="hashed_pw")
    await user.create()
    
    found = await User.find_one(User.username == "direct_user")
    assert found is not None
    assert found.username == "direct_user"
    
    # 2. Test Session Persistence
    session = Session(name="Direct Workout", date="01/01/2026", owner="direct_user")
    await session.create()
    
    found_s = await Session.find_one(Session.owner == "direct_user")
    assert found_s is not None
    assert found_s.name == "Direct Workout"
    
    # 3. Test Recipe Persistence
    recipe = Recipe(
        name="Direct Recipe", 
        ingredients=[Ingredient(name="Water", quantity="1 cup")], 
        owner="direct_user"
    )
    await recipe.create()
    
    found_r = await Recipe.find_one(Recipe.owner == "direct_user")
    assert found_r is not None
    assert found_r.name == "Direct Recipe"

    # Cleanup
    await User.find_all().delete()
    await Session.find_all().delete()
    await Recipe.find_all().delete()
    client.close()
