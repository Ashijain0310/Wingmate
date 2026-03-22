// api/_lib/pusher.js
// Pusher Channels replaces Socket.io on Vercel serverless
// Server PUSHES events to clients — no persistent connections needed

const Pusher = require('pusher');

let pusherServer;

function getPusher() {
  if (!pusherServer) {
    pusherServer = new Pusher({
      appId:   process.env.PUSHER_APP_ID,
      key:     process.env.PUSHER_KEY,
      secret:  process.env.PUSHER_SECRET,
      cluster: process.env.PUSHER_CLUSTER || 'ap2',
      useTLS:  true,
    });
  }
  return pusherServer;
}

// Channel names follow the pattern: session-{sessionId}
// Private channels require auth — we use presence channels for online tracking

async function triggerSessionEvent(sessionId, event, data) {
  try {
    await getPusher().trigger(`session-${sessionId}`, event, data);
  } catch (err) {
    console.error(`Pusher trigger failed [${event}]:`, err.message);
  }
}

async function triggerUserEvent(userId, event, data) {
  try {
    await getPusher().trigger(`user-${userId}`, event, data);
  } catch (err) {
    console.error(`Pusher user trigger failed [${event}]:`, err.message);
  }
}

module.exports = { getPusher, triggerSessionEvent, triggerUserEvent };
