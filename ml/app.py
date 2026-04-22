from flask import Flask, request, jsonify
from predict import PredictionEngine
from pymongo import MongoClient
from flask_cors import CORS
from datetime import datetime

app = Flask(__name__)
CORS(app)

# ── MongoDB Connection ────────────────────────────────────────────────────────
client = MongoClient("mongodb+srv://suhanisaxena23_db_user:suhani2410@cluster0.bmxpq9q.mongodb.net/churnDB?retryWrites=true&w=majority")

db = client["churnDB"]
customers_collection = db["customers"]
predictions_collection = db["predictions"]

print("MongoDB connected successfully!")

# ── Load model once at startup ────────────────────────────────────────────────
engine = PredictionEngine()


# ── Health check ──────────────────────────────────────────────────────────────
@app.route('/health')
def health():
    return jsonify({'status': 'ok', **engine.model_info()})


# ── Single prediction ─────────────────────────────────────────────────────────
@app.route('/predict', methods=['POST'])
def predict():
    data = request.get_json(force=True, silent=True)

    if not data:
        return jsonify({'error': 'Invalid or missing JSON body'}), 400

    try:
        result = engine.predict(data)

        # ✅ FIXED: Flat structure for dashboard compatibility
        record = {
            "customer_id": data.get("customer_id"),
            "customer_name": data.get("customer_name", "Unknown"),

            "churn_prediction": result["churn_prediction"],
            "churn_probability": result["churn_probability"],
            "risk_category": result["risk_category"],

            "churn_reasons": result["churn_reasons"],
            "recommended_strategy": ", ".join(result["recommended_strategies"]),

            "createdAt": datetime.utcnow()
        }

        predictions_collection.insert_one(record)

        return jsonify(result)

    except Exception as exc:
        return jsonify({'error': str(exc)}), 500


# ── Batch prediction ──────────────────────────────────────────────────────────
@app.route('/predict/batch', methods=['POST'])
def predict_batch():
    data = request.get_json(force=True, silent=True)

    if not isinstance(data, list):
        return jsonify({'error': 'Expected a JSON array of customer records'}), 400

    try:
        results = engine.predict_batch(data)

        # ✅ FIXED: Flat structure for batch as well
        records = [
            {
                "customer_id": d.get("customer_id"),
                "customer_name": d.get("customer_name", "Unknown"),

                "churn_prediction": r["churn_prediction"],
                "churn_probability": r["churn_probability"],
                "risk_category": r["risk_category"],

                "churn_reasons": r["churn_reasons"],
                "recommended_strategy": ", ".join(r["recommended_strategies"]),

                "createdAt": datetime.utcnow()
            }
            for d, r in zip(data, results)
        ]

        if records:
            predictions_collection.insert_many(records)

        return jsonify(results)

    except Exception as exc:
        return jsonify({'error': str(exc)}), 500


# ── Feature importance ────────────────────────────────────────────────────────
@app.route('/feature-importance')
def feature_importance():
    return jsonify(engine.feature_importance())


# ── Model metadata ────────────────────────────────────────────────────────────
@app.route('/model-info')
def model_info():
    return jsonify(engine.model_info())


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=False)