// client/src/hooks/useChat.js
import { useEffect, useRef, useState, useCallback } from 'react';
import { subscribeToSession, unsubscribe } from '../lib/pusher';
import { useSession } from '../context/SessionContext';
import { useAuth }    from '../context/AuthContext';
import { sessions, ai } from '../lib/api';

export function useChat(sessionId) {
  const { user }                                  = useAuth();
  const { receiveMessage, addAiInsight, addOptimisticMessage, updateCallState } = useSession();

  const [partnerTyping, setPartnerTyping] = useState(false);
  const [partnerOnline, setPartnerOnline] = useState(true);
  const [incomingCall,  setIncomingCall]  = useState(null);
  const channelRef     = useRef(null);
  const typingTimeout  = useRef(null);
  const typingThrottle = useRef(null);

  // Subscribe to Pusher session channel
  useEffect(() => {
    if (!sessionId) return;

    const ch = subscribeToSession(sessionId);
    channelRef.current = ch;

    ch.bind('message:new',     (msg)  => receiveMessage(msg));
    ch.bind('typing:start',    (data) => { if (data.userId !== user?.id) setPartnerTyping(true); });
    ch.bind('typing:stop',     (data) => { if (data.userId !== user?.id) setPartnerTyping(false); });
    ch.bind('ai:insight',      (data) => addAiInsight(data.text));
    ch.bind('partner:offline', ()     => setPartnerOnline(false));
    ch.bind('partner:online',  ()     => setPartnerOnline(true));
    ch.bind('call:incoming',   (data) => { setIncomingCall(data); updateCallState('ringing'); });
    ch.bind('call:accepted',   ()     => updateCallState('active'));
    ch.bind('call:declined',   ()     => { setIncomingCall(null); updateCallState('idle'); });
    ch.bind('call:ended',      ()     => { setIncomingCall(null); updateCallState('idle'); });

    return () => {
      ch.unbind_all();
      unsubscribe(`private-session-${sessionId}`);
      channelRef.current = null;
      clearTimeout(typingTimeout.current);
    };
  }, [sessionId, user?.id, receiveMessage, addAiInsight, updateCallState]);

  // Send message via REST API (Vercel serverless)
  const sendMessage = useCallback(async (content) => {
    if (!sessionId || !content.trim()) return;
    try {
      await sessions.sendMessage(sessionId, content.trim());
    } catch (e) {
      console.error('Send failed:', e.message);
    }
  }, [sessionId]);

  // Notify typing via REST — throttled to once per 2s
  const notifyTyping = useCallback(async () => {
    if (!sessionId) return;
    if (typingThrottle.current) return;
    typingThrottle.current = setTimeout(() => { typingThrottle.current = null; }, 2000);

    try {
      await fetch(`/api/sessions/${sessionId}/typing`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('wm_token') || ''}`,
        },
      });
    } catch { /* non-fatal */ }
  }, [sessionId]);

  // AI rephrase suggestions
  const getSuggestions = useCallback(async (draft) => {
    if (!draft?.trim() || draft.length < 5) return null;
    try {
      const { suggestions } = await ai.suggest(draft, sessionId);
      return suggestions;
    } catch { return null; }
  }, [sessionId]);

  // Call actions — POST to API which triggers Pusher broadcast
  const requestCall = useCallback(async () => {
    updateCallState('ringing');
    await fetch(`/api/calls/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('wm_token')}` },
      body: JSON.stringify({ sessionId }),
    }).catch(console.error);
  }, [sessionId, updateCallState]);

  const acceptCall = useCallback(async () => {
    setIncomingCall(null);
    updateCallState('active');
    await fetch(`/api/calls/accept`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('wm_token')}` },
      body: JSON.stringify({ sessionId }),
    }).catch(console.error);
  }, [sessionId, updateCallState]);

  const declineCall = useCallback(async () => {
    setIncomingCall(null);
    updateCallState('idle');
    await fetch(`/api/calls/decline`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('wm_token')}` },
      body: JSON.stringify({ sessionId }),
    }).catch(console.error);
  }, [sessionId, updateCallState]);

  const endCall = useCallback(async () => {
    updateCallState('idle');
    await fetch(`/api/calls/end`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('wm_token')}` },
      body: JSON.stringify({ sessionId }),
    }).catch(console.error);
  }, [sessionId, updateCallState]);

  return {
    sendMessage, notifyTyping, getSuggestions,
    requestCall, acceptCall, declineCall, endCall,
    partnerTyping, partnerOnline, incomingCall,
  };
}
