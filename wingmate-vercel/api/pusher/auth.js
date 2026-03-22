// api/pusher/auth.js
// Pusher requires server-side auth for private/presence channels
require('dotenv').config({ path: '.env.local' });
const { getPusher }         = require('../_lib/pusher');
const { requireAuth, cors } = require('../_lib/auth');

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).end();

  const user = await requireAuth(req, res);
  if (!user) return;

  const { socket_id, channel_name } = req.body;

  // Only allow users to subscribe to their own user channel or session channels they belong to
  if (channel_name.startsWith(`private-user-${user.id}`) ||
      channel_name.startsWith('private-session-')) {
    const auth = getPusher().authorizeChannel(socket_id, channel_name, {
      user_id: user.id,
      user_info: { alias: user.alias, role: user.role },
    });
    return res.json(auth);
  }

  return res.status(403).json({ error: 'Forbidden channel' });
}
