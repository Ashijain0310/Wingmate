// api/sessions/[...params].js
// /api/sessions           POST  — create session + match
// /api/sessions/list      GET   — list user sessions
// /api/sessions/[id]      GET   — get session
// /api/sessions/[id]/end  POST  — end session + trigger insights
// /api/sessions/[id]/messages GET — message history
require('dotenv').config({ path: '.env.local' });
const { query }                 = require('../_lib/db');
const { requireAuth, cors }     = require('../_lib/auth');
const { triggerSessionEvent, triggerUserEvent } = require('../_lib/pusher');
const { generateSessionInsights, selectBestMatch } = require('../_lib/ai');

// ── Simple matching (no Redis needed for serverless) ─────────────────────────
async function findMatch({ seekerId, category, situationText, genderPref }) {
  const tagMap = {
    'A confusing text or message':  ['mixed signals','texting','communication gaps'],
    'Mixed signals from someone':   ['mixed signals','reading emotions'],
    'A breakup or distance':        ['breakups','emotional distance','moving on'],
    'How to start a conversation':  ['conversation starter','confidence'],
    'Relationship tension':         ['conflict resolution','relationship clarity'],
    'Friendship issue':             ['friendships','social dynamics','boundaries'],
  };
  const tags = tagMap[category] || [];

  let q = `
    SELECT u.id, u.alias, u.rating, u.rating_count,
      wp.tags, wp.bio, wp.session_count,
      COALESCE(array_length(ARRAY(SELECT unnest(wp.tags) INTERSECT SELECT unnest($1::text[])),1),0) AS tag_score
    FROM users u
    JOIN wingmate_profiles wp ON wp.user_id = u.id
    WHERE u.id != $2 AND wp.available = true AND (u.role='wingmate' OR u.role='both')
  `;
  const params = [tags, seekerId];

  if (genderPref && genderPref !== 'Any') {
    q += ` AND u.gender_pref = $${params.length + 1}`;
    params.push(genderPref);
  }
  q += ` ORDER BY tag_score DESC, u.rating DESC LIMIT 5`;

  const { rows } = await query(q, params);
  if (!rows.length) return null;

  if (situationText && rows.length > 1) {
    return await selectBestMatch(situationText, rows) || rows[0];
  }
  return rows[0];
}

