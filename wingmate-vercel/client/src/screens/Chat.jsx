// client/src/screens/Chat.jsx
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSession } from '../context/SessionContext';
import { useChat } from '../hooks/useChat';
import { useCall } from '../hooks/useCall';
import CallScreen from '../components/CallScreen';
import IncomingCallCard from '../components/IncomingCallCard';

export default function Chat() {
  const { user } = useAuth();
  const { session, wingmate, messages, callState, endSession, addOptimisticMessage } = useSession();
  const navigate = useNavigate();

  const {
    sendMessage, notifyTyping,
    requestCall, acceptCall, declineCall,
    getSuggestions,
    partnerTyping, partnerOnline, incomingCall,
  } = useChat(session?.id);

  const {
    callStatus, isMuted, isSpeaker, duration, audioRef,
    startCall, answerCall, endCall, toggleMute, toggleSpeaker,
  } = useCall(session?.id);

  const [input, setInput]             = useState('');
  const [suggestions, setSuggestions] = useState(null);
  const [showSuggest, setShowSuggest] = useState(false);
  const [callMinimized, setCallMinimized] = useState(false);
  const messagesEndRef = useRef(null);
  const suggestTimeout = useRef(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // AI rephrase suggestions (debounced)
  useEffect(() => {
    clearTimeout(suggestTimeout.current);
    if (input.length > 20) {
      suggestTimeout.current = setTimeout(async () => {
        const s = await getSuggestions(input);
        if (s) { setSuggestions(s); setShowSuggest(true); }
      }, 1500);
    } else {
      setShowSuggest(false);
    }
    return () => clearTimeout(suggestTimeout.current);
  }, [input, getSuggestions]);

  function handleSend() {
    if (!input.trim() || !session) return;
    addOptimisticMessage(input.trim(), user.id, user.alias);
    sendMessage(input.trim());
    setInput('');
    setShowSuggest(false);
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  }

  function handleInputChange(e) {
    setInput(e.target.value);
    notifyTyping();
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
  }

  function useSuggestion(text) {
    setInput(text);
    setShowSuggest(false);
  }

  async function handleCallBtn() {
    if (callStatus === 'idle') {
      await startCall();
      requestCall();
    }
  }

  async function handleAcceptCall() {
    acceptCall();
    await answerCall();
  }

  async function handleEndSession() {
    if (window.confirm('End this session? The conversation will be cleared.')) {
      await endSession();
      navigate('/insights');
    }
  }

  if (!session || !wingmate) {
    return (
      <div className="screen-center">
        <p>No active session. <button onClick={() => navigate('/onboard')}>Start one →</button></p>
      </div>
    );
  }

  return (
    <div className="chat-wrap">
      {/* Hidden audio element for remote voice */}
      <audio ref={audioRef} autoPlay playsInline style={{ display: 'none' }} />

      {/* Incoming call overlay */}
      {incomingCall && callState === 'ringing' && (
        <IncomingCallCard
          wingmate={wingmate}
          onAccept={handleAcceptCall}
          onDecline={() => { declineCall(); }}
        />
      )}

      {/* Active call screen */}
      {(callStatus === 'active' || callStatus === 'connecting') && !callMinimized && (
        <CallScreen
          wingmate={wingmate}
          duration={duration}
          isMuted={isMuted}
          isSpeaker={isSpeaker}
          callStatus={callStatus}
          onMute={toggleMute}
          onSpeaker={toggleSpeaker}
          onMinimize={() => setCallMinimized(true)}
          onEnd={() => { endCall(); endCall(); }}
        />
      )}

      {/* Minimized call bar */}
      {callStatus === 'active' && callMinimized && (
        <div className="call-mini">
          <div className="call-mini-avatar">{wingmate.emoji || '🌿'}</div>
          <div className="call-mini-info">
            <span className="call-mini-name">{wingmate.alias}</span>
            <span className="call-mini-timer">{duration}</span>
          </div>
          <div className="call-mini-wave">
            {[...Array(5)].map((_, i) => <div key={i} className="mini-bar" />)}
          </div>
          <button className="call-mini-expand" onClick={() => setCallMinimized(false)}>▲</button>
          <button className="call-mini-end" onClick={() => { endCall(); setCallMinimized(false); }}>✕</button>
        </div>
      )}

      {/* Chat header */}
      <div className="chat-header">
        <div className="chat-status" />
        <div className="avatar" style={{ width: 40, height: 40, fontSize: '1.1rem', flexShrink: 0 }}>
          {wingmate.emoji || '🌿'}
        </div>
        <div className="chat-info">
          <div className="chat-name">{wingmate.alias}</div>
          <div className="chat-sub">
            {partnerOnline ? 'Your Wingmate · Online' : 'Your Wingmate · Reconnecting…'}
          </div>
        </div>
        <div className="chat-actions-top">
          <button
            className={`icon-btn call-pulse-btn ${callStatus !== 'idle' ? 'active' : ''}`}
            title="Start voice call"
            onClick={handleCallBtn}
            disabled={callStatus === 'connecting'}
          >
            <PhoneIcon />
          </button>
          <button className="icon-btn" title="View insights" onClick={() => navigate('/insights')}>💡</button>
          <button className="icon-btn" title="End session" onClick={handleEndSession}>✕</button>
        </div>
      </div>

      {/* Messages */}
      <div className="messages" id="messages">
        <div className="ai-insight">
          <span className="ai-insight-icon">✦</span>
          <span>
            AI Note: {wingmate.alias} has been matched to your situation.
            This conversation is anonymous and will disappear when you end the session.
          </span>
        </div>

        {messages.map(msg => <MessageBubble key={msg.id} msg={msg} userId={user.id} />)}

        {partnerTyping && (
          <div className="msg">
            <div className="msg-avatar">🌿</div>
            <div>
              <div className="msg-bubble">
                <div className="typing-indicator">
                  <div className="typing-dot" /><div className="typing-dot" /><div className="typing-dot" />
                </div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="chat-input-area">
        <div className="chat-input-row">
          <textarea
            value={input}
            placeholder="Share what's on your mind…"
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            rows={1}
          />
          <button className="send-btn" onClick={handleSend} disabled={!input.trim()}>↑</button>
        </div>

        {/* AI rephrase chips */}
        {showSuggest && suggestions && (
          <div className="ai-rephrase-bar">
            <span className="ai-rephrase-label">✦ AI:</span>
            {suggestions.gentle && (
              <span className="rephrase-chip" onClick={() => useSuggestion(suggestions.gentle)}>Gentler</span>
            )}
            {suggestions.direct && (
              <span className="rephrase-chip" onClick={() => useSuggestion(suggestions.direct)}>Clearer</span>
            )}
            {suggestions.contextual && (
              <span className="rephrase-chip" onClick={() => useSuggestion(suggestions.contextual)}>Add context</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function MessageBubble({ msg, userId }) {
  const isMine = msg.senderId === userId;
  const isAi   = msg.senderRole === 'ai_note';

  if (isAi) {
    return (
      <div className="ai-insight">
        <span className="ai-insight-icon">✦</span>
        <span>{msg.content}</span>
      </div>
    );
  }

  const time = new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className={`msg ${isMine ? 'mine' : ''}`}>
      {!isMine && <div className="msg-avatar">🌿</div>}
      <div>
        <div className="msg-bubble">{msg.content}</div>
        <div className="msg-time">{time}{msg.optimistic ? ' ·' : ''}</div>
      </div>
      {isMine && <div className="msg-avatar" style={{ background: 'linear-gradient(135deg, var(--navy-light), var(--lavender))' }}>👤</div>}
    </div>
  );
}

function PhoneIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81 19.79 19.79 0 01.01 1.18 2 2 0 012 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 14.92v2z"/>
    </svg>
  );
}
