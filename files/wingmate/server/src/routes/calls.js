// server/src/routes/calls.js
// WebRTC call signalling using Twilio Programmable Video
// For real voice calls, Twilio handles all WebRTC complexity

const express = require('express');
const router  = express.Router();
const { requireAuth } = require('../middleware/auth');
const { query } = require('../db/pool');

// Twilio SDK (only instantiate if credentials exist)
let twilio = null;
let AccessToken, VideoGrant;
try {
  twilio = require('twilio');
  AccessToken = twilio.jwt.AccessToken;
  VideoGrant  = AccessToken.VideoGrant;
} catch { /* Twilio not installed — call feature will be stubbed */ }

// ─── POST /calls/token — Generate Twilio access token for a call room ────────
router.post('/token', requireAuth, async (req, res, next) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId) return res.status(400).json({ error: 'sessionId required' });

    // Verify user is part of this session
    const { rows } = await query(
      'SELECT id, call_room_id FROM sessions WHERE id = $1 AND (seeker_id = $2 OR wingmate_id = $2) AND status = $3',
      [sessionId, req.user.id, 'active']
    );
    if (!rows.length) return res.status(403).json({ error: 'Forbidden or session not active' });

    let session = rows[0];

    // Create a room ID if one doesn't exist yet
    if (!session.call_room_id) {
      const roomId = `wingmate-${sessionId.slice(0, 8)}`;
      await query('UPDATE sessions SET call_room_id = $1 WHERE id = $2', [roomId, sessionId]);
      session.call_room_id = roomId;
    }

    // If Twilio is configured, issue a real token
    if (twilio && process.env.TWILIO_API_KEY && process.env.TWILIO_API_SECRET) {
      const token = new AccessToken(
        process.env.TWILIO_ACCOUNT_SID,
        process.env.TWILIO_API_KEY,
        process.env.TWILIO_API_SECRET,
        { identity: req.user.id, ttl: 3600 }
      );

      const videoGrant = new VideoGrant({ room: session.call_room_id });
      token.addGrant(videoGrant);

      return res.json({
        token: token.toJwt(),
        roomName: session.call_room_id,
        identity: req.user.alias,
      });
    }

    // Stub response (no Twilio credentials set up yet)
    res.json({
      token: 'STUB_TOKEN_CONFIGURE_TWILIO',
      roomName: session.call_room_id,
      identity: req.user.alias,
      note: 'Configure TWILIO_* env vars for real calls',
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /calls/start — Notify the other party that a call is being requested
router.post('/start', requireAuth, async (req, res, next) => {
  try {
    const { sessionId } = req.body;

    const { rows } = await query(
      'SELECT seeker_id, wingmate_id FROM sessions WHERE id = $1 AND status = $2',
      [sessionId, 'active']
    );
    if (!rows.length) return res.status(404).json({ error: 'Session not found' });

    await query('UPDATE sessions SET call_active = true WHERE id = $1', [sessionId]);

    // The Socket.io server will emit 'call:incoming' to the other participant
    // (handled in socket.js via the session room)
    res.json({ ok: true, sessionId });
  } catch (err) {
    next(err);
  }
});

// ─── POST /calls/end — End the call (keep chat session alive) ─────────────────
router.post('/end', requireAuth, async (req, res, next) => {
  try {
    const { sessionId } = req.body;
    await query('UPDATE sessions SET call_active = false WHERE id = $1', [sessionId]);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
