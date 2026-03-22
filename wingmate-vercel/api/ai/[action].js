// api/ai/[action].js
// /api/ai/rephrase  POST — help seeker express situation
// /api/ai/suggest   POST — chat message suggestions
// /api/ai/insight   POST — real-time chat insight
// /api/ai/insights  GET  — saved insights
// /api/ai/insights/[id] DELETE
require('dotenv').config({ path: '.env.local' });
const { query }             = require('../_lib/db');
const { withRateLimit }     = require('../_lib/rateLimit');
const { requireAuth, cors } = require('../_lib/auth');
const ai                    = require('../_lib/ai');

export default async function handler(req, res) {
  if (cors(req, res)) return;

  const user = await requireAuth(req, res);
  if (!user) return;

  const action   = req.query.action;
  const insightId = req.query.insightId; // for DELETE /api/ai/insights/[id]

  // Rate limit AI calls — 30 per minute
  if (req.method === 'POST' && (action === 'rephrase' || action === 'suggest' || action === 'insight')) {
    const allowed = await (require('../_lib/rateLimit').checkRateLimit)(user.id, { maxRequests: 30, windowSeconds: 60 });
    if (!allowed) return res.status(429).json({ error: 'Too many AI requests. Please slow down.' });
  }

  // ── POST /api/ai/rephrase ─────────────────────────────────────────────────
  if (req.method === 'POST' && action === 'rephrase') {
    const { text } = req.body;
    if (!text || text.trim().length < 10) return res.status(400).json({ error: 'Text too short' });
    try {
      const rephrased = await ai.rephraseSituation(text);
      return res.json({ rephrased });
    } catch (e) {
      return res.status(500).json({ error: 'AI unavailable', rephrased: null });
    }
  }

  // ── POST /api/ai/suggest ──────────────────────────────────────────────────
  if (req.method === 'POST' && action === 'suggest') {
    const { draft, sessionId } = req.body;
    if (!draft) return res.status(400).json({ error: 'Draft required' });

    let context = null;
    if (sessionId) {
      const { rows } = await query(
        'SELECT sender_role, content FROM messages WHERE session_id=$1 ORDER BY created_at DESC LIMIT 6',
        [sessionId]
      );
      context = rows.reverse().map(m => `${m.sender_role === 'seeker' ? 'You' : 'Wingmate'}: ${m.content}`).join('\n');
    }
    try {
      const suggestions = await ai.suggestRephrases(draft, context);
      return res.json({ suggestions });
    } catch {
      return res.json({ suggestions: null });
    }
  }

  // ── POST /api/ai/insight ──────────────────────────────────────────────────
  if (req.method === 'POST' && action === 'insight') {
    const { sessionId } = req.body;
    if (!sessionId) return res.status(400).json({ error: 'sessionId required' });

    const { rows: check } = await query(
      'SELECT id FROM sessions WHERE id=$1 AND (seeker_id=$2 OR wingmate_id=$2)',
      [sessionId, user.id]
    );
    if (!check.length) return res.status(403).json({ error: 'Forbidden' });

    const { rows } = await query(
      'SELECT sender_role, content FROM messages WHERE session_id=$1 ORDER BY created_at DESC LIMIT 10',
      [sessionId]
    );
    try {
      const insight = await ai.generateChatInsight(rows.reverse());
      return res.json({ insight });
    } catch {
      return res.json({ insight: null });
    }
  }

  // ── GET /api/ai/insights ──────────────────────────────────────────────────
  if (req.method === 'GET' && action === 'insights' && !insightId) {
    const { rows } = await query(
      'SELECT id, type, title, body, key_moments, takeaways, created_at FROM insights WHERE user_id=$1 ORDER BY created_at DESC LIMIT 20',
      [user.id]
    );
    return res.json({ insights: rows });
  }

  // ── DELETE /api/ai/insights/[id] ──────────────────────────────────────────
  if (req.method === 'DELETE' && action === 'insights' && insightId) {
    await query('DELETE FROM insights WHERE id=$1 AND user_id=$2', [insightId, user.id]);
    return res.json({ ok: true });
  }

  res.status(404).json({ error: 'Not found' });
}
