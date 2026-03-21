// server/src/routes/ai.js
const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { requireAuth } = require('../middleware/auth');
const { query } = require('../db/pool');
const aiService = require('../services/ai');

// Rate limit AI calls — 30 per minute per user
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  keyGenerator: (req) => req.user?.id || req.ip,
  message: { error: 'Too many AI requests. Please slow down.' },
});

// ─── POST /ai/rephrase — Help seeker express their situation ─────────────────
router.post('/rephrase', requireAuth, aiLimiter, async (req, res, next) => {
  try {
    const { text } = req.body;
    if (!text || text.trim().length < 10) {
      return res.status(400).json({ error: 'Text too short' });
    }
    const rephrased = await aiService.rephrasesSituation(text);
    res.json({ rephrased });
  } catch (err) {
    next(err);
  }
});

// ─── POST /ai/suggest — Suggest message rephrases during chat ────────────────
router.post('/suggest', requireAuth, aiLimiter, async (req, res, next) => {
  try {
    const { draft, sessionId } = req.body;
    if (!draft) return res.status(400).json({ error: 'Draft required' });

    // Get recent context if sessionId provided
    let context = null;
    if (sessionId) {
      const { rows } = await query(
        `SELECT sender_role, content FROM messages
         WHERE session_id = $1 ORDER BY created_at DESC LIMIT 6`,
        [sessionId]
      );
      context = rows.reverse()
        .map(m => `${m.sender_role === 'seeker' ? 'You' : 'Wingmate'}: ${m.content}`)
        .join('\n');
    }

    const suggestions = await aiService.suggestRephrases(draft, context);
    res.json({ suggestions });
  } catch (err) {
    next(err);
  }
});

// ─── POST /ai/insight — Generate real-time chat insight ──────────────────────
router.post('/insight', requireAuth, aiLimiter, async (req, res, next) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId) return res.status(400).json({ error: 'sessionId required' });

    // Verify user is in this session
    const { rows: sessionRows } = await query(
      'SELECT id FROM sessions WHERE id = $1 AND (seeker_id = $2 OR wingmate_id = $2)',
      [sessionId, req.user.id]
    );
    if (!sessionRows.length) return res.status(403).json({ error: 'Forbidden' });

    const { rows: messages } = await query(
      'SELECT sender_role, content FROM messages WHERE session_id = $1 ORDER BY created_at DESC LIMIT 10',
      [sessionId]
    );

    const insight = await aiService.generateChatInsight(messages.reverse());
    res.json({ insight });
  } catch (err) {
    next(err);
  }
});

// ─── GET /ai/insights — Get user's saved insights ────────────────────────────
router.get('/insights', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT id, type, title, body, key_moments, takeaways, created_at
       FROM insights WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20`,
      [req.user.id]
    );
    res.json({ insights: rows });
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /ai/insights/:id — Delete a specific insight ─────────────────────
router.delete('/insights/:id', requireAuth, async (req, res, next) => {
  try {
    await query('DELETE FROM insights WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
