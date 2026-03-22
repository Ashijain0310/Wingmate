// api/calls/[action].js
// /api/calls/request  POST — notify partner of incoming call
// /api/calls/accept   POST — notify caller their call was accepted
// /api/calls/decline  POST — notify caller their call was declined
// /api/calls/end      POST — end call
// /api/calls/token    POST — get WebRTC TURN credentials (optional Twilio)
require('dotenv').config({ path: '.env.local' });
const { query }                                   = require('../_lib/db');
const { requireAuth, cors }                       = require('../_lib/auth');
const { triggerSessionEvent }                     = require('../_lib/pusher');

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).end();

  const user = await requireAuth(req, res);
  if (!user) return;

  const action    = req.query.action;
  const { sessionId } = req.body;

  if (!sessionId) return res.status(400).json({ error: 'sessionId required' });

  // Verify user belongs to this session
  const { rows } = await query(
    "SELECT seeker_id, wingmate_id FROM sessions WHERE id=$1 AND status='active'",
    [sessionId]
  );
  if (!rows.length) return res.status(404).json({ error: 'Active session not found' });

  const session = rows[0];
  const partnerAlias = user.alias;

  if (action === 'request') {
    await triggerSessionEvent(sessionId, 'call:incoming', {
      from: { id: user.id, alias: partnerAlias },
      sessionId,
    });
    await query('UPDATE sessions SET call_active=true WHERE id=$1', [sessionId]);
    return res.json({ ok: true });
  }

  if (action === 'accept') {
    await triggerSessionEvent(sessionId, 'call:accepted', { by: partnerAlias });
    return res.json({ ok: true });
  }

  if (action === 'decline') {
    await triggerSessionEvent(sessionId, 'call:declined', { by: partnerAlias });
    return res.json({ ok: true });
  }

  if (action === 'end') {
    await triggerSessionEvent(sessionId, 'call:ended', { by: partnerAlias });
    await query('UPDATE sessions SET call_active=false WHERE id=$1', [sessionId]);
    return res.json({ ok: true });
  }

  // WebRTC ICE signalling relay
  if (action === 'offer' || action === 'answer' || action === 'ice') {
    const eventMap = { offer: 'webrtc:offer', answer: 'webrtc:answer', ice: 'webrtc:ice' };
    await triggerSessionEvent(sessionId, eventMap[action], { ...req.body, from: user.id });
    return res.json({ ok: true });
  }

  // Optional: Twilio token for TURN server
  if (action === 'token') {
    if (!process.env.TWILIO_ACCOUNT_SID) {
      return res.json({ token: null, note: 'TURN not configured — using STUN only (may not work on some networks)' });
    }
    try {
      const twilio      = require('twilio');
      const AccessToken = twilio.jwt.AccessToken;
      const VideoGrant  = AccessToken.VideoGrant;
      const token = new AccessToken(
        process.env.TWILIO_ACCOUNT_SID,
        process.env.TWILIO_API_KEY,
        process.env.TWILIO_API_SECRET,
        { identity: user.id, ttl: 3600 }
      );
      token.addGrant(new VideoGrant({ room: `wingmate-${sessionId.slice(0, 8)}` }));
      return res.json({ token: token.toJwt(), roomName: `wingmate-${sessionId.slice(0, 8)}` });
    } catch (e) {
      return res.status(500).json({ error: 'Could not generate token' });
    }
  }

  res.status(404).json({ error: 'Unknown action' });
}
