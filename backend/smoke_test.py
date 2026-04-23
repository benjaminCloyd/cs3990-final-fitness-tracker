import asyncio
import os
from datetime import datetime
from beanie import init_beanie
from pymongo import AsyncMongoClient
from models import User, Session, Recipe, Exercise, SetEntry, Ingredient, MacroTargets

async def run_smoke_test():
    # Attempt to get DATABASE_URL from environment or use a common local default
    db_url = os.getenv("DATABASE_URL", "mongodb://localhost:27017/ironlog_test")
    print(f"--- Starting Smoke Test ---")
    print(f"Connecting to: {db_url}")
    
    client = AsyncMongoClient(db_url)
    try:
        # Initialize Beanie with all models
        await init_beanie(
            database=client.get_default_database(),
            document_models=[User, Session, Recipe]
        )
        print("✅ Database initialized successfully.")

        # 1. Test User Creation
        test_username = f"testuser_{int(datetime.now().timestamp())}"
        user = User(
            username=test_username,
            password="hashed_password_here",
            height=180.0,
            weight=85.0,
            macro_targets=MacroTargets(calories=2500, protein=200, carbs=250, fat=80)
        )
        await user.create()
        print(f"✅ User created: {test_username}")

        # 2. Test Session & Exercise
        session = Session(
            name="Test Workout",
            date="10/25/2026",
            owner=test_username,
            exercises=[
                Exercise(
                    id=1,
                    name="Bench Press",
                    sets=[SetEntry(weight=225, reps=5)],
                    best_1rm=253.1
                )
            ]
        )
        await session.create()
        print(f"✅ Session created with 1 exercise.")

        # 3. Test Recipe
        recipe = Recipe(
            name="Test Protein Shake",
            ingredients=[
                Ingredient(name="Whey Protein", quantity="1 scoop", calories=120, protein=25, carbs=3, fat=1.5),
                Ingredient(name="Milk", quantity="200ml", calories=100, protein=8, carbs=10, fat=4)
            ],
            instructions="Mix and shake.",
            owner=test_username,
            calories_per_serving=220,
            protein_per_serving=33,
            carbs_per_serving=13,
            fat_per_serving=5.5
        )
        await recipe.create()
        print(f"✅ Recipe created: {recipe.name}")

        # 4. Verification Cleanup (Optional)
        # We'll leave them in for you to see in MongoDB, but we'll fetch them to prove they exist
        found_user = await User.find_one(User.username == test_username)
        if found_user:
            print(f"✅ Verification: Found user {found_user.username} in DB.")
        
        print(f"--- Smoke Test Passed! ---")

    except Exception as e:
        print(f"❌ Smoke Test Failed: {e}")
    finally:
        client.close()

if __name__ == "__main__":
    asyncio.run(run_smoke_test())
