const mongoose = require('mongoose');

const PredictionSchema = new mongoose.Schema({
  customer_id:          { type: String, required: true, index: true },
  customer_name:        { type: String, default: 'Unknown' },

  // ── Model Output ──────────────────────────────────────────────────────────
  churn_prediction:     { type: Number, enum: [0, 1], required: true },   // 0 = No Churn, 1 = Churn
  churn_probability:    { type: Number, min: 0, max: 1, required: true },  // 0.0 – 1.0
  risk_category:        { type: String, enum: ['High', 'Medium', 'Low'], required: true },
  recommended_strategy: { type: String, required: true },

  // ── Model Meta ────────────────────────────────────────────────────────────
  model_used:           { type: String, default: 'Random Forest' },
  model_version:        { type: String, default: '1.0' },

  // ── Input snapshot (stored for auditability) ──────────────────────────────
  input_snapshot:       { type: mongoose.Schema.Types.Mixed },

  // ── Audit ─────────────────────────────────────────────────────────────────
  predicted_by:         { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, {
  timestamps: true,
});

PredictionSchema.index({ createdAt: -1 });
PredictionSchema.index({ risk_category: 1 });
PredictionSchema.index({ churn_prediction: 1 });

module.exports = mongoose.model('Prediction', PredictionSchema);
