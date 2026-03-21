// client/src/context/SessionContext.jsx
import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { sessions, ai } from '../lib/api';
import { getSocket } from '../lib/socket';

const SessionContext = createContext(null);

export function SessionProvider({ children }) {
  const [session, setSession]       = useState(null);   // { id, status, startedAt }
  const [wingmate, setWingmate]     = useState(null);   // matched wingmate info
  const [messages, setMessages]     = useState([]);
  const [insights, setInsights]     = useState([]);
  const [isMatching, setIsMatching] = useState(false);
  const [callState, setCallState]   = useState('idle'); // idle|ringing|active|ended
  const typingTimeout = useRef(null);

  // Start a new session — calls backend matching engine
  const startSession = useCallback(async (payload) => {
    setIsMatching(true);
    try {
      const data = await sessions.create(payload);
      setSession(data.session);
      setWingmate(data.wingmate);
      setMessages([]);

      // Join the socket room
      const socket = getSocket();
      if (socket) socket.emit('session:join', { sessionId: data.session.id });

      return data;
    } finally {
      setIsMatching(false);
    }
  }, []);

  // Called by socket listener when a new message arrives
  const receiveMessage = useCallback((msg) => {
    setMessages(prev => {
      // Deduplicate by id
      if (prev.find(m => m.id === msg.id)) return prev;
      return [...prev, msg];
    });
  }, []);

  // Optimistically add own message (socket will confirm)
  const addOptimisticMessage = useCallback((content, userId, alias) => {
    const tmpId = `tmp-${Date.now()}`;
    const msg = {
      id: tmpId,
      senderId: userId,
      senderAlias: alias,
      senderRole: 'seeker',
      content,
      createdAt: new Date().toISOString(),
      optimistic: true,
    };
    setMessages(prev => [...prev, msg]);
    return tmpId;
  }, []);

  // Confirm optimistic message with real server message
  const confirmMessage = useCallback((tmpId, serverMsg) => {
    setMessages(prev => prev.map(m => m.id === tmpId ? { ...serverMsg } : m));
  }, []);

  // Add AI insight note to chat
  const addAiInsight = useCallback((text) => {
    setMessages(prev => [...prev, {
      id: `ai-${Date.now()}`,
      senderRole: 'ai_note',
      content: text,
      createdAt: new Date().toISOString(),
    }]);
  }, []);

  // Load message history from backend
  const loadMessages = useCallback(async (sessionId) => {
    const { messages: msgs } = await sessions.getMessages(sessionId);
    setMessages(msgs);
  }, []);

  // End session and get insights
  const endSession = useCallback(async () => {
    if (!session) return;
    await sessions.end(session.id);
    setSession(s => s ? { ...s, status: 'ended' } : null);
    setCallState('idle');

    // Load saved insights
    try {
      const { insights: ins } = await ai.getInsights();
      setInsights(ins);
    } catch { /* non-fatal */ }
  }, [session]);

  // Load user's insights
  const loadInsights = useCallback(async () => {
    const { insights: ins } = await ai.getInsights();
    setInsights(ins);
  }, []);

  // Call state management
  const updateCallState = useCallback((state) => setCallState(state), []);

  const reset = useCallback(() => {
    setSession(null);
    setWingmate(null);
    setMessages([]);
    setCallState('idle');
    setIsMatching(false);
  }, []);

  return (
    <SessionContext.Provider value={{
      session, wingmate, messages, insights,
      isMatching, callState,
      startSession, receiveMessage, addOptimisticMessage,
      confirmMessage, addAiInsight, loadMessages,
      endSession, loadInsights, updateCallState, reset,
    }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within SessionProvider');
  return ctx;
}
