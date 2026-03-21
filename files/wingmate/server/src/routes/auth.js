// server/src/routes/auth.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { body, validationResult } = require('express-validator');
const { query } = require('../db/pool');
const { signToken, requireAuth } = require('../middleware/auth');

// Hash email for storage (one-way, for uniqueness checks only)
function hashEmail(email) {
  return crypto.createHash('sha256').update(email.toLowerCase().trim()).digest('hex');
}

// ─── POST /auth/signup ────────────────────────────────────────────────────────
router.post('/signup', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
  body('alias').trim().isLength({ min: 2, max: 50 }),
  body('role').isIn(['seeker', 'wingmate', 'both']),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { email, password, alias, role, ageRange, needs, genderPref } = req.body;
    const emailHash = hashEmail(email);

    // Check existing
    const existing = await query('SELECT id FROM users WHERE email_hash = $1', [emailHash]);
    if (existing.rows.length) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const { rows } = await query(
      `INSERT INTO users (alias, email_hash, provider, password_hash, role, age_range, needs, gender_pref)
       VALUES ($1,$2,'email',$3,$4,$5,$6,$7) RETURNING id, alias, role`,
      [alias, emailHash, passwordHash, role, ageRange || null, needs || [], genderPref || null]
    );

    const user = rows[0];

    // If wingmate role, create profile
    if (role === 'wingmate' || role === 'both') {
      await query(
        'INSERT INTO wingmate_profiles (user_id) VALUES ($1) ON CONFLICT DO NOTHING',
        [user.id]
      );
    }

    const token = signToken(user.id);
    res.status(201).json({ token, user: { id: user.id, alias: user.alias, role: user.role } });
  } catch (err) {
    next(err);
  }
});

// ─── POST /auth/signin ────────────────────────────────────────────────────────
router.post('/signin', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { email, password } = req.body;
    const emailHash = hashEmail(email);

    const { rows } = await query(
      'SELECT id, alias, role, password_hash FROM users WHERE email_hash = $1 AND provider = $2',
      [emailHash, 'email']
    );

    if (!rows.length) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid email or password' });

    const token = signToken(user.id);
    res.json({ token, user: { id: user.id, alias: user.alias, role: user.role } });
  } catch (err) {
    next(err);
  }
});

// ─── POST /auth/google ────────────────────────────────────────────────────────
// Receives the Google ID token from the client after Google Sign-In
router.post('/google', async (req, res, next) => {
  try {
    const { idToken, alias, role } = req.body;
    if (!idToken) return res.status(400).json({ error: 'idToken required' });

    // Verify Google ID token
    // In production: use google-auth-library to verify
    // const { OAuth2Client } = require('google-auth-library');
    // const gClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
    // const ticket = await gClient.verifyIdToken({ idToken, audience: process.env.GOOGLE_CLIENT_ID });
    // const payload = ticket.getPayload();
    // const { sub: googleId, email } = payload;

    // --- DEMO stub (replace with real verification above) ---
    const { sub: googleId, email, name } = JSON.parse(
      Buffer.from(idToken.split('.')[1] + '==', 'base64').toString()
    );

    const emailHash = hashEmail(email || googleId);
    const userAlias = alias || name || 'User' + Math.floor(Math.random() * 9999);
    const userRole  = role || 'seeker';

    // Upsert user
    const { rows } = await query(
      `INSERT INTO users (alias, email_hash, provider, provider_id, role)
       VALUES ($1,$2,'google',$3,$4)
       ON CONFLICT (email_hash) DO UPDATE
         SET provider_id = EXCLUDED.provider_id, updated_at = NOW()
       RETURNING id, alias, role`,
      [userAlias, emailHash, googleId, userRole]
    );

    const user = rows[0];
    if (userRole === 'wingmate' || userRole === 'both') {
      await query('INSERT INTO wingmate_profiles (user_id) VALUES ($1) ON CONFLICT DO NOTHING', [user.id]);
    }

    const token = signToken(user.id);
    res.json({ token, user: { id: user.id, alias: user.alias, role: user.role } });
  } catch (err) {
    next(err);
  }
});

// ─── GET /auth/me ─────────────────────────────────────────────────────────────
router.get('/me', requireAuth, async (req, res) => {
  res.json({ user: req.user });
});

// ─── POST /auth/signout ───────────────────────────────────────────────────────
router.post('/signout', requireAuth, async (req, res) => {
  // JWT is stateless — client deletes the token
  // For extra security, you'd maintain a token blocklist in Redis
  res.json({ ok: true });
});

module.exports = router;
