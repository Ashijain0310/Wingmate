// api/ai/insights/[id].js
require('dotenv').config({ path: '.env.local' });
const { query }             = require('../../_lib/db');
const { requireAuth, cors } = require('../../_lib/auth');

export default async function handler(req, res) {
  if (cors(req, res)) return;

  const user = await requireAuth(req, res);
  if (!user) return;

  const insightId = req.query.id;

  if (req.method === 'DELETE') {
    const { rowCount } = await query(
      'DELETE FROM insights WHERE id = $1 AND user_id = $2',
      [insightId, user.id]
    );
    if (rowCount === 0) return res.status(404).json({ error: 'Insight not found' });
    return res.json({ ok: true });
  }

  if (req.method === 'GET') {
    const { rows } = await query(
      'SELECT id, type, title, body, key_moments, takeaways, created_at FROM insights WHERE id = $1 AND user_id = $2',
      [insightId, user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Insight not found' });
    return res.json({ insight: rows[0] });
  }

  res.status(405).json({ error: 'Method not allowed' });
}
