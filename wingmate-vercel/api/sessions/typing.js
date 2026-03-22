// api/sessions/[id]/typing.js  →  POST /api/sessions/:id/typing
require('dotenv').config({ path: '.env.local' });
const { query }                 = require('../../_lib/db');
const { requireAuth, cors }     = require('../../_lib/auth');
const { triggerSessionEvent }   = require('../../_lib/pusher');

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).end();

  const user = await requireAuth(req, res);
  if (!user) return;

  const sessionId = req.query.id;

  // Verify membership
  const { rows } = await query(
    "SELECT id FROM sessions WHERE id=$1 AND (seeker_id=$2 OR wingmate_id=$2) AND status='active'",
    [sessionId, user.id]
  );
  if (!rows.length) return res.status(403).json({ error: 'Forbidden' });

  await triggerSessionEvent(sessionId, 'typing:start', { userId: user.id, alias: user.alias });

  // Auto-stop typing after 2s
  setTimeout(() => {
    triggerSessionEvent(sessionId, 'typing:stop', { userId: user.id }).catch(() => {});
  }, 2000);

  res.json({ ok: true });
}
