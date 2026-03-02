/**
 * routes/api.js
 * ─────────────────────────────────────────────────────────────────────────────
 * REST API endpoints that power the ChurnIQ dashboard.
 * All routes are prefixed with /api (mounted in app.js).
 * All responses are JSON.
 *
 * Endpoints:
 *   GET  /api/stats                – Overview KPI cards
 *   GET  /api/predictions          – Paginated prediction history
 *   GET  /api/predictions/:id      – Single prediction detail
 *   POST /api/predict              – Run prediction on one customer record
 *   POST /api/upload               – Bulk upload CSV data
 *   GET  /api/analytics/churn-trend     – Monthly churn vs retained
 *   GET  /api/analytics/risk-segments   – Risk category breakdown
 *   GET  /api/analytics/feature-importance – Feature weight rankings
 *   GET  /api/models/comparison    – Model evaluation metrics
 */

const express  = require('express');
const router   = express.Router();
const multer   = require('multer');
const csv      = require('csv-parser');
const fs       = require('fs');
const path     = require('path');
const Customer   = require('../models/Customer');
const Prediction = require('../models/Prediction');

// ── Auth guard – all API routes require login ─────────────────────────────────
const ensureAuth = (req, res, next) => {
  if (req.isAuthenticated()) return next();
  res.status(401).json({ error: 'Unauthorized' });
};
router.use(ensureAuth);

// ── Multer – CSV uploads stored temporarily ───────────────────────────────────
const upload = multer({
  dest: 'uploads/tmp/',
  fileFilter: (req, file, cb) => {
    if (path.extname(file.originalname).toLowerCase() !== '.csv') {
      return cb(new Error('Only CSV files are allowed'), false);
    }
    cb(null, true);
  },
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB max
});

// ─────────────────────────────────────────────────────────────────────────────
// CHURN PREDICTION LOGIC
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Local rule-based fallback model.
 * Swap this out for a Python ML microservice call when your model is ready.
 *
 * To call your Python Flask API instead:
 *   const axios = require('axios');
 *   const r = await axios.post(process.env.ML_API_URL + '/predict', features);
 *   return { probability: r.data.churn_probability, prediction: r.data.churn_prediction };
 */
function runPrediction(features) {
  const {
    customer_support_calls = 0,
    maximum_days_inactive  = 0,
    weekly_mins_watched    = 120,
    no_of_days_subscribed  = 180,
    videos_watched         = 30,
  } = features;

  // Weighted scoring (mirrors Random Forest feature importances from SRS)
  let score = 0;
  score += customer_support_calls * 0.31;
  score += maximum_days_inactive  * 0.024;
  score -= weekly_mins_watched    * 0.003;
  score -= no_of_days_subscribed  * 0.001;
  score -= videos_watched         * 0.005;
  score += 0.15; // base rate

  const probability = Math.min(0.98, Math.max(0.02, parseFloat(score.toFixed(4))));
  const prediction  = probability >= 0.5 ? 1 : 0;
  return { probability, prediction };
}

function getRiskCategory(prob) {
  if (prob >= 0.70) return 'High';
  if (prob >= 0.40) return 'Medium';
  return 'Low';
}

