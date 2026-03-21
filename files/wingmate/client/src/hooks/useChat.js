// client/src/hooks/useChat.js
import { useEffect, useRef, useState, useCallback } from 'react';
import { getSocket } from '../lib/socket';
import { useSession } from '../context/SessionContext';
import { useAuth } from '../context/AuthContext';
import { ai } from '../lib/api';

export function useChat(sessionId) {
  const { user } = useAuth();
  const {
    receiveMessage, addAiInsight, addOptimisticMessage,
    updateCallState,
  } = useSession();

  const [partnerTyping, setPartnerTyping] = useState(false);
  const [partnerOnline, setPartnerOnline] = useState(true);
  const [incomingCall, setIncomingCall]   = useState(null);
  const typingTimeoutRef = useRef(null);
  const socket = getSocket();

  useEffect(() => {
    if (!socket || !sessionId) return;

    socket.emit('session:join', { sessionId });

    const handlers = {
      'message:new':     (msg) => receiveMessage(msg),
      'typing:start':    ({ userId }) => { if (userId !== user.id) setPartnerTyping(true); },
      'typing:stop':     ({ userId }) => { if (userId !== user.id) setPartnerTyping(false); },
      'ai:insight':      ({ text }) => addAiInsight(text),
      'partner:offline': () => setPartnerOnline(false),
      'session:active':  () => {},
      'call:incoming':   (data) => { setIncomingCall(data); updateCallState('ringing'); },
      'call:accepted':   () => updateCallState('active'),
      'call:declined':   () => { setIncomingCall(null); updateCallState('idle'); },
      'call:ended':      () => { setIncomingCall(null); updateCallState('idle'); },
    };

    Object.entries(handlers).forEach(([event, fn]) => socket.on(event, fn));

    return () => {
      Object.keys(handlers).forEach(event => socket.off(event));
      clearTimeout(typingTimeoutRef.current);
    };
  }, [socket, sessionId, user?.id, receiveMessage, addAiInsight, updateCallState]);

  const sendMessage = useCallback((content) => {
    if (!socket || !content.trim()) return;
    socket.emit('message:send', { sessionId, content: content.trim() });
  }, [socket, sessionId]);

  const notifyTyping = useCallback(() => {
    if (!socket) return;
    socket.emit('typing:start', { sessionId });
    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('typing:stop', { sessionId });
    }, 2000);
  }, [socket, sessionId]);

  const requestCall = useCallback(() => {
    if (!socket) return;
    socket.emit('call:request', { sessionId });
    updateCallState('ringing');
  }, [socket, sessionId, updateCallState]);

  const acceptCall = useCallback(() => {
    if (!socket) return;
    socket.emit('call:accept', { sessionId });
    setIncomingCall(null);
    updateCallState('active');
  }, [socket, sessionId, updateCallState]);

  const declineCall = useCallback(() => {
    if (!socket) return;
    socket.emit('call:decline', { sessionId });
    setIncomingCall(null);
    updateCallState('idle');
  }, [socket, sessionId, updateCallState]);

  const endCall = useCallback(() => {
    if (!socket) return;
    socket.emit('call:end', { sessionId });
    updateCallState('idle');
  }, [socket, sessionId, updateCallState]);

  // AI rephrase suggestions
  const getSuggestions = useCallback(async (draft) => {
    if (!draft?.trim() || draft.length < 5) return null;
    try {
      const { suggestions } = await ai.suggest(draft, sessionId);
      return suggestions;
    } catch { return null; }
  }, [sessionId]);

  return {
    sendMessage, notifyTyping,
    requestCall, acceptCall, declineCall, endCall,
    getSuggestions,
    partnerTyping, partnerOnline, incomingCall,
  };
}
