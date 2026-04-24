import asyncio
from beanie import init_beanie
from pymongo import AsyncMongoClient
from models import User, Session, Recipe, WorkoutTemplate, MealPlan, GroceryList, Exercise, SetEntry, Ingredient
from auth.hash_password import hash_password

async def seed():
    # Use the test database so we don't overwrite your main data
    client = AsyncMongoClient("mongodb://localhost:27017/ironlog_seed")
    await init_beanie(database=client.get_default_database(), 
                     document_models=[User, Session, Recipe, WorkoutTemplate, MealPlan, GroceryList])

    # 1. Clear existing data
    await User.find_all().delete()
    await Session.find_all().delete()
    await Recipe.find_all().delete()

    # 2. Create Admin and Standard User
    admin_pw = str(hash_password("admin123"), "utf-8")
    user_pw = str(hash_password("user123"), "utf-8")
    
    admin = User(username="admin_boss", password=admin_pw, role="admin", weight=95.0)
    user = User(username="fitness_fan", password=user_pw, role="user", weight=70.0)
    await admin.create()
    await user.create()

    # 3. Create a Recipe
    shake = Recipe(
        name="Post-Workout Power Shake",
        ingredients=[
            Ingredient(name="Whey Protein", quantity="1 scoop", calories=120, protein=25, carbs=3, fat=1),
            Ingredient(name="Banana", quantity="1 medium", calories=105, protein=1, carbs=27, fat=0.3),
            Ingredient(name="Oat Milk", quantity="1 cup", calories=130, protein=4, carbs=20, fat=5)
        ],
        instructions="Blend all ingredients until smooth.",
        owner="fitness_fan",
        calories_per_serving=355, protein_per_serving=30, carbs_per_serving=50, fat_per_serving=6.3
    )
    await shake.create()

    # 4. Create a Workout Session
    workout = Session(
        name="Powerlifting A",
        date="03/15/2026",
        owner="fitness_fan",
        exercises=[
            Exercise(
                id=1, 
                name="Squat", 
                sets=[SetEntry(weight=315, reps=5), SetEntry(weight=315, reps=5)], 
                best_1rm=367.5
            ),
            Exercise(
                id=2,
                name="Bench Press",
                sets=[SetEntry(weight=225, reps=5)],
                best_1rm=262.5
            )
        ]
    )
    await workout.create()

    print("✅ Database 'ironlog_seed' seeded successfully.")
    print("   Created: admin_boss/admin123 and fitness_fan/user123")

if __name__ == "__main__":
    asyncio.run(seed())
