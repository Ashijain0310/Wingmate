// client/src/screens/WingmateDashboard.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSession } from '../context/SessionContext';
import { getSocket } from '../lib/socket';

const BASE = process.env.REACT_APP_API_URL || 'http://localhost:4000/api';

async function apiFetch(path, opts = {}) {
  const token = localStorage.getItem('wm_token');
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...opts, body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Error');
  return data;
}

export default function WingmateDashboard() {
  const { user } = useAuth();
  const { startSession } = useSession();
  const navigate = useNavigate();

  const [available, setAvailable]         = useState(true);
  const [incomingRequest, setIncoming]    = useState(null);
  const [recentSessions, setRecent]       = useState([]);
  const [stats, setStats]                 = useState({ sessions: 0, rating: 0, ratingCount: 0 });
  const [toggling, setToggling]           = useState(false);
  const [accepting, setAccepting]         = useState(false);

  // Load profile + recent sessions
  useEffect(() => {
    apiFetch('/users/me/profile').then(d => {
      setAvailable(d.profile.available ?? true);
      setStats({
        sessions:     d.profile.session_count    || d.profile.totalSessions || 0,
        rating:       d.profile.rating           || 0,
        ratingCount:  d.profile.rating_count     || 0,
      });
    }).catch(console.error);

    apiFetch('/sessions').then(d => setRecent(d.sessions || [])).catch(console.error);
  }, []);

  // Listen for incoming session requests via socket
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    function onSessionRequest(data) {
      setIncoming(data);
    }
    socket.on('wingmate:request', onSessionRequest);
    return () => socket.off('wingmate:request', onSessionRequest);
  }, []);

  async function toggleAvailability() {
    setToggling(true);
    try {
      const next = !available;
      await apiFetch('/users/me/wingmate', { method: 'PATCH', body: { available: next } });
      setAvailable(next);
      window.showToast?.(next ? '● You are now available' : '○ You are now offline');
    } catch (e) {
      window.showToast?.(e.message);
    } finally {
      setToggling(false);
    }
  }

  async function acceptRequest() {
    if (!incomingRequest) return;
    setAccepting(true);
    try {
      // Join the session room via socket
      const socket = getSocket();
      socket?.emit('session:join', { sessionId: incomingRequest.sessionId });
      navigate('/chat');
    } catch (e) {
      window.showToast?.(e.message);
    } finally {
      setAccepting(false);
    }
  }

  function declineRequest() {
    const socket = getSocket();
    if (incomingRequest) {
      socket?.emit('wingmate:decline', { sessionId: incomingRequest.sessionId });
    }
    setIncoming(null);
  }

  const formatDate = (d) => new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

  return (
    <div className="profile-wrap">

      {/* Incoming request banner */}
      {incomingRequest && (
        <div style={{
          background: 'rgba(62,207,178,0.08)', border: '1.5px solid rgba(62,207,178,0.35)',
          borderRadius: 'var(--radius)', padding: '20px 24px', marginBottom: 20,
          animation: 'fadeUp 0.3s ease',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--teal)', animation: 'pulse 1s infinite' }} />
            <span style={{ color: 'var(--white)', fontWeight: 500, fontSize: '0.95rem' }}>
              Someone needs a Wingmate
            </span>
          </div>
          <p style={{ color: 'var(--lavender)', fontSize: '0.88rem', marginBottom: 16, lineHeight: 1.6 }}>
            Category: <strong style={{ color: 'var(--white)' }}>{incomingRequest.category || 'General'}</strong>
            <br />
            {incomingRequest.situation && `"${incomingRequest.situation.slice(0, 120)}…"`}
          </p>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn-accept" onClick={acceptRequest} disabled={accepting} style={{ flex: 1 }}>
              {accepting ? 'Joining…' : 'Accept →'}
            </button>
            <button className="btn-skip" onClick={declineRequest}>Decline</button>
          </div>
        </div>
      )}

      <h2>Wingmate Dashboard</h2>

      {/* Availability toggle */}
      <div className="profile-section" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ color: 'var(--white)', fontWeight: 500, marginBottom: 4 }}>
              {available ? '● You are available' : '○ You are offline'}
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              {available ? 'Seekers can be matched to you right now' : 'You won\'t receive new session requests'}
            </div>
          </div>
          <button
            onClick={toggleAvailability}
            disabled={toggling}
            style={{
              padding: '10px 22px', borderRadius: 50, border: '1.5px solid',
              borderColor: available ? 'rgba(224,90,107,0.4)' : 'rgba(62,207,178,0.4)',
              background: available ? 'rgba(224,90,107,0.08)' : 'rgba(62,207,178,0.08)',
              color: available ? 'var(--danger)' : 'var(--teal)',
              cursor: 'pointer', fontSize: '0.85rem', fontFamily: 'DM Sans',
              transition: 'all 0.22s', flexShrink: 0,
            }}
          >
            {toggling ? '…' : available ? 'Go Offline' : 'Go Online'}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="profile-section" style={{ marginBottom: 16 }}>
        <h3>Your Impact</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginTop: 8 }}>
          {[
            { label: 'Sessions', value: stats.sessions },
            { label: 'Rating',   value: stats.rating > 0 ? `⭐ ${Number(stats.rating).toFixed(1)}` : '—' },
            { label: 'Reviews',  value: stats.ratingCount },
          ].map(s => (
            <div key={s.label} style={{
              background: 'rgba(13,27,53,0.5)', borderRadius: 'var(--radius-sm)',
              padding: '16px 12px', textAlign: 'center',
              border: '1px solid var(--card-border)',
            }}>
              <div style={{ fontSize: '1.4rem', color: 'var(--white)', fontWeight: 500, marginBottom: 4 }}>
                {s.value}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tips */}
      <div className="profile-section" style={{ marginBottom: 16 }}>
        <h3>Wingmate Tips</h3>
        {[
          { icon: '👂', tip: 'Listen first. Don\'t rush to give advice — understanding the situation matters most.' },
          { icon: '🪞', tip: 'Reflect back what you hear. "It sounds like you\'re feeling…" goes a long way.' },
          { icon: '🚫', tip: 'Don\'t take sides. You\'re here to help them see clearly, not to validate a position.' },
          { icon: '✦',  tip: 'Trust the AI insights — they surface patterns the user might not notice themselves.' },
        ].map((t, i) => (
          <div key={i} style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: i < 3 ? '1px solid var(--card-border)' : 'none' }}>
            <span style={{ fontSize: '1.2rem', flexShrink: 0 }}>{t.icon}</span>
            <p style={{ fontSize: '0.86rem', color: 'var(--lavender)', lineHeight: 1.6 }}>{t.tip}</p>
          </div>
        ))}
      </div>

      {/* Recent sessions */}
      {recentSessions.length > 0 && (
        <div className="profile-section">
          <h3>Recent Sessions</h3>
          {recentSessions.slice(0, 5).map(s => (
            <div key={s.id} className="stat-row">
              <span className="stat-label">{s.category || 'General'}</span>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{
                  fontSize: '0.72rem', padding: '2px 8px', borderRadius: 20,
                  background: s.status === 'ended' ? 'rgba(62,207,178,0.1)' : 'rgba(240,160,80,0.1)',
                  color: s.status === 'ended' ? 'var(--teal)' : 'var(--warn)',
                  border: `1px solid ${s.status === 'ended' ? 'rgba(62,207,178,0.2)' : 'rgba(240,160,80,0.2)'}`,
                }}>
                  {s.status}
                </span>
                <span className="stat-value" style={{ fontSize: '0.8rem' }}>{formatDate(s.started_at)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
