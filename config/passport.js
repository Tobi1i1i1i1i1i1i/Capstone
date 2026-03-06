const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');

// Serialize user into session
passport.serializeUser((user, done) => {
  done(null, user.id);
});

// Deserialize user from session
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});

// ──── Local Strategy ────
passport.use(new LocalStrategy(
  { usernameField: 'email' },
  async (email, password, done) => {
    try {
      const user = await User.findOne({ email: email.toLowerCase() });
      if (!user) {
        return done(null, false, { message: 'No account with that email.' });
      }
      if (!user.password) {
        return done(null, false, { message: 'This account uses Google login. Please sign in with Google.' });
      }
      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        return done(null, false, { message: 'Incorrect password.' });
      }
      return done(null, user);
    } catch (err) {
      return done(err);
    }
  }
));

// ──── Google OAuth Strategy ────
passport.use(new GoogleStrategy(
  {
    clientID:     process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL:  process.env.GOOGLE_CALLBACK_URL || '/auth/google/callback',
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      // Find existing user by googleId or email
      let user = await User.findOne({ googleId: profile.id });

      if (!user) {
        const email = profile.emails?.[0]?.value;
        if (email) {
          user = await User.findOne({ email });
        }

        if (user) {
          // Link Google account to existing email/password account
          user.googleId = profile.id;
          user.avatar   = user.avatar || profile.photos?.[0]?.value || '';
          await user.save();
        } else {
          // Create new user from Google profile
          user = await User.create({
            googleId: profile.id,
            name:     profile.displayName,
            email:    profile.emails?.[0]?.value,
            avatar:   profile.photos?.[0]?.value || '',
          });
        }
      }

      return done(null, user);
    } catch (err) {
      return done(err, null);
    }
  }
));

module.exports = passport;
