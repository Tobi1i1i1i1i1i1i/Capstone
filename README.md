# ChurnIQ — Customer Churn Prediction Dashboard

A full-stack web app for predicting and managing customer churn. Features a login/signup system, Google OAuth, and a data-driven dashboard powered by a rule-based Random Forest model.

![Node.js](https://img.shields.io/badge/Node.js-18+-green)
![MongoDB](https://img.shields.io/badge/MongoDB-7-brightgreen)

---

## Features

- Email/password signup & login + Google OAuth 2.0
- Session-based authentication (stored in MongoDB)
- Churn prediction dashboard with live stats, charts, and predictions table
- Single and bulk (CSV) customer churn prediction
- Model performance comparison (Random Forest, XGBoost, Gradient Boosting, etc.)
- Retention strategy recommendations

---

## Quick Start

### Prerequisites

- **Node.js 18+**
- **MongoDB** running locally on port `27017`

### Steps

```bash
# 1. Clone the repo
git clone https://github.com/Tobi1i1i1i1i1i1i/Login-page.git
cd Login-page

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env
# Edit .env — set SESSION_SECRET (required), and optionally Google OAuth keys

# 4. Seed the dashboard with 2000 sample customers
npm run seed

# 5. Start the app
npm start

# 6. Open browser → http://localhost:3000
```

---

## Google OAuth Setup (Optional)

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create **OAuth 2.0 Client ID** credentials
3. Set the redirect URI to `http://localhost:3000/auth/google/callback`
4. Add your credentials to `.env`:

```
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
```

> The app works without Google OAuth — only email/password login will be available.

---

## Project Structure

```
├── app.js                  # Express entry point
├── config/
│   └── passport.js         # Passport strategies (local + Google OAuth)
├── models/
│   ├── Customer.js         # Customer schema
│   ├── Prediction.js       # Prediction result schema
│   └── User.js             # User account schema
├── routes/
│   ├── api.js              # Dashboard API endpoints
│   └── auth.js             # Login / signup / OAuth routes
├── scripts/
│   └── seed.js             # Seeds MongoDB with 2000 sample customers
├── views/
│   ├── login.ejs           # Sign-in page
│   ├── signup.ejs          # Sign-up page
│   └── dashboard.ejs       # Main dashboard
├── uploads/tmp/            # Temporary CSV upload storage (auto-created)
├── .env.example            # Environment variable template
└── package.json
```

---

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `PORT` | Server port | `3000` |
| `MONGODB_URI` | MongoDB connection string | `mongodb://localhost:27017/loginpage` |
| `SESSION_SECRET` | Session secret key | *(required)* |
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID | *(optional)* |
| `GOOGLE_CLIENT_SECRET` | Google OAuth Client Secret | *(optional)* |
| `GOOGLE_CALLBACK_URL` | Google OAuth callback URL | `http://localhost:3000/auth/google/callback` |

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/stats` | Dashboard KPI cards |
| `GET` | `/api/predictions` | Paginated prediction history |
| `POST` | `/api/predict` | Run prediction on a customer |
| `POST` | `/api/upload` | Bulk predict via CSV upload |
| `GET` | `/api/analytics/churn-trend` | Monthly churn vs retained |
| `GET` | `/api/analytics/risk-segments` | Risk category breakdown |
| `GET` | `/api/analytics/feature-importance` | Feature weight rankings |
| `GET` | `/api/models/comparison` | Model evaluation metrics |

---

## License

ISC
