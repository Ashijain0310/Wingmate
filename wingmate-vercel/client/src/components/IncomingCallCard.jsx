// client/src/components/IncomingCallCard.jsx
import React from 'react';

export default function IncomingCallCard({ wingmate, onAccept, onDecline }) {
  return (
    <div id="callIncoming" className="call-overlay">
      <div className="call-incoming-card">
        <div className="call-ring-anim">
          <div className="call-ring r1" /><div className="call-ring r2" /><div className="call-ring r3" />
          <div className="call-avatar-wrap">
            <div className="avatar" style={{ width: 64, height: 64, fontSize: '1.8rem' }}>
              {wingmate?.emoji || '🌿'}
            </div>
          </div>
        </div>
        <div className="call-incoming-name">{wingmate?.alias || 'Wingmate'}</div>
        <div className="call-incoming-sub">wants to switch to a voice call</div>
        <div className="call-incoming-note">
          <span>🔒</span> Anonymous · your voice will be subtly masked
        </div>
        <div className="call-incoming-actions">
          <button className="call-decline-btn" onClick={onDecline}>✕</button>
          <button className="call-accept-btn" onClick={onAccept}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81 19.79 19.79 0 01.01 1.18 2 2 0 012 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 14.92v2z"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
