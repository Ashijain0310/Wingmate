// client/src/components/CallScreen.jsx
import React from 'react';

export default function CallScreen({
  wingmate, duration, isMuted, isSpeaker,
  callStatus, onMute, onSpeaker, onMinimize, onEnd,
}) {
  return (
    <div className="call-overlay">
      <div className="call-full-screen">
        <div className="call-bg-orb orb1" />
        <div className="call-bg-orb orb2" />

        {/* Top bar */}
        <div className="call-top-bar">
          <div className="call-secure-badge">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2L4 5v6c0 5.5 3.8 10.7 8 12 4.2-1.3 8-6.5 8-12V5L12 2z"/>
            </svg>
            Anonymous &amp; Encrypted
          </div>
          <div className="call-timer">{duration}</div>
          <button className="call-minimize" onClick={onMinimize}>▲</button>
        </div>

        {/* Center */}
        <div className="call-center">
          <div className={`call-voice-anim ${callStatus === 'active' ? 'speaking' : ''}`}>
            <div className="voice-ring vr1" />
            <div className="voice-ring vr2" />
            <div className="voice-ring vr3" />
            <div className="call-big-avatar">{wingmate?.emoji || '🌿'}</div>
          </div>
          <div className="call-partner-name">{wingmate?.alias || 'Wingmate'}</div>
          <div className="call-status-text">
            {callStatus === 'connecting' ? 'Connecting…' : 'Connected'}
          </div>

          <div className={`waveform ${isMuted ? 'muted' : ''}`}>
            {[...Array(15)].map((_, i) => <div key={i} className="wave-bar" />)}
          </div>

          <div className="call-ai-note">
            <span className="call-ai-dot" />
            <span>Your voice is anonymously masked · AI listening for clarity cues</span>
          </div>
        </div>

        {/* Controls */}
        <div className="call-controls">
          <div className="call-ctrl-group">
            <button
              className={`call-ctrl-btn ${isMuted ? 'muted' : ''}`}
              onClick={onMute}
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? <MutedIcon /> : <MicIcon />}
            </button>
            <span className="call-ctrl-label">{isMuted ? 'Unmute' : 'Mute'}</span>
          </div>

          <div className="call-ctrl-group">
            <button
              className={`call-ctrl-btn ${isSpeaker ? 'active' : ''}`}
              onClick={onSpeaker}
              title="Speaker"
            >
              <SpeakerIcon />
            </button>
            <span className="call-ctrl-label">Speaker</span>
          </div>

          <div className="call-ctrl-group">
            <button className="call-ctrl-btn active" title="Voice mask (always on)">
              <ShieldIcon />
            </button>
            <span className="call-ctrl-label">Mask On</span>
          </div>

          <div className="call-ctrl-group">
            <button className="call-ctrl-btn danger-btn" onClick={onEnd} title="End call">
              <EndCallIcon />
            </button>
            <span className="call-ctrl-label" style={{ color: 'var(--danger)' }}>End</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── SVG Icons ──────────────────────────────────────────────────────────────────
function MicIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/>
      <path d="M19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8"/>
    </svg>
  );
}

function MutedIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="1" y1="1" x2="23" y2="23"/>
      <path d="M9 9v3a3 3 0 005.12 2.12M15 9.34V4a3 3 0 00-5.94-.6"/>
      <path d="M17 16.95A7 7 0 015 12v-2m14 0v2a7 7 0 01-.11 1.23M12 19v4M8 23h8"/>
    </svg>
  );
}

function SpeakerIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
      <path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07"/>
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
  );
}

function EndCallIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z"/>
    </svg>
  );
}
