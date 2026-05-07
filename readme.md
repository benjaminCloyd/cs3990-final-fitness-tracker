# Fitness Tracker Application

A comprehensive full-stack fitness, nutrition, and meal-planning application designed to help users monitor their health journey through data-driven insights and organized preparation.

---

## Project Preview

> **Dashboard Overview**  
> ![Dashboard Screenshot](images/dashboard.png)

---

## Getting Started

### Prerequisites
- **Node.js** (v16 or higher)
- **npm** or **yarn**
- **Database**: [Specify your DB, e.g., PostgreSQL/MongoDB]

### Installation & Setup

1. **Clone the Repository**
   ```bash
   git clone <repository-url>
   cd cs3990-final-fitness-tracker
   ```

2. **Backend Configuration**
   - For information about the backend of this program, please reference the readme.md file in the backend directory.
   - To run backend from project root: `uvicorn backend.main:app --reload`


3. **Frontend Configuration**
   - Navigate to the client directory: `cd frontend`
   - Install dependencies: `npm install`
   - Start the development server: `npm run dev`

---

## Project Features & User Capabilities

Our application provides a holistic approach to health management, allowing users to handle everything from workout intensity to weekly food preparation.

### 1. Fitness & Activity Tracking (CRUD)
Maintain a complete history of your physical activity with full CRUD capabilities:
- **Log Workouts**: Create new entries with exercise types, sets, reps, and weights.
- **View History**: Read and review your past workout performance.
- **Edit Logs**: Update entries to correct mistakes or adjust data.
- **Remove Entries**: Delete logs that are no longer relevant to your history.

> **Excersise Log**
> ![Workout Tracking](images/multipleExercise.png)

### 2. Progress Visualization
The application utilizes **Chart.js** to transform raw data into visual insights. Users can track their weight trends, strength increases, and caloric consistency over time.

> **Progress Chart**
> ![Progress Charts](images/progress.png)

### 3. Nutrition & Macro API Integration
The app features an integrated **Macro API Puller**. Users can search for specific food items, and the application fetches real-time nutritional data (Calories, Protein, Carbs, and Fats) from a verified external database to ensure accurate logging.

> **Macro API Searching**
> ![Macro Pulling](images/macrosearch.png)

### 4. Recipe & Meal Management
- **Save Recipes**: Create a digital cookbook of your favorite healthy meals.
- **Create Meal Plans**: Organize your week by assigning recipes to specific days.
- **Recipe Image Upload**: (File Upload) Users can personalize their saved recipes by uploading custom images of their prepared meals.

> **Recipe Page**
> ![Recipes](images/recipes.png)

> **Image Uploaded to Recipe**
> ![Recipes Images](images/recipes2.png)

> **Meal Plan Page**
> ![Meal Plan](images/mealplan.png)

### 5. Grocery List Generation
- **Automatic Generation**: The app parses your weekly meal plan to identify all necessary ingredients.
- **Export List**: (File Download) Users can download their generated grocery list as a portable file (e.g., PDF or Text) for easy use while shopping.

> **Generated Grocery List**
> ![Grocery List](images/grocery.png)

---
