// client/src/lib/pusher.js
// Replaces socket.io-client — uses Pusher Channels for real-time on Vercel
// Install: npm install pusher-js

import Pusher from 'pusher-js';

let pusherClient = null;

export function getPusherClient() {
  if (!pusherClient) {
    pusherClient = new Pusher(process.env.REACT_APP_PUSHER_KEY, {
      cluster:         process.env.REACT_APP_PUSHER_CLUSTER || 'ap2',
      authEndpoint:    '/api/pusher/auth',
      auth: {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('wm_token') || ''}`,
        },
      },
    });

    pusherClient.connection.bind('connected',     () => console.log('[pusher] connected'));
    pusherClient.connection.bind('disconnected',  () => console.log('[pusher] disconnected'));
    pusherClient.connection.bind('error',   (err) => console.error('[pusher] error:', err));
  }
  return pusherClient;
}

export function disconnectPusher() {
  if (pusherClient) {
    pusherClient.disconnect();
    pusherClient = null;
  }
}

// Subscribe to a session channel — returns the channel object
export function subscribeToSession(sessionId) {
  const client = getPusherClient();
  return client.subscribe(`private-session-${sessionId}`);
}

// Subscribe to the current user's private channel (for wingmate requests etc.)
export function subscribeToUser(userId) {
  const client = getPusherClient();
  return client.subscribe(`private-user-${userId}`);
}

export function unsubscribe(channelName) {
  pusherClient?.unsubscribe(channelName);
}
