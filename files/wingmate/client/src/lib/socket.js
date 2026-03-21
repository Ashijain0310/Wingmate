// client/src/lib/socket.js
// Socket.io client — manages the real-time connection

import { io } from 'socket.io-client';

const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:4000';

let socket = null;

export function getSocket() {
  return socket;
}

export function connectSocket(token) {
  if (socket?.connected) return socket;

  socket = io(SOCKET_URL, {
    auth: { token },
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    transports: ['websocket', 'polling'],
  });

  socket.on('connect', () => console.log('[socket] connected:', socket.id));
  socket.on('disconnect', (reason) => console.log('[socket] disconnected:', reason));
  socket.on('connect_error', (err) => console.error('[socket] error:', err.message));

  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

// ── React hook for socket events ──────────────────────────────────────────────
// Usage in component:
//   const { sendMessage, requestCall, ... } = useSocket(sessionId, { onMessage, onTyping, onCallIncoming, onAiInsight });

export function useSocketSession(sessionId, handlers = {}) {
  const s = getSocket();
  if (!s) return {};

  function joinSession() {
    s.emit('session:join', { sessionId });
  }

  function sendMessage(content) {
    s.emit('message:send', { sessionId, content });
  }

  function startTyping() {
    s.emit('typing:start', { sessionId });
  }

  function stopTyping() {
    s.emit('typing:stop', { sessionId });
  }

  function requestCall() {
    s.emit('call:request', { sessionId });
  }

  function acceptCall() {
    s.emit('call:accept', { sessionId });
  }

  function declineCall() {
    s.emit('call:decline', { sessionId });
  }

  function endCall() {
    s.emit('call:end', { sessionId });
  }

  // WebRTC signalling
  function sendOffer(offer) { s.emit('webrtc:offer', { sessionId, offer }); }
  function sendAnswer(answer) { s.emit('webrtc:answer', { sessionId, answer }); }
  function sendIceCandidate(candidate) { s.emit('webrtc:ice', { sessionId, candidate }); }

  // Register listeners (call this in useEffect)
  function subscribe() {
    if (handlers.onMessage)       s.on('message:new',     handlers.onMessage);
    if (handlers.onTypingStart)   s.on('typing:start',    handlers.onTypingStart);
    if (handlers.onTypingStop)    s.on('typing:stop',     handlers.onTypingStop);
    if (handlers.onCallIncoming)  s.on('call:incoming',   handlers.onCallIncoming);
    if (handlers.onCallAccepted)  s.on('call:accepted',   handlers.onCallAccepted);
    if (handlers.onCallDeclined)  s.on('call:declined',   handlers.onCallDeclined);
    if (handlers.onCallEnded)     s.on('call:ended',      handlers.onCallEnded);
    if (handlers.onAiInsight)     s.on('ai:insight',      handlers.onAiInsight);
    if (handlers.onPartnerOffline) s.on('partner:offline', handlers.onPartnerOffline);
    if (handlers.onSessionActive) s.on('session:active',  handlers.onSessionActive);
    // WebRTC
    if (handlers.onOffer)         s.on('webrtc:offer',    handlers.onOffer);
    if (handlers.onAnswer)        s.on('webrtc:answer',   handlers.onAnswer);
    if (handlers.onIceCandidate)  s.on('webrtc:ice',      handlers.onIceCandidate);
  }

  function unsubscribe() {
    ['message:new','typing:start','typing:stop','call:incoming','call:accepted',
     'call:declined','call:ended','ai:insight','partner:offline','session:active',
     'webrtc:offer','webrtc:answer','webrtc:ice'].forEach(e => s.off(e));
  }

  return {
    joinSession, sendMessage, startTyping, stopTyping,
    requestCall, acceptCall, declineCall, endCall,
    sendOffer, sendAnswer, sendIceCandidate,
    subscribe, unsubscribe,
  };
}
