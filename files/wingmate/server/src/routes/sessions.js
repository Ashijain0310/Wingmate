// server/src/routes/sessions.js
const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { query, withTransaction } = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { findMatch, lockWingmate, releaseWingmate } = require('../services/matching');
const { generateSessionInsights } = require('../services/ai');
const { cacheSession, deleteCachedSession } = require('../db/redis');

// ─── POST /sessions — Start a new session (seeker initiates) ─────────────────
router.post('/', requireAuth, [
  body('situation').optional().trim().isLength({ max: 2000 }),
  body('category').optional().trim(),
  body('genderPref').optional().trim(),
  body('needs').optional().isArray(),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { situation, category, genderPref, needs } = req.body;
    const seekerId = req.user.id;

    // Find a match
    const wingmate = await findMatch({
      seekerId,
      category,
      situationText: situation,
      genderPref,
    });

    if (!wingmate) {
      return res.status(503).json({ error: 'No Wingmates available right now. Please try again shortly.' });
    }

    // Create session in DB
    const { rows } = await query(
      `INSERT INTO sessions (seeker_id, wingmate_id, situation, category, status)
       VALUES ($1, $2, $3, $4, 'matching')
       RETURNING id, seeker_id, wingmate_id, status, started_at`,
      [seekerId, wingmate.id, situation || null, category || null]
    );

    const session = rows[0];

    // Lock wingmate so they're not double-matched
    await lockWingmate(wingmate.id);

    // Cache session for fast lookup
    await cacheSession(session.id, {
      ...session,
      wingmate: { id: wingmate.id, alias: wingmate.alias, tags: wingmate.tags, rating: wingmate.rating },
    });

    res.status(201).json({
      session: {
        id: session.id,
        status: session.status,
        startedAt: session.started_at,
      },
      wingmate: {
        id: wingmate.id,
        alias: wingmate.alias,
        tags: wingmate.tags || [],
        rating: wingmate.rating,
        ratingCount: wingmate.rating_count,
        bio: wingmate.bio,
        sessionCount: wingmate.session_count,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /sessions/:id — Get session info ────────────────────────────────────
router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT s.*, 
        u.alias AS wingmate_alias,
        wp.tags AS wingmate_tags, wp.rating AS wingmate_rating
       FROM sessions s
       LEFT JOIN users u ON u.id = s.wingmate_id
       LEFT JOIN wingmate_profiles wp ON wp.user_id = s.wingmate_id
       WHERE s.id = $1 AND (s.seeker_id = $2 OR s.wingmate_id = $2)`,
      [req.params.id, req.user.id]
    );

    if (!rows.length) return res.status(404).json({ error: 'Session not found' });
    res.json({ session: rows[0] });
  } catch (err) {
    next(err);
  }
});

// ─── GET /sessions/:id/messages — Fetch message history ──────────────────────
router.get('/:id/messages', requireAuth, async (req, res, next) => {
  try {
    // Verify user belongs to this session
    const { rows: sessionRows } = await query(
      'SELECT id FROM sessions WHERE id = $1 AND (seeker_id = $2 OR wingmate_id = $2)',
      [req.params.id, req.user.id]
    );
    if (!sessionRows.length) return res.status(403).json({ error: 'Forbidden' });

    const { rows } = await query(
      `SELECT id, sender_id, sender_role, content, created_at
       FROM messages WHERE session_id = $1 ORDER BY created_at ASC`,
      [req.params.id]
    );

    res.json({ messages: rows });
  } catch (err) {
    next(err);
  }
});

// ─── POST /sessions/:id/end — End a session and generate insights ─────────────
router.post('/:id/end', requireAuth, async (req, res, next) => {
  try {
    const { rows: sessionRows } = await query(
      'SELECT * FROM sessions WHERE id = $1 AND (seeker_id = $2 OR wingmate_id = $2)',
      [req.params.id, req.user.id]
    );

    if (!sessionRows.length) return res.status(404).json({ error: 'Session not found' });
    const session = sessionRows[0];

    if (session.status === 'ended') {
      return res.json({ ok: true, message: 'Already ended' });
    }

    // Fetch all messages for AI insight generation
    const { rows: messages } = await query(
      'SELECT sender_role, content FROM messages WHERE session_id = $1 ORDER BY created_at ASC',
      [session.id]
    );

    // Mark session ended
    await query(
      "UPDATE sessions SET status = 'ended', ended_at = NOW() WHERE id = $1",
      [session.id]
    );

    // Release the wingmate
    if (session.wingmate_id) await releaseWingmate(session.wingmate_id);

    // Clean up cache
    await deleteCachedSession(session.id);

    // Generate AI insights asynchronously (don't block the response)
    generateAndSaveInsights(session, messages, req.user.id).catch(console.error);

    // Delete messages (ephemeral — privacy by design)
    // Slight delay to allow insights to be generated first
    setTimeout(async () => {
      await query('DELETE FROM messages WHERE session_id = $1', [session.id]).catch(console.error);
    }, 10000);

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

async function generateAndSaveInsights(session, messages, userId) {
  if (messages.length < 3) return;

  try {
    const insights = await generateSessionInsights(messages, session.situation);

    for (const insight of insights) {
      await query(
        `INSERT INTO insights (user_id, session_id, type, title, body, key_moments, takeaways)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [
          userId,
          session.id,
          insight.type,
          insight.title,
          insight.body,
          JSON.stringify(insight.key_moments || []),
          insight.takeaways || [],
        ]
      );
    }
  } catch (err) {
    console.error('Failed to generate insights:', err.message);
  }
}

// ─── GET /sessions — Get user's session history ───────────────────────────────
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT s.id, s.status, s.category, s.started_at, s.ended_at
       FROM sessions s
       WHERE s.seeker_id = $1 OR s.wingmate_id = $1
       ORDER BY s.started_at DESC LIMIT 20`,
      [req.user.id]
    );
    res.json({ sessions: rows });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
