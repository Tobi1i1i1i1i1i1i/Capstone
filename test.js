// Verified Smoke Tests for ChurnIQ Project Evaluation
const { describe, it } = require('node:test');
const assert = require('node:assert');
const http   = require('http');

// ── Helper: HTTP GET ──────────────────────────────────────────────────────────
function get(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body }));
    }).on('error', reject);
  });
}

// ── Helper: HTTP POST JSON ────────────────────────────────────────────────────
function post(url, payload) {
  return new Promise((resolve, reject) => {
    const data    = JSON.stringify(payload);
    const parsed  = new URL(url);
    const opts = {
      hostname: parsed.hostname,
      port:     parseInt(parsed.port) || 80,
      path:     parsed.pathname,
      method:   'POST',
      headers:  { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
    };
    const req = http.request(opts, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Unit — module loading
// ─────────────────────────────────────────────────────────────────────────────
describe('Unit — module loading', () => {
  it('loads .env without error', () => {
    require('dotenv').config();
    assert.ok(true);
  });

  it('loads User model', () => {
    const User = require('./models/User');
    assert.ok(User);
    assert.strictEqual(User.modelName, 'User');
  });

  it('loads Customer model', () => {
    const Customer = require('./models/Customer');
    assert.ok(Customer);
    assert.strictEqual(Customer.modelName, 'Customer');
  });

  it('loads Prediction model', () => {
    const Prediction = require('./models/Prediction');
    assert.ok(Prediction);
    assert.strictEqual(Prediction.modelName, 'Prediction');
  });

  it('loads auth routes', () => {
    const auth = require('./routes/auth');
    assert.ok(auth);
  });

  it('loads api routes', () => {
    const api = require('./routes/api');
    assert.ok(api);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. HTTP — Node.js app (port 3000)
// ─────────────────────────────────────────────────────────────────────────────
describe('HTTP — Node.js app (:3000)', () => {
  it('GET / redirects to /login (3xx)', async () => {
    const res = await get('http://localhost:3000/');
    assert.ok([301, 302, 308].includes(res.status), `Expected redirect, got ${res.status}`);
  });

  it('GET /login returns 200', async () => {
    const res = await get('http://localhost:3000/login');
    assert.strictEqual(res.status, 200);
  });

  it('GET /signup returns 200', async () => {
    const res = await get('http://localhost:3000/signup');
    assert.strictEqual(res.status, 200);
  });

  it('GET /dashboard redirects unauthenticated users to /login', async () => {
    const res = await get('http://localhost:3000/dashboard');
    assert.ok([301, 302, 308].includes(res.status), `Expected redirect, got ${res.status}`);
  });

  it('GET /api/stats returns 401 without auth', async () => {
    const res = await get('http://localhost:3000/api/stats');
    assert.strictEqual(res.status, 401);
  });

  it('GET /nonexistent returns 404', async () => {
    const res = await get('http://localhost:3000/nonexistent-route-xyz');
    assert.ok([404, 302].includes(res.status), `Expected 404, got ${res.status}`);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. HTTP — Flask ML API (port 5000)
// ─────────────────────────────────────────────────────────────────────────────
describe('HTTP — Flask ML API (:5000)', () => {
  it('GET /health returns 200', async () => {
    const res = await get('http://localhost:5000/health');
    assert.strictEqual(res.status, 200, `Flask health check failed: ${res.body}`);
  });

  it('GET /health response contains status ok', async () => {
    const res  = await get('http://localhost:5000/health');
    const body = JSON.parse(res.body);
    assert.strictEqual(body.status, 'ok');
  });

  it('GET /model-info returns model metadata', async () => {
    const res  = await get('http://localhost:5000/model-info');
    assert.strictEqual(res.status, 200);
    const body = JSON.parse(res.body);
    assert.ok(Array.isArray(body.features), 'Expected features array');
    assert.ok(body.features.length > 0);
  });

  it('GET /feature-importance returns array', async () => {
    const res  = await get('http://localhost:5000/feature-importance');
    assert.strictEqual(res.status, 200);
    const body = JSON.parse(res.body);
    assert.ok(Array.isArray(body));
  });

  it('POST /predict returns churn prediction', async () => {
    const res = await post('http://localhost:5000/predict', {
      age:                    35,
      no_of_days_subscribed:  180,
      multi_screen:           'yes',
      mail_subscribed:        'no',
      weekly_mins_watched:    120,
      minimum_daily_mins:     10,
      maximum_daily_mins:     60,
      weekly_max_night_mins:  30,
      videos_watched:         25,
      maximum_days_inactive:  5,
      customer_support_calls: 3,
    });
    assert.strictEqual(res.status, 200, `Predict failed: ${res.body}`);
    const body = JSON.parse(res.body);
    assert.ok('churn_prediction'  in body, 'Missing churn_prediction');
    assert.ok('churn_probability' in body, 'Missing churn_probability');
    assert.ok('risk_category'     in body, 'Missing risk_category');
    assert.ok(['High', 'Medium', 'Low'].includes(body.risk_category));
    assert.ok(body.churn_probability >= 0 && body.churn_probability <= 1);
  });

  it('POST /predict/batch returns array of results', async () => {
    const res = await post('http://localhost:5000/predict/batch', [
      { customer_id: 'T001', age: 25, customer_support_calls: 1, maximum_days_inactive: 2, weekly_mins_watched: 200 },
      { customer_id: 'T002', age: 50, customer_support_calls: 8, maximum_days_inactive: 30, weekly_mins_watched: 20 },
    ]);
    assert.strictEqual(res.status, 200);
    const body = JSON.parse(res.body);
    assert.ok(Array.isArray(body));
    assert.strictEqual(body.length, 2);
  });
});
