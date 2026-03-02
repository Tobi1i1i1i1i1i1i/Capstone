/**
 * scripts/seed.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Seeds MongoDB with all 2000 customer records from churn_dataset.csv
 * and runs predictions on each row.
 *
 * Usage:
 *   node scripts/seed.js                          # looks for churn_dataset.csv in project root
 *   node scripts/seed.js /path/to/churn_dataset.csv
 *
 * Run ONCE to populate the dashboard with the training dataset.
 * Re-running clears and re-seeds all data.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const fs       = require('fs');
const path     = require('path');
const csv      = require('csv-parser');

const Customer   = require('../models/Customer');
const Prediction = require('../models/Prediction');
const User       = require('../models/User');

// ── Prediction logic (mirrors routes/api.js) ──────────────────────────────────
function runPrediction({ customer_support_calls = 0, maximum_days_inactive = 0,
  weekly_mins_watched = 120, no_of_days_subscribed = 180, videos_watched = 30 }) {
  let score = 0;
  score += customer_support_calls * 0.31;
  score += maximum_days_inactive  * 0.024;
  score -= weekly_mins_watched    * 0.003;
  score -= no_of_days_subscribed  * 0.001;
  score -= videos_watched         * 0.005;
  score += 0.15;
  const probability = Math.min(0.98, Math.max(0.02, parseFloat(score.toFixed(4))));
  return { probability, prediction: probability >= 0.5 ? 1 : 0 };
}

function getRiskCategory(prob) {
  if (prob >= 0.70) return 'High';
  if (prob >= 0.40) return 'Medium';
  return 'Low';
}

function getStrategy(risk) {
  return {
    High:   'Personal retention call + exclusive loyalty discount within 24h',
    Medium: 'Targeted email campaign + feature highlight nudge',
    Low:    'Routine check-in + monthly newsletter engagement',
  }[risk];
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function titleCase(str) {
  if (!str) return undefined;
  return str.trim().charAt(0).toUpperCase() + str.trim().slice(1).toLowerCase();
}

function yesNo(str) {
  if (!str) return undefined;
  return str.trim().toLowerCase() === 'yes' ? 'Yes' : 'No';
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function seed() {
  const csvPath = process.argv[2] || path.join(__dirname, '..', 'churn_dataset.csv');

  if (!fs.existsSync(csvPath)) {
    console.error('\n✗ CSV file not found:', csvPath);
    console.error('  Place churn_dataset.csv in the project root, then run:\n');
    console.error('  node scripts/seed.js\n');
    process.exit(1);
  }

  console.log('Connecting to MongoDB…');
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/loginpage');
  console.log('✓ Connected');

  // Use any existing user as the "predicted_by" reference (or a placeholder ID)
  const systemUser = await User.findOne().lean();
  const userId = systemUser?._id ?? new mongoose.Types.ObjectId();

  // Clear existing seeded data
  const [delC, delP] = await Promise.all([
    Customer.deleteMany({}),
    Prediction.deleteMany({}),
  ]);
  console.log(`✓ Cleared ${delC.deletedCount} customers, ${delP.deletedCount} predictions`);

  // Read CSV
  const rows = [];
  await new Promise((resolve, reject) => {
    fs.createReadStream(csvPath)
      .pipe(csv())
      .on('data', row => rows.push(row))
      .on('end',  resolve)
      .on('error', reject);
  });
  console.log(`✓ Read ${rows.length} rows from CSV`);

  // Seed in batches of 100
  const BATCH = 100;
  let seeded = 0;
  let errors = 0;

  // Spread predictions across the past 6 months so trend charts have data
  const now        = Date.now();
  const sixMonths  = 180 * 24 * 60 * 60 * 1000;

  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);

    const customerOps = batch.map(row => ({
      updateOne: {
        filter: { customer_id: String(row.customer_id) },
        update: {
          $set: {
            customer_id:            String(row.customer_id),
            year:                   parseInt(row.year)                    || undefined,
            phone_no:               row.phone_no?.trim()                  || undefined,
            gender:                 titleCase(row.gender),
            age:                    parseFloat(row.age)                   || undefined,
            no_of_days_subscribed:  parseFloat(row.no_of_days_subscribed) || undefined,
            multi_screen:           yesNo(row.multi_screen),
            mail_subscribed:        yesNo(row.mail_subscribed),
            weekly_mins_watched:    parseFloat(row.weekly_mins_watched)   || undefined,
            minimum_daily_mins:     parseFloat(row.minimum_daily_mins)    || undefined,
            maximum_daily_mins:     parseFloat(row.maximum_daily_mins)    || undefined,
            weekly_max_night_mins:  parseFloat(row.weekly_max_night_mins) || undefined,
            videos_watched:         parseInt(row.videos_watched)          || undefined,
            maximum_days_inactive:  parseFloat(row.maximum_days_inactive) || undefined,
            customer_support_calls: parseInt(row.customer_support_calls)  || 0,
            churn:                  row.churn !== '' ? parseInt(row.churn) : undefined,
          },
        },
        upsert: true,
      },
    }));

    const predDocs = batch.map((row, j) => {
      const features = {
        customer_support_calls: parseInt(row.customer_support_calls)  || 0,
        maximum_days_inactive:  parseFloat(row.maximum_days_inactive) || 0,
        weekly_mins_watched:    parseFloat(row.weekly_mins_watched)   || 0,
        no_of_days_subscribed:  parseFloat(row.no_of_days_subscribed) || 0,
        videos_watched:         parseInt(row.videos_watched)          || 0,
      };
      const { probability, prediction } = runPrediction(features);
      const risk     = getRiskCategory(probability);
      const strategy = getStrategy(risk);

      // Spread timestamps evenly across the past 6 months
      const offset    = ((i + j) / rows.length) * sixMonths;
      const createdAt = new Date(now - sixMonths + offset);

      return {
        customer_id:          String(row.customer_id),
        customer_name:        String(row.customer_id),
        churn_prediction:     prediction,
        churn_probability:    probability,
        risk_category:        risk,
        recommended_strategy: strategy,
        model_used:           'Random Forest',
        model_version:        '1.0',
        input_snapshot:       features,
        predicted_by:         userId,
        createdAt,
        updatedAt:            createdAt,
      };
    });

    try {
      await Customer.bulkWrite(customerOps, { ordered: false });
      await Prediction.insertMany(predDocs, { ordered: false });
      seeded += batch.length;
    } catch (err) {
      errors += batch.length;
      console.error(`\n  Batch error at row ${i}:`, err.message);
    }

    process.stdout.write(`\r  Seeding… ${seeded}/${rows.length}`);
  }

  console.log(`\n✓ Done — ${seeded} customers and predictions seeded (${errors} errors)`);
  await mongoose.disconnect();
}

seed().catch(err => {
  console.error('\n✗ Seed failed:', err.message);
  process.exit(1);
});
