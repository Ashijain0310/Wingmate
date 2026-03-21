// server/src/routes/users.js
const express = require('express');
const router  = express.Router();
const { body, validationResult } = require('express-validator');
const { query } = require('../db/pool');
const { requireAuth } = require('../middleware/auth');

// ─── GET /users/me/profile ────────────────────────────────────────────────────
router.get('/me/profile', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT
        u.id, u.alias, u.role, u.age_range, u.needs, u.gender_pref,
        u.rating, u.rating_count, u.created_at,
        wp.tags, wp.bio, wp.session_count, wp.available
       FROM users u
       LEFT JOIN wingmate_profiles wp ON wp.user_id = u.id
       WHERE u.id = $1`,
      [req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'User not found' });

    // Total sessions as seeker or wingmate
    const { rows: sessionRows } = await query(
      `SELECT COUNT(*) AS total FROM sessions
       WHERE (seeker_id = $1 OR wingmate_id = $1) AND status = 'ended'`,
      [req.user.id]
    );

    // Total insights
    const { rows: insightRows } = await query(
      'SELECT COUNT(*) AS total FROM insights WHERE user_id = $1',
      [req.user.id]
    );

    res.json({
      profile: {
        ...rows[0],
        totalSessions: parseInt(sessionRows[0].total, 10),
        totalInsights: parseInt(insightRows[0].total, 10),
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /users/me — Update alias, preferences ─────────────────────────────
router.patch('/me', requireAuth, [
  body('alias').optional().trim().isLength({ min: 2, max: 50 }),
  body('ageRange').optional().trim(),
  body('needs').optional().isArray(),
  body('genderPref').optional().trim(),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { alias, ageRange, needs, genderPref } = req.body;
    const fields = [];
    const values = [];
    let i = 1;

    if (alias     !== undefined) { fields.push(`alias = $${i++}`);       values.push(alias); }
    if (ageRange  !== undefined) { fields.push(`age_range = $${i++}`);   values.push(ageRange); }
    if (needs     !== undefined) { fields.push(`needs = $${i++}`);       values.push(needs); }
    if (genderPref !== undefined){ fields.push(`gender_pref = $${i++}`); values.push(genderPref); }

    if (!fields.length) return res.status(400).json({ error: 'No fields to update' });

    fields.push(`updated_at = NOW()`);
    values.push(req.user.id);

    const { rows } = await query(
      `UPDATE users SET ${fields.join(', ')} WHERE id = $${i} RETURNING id, alias, role`,
      values
    );

    res.json({ user: rows[0] });
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /users/me/wingmate — Update wingmate profile ──────────────────────
router.patch('/me/wingmate', requireAuth, [
  body('tags').optional().isArray(),
  body('bio').optional().trim().isLength({ max: 500 }),
  body('available').optional().isBoolean(),
], async (req, res, next) => {
  try {
    if (req.user.role !== 'wingmate' && req.user.role !== 'both') {
      return res.status(403).json({ error: 'Only Wingmates can update wingmate profiles' });
    }

    const { tags, bio, available } = req.body;
    const fields = [];
    const values = [];
    let i = 1;

    if (tags      !== undefined) { fields.push(`tags = $${i++}`);      values.push(tags); }
    if (bio       !== undefined) { fields.push(`bio = $${i++}`);       values.push(bio); }
    if (available !== undefined) { fields.push(`available = $${i++}`); values.push(available); }

    if (!fields.length) return res.status(400).json({ error: 'No fields to update' });
    fields.push(`updated_at = NOW()`);
    values.push(req.user.id);

    await query(
      `UPDATE wingmate_profiles SET ${fields.join(', ')} WHERE user_id = $${i}`,
      values
    );

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// ─── POST /users/rate — Rate a Wingmate after a session ──────────────────────
router.post('/rate', requireAuth, [
  body('sessionId').isUUID(),
  body('score').isInt({ min: 1, max: 5 }),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { sessionId, score } = req.body;

    // Verify session exists and user was the seeker
    const { rows: sessionRows } = await query(
      "SELECT wingmate_id FROM sessions WHERE id = $1 AND seeker_id = $2 AND status = 'ended'",
      [sessionId, req.user.id]
    );
    if (!sessionRows.length) {
      return res.status(404).json({ error: 'Session not found or not ended' });
    }

    const wingmateId = sessionRows[0].wingmate_id;
    if (!wingmateId) return res.status(400).json({ error: 'No Wingmate to rate' });

    // Insert rating (unique per session per rater)
    await query(
      `INSERT INTO ratings (session_id, rater_id, rated_id, score)
       VALUES ($1,$2,$3,$4) ON CONFLICT (session_id, rater_id) DO UPDATE SET score = EXCLUDED.score`,
      [sessionId, req.user.id, wingmateId, score]
    );

    // Recalculate Wingmate's average rating
    const { rows: ratingRows } = await query(
      'SELECT AVG(score)::NUMERIC(3,2) AS avg, COUNT(*) AS cnt FROM ratings WHERE rated_id = $1',
      [wingmateId]
    );

    await query(
      'UPDATE users SET rating = $1, rating_count = $2 WHERE id = $3',
      [ratingRows[0].avg, ratingRows[0].cnt, wingmateId]
    );

    res.json({ ok: true, newRating: ratingRows[0].avg });
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /users/me — Delete account (GDPR) ────────────────────────────────
router.delete('/me', requireAuth, async (req, res, next) => {
  try {
    // Cascade deletes handle sessions, messages, insights, ratings
    await query('DELETE FROM users WHERE id = $1', [req.user.id]);
    res.json({ ok: true, message: 'Account and all associated data deleted.' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
