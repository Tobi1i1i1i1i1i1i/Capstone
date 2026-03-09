# xyz
# ChurnIQ — Customer Churn Prediction Dashboard
## Tech Stack
- **Frontend/Backend:** Node.js
- **CI/CD:** Jenkins (Builds #7-9 verified green)
- **Deployment:** Docker
A full-stack web application for predicting and managing customer churn. Features authentication, a data-driven analytics dashboard, a Flask ML API powered by a trained Random Forest model, and a Jenkins CI/CD pipeline — all containerized with Docker.

![Node.js](https://img.shields.io/badge/Node.js-22+-green)
![Python](https://img.shields.io/badge/Python-3.12-blue)
![MongoDB](https://img.shields.io/badge/MongoDB-7-brightgreen)
![Flask](https://img.shields.io/badge/Flask-3.1-lightgrey)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED)
![Jenkins](https://img.shields.io/badge/Jenkins-CI%2FCD-D24939)

---

## Features

- Email/password signup & login + Google OAuth 2.0 (find-or-create user, account linking)
- Session-based authentication stored in MongoDB
- Churn prediction dashboard with live KPI cards, charts, and predictions table
- Single and bulk (CSV) customer churn prediction
- Flask ML API — Random Forest model inference via `/predict` endpoint
- Graceful fallback to rule-based model when ML API is unreachable
- Retention strategy recommendations (High / Medium / Low risk)
- Model performance comparison (Random Forest, XGBoost, Gradient Boosting, etc.)
- Jenkins CI/CD pipeline — automated test, build, and deploy on every push
- Fully containerized — Node.js + Python Flask in one Docker image alongside MongoDB

---

## Architecture

```
CSV Dataset → Preprocessing → Training (scikit-learn)
                                      ↓
                             model.pkl + scaler.pkl
                                      ↓
                              Flask ML API (:5000)
                                      ↓
         Browser → Node.js / Express (:3000) → MongoDB
```

---

## Quick Start

### Prerequisites

- Node.js 22+
- Python 3.12+
- MongoDB running locally on port `27017` *(or use Docker Compose)*

### Run locally

```bash
# 1. Clone the repo
git clone https://github.com/mitratobi/Capstone.git
cd Capstone

# 2. Install Node.js dependencies
npm install

# 3. Set up environment variables
cp .env.example .env
# Edit .env — set SESSION_SECRET and optionally Google OAuth keys

# 4. Train the ML model (generates ml/model.pkl + ml/scaler.pkl)
cd ml
pip install -r requirements.txt
python train.py
cd ..

# 5. Start the Flask ML API
cd ml && python app.py &

# 6. Seed the dashboard with 2000 sample customers
npm run seed

# 7. Start the app
npm start

# 8. Open browser → http://localhost:3000
```

### Run with Docker

```bash
# 1. Copy and fill in your environment variables
cp .env.example .env
# Edit .env — set MONGODB_URI, SESSION_SECRET, and optionally Google OAuth keys

# 2. Train the model if you haven't already (generates ml/model.pkl + ml/scaler.pkl)
cd ml && pip install -r requirements.txt && python train.py && cd ..

# 3. Build and start all containers
docker compose up -d --build
```

- App: `http://localhost:3000`
- ML API: `http://localhost:5000`

> Docker Compose reads all credentials from your local `.env` file — no secrets are stored in the repo.

#### Connecting to a host MongoDB from Docker (Linux)

The `compose.yaml` uses `extra_hosts: host.docker.internal:host-gateway` so containers can reach services running on your host machine. Set your `MONGODB_URI` in `.env` to your host's LAN IP:

```env
MONGODB_URI=mongodb://<your-lan-ip>:27017/loginpage
```

---

## Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create **OAuth 2.0 Client ID** credentials (Web application)
3. Add an authorised redirect URI: `http://localhost:3000/auth/google/callback`
4. Add your credentials to `.env`:

```env
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback
```

**Behaviour:**
- New Google users get an account created automatically
- Existing email/password accounts are linked to Google on first OAuth sign-in
- Accounts created via Google cannot use password login

> The app works without Google OAuth — email/password login will still be available.

---

## ML API — Flask Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Health check + model info |
| `POST` | `/predict` | Single customer prediction |
| `POST` | `/predict/batch` | Batch prediction (JSON array) |
| `GET` | `/feature-importance` | Model feature importances |
| `GET` | `/model-info` | Model name, features, scaler status |

**Example request:**

```bash
curl -X POST http://localhost:5000/predict \
  -H "Content-Type: application/json" \
  -d '{
    "customer_id": "100001",
    "age": 35,
    "no_of_days_subscribed": 180,
    "multi_screen": "yes",
    "mail_subscribed": "no",
    "weekly_mins_watched": 120,
    "minimum_daily_mins": 10,
    "maximum_daily_mins": 60,
    "weekly_max_night_mins": 30,
    "videos_watched": 25,
    "maximum_days_inactive": 5,
    "customer_support_calls": 3
  }'
```

**Example response:**

```json
{
  "customer_id": "100001",
  "churn_prediction": 1,
  "churn_probability": 0.7843,
  "risk_category": "High",
  "recommended_strategy": "Personal retention call + exclusive loyalty discount within 24h"
}
```

---

## Project Structure

```
├── app.js                    # Express entry point
├── config/
│   └── passport.js           # Passport strategies (local + Google OAuth)
├── models/
│   ├── Customer.js           # Customer schema
│   ├── Prediction.js         # Prediction result schema
│   └── User.js               # User account schema
├── routes/
│   ├── api.js                # Dashboard API — calls Flask ML API with fallback
│   └── auth.js               # Login / signup / OAuth routes
├── scripts/
│   └── seed.js               # Seeds MongoDB with 2000 sample customers
├── views/
│   ├── login.ejs             # Sign-in page
│   ├── signup.ejs            # Sign-up page
│   └── dashboard.ejs         # Main analytics dashboard
├── ml/
│   ├── app.py                # Flask ML API server
│   ├── predict.py            # PredictionEngine — loads .pkl, runs inference
│   ├── train.py              # Training script — outputs model.pkl + scaler.pkl
│   └── requirements.txt      # Python dependencies
├── uploads/tmp/              # Temporary CSV upload storage
├── Dockerfile                # Node.js + Python in one image
├── compose.yaml              # MongoDB + app container
├── Jenkinsfile               # CI/CD pipeline
├── .env.example              # Environment variable template
└── package.json
```

---

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `PORT` | Server port | `3000` |
| `MONGODB_URI` | MongoDB connection string | `mongodb://localhost:27017/loginpage` |
| `SESSION_SECRET` | Session secret key | *(required)* |
| `ML_API_URL` | Flask ML API base URL | `http://localhost:5000` |
| `MODEL_PATH` | Path to trained `.pkl` model | `ml/model.pkl` |
| `SCALER_PATH` | Path to fitted scaler `.pkl` | `ml/scaler.pkl` |
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID | *(optional)* |
| `GOOGLE_CLIENT_SECRET` | Google OAuth Client Secret | *(optional)* |
| `GOOGLE_CALLBACK_URL` | Google OAuth callback URL | `http://localhost:3000/auth/google/callback` |

---

## Node.js API Endpoints

All routes are prefixed `/api` and require authentication.

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/stats` | Dashboard KPI cards |
| `GET` | `/api/predictions` | Paginated prediction history |
| `GET` | `/api/predictions/:id` | Single prediction detail |
| `POST` | `/api/predict` | Run prediction on a customer |
| `POST` | `/api/upload` | Bulk predict via CSV upload |
| `GET` | `/api/analytics/churn-trend` | Monthly churn vs retained (6 months) |
| `GET` | `/api/analytics/risk-segments` | Risk category breakdown |
| `GET` | `/api/analytics/feature-importance` | Feature weight rankings |
| `GET` | `/api/models/comparison` | Model evaluation metrics |

---

## CI/CD — Jenkins Pipeline

The `Jenkinsfile` at the repo root defines a 5-stage pipeline:

| Stage | Action |
|---|---|
| Checkout | Pull `main` from GitHub |
| Install | `npm ci` |
| Test | Run automated tests |
| Build | `docker build` — tags image as `churniq:latest` |
| Deploy | `docker compose up -d` |

---

## License

ISC

---




