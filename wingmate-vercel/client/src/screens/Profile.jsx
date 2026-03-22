// client/src/screens/Profile.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSession } from '../context/SessionContext';
import { useNavigate } from 'react-router-dom';

const BASE = process.env.REACT_APP_API_URL || '/api';

async function apiFetch(path, options = {}) {
  const token = localStorage.getItem('wm_token');
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export default function Profile() {
  const { user, signout } = useAuth();
  const { session } = useSession();
  const navigate = useNavigate();

  const [profile, setProfile]   = useState(null);
  const [loading, setLoading]   = useState(true);
  const [editing, setEditing]   = useState(false);
  const [alias, setAlias]       = useState('');
  const [saving, setSaving]     = useState(false);
  const [rateScore, setRateScore] = useState(0);
  const [rated, setRated]       = useState(false);
  const [err, setErr]           = useState('');

  useEffect(() => {
    apiFetch('/users/me/profile')
      .then(d => { setProfile(d.profile); setAlias(d.profile.alias); })
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function saveAlias() {
    setSaving(true);
    try {
      await apiFetch('/users/me', { method: 'PATCH', body: { alias } });
      setProfile(p => ({ ...p, alias }));
      setEditing(false);
      window.showToast?.('Alias updated ✓');
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function submitRating() {
    if (!session?.id || rateScore === 0) return;
    try {
      await apiFetch('/users/rate', { method: 'POST', body: { sessionId: session.id, score: rateScore } });
      setRated(true);
      window.showToast?.('Rating submitted ✓');
    } catch (e) {
      setErr(e.message);
    }
  }

  async function deleteAccount() {
    if (!window.confirm('Delete your account? All data will be permanently removed. This cannot be undone.')) return;
    try {
      await apiFetch('/users/me', { method: 'DELETE' });
      signout();
      navigate('/');
    } catch (e) {
      setErr(e.message);
    }
  }

  if (loading) return <div className="screen-center"><p>Loading…</p></div>;

  return (
    <div className="profile-wrap">
      <h2>Your Profile</h2>

      {err && <div className="form-error">{err}</div>}

      {/* Identity */}
      <div className="profile-section">
        <h3>Identity</h3>
        <div className="stat-row">
          <span className="stat-label">Alias</span>
          {editing ? (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                value={alias}
                onChange={e => setAlias(e.target.value)}
                style={{ background: 'rgba(13,27,53,0.7)', border: '1.5px solid var(--teal)', borderRadius: 8, padding: '6px 10px', color: 'var(--white)', fontFamily: 'DM Sans', fontSize: '0.9rem', width: 140 }}
              />
              <button className="btn-next" style={{ flex: 'unset', padding: '6px 16px', fontSize: '0.82rem' }} onClick={saveAlias} disabled={saving}>
                {saving ? '…' : 'Save'}
              </button>
              <button className="btn-back" style={{ padding: '6px 12px', fontSize: '0.82rem' }} onClick={() => setEditing(false)}>Cancel</button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <span className="stat-value">{profile?.alias}</span>
              <button onClick={() => setEditing(true)}
                style={{ background: 'none', border: 'none', color: 'var(--teal)', cursor: 'pointer', fontSize: '0.8rem' }}>Edit</button>
            </div>
          )}
        </div>
        <div className="stat-row">
          <span className="stat-label">Role</span>
          <span className="stat-value" style={{ textTransform: 'capitalize' }}>{profile?.role}</span>
        </div>
        <div className="stat-row">
          <span className="stat-label">Member since</span>
          <span className="stat-value">{new Date(profile?.created_at).toLocaleDateString()}</span>
        </div>
        <div className="stat-row">
          <span className="stat-label">Age range</span>
          <span className="stat-value">{profile?.age_range || '—'}</span>
        </div>
      </div>

      {/* Stats */}
      <div className="profile-section">
        <h3>Activity</h3>
        <div className="stat-row">
          <span className="stat-label">Sessions completed</span>
          <span className="stat-value">{profile?.totalSessions ?? 0}</span>
        </div>
        <div className="stat-row">
          <span className="stat-label">Insights saved</span>
          <span className="stat-value">{profile?.totalInsights ?? 0}</span>
        </div>
        {(profile?.role === 'wingmate' || profile?.role === 'both') && (
          <>
            <div className="stat-row">
              <span className="stat-label">Rating</span>
              <span className="stat-value">
                {profile?.rating > 0 ? `⭐ ${Number(profile.rating).toFixed(1)} (${profile.rating_count})` : 'No ratings yet'}
              </span>
            </div>
            <div className="stat-row">
              <span className="stat-label">Available now</span>
              <span className="stat-value" style={{ color: profile?.available ? 'var(--teal)' : 'var(--text-muted)' }}>
                {profile?.available ? '● Online' : '○ Offline'}
              </span>
            </div>
          </>
        )}
      </div>

      {/* Rate last Wingmate */}
      {session?.status === 'ended' && !rated && (
        <div className="profile-section">
          <h3>Rate Your Last Session</h3>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginBottom: 16 }}>
            How helpful was your Wingmate?
          </p>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            {[1, 2, 3, 4, 5].map(s => (
              <button key={s} onClick={() => setRateScore(s)}
                style={{
                  width: 40, height: 40, borderRadius: '50%', border: '1.5px solid',
                  borderColor: s <= rateScore ? 'var(--teal)' : 'var(--card-border)',
                  background: s <= rateScore ? 'rgba(62,207,178,0.15)' : 'transparent',
                  color: s <= rateScore ? 'var(--teal)' : 'var(--text-muted)',
                  cursor: 'pointer', fontSize: '1rem', transition: 'all 0.2s',
                }}>
                ★
              </button>
            ))}
          </div>
          <button className="btn-next" style={{ width: 'auto', padding: '10px 24px' }}
            onClick={submitRating} disabled={rateScore === 0}>
            Submit Rating →
          </button>
        </div>
      )}

      {/* Privacy */}
      <div className="profile-section">
        <h3>Privacy & Data</h3>
        <div className="safety-banner" style={{ marginBottom: 16 }}>
          <div className="safety-icon">🔒</div>
          <div>
            <div className="safety-title">Your email is never stored</div>
            <div className="safety-text">
              We store a one-way hash of your email for uniqueness checking only.
              It cannot be reversed. Conversations are deleted when sessions end.
            </div>
          </div>
        </div>
        <button
          onClick={deleteAccount}
          style={{
            width: '100%', padding: 12, borderRadius: 50, border: '1.5px solid rgba(224,90,107,0.3)',
            background: 'rgba(224,90,107,0.08)', color: 'var(--danger)',
            cursor: 'pointer', fontSize: '0.88rem', transition: 'all 0.22s',
          }}
        >
          Delete My Account & All Data
        </button>
      </div>

      {/* Sign out */}
      <button className="btn-back" style={{ width: '100%', marginTop: 8 }}
        onClick={() => { signout(); navigate('/'); }}>
        Sign Out
      </button>
    </div>
  );
}
