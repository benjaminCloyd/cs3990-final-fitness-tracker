import httpx
from database.connection import get_settings

SETTINGS = get_settings()
BASE_URL = "https://api.nal.usda.gov/fdc/v1"

async def search_food_nutrients(query: str):
    """
    Search for a food item and return its nutrient breakdown per 100g.
    """
    params = {
        "api_key": SETTINGS.USDA_API_KEY,
        "query": query,
        "pageSize": 1,
        "dataType": ["Foundation", "SR Legacy"]
    }
    
    async with httpx.AsyncClient() as client:
        response = await client.get(f"{BASE_URL}/foods/search", params=params)
        if response.status_code != 200:
            return None
        
        data = response.json()
        if not data.get("foods"):
            return None
        
        food = data["foods"][0]
        nutrients = {
            "calories": 0.0,
            "protein": 0.0,
            "carbs": 0.0,
            "fat": 0.0
        }
        
        # Nutrient IDs mapping
        mapping = {
            1008: "calories",
            1003: "protein",
            1005: "carbs",
            1004: "fat"
        }
        
        for n in food.get("foodNutrients", []):
            nid = n.get("nutrientId")
            if nid in mapping:
                nutrients[mapping[nid]] = n.get("value", 0.0)
        
        return nutrients
