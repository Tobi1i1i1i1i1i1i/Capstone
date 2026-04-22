const mongoose = require('mongoose');

const PredictionSchema = new mongoose.Schema({
  customer_id:          { type: String, required: true, index: true },
  customer_name:        { type: String, default: 'Unknown' },

  // ── Model Output ──────────────────────────────────────────────────────────
  churn_prediction:     { type: Number, enum: [0, 1], required: true },
  churn_probability:    { type: Number, min: 0, max: 1, required: true },
  risk_category:        { type: String, enum: ['High', 'Medium', 'Low'], required: true },

  // ✅ FIX: array instead of string
  churn_reasons:        [{ type: String }],
  recommended_strategies: [{ type: String }],

  // ── Model Meta ────────────────────────────────────────────────────────────
  model_used:           { type: String, default: 'Random Forest' },
  model_version:        { type: String, default: '1.0' },

  // ── Input snapshot ────────────────────────────────────────────────────────
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