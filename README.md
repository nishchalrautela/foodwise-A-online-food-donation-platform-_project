# FoodWise

Lightweight Flask application that helps kitchens track inventory, log surplus food, and move it to NGOs.

## Highlights

- 🍲 **Inventory hub** – register prepared batches (human or pet friendly), ties each batch back to a restaurant if needed.
- ♻️ **NGO demand board** – NGOs submit requests (human & pet) with urgency so kitchens/restaurants know what to cook.
- 🍽️ **Restaurant portal** – partner restaurants log leftover meals that immediately appear in the shared inventory.
- 🎁 **Donation pipeline** – match batches to NGO partners, keep auditable history, and auto-mark donated items.
- 📊 **Analytics dashboard** – live summary cards, bar + line charts, and combined activity feed powered by new trend APIs.
- 🗺️ **Interactive Maps** – visualize nearby NGOs and food platforms on Google Maps with filtering and location features.
- ⚙️ **Robust APIs** – validation, helpful error messages, CRUD for inventory, requests, restaurant submissions, and `/api/analytics/trends`.

## Quick start

```bash
cd /Users/nsrexe/Desktop/codes/dbms\ pbl/foodwise_full_project
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Set up environment variables (required for Maps feature)
cp .env.example .env
# Edit .env and add your Google Maps API key
# GOOGLE_MAPS_API_KEY=your-actual-api-key-here

python app.py
```

Open http://127.0.0.1:5000/ and you're ready.

> The SQLite database lives in `instance/foodwise.db`. Delete it if you want a clean slate; the app will recreate it and seed a default NGO.

## API overview

| Endpoint | Method(s) | Description |
| --- | --- | --- |
| `/api/inventory` | GET, POST | List batches with optional `status`/`search` filters or create a new batch. |
| `/api/inventory/<id>` | GET, PUT, DELETE | Fetch, update, or delete a batch. |
| `/api/surplus-food` | GET, POST | List recent surplus food entries or log a new one (auto-deducts remaining stock). |
| `/api/donations` | GET, POST | List recent donations or record a new donation (auto-deducts remaining stock). |
| `/api/ngos` | GET | Retrieve partner NGOs. |
| `/api/food-platforms` | GET | Retrieve food platform/kitchen locations. |
| `/api/locations` | GET | Get all NGOs and Food Platforms with location coordinates. |
| `/api/restaurants/submissions` | POST | Restaurants log leftovers (category, quantity, platform). |
| `/api/food-requests` | GET, POST | NGOs submit demand for human/pet meals. |
| `/api/food-requests/<id>` | PUT | Update request status, urgency, or notes. |
| `/api/analytics` | GET | Totals for produced, remaining, donated, and surplus food. |
| `/api/analytics/trends?days=7` | GET | Daily quantities for produced, donated, and surplus food items (1–30 day window). |
| `/api/health` | GET | Lightweight health/status check. |

All endpoints respond with JSON and descriptive error messages when validation fails.

### Sample requests

```bash
curl -X POST http://127.0.0.1:5000/api/inventory \
     -H "Content-Type: application/json" \
     -d '{"item_type":"Veg Biryani","quantity":12,"date_prepared":"2025-11-18"}'

curl http://127.0.0.1:5000/api/analytics/trends?days=14
```

## Front-end tour

- `Inventory` – now tracks category (human/pet) plus restaurant source. Filter by status or category.
- `Surplus Food` / `Donations` – capture wastage, donations, and auto-adjust inventory.
- `Requests` – NGOs submit meal requests with urgency, track status, and update as fulfilled.
- `Restaurants` – kitchens/restaurants log leftover dishes that immediately flow into inventory.
- `Analytics` – consolidates totals, trends, and mixed activity feed powered by Chart.js.
- `Maps` – displays NGOs and food platforms on Google Maps with filtering, user location, and interactive markers.
- Global toast notifications + loading states keep feedback consistent.

## Development notes

- Built with Flask 2.x and SQLAlchemy 3.x. The latest update adds new columns (`category`, `platform_id`) and new tables (`food_request`). If you already had `instance/foodwise.db`, delete it (or run migrations) to apply the new schema:
  ```bash
  rm instance/foodwise.db
  python app.py  # recreates with seed data
  ```
- Static assets live under `static/` and pages in `templates/`.
- Any Python changes auto-reload when `debug=True`.
- **Google Maps Integration**: 
  - Copy `.env.example` to `.env` and add your `GOOGLE_MAPS_API_KEY`
  - Get your API key from [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
  - Enable "Maps JavaScript API" and "Places API" for full functionality
  - The app automatically loads variables from `.env` file using `python-dotenv`
  - **Troubleshooting**: If maps don't load, check:
    - API key is set correctly in `.env` file (no quotes, no spaces)
    - "Maps JavaScript API" is enabled in Google Cloud Console
    - API key has no HTTP referrer restrictions (or localhost is allowed)
    - Restart Flask app after changing `.env` file
    - Check browser console (F12) for specific error messages
- Consider exporting the SQLite DB before deploying or swapping to a managed database via the `DATABASE_URL` env var.


##cd /Users/nsrexe/Desktop/codes/dbms\ pbl/foodwise_full_project && python -m py_compile app.py models.py




AIzaSyDI2P3Gq7YiGL9vhtR80zyjiRzQK7KF3qA
