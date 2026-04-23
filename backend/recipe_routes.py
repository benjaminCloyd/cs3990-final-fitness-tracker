import shutil
import uuid
from pathlib import Path
from typing import List, Optional

from auth.authenticate import authenticate
from auth.jwt_handler import TokenData
from beanie import PydanticObjectId
from fastapi import APIRouter, Depends, HTTPException, File, UploadFile, status
from fastapi.responses import FileResponse
from starlette.background import BackgroundTask
from models import Recipe, RecipeRequest, MealPlan, MealPlanRequest, GroceryList, Ingredient, User
from usda_api import search_food_nutrients
from logger import log_event

recipe_router = APIRouter()
UPLOADS_DIR = Path(__file__).parent / "uploads"

# ── helpers ───────────────────────────────────────────────────────────────────

def require_admin(user: TokenData):
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required.")

async def get_recipe_or_404(recipe_id: str, user: TokenData) -> Recipe:
    try:
        oid = PydanticObjectId(recipe_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid recipe ID format.")
    recipe = await Recipe.get(oid)
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found.")
    if user.role != "admin" and recipe.owner != user.username:
        raise HTTPException(status_code=403, detail="Not authorized to access this recipe.")
    return recipe

# ── usda search ───────────────────────────────────────────────────────────────

@recipe_router.get("/search-nutrients")
async def search_nutrients(query: str, user: TokenData = Depends(authenticate)):
    nutrients = await search_food_nutrients(query)
    if not nutrients:
        raise HTTPException(status_code=404, detail="No nutrient data found for this item.")
    return nutrients

# ── recipes ───────────────────────────────────────────────────────────────────

@recipe_router.get("", response_model=List[Recipe])
async def list_recipes(user: TokenData = Depends(authenticate)):
    if user.role == "admin":
        return await Recipe.find_all().to_list()
    return await Recipe.find(Recipe.owner == user.username).to_list()

@recipe_router.post("", status_code=201)
async def create_recipe(body: RecipeRequest, user: TokenData = Depends(authenticate)):
    # Calculate total macros
    cals = sum(i.calories for i in body.ingredients)
    prot = sum(i.protein for i in body.ingredients)
    carb = sum(i.carbs for i in body.ingredients)
    fat = sum(i.fat for i in body.ingredients)
    
    recipe = Recipe(
        name=body.name,
        ingredients=body.ingredients,
        instructions=body.instructions,
        image_url=body.image_url,
        owner=user.username,
        calories_per_serving=cals,
        protein_per_serving=prot,
        carbs_per_serving=carb,
        fat_per_serving=fat
    )
    await recipe.create()
    log_event("Recipe Created", f"Recipe '{recipe.name}' created by {user.username}")
    return recipe

@recipe_router.get("/{recipe_id}", response_model=Recipe)
async def get_recipe(recipe_id: str, user: TokenData = Depends(authenticate)):
    return await get_recipe_or_404(recipe_id, user)

@recipe_router.put("/{recipe_id}")
async def update_recipe(recipe_id: str, body: RecipeRequest, user: TokenData = Depends(authenticate)):
    recipe = await get_recipe_or_404(recipe_id, user)
    
    cals = sum(i.calories for i in body.ingredients)
    prot = sum(i.protein for i in body.ingredients)
    carb = sum(i.carbs for i in body.ingredients)
    fat = sum(i.fat for i in body.ingredients)
    
    recipe.name = body.name
    recipe.ingredients = body.ingredients
    recipe.instructions = body.instructions
    recipe.image_url = body.image_url
    recipe.calories_per_serving = cals
    recipe.protein_per_serving = prot
    recipe.carbs_per_serving = carb
    recipe.fat_per_serving = fat
    
    await recipe.save()
    log_event("Recipe Updated", f"Recipe '{recipe.name}' updated by {user.username}")
    return recipe

@recipe_router.delete("/{recipe_id}")
async def delete_recipe(recipe_id: str, user: TokenData = Depends(authenticate)):
    recipe = await get_recipe_or_404(recipe_id, user)
    await recipe.delete()
    log_event("Recipe Deleted", f"Recipe '{recipe.name}' deleted by {user.username}")
    return {"message": "Recipe deleted successfully"}

# ── file upload ───────────────────────────────────────────────────────────────

@recipe_router.post("/upload-image")
async def upload_recipe_image(file: UploadFile = File(...), user: TokenData = Depends(authenticate)):
    ext = file.filename.split(".")[-1]
    filename = f"{uuid.uuid4()}.{ext}"
    dest = UPLOADS_DIR / filename
    
    with open(dest, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    url = f"/uploads/{filename}"
    log_event("File Upload", f"User {user.username} uploaded {filename}")
    return {"url": url}

# ── meal planner ──────────────────────────────────────────────────────────────

@recipe_router.get("/meal-plans/all", response_model=List[MealPlan])
async def list_meal_plans(user: TokenData = Depends(authenticate)):
    if user.role == "admin":
        return await MealPlan.find_all().to_list()
    return await MealPlan.find(MealPlan.owner == user.username).to_list()

@recipe_router.post("/meal-plans")
async def create_meal_plan(body: MealPlanRequest, user: TokenData = Depends(authenticate)):
    plan = MealPlan(
        week_start_date=body.week_start_date,
        owner=user.username,
        slots=body.slots
    )
    await plan.create()
    return plan

@recipe_router.get("/meal-plans/macros/{plan_id}")
async def get_meal_plan_macros(plan_id: str, user: TokenData = Depends(authenticate)):
    try:
        oid = PydanticObjectId(plan_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid plan ID.")
    
    plan = await MealPlan.get(oid)
    if not plan: raise HTTPException(status_code=404, detail="Plan not found.")
    
    # Aggregate macros per day
    daily_macros = {} # "Monday": {cals: 0, ...}
    
    for slot_key, recipe_id in plan.slots.items():
        day = slot_key.split("_")[0]
        if day not in daily_macros:
            daily_macros[day] = {"calories": 0, "protein": 0, "carbs": 0, "fat": 0}
        
        try:
            recipe_oid = PydanticObjectId(recipe_id)
            recipe = await Recipe.get(recipe_oid)
            if recipe:
                daily_macros[day]["calories"] += recipe.calories_per_serving
                daily_macros[day]["protein"] += recipe.protein_per_serving
                daily_macros[day]["carbs"] += recipe.carbs_per_serving
                daily_macros[day]["fat"] += recipe.fat_per_serving
        except:
            continue
            
    return daily_macros

# ── grocery list ──────────────────────────────────────────────────────────────

@recipe_router.post("/meal-plans/{plan_id}/generate-grocery-list")
async def generate_grocery_list(plan_id: str, user: TokenData = Depends(authenticate)):
    try:
        oid = PydanticObjectId(plan_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid plan ID.")
    
    plan = await MealPlan.get(oid)
    if not plan: raise HTTPException(status_code=404, detail="Plan not found.")
    
    ingredients_map = {} # name: quantity_list
    
    for recipe_id in plan.slots.values():
        try:
            recipe = await Recipe.get(PydanticObjectId(recipe_id))
            if recipe:
                for ing in recipe.ingredients:
                    if ing.name not in ingredients_map:
                        ingredients_map[ing.name] = []
                    ingredients_map[ing.name].append(ing.quantity)
        except: continue
        
    consolidated = []
    for name, quantities in ingredients_map.items():
        consolidated.append(Ingredient(name=name, quantity=", ".join(quantities)))
    
    gl = GroceryList(owner=user.username, items=consolidated, is_checked=[False]*len(consolidated))
    await gl.create()
    return gl

@recipe_router.get("/grocery-lists/download/{list_id}")
async def download_grocery_list(list_id: str, user: TokenData = Depends(authenticate)):
    try:
        oid = PydanticObjectId(list_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid ID.")
    
    gl = await GroceryList.get(oid)
    if not gl: raise HTTPException(status_code=404, detail="List not found.")
    
    # Generate a simple text file
    content = f"GROCERY LIST FOR {user.username}\n\n"
    for item in gl.items:
        content += f"- [ ] {item.name} ({item.quantity})\n"
    
    temp_file = Path(f"grocery_list_{list_id}.txt")
    with open(temp_file, "w") as f:
        f.write(content)
        
    return FileResponse(temp_file, filename="grocery_list.txt", background=BackgroundTask(temp_file.unlink))

# ── admin file management ─────────────────────────────────────────────────────

@recipe_router.get("/admin/files")
async def list_all_files(user: TokenData = Depends(authenticate)):
    require_admin(user)
    files = []
    for f in UPLOADS_DIR.iterdir():
        if f.is_file():
            files.append({"name": f.name, "size": f.stat().st_size})
    return files

@recipe_router.delete("/admin/files/{filename}")
async def delete_file(filename: str, user: TokenData = Depends(authenticate)):
    require_admin(user)
    target = UPLOADS_DIR / filename
    if target.exists() and target.is_file():
        target.unlink()
        log_event("File Deleted", f"Admin {user.username} deleted {filename}")
        return {"message": "File deleted"}
    raise HTTPException(status_code=404, detail="File not found")
