import httpx
from backend.database.connection import get_settings

SETTINGS = get_settings()
BASE_URL = "https://api.nal.usda.gov/fdc/v1"

NUTRIENT_MAP = {
    1003: "protein",
    1005: "carbs",
    1050: "carbs",  # Carbohydrate, by summation
    1004: "fat",
}


async def search_food_nutrients(query: str, max_results: int = 5) -> list | None:
    """
    Search USDA FoodData Central and return the top N results with
    macro data (protein/carbs/fat) per 100g.
    Includes Foundation, SR Legacy, Branded, and Survey (FNDDS) for better coverage.
    """
    params = {
        "api_key": SETTINGS.USDA_API_KEY,
        "query": query,
        "pageSize": max_results * 5,
        "dataType": ["Foundation", "SR Legacy", "Branded", "Survey (FNDDS)"],
    }

    async with httpx.AsyncClient() as client:
        response = await client.get(f"{BASE_URL}/foods/search", params=params)
        if response.status_code != 200:
            return None

        data = response.json()
        foods = data.get("foods", [])
        if not foods:
            return None

    results = []
    for food in foods:
        nutrients = {k: 0.0 for k in ["protein", "carbs", "fat"]}

        for n in food.get("foodNutrients", []):
            nid = n.get("nutrientId")
            if nid in NUTRIENT_MAP:
                # If we already have a value (e.g. from 1005), don't overwrite with 1050 unless 1050 is higher
                # or just use 1005 preferentially.
                key = NUTRIENT_MAP[nid]
                val = round(n.get("value", 0.0), 2)
                if nutrients[key] == 0.0 or (nid == 1005):
                     nutrients[key] = val

        # Skip entries where all three macros are zero
        if all(v == 0 for v in nutrients.values()):
            continue

        nutrients["name"] = food.get("description", "Unknown")
        results.append(nutrients)

        if len(results) >= max_results:
            break

    return results if results else None
