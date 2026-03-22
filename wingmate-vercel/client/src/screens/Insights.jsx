// client/src/screens/Insights.jsx
import React, { useEffect, useState } from 'react';
import { useSession } from '../context/SessionContext';
import { useNavigate } from 'react-router-dom';
import { ai } from '../lib/api';

export default function Insights() {
  const { insights, loadInsights } = useSession();
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadInsights().finally(() => setLoading(false));
  }, [loadInsights]);

  async function handleDelete(id) {
    await ai.deleteInsight(id);
    loadInsights();
  }

  if (loading) {
    return (
      <div className="insights-wrap">
        <div className="matching-anim">
          <div className="orbit"><div className="orbit-dot"/></div>
          <div className="orbit"><div className="orbit-dot"/></div>
          <div className="orbit-center">💡</div>
        </div>
        <p style={{textAlign:'center',color:'var(--text-muted)',marginTop:16}}>Loading your insights…</p>
      </div>
    );
  }

  return (
    <div className="insights-wrap">
      <h2>Your Insights</h2>
      <p className="sub-h">AI-surfaced patterns and clarity from your sessions</p>

      {insights.length === 0 && (
        <div className="insight-card" style={{textAlign:'center',padding:40}}>
          <div style={{fontSize:'2rem',marginBottom:12}}>💡</div>
          <p style={{color:'var(--text-muted)'}}>Your insights will appear here after your first session ends.</p>
          <button className="btn-next" style={{marginTop:20,width:'auto',padding:'12px 28px'}}
            onClick={() => navigate('/onboard')}>
            Start a Session →
          </button>
        </div>
      )}

      {insights.map(ins => (
        <div className="insight-card" key={ins.id}>
          <div className="insight-card-header">
            <div>
              <div className="insight-label">
                {ins.type === 'clarity'  && 'Clarity Report'}
                {ins.type === 'pattern'  && 'Pattern Detected'}
                {ins.type === 'action'   && 'Key Takeaways'}
              </div>
              <div className="insight-title">{ins.title}</div>
            </div>
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              <span className={`insight-badge badge-${ins.type}`}>
                {ins.type.charAt(0).toUpperCase() + ins.type.slice(1)}
              </span>
              <button
                onClick={() => handleDelete(ins.id)}
                style={{background:'none',border:'none',color:'var(--text-muted)',cursor:'pointer',fontSize:'1rem'}}
                title="Delete insight"
              >✕</button>
            </div>
          </div>

          <div className="insight-text">{ins.body}</div>

          {ins.key_moments?.length > 0 && (
            <div className="key-moments">
              {ins.key_moments.map((m, i) => (
                <div className="moment" key={i}>
                  <div className="moment-dot" />
                  <div className="moment-text">{m}</div>
                </div>
              ))}
            </div>
          )}

          {ins.takeaways?.length > 0 && (
            <div className="takeaway-section">
              <div className="takeaway-label">What was suggested</div>
              <div className="takeaway-list">
                {ins.takeaways.map((t, i) => (
                  <div className="takeaway-item" key={i}>
                    <span className="takeaway-icon">→</span> {t}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{fontSize:'0.72rem',color:'var(--text-muted)',marginTop:12}}>
            {new Date(ins.created_at).toLocaleDateString()}
          </div>
        </div>
      ))}

      <div className="safety-banner" style={{marginTop:16}}>
        <div className="safety-icon">🧹</div>
        <div>
          <div className="safety-title">Ephemeral by design</div>
          <div className="safety-text">
            The conversations that generated these insights have already been deleted.
            You can delete any insight above at any time.
          </div>
        </div>
      </div>
    </div>
  );
}
