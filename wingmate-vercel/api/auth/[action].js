// api/auth/[action].js
// Handles: /api/auth/signup  /api/auth/signin  /api/auth/me  /api/auth/google
require('dotenv').config({ path: '.env.local' });
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { query }                 = require('../_lib/db');
const { signToken, requireAuth, cors } = require('../_lib/auth');

function hashEmail(email) {
  return crypto.createHash('sha256').update(email.toLowerCase().trim()).digest('hex');
}

export default async function handler(req, res) {
  if (cors(req, res)) return;

  const action = req.query.action;

  // ── GET /api/auth/me ───────────────────────────────────────────────────────
  if (req.method === 'GET' && action === 'me') {
    const user = await requireAuth(req, res);
    if (!user) return;
    return res.json({ user });
  }

  // ── POST /api/auth/signup ──────────────────────────────────────────────────
  if (req.method === 'POST' && action === 'signup') {
    const { email, password, alias, role, ageRange, needs, genderPref } = req.body;
    if (!email || !password || !alias || !role) {
      return res.status(400).json({ error: 'email, password, alias and role are required' });
    }
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

    const emailHash    = hashEmail(email);
    const existing     = await query('SELECT id FROM users WHERE email_hash=$1', [emailHash]);
    if (existing.rows.length) return res.status(409).json({ error: 'An account with this email already exists' });

    const passwordHash = await bcrypt.hash(password, 12);
    const { rows }     = await query(
      `INSERT INTO users (alias, email_hash, provider, password_hash, role, age_range, needs, gender_pref)
       VALUES ($1,$2,'email',$3,$4,$5,$6,$7) RETURNING id, alias, role`,
      [alias, emailHash, passwordHash, role, ageRange||null, needs||[], genderPref||null]
    );
    const user = rows[0];
    if (role === 'wingmate' || role === 'both') {
      await query('INSERT INTO wingmate_profiles (user_id) VALUES ($1) ON CONFLICT DO NOTHING', [user.id]);
    }
    return res.status(201).json({ token: signToken(user.id), user });
  }

  // ── POST /api/auth/signin ──────────────────────────────────────────────────
  if (req.method === 'POST' && action === 'signin') {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const emailHash = hashEmail(email);
    const { rows }  = await query(
      "SELECT id, alias, role, password_hash FROM users WHERE email_hash=$1 AND provider='email'",
      [emailHash]
    );
    if (!rows.length) return res.status(401).json({ error: 'Invalid email or password' });

    const valid = await bcrypt.compare(password, rows[0].password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid email or password' });

    const { password_hash, ...user } = rows[0];
    return res.json({ token: signToken(user.id), user });
  }

  // ── POST /api/auth/google ──────────────────────────────────────────────────
  if (req.method === 'POST' && action === 'google') {
    const { idToken, alias, role } = req.body;
    if (!idToken) return res.status(400).json({ error: 'idToken required' });

    // ⚠️  In production replace this stub with google-auth-library verification:
    // const { OAuth2Client } = require('google-auth-library');
    // const ticket = await new OAuth2Client(process.env.GOOGLE_CLIENT_ID)
    //   .verifyIdToken({ idToken, audience: process.env.GOOGLE_CLIENT_ID });
    // const { sub: googleId, email, name } = ticket.getPayload();

    // Demo stub — decodes without verification (replace in production):
    let googleId, email, name;
    try {
      const payload = JSON.parse(Buffer.from(idToken.split('.')[1] + '==', 'base64').toString());
      googleId = payload.sub; email = payload.email; name = payload.name;
    } catch {
      return res.status(400).json({ error: 'Invalid Google token' });
    }

    const emailHash  = hashEmail(email || googleId);
    const userAlias  = alias || name || 'User' + Math.floor(Math.random() * 9999);
    const userRole   = role  || 'seeker';

    const { rows } = await query(
      `INSERT INTO users (alias, email_hash, provider, provider_id, role)
       VALUES ($1,$2,'google',$3,$4)
       ON CONFLICT (email_hash) DO UPDATE SET provider_id=EXCLUDED.provider_id, updated_at=NOW()
       RETURNING id, alias, role`,
      [userAlias, emailHash, googleId, userRole]
    );
    const user = rows[0];
    if (userRole === 'wingmate' || userRole === 'both') {
      await query('INSERT INTO wingmate_profiles (user_id) VALUES ($1) ON CONFLICT DO NOTHING', [user.id]);
    }
    return res.json({ token: signToken(user.id), user });
  }

  res.status(404).json({ error: 'Not found' });
}
