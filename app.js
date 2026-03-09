
require('dotenv').config();
const fs      = require('fs');
const path    = require('path');
const express = require('express');
const mongoose = require('mongoose');
const session  = require('express-session');
const MongoStore = require('connect-mongo').default;
const flash    = require('express-flash');
const passport = require('passport');

const authRoutes = require('./routes/auth');
require('./models/Customer');
require('./models/Prediction');
const apiRoutes  = require('./routes/api');   // ← ChurnIQ API routes

require('./config/passport');

// ── Environment validation ────────────────────────────────────────────────────
if (!process.env.SESSION_SECRET) {
  console.warn('⚠️  WARNING: SESSION_SECRET is not set. Using fallback secret — unsafe in production.');
}

// ── Ensure tmp upload dir exists ──────────────────────────────────────────────
const tmpDir = path.join(__dirname, 'uploads', 'tmp');
if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

const app  = express();
const PORT = process.env.PORT || 3000;

// ── View engine ───────────────────────────────────────────────────────────────
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── Session ───────────────────────────────────────────────────────────────────
app.use(session({
  secret: process.env.SESSION_SECRET || 'fallback-secret',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI || 'mongodb://localhost:27017/loginpage',
    collectionName: 'sessions',
  }),
  cookie: { maxAge: 1000 * 60 * 60 * 24 }, // 1 day
}));

// ── Passport ──────────────────────────────────────────────────────────────────
app.use(passport.initialize());
app.use(passport.session());
app.use(flash());

// ── Auth guard ────────────────────────────────────────────────────────────────
const ensureAuth = (req, res, next) => {
  if (req.isAuthenticated()) return next();
  res.redirect('/login');
};

// ── Auth routes (login, register, logout, Google OAuth) ───────────────────────
app.use('/', authRoutes);

// ── ChurnIQ API routes (all protected inside routes/api.js) ───────────────────
app.use('/api', apiRoutes);

// ── Dashboard (protected EJS view) ───────────────────────────────────────────
app.get('/dashboard', ensureAuth, (req, res) => {
  res.render('dashboard', { user: req.user });
});

// ── Google OAuth ──────────────────────────────────────────────────────────────
app.get('/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);
app.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/login', failureFlash: true }),
  (req, res) => res.redirect('/dashboard')
);

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    message: 'Server is healthy and active',
    timestamp: new Date().toISOString() 
  });
});

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  if (req.path.startsWith('/api')) {
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
  res.status(500).send('Something went wrong. Please try again.');
});

// ── Connect to MongoDB & start ────────────────────────────────────────────────
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/loginpage')
  .then(() => {
    console.log('✓ MongoDB connected');
    app.listen(PORT, () => {
      console.log(`✓ Server running at http://localhost:${PORT}`);
    });
  })
  .catch(err => {
    console.error('✗ MongoDB connection failed:', err.message);
    process.exit(1);
  });

module.exports = app;
