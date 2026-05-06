import httpx
from backend.database.connection import get_settings

SETTINGS = get_settings()
BASE_URL = "https://api.nal.usda.gov/fdc/v1"

NUTRIENT_MAP = {
    # 1008 intentionally removed — calories are derived from macros (P×4 + C×4 + F×9)
    1003: "protein",
    1005: "carbs",
    1004: "fat",
}


async def search_food_nutrients(query: str, max_results: int = 3) -> list | None:
    """
    Search USDA FoodData Central and return the top N results with
    macro data (protein/carbs/fat) per 100g. Calories are intentionally
    excluded — they should be derived from macros for internal consistency.
    """
    params = {
        "api_key": SETTINGS.USDA_API_KEY,
        "query": query,
        "pageSize": max_results * 3,
        "dataType": ["Foundation", "SR Legacy"],
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
        nutrients = {k: 0.0 for k in NUTRIENT_MAP.values()}

        for n in food.get("foodNutrients", []):
            nid = n.get("nutrientId")
            if nid in NUTRIENT_MAP:
                nutrients[NUTRIENT_MAP[nid]] = round(n.get("value", 0.0), 2)

        # Skip entries where all three macros are zero
        if all(v == 0 for v in nutrients.values()):
            continue

        nutrients["name"] = food.get("description", "Unknown")
        results.append(nutrients)

        if len(results) >= max_results:
            break

    return results if results else None
