import os
import joblib
import pandas as pd

FEATURES = [
    'age',
    'no_of_days_subscribed',
    'multi_screen',
    'mail_subscribed',
    'weekly_mins_watched',
    'minimum_daily_mins',
    'maximum_daily_mins',
    'weekly_max_night_mins',
    'videos_watched',
    'maximum_days_inactive',
    'customer_support_calls',
]


class PredictionEngine:
    def __init__(self):
        model_path = os.environ.get('MODEL_PATH', 'model.pkl')
        scaler_path = os.environ.get('SCALER_PATH', 'scaler.pkl')

        if not os.path.exists(model_path):
            raise FileNotFoundError("Model file not found")

        self.model = joblib.load(model_path)
        self.scaler = joblib.load(scaler_path) if os.path.exists(scaler_path) else None

    # ─────────────── PREPROCESS ───────────────

    @staticmethod
    def _bool_field(value):
        return 1 if str(value).strip().lower() in ('yes', '1', 'true') else 0

    def _preprocess(self, data):
        row = {
            'age': float(data.get('age', 30)),
            'no_of_days_subscribed': float(data.get('no_of_days_subscribed', 180)),
            'multi_screen': self._bool_field(data.get('multi_screen', 'no')),
            'mail_subscribed': self._bool_field(data.get('mail_subscribed', 'no')),
            'weekly_mins_watched': float(data.get('weekly_mins_watched', 120)),
            'minimum_daily_mins': float(data.get('minimum_daily_mins', 10)),
            'maximum_daily_mins': float(data.get('maximum_daily_mins', 60)),
            'weekly_max_night_mins': float(data.get('weekly_max_night_mins', 30)),
            'videos_watched': float(data.get('videos_watched', 30)),
            'maximum_days_inactive': float(data.get('maximum_days_inactive', 0)),
            'customer_support_calls': float(data.get('customer_support_calls', 0)),
        }

        X = pd.DataFrame([row], columns=FEATURES)

        if self.scaler:
            X = pd.DataFrame(self.scaler.transform(X), columns=FEATURES)

        return X, row

    # ─────────────── RISK CATEGORY ───────────────

    def _risk_category(self, prob):
        if prob >= 0.7:
            return "High"
        elif prob >= 0.4:
            return "Medium"
        else:
            return "Low"

    # ─────────────── CHURN REASON ENGINE ───────────────

    def _identify_reasons(self, row):
        reasons = []

        if row['maximum_days_inactive'] > 7:
            reasons.append("High inactivity")

        if row['weekly_mins_watched'] < 60:
            reasons.append("Low engagement")

        if row['customer_support_calls'] > 3:
            reasons.append("Frequent complaints")

        if row['mail_subscribed'] == 0:
            reasons.append("Not receiving updates")

        if row['multi_screen'] == 0:
            reasons.append("Limited feature usage")

        return reasons

    # ─────────────── STRATEGY ENGINE ───────────────

    def _generate_strategy(self, reasons, risk):
        strategies = []

        for r in reasons:
            if r == "High inactivity":
                strategies.append("Send re-engagement offer + personalized recommendations")

            elif r == "Low engagement":
                strategies.append("Recommend trending content + push notifications")

            elif r == "Frequent complaints":
                strategies.append("Priority customer support + issue resolution call")

            elif r == "Not receiving updates":
                strategies.append("Enable email subscription + targeted campaigns")

            elif r == "Limited feature usage":
                strategies.append("Promote multi-screen benefits + free trial upgrade")

        # fallback if no reasons found
        if not strategies:
            if risk == "High":
                strategies.append("Offer discount + retention call")
            elif risk == "Medium":
                strategies.append("Engagement email campaign")
            else:
                strategies.append("Newsletter engagement")

        return strategies

    # ─────────────── MAIN PREDICT ───────────────

    def predict(self, data):
        X, row = self._preprocess(data)

        prob = self.model.predict_proba(X)[0][1]
        risk = self._risk_category(prob)

        reasons = self._identify_reasons(row)
        strategies = self._generate_strategy(reasons, risk)

        return {
            "churn_probability": round(float(prob), 4),
            "churn_prediction": int(prob >= 0.5),
            "risk_category": risk,
            "churn_reasons": reasons,
            "recommended_strategies": strategies,
            "customer_id": data.get("customer_id")
        }