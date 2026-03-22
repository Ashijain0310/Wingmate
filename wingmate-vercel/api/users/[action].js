// api/users/[action].js
require('dotenv').config({ path: '.env.local' });
const { query }             = require('../_lib/db');
const { requireAuth, cors } = require('../_lib/auth');

export default async function handler(req, res) {
  if (cors(req, res)) return;

  const user   = await requireAuth(req, res);
  if (!user) return;

  const action = req.query.action;

  // ── GET /api/users/profile ────────────────────────────────────────────────
  if (req.method === 'GET' && action === 'profile') {
    const { rows } = await query(
      `SELECT u.id, u.alias, u.role, u.age_range, u.needs, u.gender_pref, u.rating, u.rating_count, u.created_at,
              wp.tags, wp.bio, wp.session_count, wp.available
       FROM users u LEFT JOIN wingmate_profiles wp ON wp.user_id=u.id WHERE u.id=$1`,
      [user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    const { rows: sc } = await query("SELECT COUNT(*) AS t FROM sessions WHERE (seeker_id=$1 OR wingmate_id=$1) AND status='ended'", [user.id]);
    const { rows: ic } = await query('SELECT COUNT(*) AS t FROM insights WHERE user_id=$1', [user.id]);
    return res.json({ profile: { ...rows[0], totalSessions: +sc[0].t, totalInsights: +ic[0].t } });
  }

  // ── PATCH /api/users/me ───────────────────────────────────────────────────
  if (req.method === 'PATCH' && action === 'me') {
    const { alias, ageRange, needs, genderPref } = req.body;
    const fields = []; const vals = []; let i = 1;
    if (alias      != null) { fields.push(`alias=$${i++}`);       vals.push(alias); }
    if (ageRange   != null) { fields.push(`age_range=$${i++}`);   vals.push(ageRange); }
    if (needs      != null) { fields.push(`needs=$${i++}`);       vals.push(needs); }
    if (genderPref != null) { fields.push(`gender_pref=$${i++}`); vals.push(genderPref); }
    if (!fields.length) return res.status(400).json({ error: 'Nothing to update' });
    fields.push('updated_at=NOW()'); vals.push(user.id);
    const { rows } = await query(`UPDATE users SET ${fields.join(',')} WHERE id=$${i} RETURNING id,alias,role`, vals);
    return res.json({ user: rows[0] });
  }

  // ── PATCH /api/users/wingmate ─────────────────────────────────────────────
  if (req.method === 'PATCH' && action === 'wingmate') {
    if (user.role !== 'wingmate' && user.role !== 'both') {
      return res.status(403).json({ error: 'Only Wingmates can update wingmate profiles' });
    }
    const { tags, bio, available } = req.body;
    const fields = []; const vals = []; let i = 1;
    if (tags      != null) { fields.push(`tags=$${i++}`);      vals.push(tags); }
    if (bio       != null) { fields.push(`bio=$${i++}`);       vals.push(bio); }
    if (available != null) { fields.push(`available=$${i++}`); vals.push(available); }
    if (!fields.length) return res.status(400).json({ error: 'Nothing to update' });
    fields.push('updated_at=NOW()'); vals.push(user.id);
    await query(`UPDATE wingmate_profiles SET ${fields.join(',')} WHERE user_id=$${i}`, vals);
    return res.json({ ok: true });
  }

  // ── POST /api/users/rate ──────────────────────────────────────────────────
  if (req.method === 'POST' && action === 'rate') {
    const { sessionId, score } = req.body;
    if (!sessionId || !score || score < 1 || score > 5) {
      return res.status(400).json({ error: 'sessionId and score (1-5) required' });
    }
    const { rows: sRows } = await query(
      "SELECT wingmate_id FROM sessions WHERE id=$1 AND seeker_id=$2 AND status='ended'",
      [sessionId, user.id]
    );
    if (!sRows.length) return res.status(404).json({ error: 'Session not found' });

    const wingmateId = sRows[0].wingmate_id;
    await query(
      'INSERT INTO ratings (session_id,rater_id,rated_id,score) VALUES ($1,$2,$3,$4) ON CONFLICT (session_id,rater_id) DO UPDATE SET score=EXCLUDED.score',
      [sessionId, user.id, wingmateId, score]
    );
    const { rows: rRows } = await query(
      'SELECT AVG(score)::NUMERIC(3,2) AS avg, COUNT(*) AS cnt FROM ratings WHERE rated_id=$1',
      [wingmateId]
    );
    await query('UPDATE users SET rating=$1, rating_count=$2 WHERE id=$3', [rRows[0].avg, rRows[0].cnt, wingmateId]);
    return res.json({ ok: true, newRating: rRows[0].avg });
  }

  // ── DELETE /api/users/me ──────────────────────────────────────────────────
  if (req.method === 'DELETE' && action === 'me') {
    await query('DELETE FROM users WHERE id=$1', [user.id]);
    return res.json({ ok: true });
  }

  res.status(404).json({ error: 'Not found' });
}