function getStrategy(risk) {
  const strategies = {
    High:   'Personal retention call + exclusive loyalty discount within 24h',
    Medium: 'Targeted email campaign + feature highlight nudge',
    Low:    'Routine check-in + monthly newsletter engagement',
  };
  return strategies[risk];
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/stats
// Returns KPI cards for the Overview tab
// ─────────────────────────────────────────────────────────────────────────────
router.get('/stats', async (req, res) => {
  try {
    const [
      totalCustomers,
      totalPredictions,
      highRiskCount,
      churnedCount,
    ] = await Promise.all([
      Customer.countDocuments(),
      Prediction.countDocuments(),
      Prediction.countDocuments({ risk_category: 'High' }),
      Prediction.countDocuments({ churn_prediction: 1 }),
    ]);

    const churnRate = totalPredictions > 0
      ? ((churnedCount / totalPredictions) * 100).toFixed(1)
      : 0;

    // Month-over-month delta: compare this month vs last month
    const now        = new Date();
    const startThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const [thisMonthChurn, lastMonthChurn] = await Promise.all([
      Prediction.countDocuments({ churn_prediction: 1, createdAt: { $gte: startThisMonth } }),
      Prediction.countDocuments({ churn_prediction: 1, createdAt: { $gte: startLastMonth, $lt: startThisMonth } }),
    ]);

    const churnDelta = lastMonthChurn > 0
      ? (((thisMonthChurn - lastMonthChurn) / lastMonthChurn) * 100).toFixed(1)
      : null;

    res.json({
      totalCustomers,
      totalPredictions,
      highRiskCount,
      churnedCount,
      churnRate,
      churnDelta,
      modelAccuracy: 91.0,
      modelName: 'Random Forest',
    });
  } catch (err) {
    console.error('GET /api/stats error:', err);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/predictions?page=1&limit=10&risk=High&search=
// Paginated prediction history table
// ─────────────────────────────────────────────────────────────────────────────
router.get('/predictions', async (req, res) => {
  try {
    const page   = Math.max(1, parseInt(req.query.page)  || 1);
    const limit  = Math.min(50, parseInt(req.query.limit) || 10);
    const skip   = (page - 1) * limit;

    const filter = {};
    if (req.query.risk)   filter.risk_category  = req.query.risk;
    if (req.query.churn)  filter.churn_prediction = parseInt(req.query.churn);
    if (req.query.search) {
      filter.$or = [
        { customer_id:   { $regex: req.query.search, $options: 'i' } },
        { customer_name: { $regex: req.query.search, $options: 'i' } },
      ];
    }

    const [predictions, total] = await Promise.all([
      Prediction.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Prediction.countDocuments(filter),
    ]);

    res.json({
      predictions,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error('GET /api/predictions error:', err);
    res.status(500).json({ error: 'Failed to fetch predictions' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/predictions/:id
// Single prediction detail
// ─────────────────────────────────────────────────────────────────────────────
router.get('/predictions/:id', async (req, res) => {
  try {
    const prediction = await Prediction.findById(req.params.id).lean();
    if (!prediction) return res.status(404).json({ error: 'Prediction not found' });
    res.json(prediction);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch prediction' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/predict
// Body: { customer_id, customer_name?, ...feature fields }
// Runs prediction and saves result to MongoDB
// ─────────────────────────────────────────────────────────────────────────────
router.post('/predict', async (req, res) => {
  try {
    const {
      customer_id,
      customer_name,
      age,
      gender,
      no_of_days_subscribed,
      multi_screen,
      mail_subscribed,
      weekly_mins_watched,
      minimum_daily_mins,
      maximum_daily_mins,
      weekly_max_night_mins,
      videos_watched,
      maximum_days_inactive,
      customer_support_calls,
    } = req.body;

    if (!customer_id) {
      return res.status(400).json({ error: 'customer_id is required' });
    }

    // Upsert customer record
    await Customer.findOneAndUpdate(
      { customer_id },
      {
        customer_id, age, gender,
        no_of_days_subscribed, multi_screen, mail_subscribed,
        weekly_mins_watched, minimum_daily_mins, maximum_daily_mins,
        weekly_max_night_mins, videos_watched, maximum_days_inactive,
        customer_support_calls,
      },
      { upsert: true, new: true }
    );

    // Run prediction
    const features = {
      customer_support_calls: parseInt(customer_support_calls) || 0,
      maximum_days_inactive:  parseInt(maximum_days_inactive)  || 0,
      weekly_mins_watched:    parseInt(weekly_mins_watched)     || 0,
      no_of_days_subscribed:  parseInt(no_of_days_subscribed)   || 0,
      videos_watched:         parseInt(videos_watched)          || 0,
    };

    const { probability, prediction } = runPrediction(features);
    const risk     = getRiskCategory(probability);
    const strategy = getStrategy(risk);

    // Save prediction result
    const result = await Prediction.create({
      customer_id,
      customer_name: customer_name || customer_id,
      churn_prediction:     prediction,
      churn_probability:    probability,
      risk_category:        risk,
      recommended_strategy: strategy,
      model_used:           'Random Forest',
      model_version:        '1.0',
      input_snapshot:       features,
      predicted_by:         req.user._id,
    });

    res.json({
      customer_id,
      churn_prediction:     prediction,
      churn_probability:    probability,
      risk_category:        risk,
      recommended_strategy: strategy,
      prediction_id:        result._id,
    });
  } catch (err) {
    console.error('POST /api/predict error:', err);
    res.status(500).json({ error: 'Prediction failed: ' + err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/upload
// Accepts a CSV file, parses it, runs predictions on each row, saves to MongoDB
// ─────────────────────────────────────────────────────────────────────────────
router.post('/upload', upload.single('dataset'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No CSV file uploaded' });

  const filePath = req.file.path;
  const results  = [];
  const errors   = [];

  try {
    await new Promise((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (row) => results.push(row))
        .on('end', resolve)
        .on('error', reject);
    });

    if (results.length === 0) {
      fs.unlinkSync(filePath);
      return res.status(400).json({ error: 'CSV file is empty' });
    }

    // Required fields validation
    const requiredFields = ['customer_id', 'weekly_mins_watched', 'customer_support_calls', 'maximum_days_inactive'];
    const firstRow = results[0];
    const missing  = requiredFields.filter(f => !(f in firstRow));
    if (missing.length > 0) {
      fs.unlinkSync(filePath);
      return res.status(400).json({ error: `Missing required columns: ${missing.join(', ')}` });
    }

    const predictions = [];
    for (const row of results) {
      try {
        const customer_id = row.customer_id?.trim();
        if (!customer_id) { errors.push({ row, reason: 'Missing customer_id' }); continue; }

        // Upsert customer
        await Customer.findOneAndUpdate(
          { customer_id },
          { ...row },
          { upsert: true, new: true }
        );

        const features = {
          customer_support_calls: parseInt(row.customer_support_calls) || 0,
          maximum_days_inactive:  parseInt(row.maximum_days_inactive)  || 0,
          weekly_mins_watched:    parseInt(row.weekly_mins_watched)     || 0,
          no_of_days_subscribed:  parseInt(row.no_of_days_subscribed)   || 0,
          videos_watched:         parseInt(row.videos_watched)          || 0,
        };

        const { probability, prediction } = runPrediction(features);
        const risk     = getRiskCategory(probability);
        const strategy = getStrategy(risk);

        predictions.push({
          customer_id,
          customer_name:        row.name || customer_id,
          churn_prediction:     prediction,
          churn_probability:    probability,
          risk_category:        risk,
          recommended_strategy: strategy,
          model_used:           'Random Forest',
          model_version:        '1.0',
          input_snapshot:       features,
          predicted_by:         req.user._id,
        });
      } catch (rowErr) {
        errors.push({ row, reason: rowErr.message });
      }
    }

    // Bulk insert predictions
    if (predictions.length > 0) {
      await Prediction.insertMany(predictions, { ordered: false });
    }

    fs.unlinkSync(filePath); // clean up temp file

    res.json({
      message:       `Processed ${results.length} rows`,
      saved:          predictions.length,
      errors:         errors.length,
      errorDetails:   errors.slice(0, 10), // cap error list
    });
  } catch (err) {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    console.error('POST /api/upload error:', err);
    res.status(500).json({ error: 'Upload processing failed: ' + err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/analytics/churn-trend
// Returns monthly churn vs retained counts for the past 6 months
// ─────────────────────────────────────────────────────────────────────────────
router.get('/analytics/churn-trend', async (req, res) => {
  try {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const raw = await Prediction.aggregate([
      { $match: { createdAt: { $gte: sixMonthsAgo } } },
      {
        $group: {
          _id: {
            year:  { $year:  '$createdAt' },
            month: { $month: '$createdAt' },
          },
          churn:    { $sum: '$churn_prediction' },
          total:    { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);

    const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const data = raw.map(r => ({
      name:     monthNames[r._id.month - 1],
      churn:    r.churn,
      retained: r.total - r.churn,
    }));

    res.json(data);
  } catch (err) {
    console.error('GET /api/analytics/churn-trend error:', err);
    res.status(500).json({ error: 'Failed to fetch churn trend' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/analytics/risk-segments
// Returns percentage breakdown of High / Medium / Low risk
// ─────────────────────────────────────────────────────────────────────────────
router.get('/analytics/risk-segments', async (req, res) => {
  try {
    const raw = await Prediction.aggregate([
      {
        $group: {
          _id:   '$risk_category',
          count: { $sum: 1 },
        },
      },
    ]);

    const total = raw.reduce((acc, r) => acc + r.count, 0);
    const colors = { High: '#ff4757', Medium: '#ffa502', Low: '#2ed573' };

    const data = raw.map(r => ({
      name:  r._id + ' Risk',
      value: total > 0 ? parseFloat(((r.count / total) * 100).toFixed(1)) : 0,
      count: r.count,
      color: colors[r._id] || '#64748b',
    }));

    res.json(data);
  } catch (err) {
    console.error('GET /api/analytics/risk-segments error:', err);
    res.status(500).json({ error: 'Failed to fetch risk segments' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/analytics/feature-importance
// Returns static feature importances from SRS (update with real model output)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/analytics/feature-importance', async (req, res) => {
  // These values come from your trained Random Forest model's .feature_importances_
  // When your Python model is ready, load these from a JSON file or a DB document.
  const features = [
    { feature: 'customer_support_calls', importance: 0.31 },
    { feature: 'maximum_days_inactive',  importance: 0.24 },
    { feature: 'weekly_mins_watched',    importance: 0.18 },
    { feature: 'no_of_days_subscribed',  importance: 0.13 },
    { feature: 'videos_watched',         importance: 0.09 },
    { feature: 'mail_subscribed',        importance: 0.05 },
  ];
  res.json(features);
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/models/comparison
// Returns evaluation metrics for all models tested
// ─────────────────────────────────────────────────────────────────────────────
router.get('/models/comparison', async (req, res) => {
  // Update these values after running your model evaluation script.
  // Ideally, store these in a MongoDB "ModelRun" collection and query here.
  // Metrics from training.ipynb (weighted avg, test set of 400 rows, random_state=42)
  const models = [
    { model: 'Random Forest',     accuracy: 91.0, precision: 91.0, recall: 91.0, f1: 91.0, selected: true  },
    { model: 'Gradient Boosting', accuracy: 89.8, precision: 89.0, recall: 90.0, f1: 89.0, selected: false },
    { model: 'XGBoost',           accuracy: 89.5, precision: 89.0, recall: 90.0, f1: 89.0, selected: false },
    { model: 'KNN',               accuracy: 88.0, precision: 85.0, recall: 88.0, f1: 86.0, selected: false },
    { model: 'Decision Tree',     accuracy: 87.8, precision: 87.0, recall: 88.0, f1: 87.0, selected: false },
    { model: 'Logistic Reg.',     accuracy: 87.0, precision: 83.0, recall: 87.0, f1: 84.0, selected: false },
  ];
  res.json(models);
});

module.exports = router;
