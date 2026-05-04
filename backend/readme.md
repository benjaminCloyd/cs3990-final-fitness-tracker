# IRONLOG Backend

This directory contains the FastAPI-based backend for the IRONLOG fitness and nutrition tracker. It handles user authentication, workout logging, recipe management, and nutritional calculations, it has authentication and login for users and allows for the uploading of food images and the downloading grocery lists 



- **Object Document Mapping**: Beanie - for mapping data to mongo dB.
- **Data Validation**: Pydantic- Data parsing and validation using Python type hints.
- **Authentication**:  JWT with Bcrypt for password hashing.
- **Nutrition Data**: [USDA FoodData API](https://fdc.nal.usda.gov/api-guide) - Uses for getting nutrition facts for ingredients

## Data Communication

### API design
The backend communicates with the frontend via RESTful API using JSON formatting.

- **Routing**: Routes are modified into separate files (`user_routes.py`, `workout_routes.py`, `recipe_routes.py`) and mounted in `main.py`.
- **Request Handling**: Use Pydantic (defined in `models.py`) to parse and validate incoming requests from frontend .
- **Response system**: Pydantic models and Beanie documents are converted to JSON for responses, for communication purposes.
- **Authentication**: Endpoints are protected by JWT-based authentication (`auth/authenticate.py`). The frontend sends the token in the `Authorization: Bearer <token>` header.

### File Management
- Recipe images are uploaded to the `backend/uploads/` directory. (subject to change)
##  Data Handling

### Data
The application uses **MongoDB** for storage of data.

- **Beanie ODM**: Maps Python classes directly to MongoDB collections structure e.  Used for database interactions.
-  Database structures are defined in `models.py`. Beanie handles the initialization and indexing of these collections on startup.
- **CRUD**: A generic Database wrapper (`database/connection.py`) for Beanie documents.

### Key Data Entities
- **User**: Stores profiles, hashed credentials, and users macro targets.
- **Session**: Records individual workout sessions, including exercises, sets, and calculated 1-Rep Max (1RM) values.
- **Recipe**: Contains ingredients (linked to USDA data), instructions, and calculated nutritional summaries (Ingredients held to reduce redundant calls may change due to bloat).
- **MealPlan**: Maps recipes to specific dates and meal slots for a weekly view.
- **WorkoutTemplate**: Allows users to save and reuse exercise routines.

### USDA food
The `usda_api.py` module handles asynchronous requests to the USDA API. It fetches nutritional facts for ingredients, which is then processed and stored within the `Recipe` documents to avoid redundant calls.

## Directory

- `auth/`: JWT handling and password hashing logic.
- `database/`: Connection management and database initialization.
- `static/`: Built frontend assets.
- `uploads/`: Storage for user-uploaded images.
- `main.py`: Entry point for the FastAPI application.
- `models.py`: Pydantic and Beanie data models.
- `user_routes.py`, `workout_routes.py`, `recipe_routes.py`: API endpoint definitions.
- `usda_api.py`: USDA FoodData integration.

## Setup

1. **Environment Variables**: Create a `.env` file in the `backend/` directory with:
  ``` env
   DATABASE_URL=mongodb://localhost:27017/ironlog
   SECRET_KEY=your_secret_key_here
   USDA_API_KEY=your_usda_api_key_here
   ```

2. **Install Dependencies**:
   ```
   pip install -r requirements.txt
   ```
3. **Run Server**:
   ```
   uvicorn backend.main:app --reload
   ```
   note the backend included in the command 