export default async function handler(req, res) {
  if (cors(req, res)) return;

  const user = await requireAuth(req, res);
  if (!user) return;

  // Parse path: /api/sessions, /api/sessions/list, /api/sessions/[id], /api/sessions/[id]/end etc.
  const params = (req.query.params || []);
  const [idOrAction, subAction] = params;

  // ── POST /api/sessions — create ───────────────────────────────────────────
  if (req.method === 'POST' && !idOrAction) {
    const { situation, category, genderPref, needs } = req.body;

    const wingmate = await findMatch({ seekerId: user.id, category, situationText: situation, genderPref });
    if (!wingmate) return res.status(503).json({ error: 'No Wingmates available right now. Please try again shortly.' });

    const { rows } = await query(
      `INSERT INTO sessions (seeker_id, wingmate_id, situation, category, status)
       VALUES ($1,$2,$3,$4,'matching') RETURNING id, status, started_at`,
      [user.id, wingmate.id, situation||null, category||null]
    );
    const session = rows[0];

    // Mark wingmate busy
    await query('UPDATE wingmate_profiles SET available=false WHERE user_id=$1', [wingmate.id]);

    // Notify wingmate via Pusher
    await triggerUserEvent(wingmate.id, 'wingmate:request', {
      sessionId: session.id, category, situation: situation?.slice(0, 150),
    });

    return res.status(201).json({
      session:  { id: session.id, status: session.status, startedAt: session.started_at },
      wingmate: { id: wingmate.id, alias: wingmate.alias, tags: wingmate.tags||[], rating: wingmate.rating, ratingCount: wingmate.rating_count, bio: wingmate.bio, sessionCount: wingmate.session_count },
    });
  }

  // ── GET /api/sessions/list ────────────────────────────────────────────────
  if (req.method === 'GET' && idOrAction === 'list') {
    const { rows } = await query(
      `SELECT id, status, category, started_at, ended_at FROM sessions
       WHERE seeker_id=$1 OR wingmate_id=$1 ORDER BY started_at DESC LIMIT 20`,
      [user.id]
    );
    return res.json({ sessions: rows });
  }

  const sessionId = idOrAction;

  // ── GET /api/sessions/[id] ────────────────────────────────────────────────
  if (req.method === 'GET' && sessionId && !subAction) {
    const { rows } = await query(
      `SELECT s.*, u.alias AS wingmate_alias, wp.tags AS wingmate_tags
       FROM sessions s
       LEFT JOIN users u ON u.id=s.wingmate_id
       LEFT JOIN wingmate_profiles wp ON wp.user_id=s.wingmate_id
       WHERE s.id=$1 AND (s.seeker_id=$2 OR s.wingmate_id=$2)`,
      [sessionId, user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Session not found' });
    return res.json({ session: rows[0] });
  }

  // ── GET /api/sessions/[id]/messages ───────────────────────────────────────
  if (req.method === 'GET' && sessionId && subAction === 'messages') {
    const { rows: check } = await query(
      'SELECT id FROM sessions WHERE id=$1 AND (seeker_id=$2 OR wingmate_id=$2)',
      [sessionId, user.id]
    );
    if (!check.length) return res.status(403).json({ error: 'Forbidden' });
    const { rows } = await query(
      'SELECT id, sender_id, sender_role, content, created_at FROM messages WHERE session_id=$1 ORDER BY created_at ASC',
      [sessionId]
    );
    return res.json({ messages: rows });
  }

  // ── POST /api/sessions/[id]/message — send a message ─────────────────────
  if (req.method === 'POST' && sessionId && subAction === 'message') {
    const { content } = req.body;
    if (!content?.trim()) return res.status(400).json({ error: 'Content required' });
    if (content.length > 2000) return res.status(400).json({ error: 'Message too long' });

    const { rows: sessRows } = await query(
      "SELECT seeker_id, wingmate_id FROM sessions WHERE id=$1 AND status='active'",
      [sessionId]
    );
    if (!sessRows.length) return res.status(403).json({ error: 'Session not active' });

    const senderRole = sessRows[0].seeker_id === user.id ? 'seeker' : 'wingmate';
    const { rows } = await query(
      'INSERT INTO messages (session_id, sender_id, sender_role, content) VALUES ($1,$2,$3,$4) RETURNING id, created_at',
      [sessionId, user.id, senderRole, content.trim()]
    );

    const message = { id: rows[0].id, sessionId, senderId: user.id, senderAlias: user.alias, senderRole, content: content.trim(), createdAt: rows[0].created_at };

    // Broadcast via Pusher to everyone in the session channel
    await triggerSessionEvent(sessionId, 'message:new', message);

    // Check if we should generate an AI insight
    const { rows: countRows } = await query(
      "SELECT COUNT(*) AS cnt FROM messages WHERE session_id=$1 AND sender_role!='ai_note'",
      [sessionId]
    );
    if (parseInt(countRows[0].cnt, 10) % 4 === 0) {
      generateAndEmitInsight(sessionId, user.id).catch(console.error);
    }

    return res.json({ message });
  }

  // ── POST /api/sessions/[id]/end ───────────────────────────────────────────
  if (req.method === 'POST' && sessionId && subAction === 'end') {
    const { rows: sessRows } = await query(
      'SELECT * FROM sessions WHERE id=$1 AND (seeker_id=$2 OR wingmate_id=$2)',
      [sessionId, user.id]
    );
    if (!sessRows.length) return res.status(404).json({ error: 'Session not found' });
    const session = sessRows[0];
    if (session.status === 'ended') return res.json({ ok: true });

    await query("UPDATE sessions SET status='ended', ended_at=NOW() WHERE id=$1", [session.id]);
    if (session.wingmate_id) {
      await query('UPDATE wingmate_profiles SET available=true WHERE user_id=$1', [session.wingmate_id]);
    }

    const { rows: msgs } = await query(
      'SELECT sender_role, content FROM messages WHERE session_id=$1 ORDER BY created_at ASC',
      [session.id]
    );

    // Generate insights async then delete messages
    generateInsightsAndClean(session, msgs, user.id).catch(console.error);

    return res.json({ ok: true });
  }

  res.status(404).json({ error: 'Not found' });
}

async function generateAndEmitInsight(sessionId, userId) {
  const { generateChatInsight } = require('../_lib/ai');
  const { rows } = await query(
    "SELECT sender_role, content FROM messages WHERE session_id=$1 AND sender_role!='ai_note' ORDER BY created_at DESC LIMIT 10",
    [sessionId]
  );
  const insight = await generateChatInsight(rows.reverse());
  if (!insight) return;
  await query(
    "INSERT INTO messages (session_id, sender_id, sender_role, content) VALUES ($1,$2,'ai_note',$3)",
    [sessionId, userId, insight]
  );
  await triggerSessionEvent(sessionId, 'ai:insight', { text: insight, sessionId });
}

async function generateInsightsAndClean(session, messages, userId) {
  try {
    const insights = await generateSessionInsights(messages, session.situation);
    for (const ins of insights) {
      await query(
        'INSERT INTO insights (user_id, session_id, type, title, body, key_moments, takeaways) VALUES ($1,$2,$3,$4,$5,$6,$7)',
        [userId, session.id, ins.type, ins.title, ins.body, JSON.stringify(ins.key_moments||[]), ins.takeaways||[]]
      );
    }
  } catch (e) { console.error('Insight generation failed:', e.message); }
  // Delete messages — ephemeral guarantee
  await query('DELETE FROM messages WHERE session_id=$1', [session.id]).catch(console.error);
}
