// client/src/screens/Matching.jsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../context/SessionContext';
import { useAuth } from '../context/AuthContext';
import { sessions as sessionsApi } from '../lib/api';

const WINGMATE_EMOJIS = ['🌿','🌊','✨','🌲','🌸','🌙','⭐','🌻'];

export default function Matching() {
  const { session, wingmate, startSession, reset } = useSession();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [phase, setPhase]   = useState('searching'); // searching | found | error
  const [errMsg, setErrMsg] = useState('');
  const [skipCount, setSkipCount] = useState(0);
  const [lastPayload, setLastPayload] = useState(null);

  // If we arrived here without a session, go back to onboarding
  useEffect(() => {
    if (!session && !wingmate) {
      // Give a brief moment in case context is still hydrating
      const t = setTimeout(() => navigate('/onboard'), 300);
      return () => clearTimeout(t);
    }
    if (session && wingmate) {
      // Simulate a brief "searching" animation before revealing the match
      const t = setTimeout(() => setPhase('found'), 2200);
      return () => clearTimeout(t);
    }
  }, [session, wingmate, navigate]);

  async function handleSkip() {
    if (!lastPayload) { navigate('/onboard'); return; }
    setPhase('searching');
    setSkipCount(c => c + 1);
    // End current session and start a new one
    try {
      if (session) await sessionsApi.end(session.id);
      reset();
      const data = await startSession(lastPayload);
      setLastPayload(lastPayload);
      setTimeout(() => setPhase('found'), 2200);
    } catch (e) {
      setErrMsg(e.message || 'No other Wingmates available right now.');
      setPhase('error');
    }
  }

  function handleAccept() {
    navigate('/chat');
  }

  const emoji = WINGMATE_EMOJIS[skipCount % WINGMATE_EMOJIS.length];

  return (
    <div className="matching-wrap">

      {/* Searching animation */}
      {phase === 'searching' && (
        <>
          <div className="matching-anim" id="matchAnim">
            <div className="orbit"><div className="orbit-dot" /></div>
            <div className="orbit"><div className="orbit-dot" /></div>
            <div className="orbit"><div className="orbit-dot" /></div>
            <div className="orbit-center">🦋</div>
          </div>
          <h2>Finding your Wingmate…</h2>
          <p>Our AI is scanning for someone with the right experience and availability to help you.</p>
        </>
      )}

      {/* Match found */}
      {phase === 'found' && wingmate && (
        <>
          <div className="matching-anim" style={{opacity:0.4}}>
            <div className="orbit"><div className="orbit-dot" /></div>
            <div className="orbit"><div className="orbit-dot" /></div>
            <div className="orbit"><div className="orbit-dot" /></div>
            <div className="orbit-center">🦋</div>
          </div>
          <h2>We found your Wingmate! 🎉</h2>
          <p>Based on your situation and preferences, here's who we think can help most.</p>

          <div className="match-result fade-in">
            <div className="match-header">
              <div className="avatar" style={{width:56,height:56,fontSize:'1.4rem',flexShrink:0}}>
                {emoji}
              </div>
              <div>
                <div className="match-name">{wingmate.alias}</div>
                <div className="match-meta">
                  Responded {wingmate.sessionCount || 0} times
                  {wingmate.rating > 0 && ` · ⭐ ${Number(wingmate.rating).toFixed(1)}`}
                  {' · Online now'}
                </div>
              </div>
            </div>

            {wingmate.tags?.length > 0 && (
              <div className="match-tags">
                {wingmate.tags.slice(0, 4).map(t => (
                  <span className="tag" key={t}>{t}</span>
                ))}
              </div>
            )}

            <div className="match-why">
              {wingmate.bio ||
                `${wingmate.alias} has helped people through very similar situations. They offer calm, honest perspective without taking sides.`}
            </div>

            <div className="match-actions">
              <button className="btn-accept" onClick={handleAccept}>Start Chatting →</button>
              <button className="btn-skip" onClick={handleSkip}>Skip</button>
            </div>
          </div>
        </>
      )}

      {/* Error */}
      {phase === 'error' && (
        <>
          <div style={{fontSize:'3rem',marginBottom:16}}>😔</div>
          <h2>No Wingmates available</h2>
          <p style={{marginBottom:24}}>{errMsg || 'All our Wingmates are busy right now. Please try again shortly.'}</p>
          <button className="btn-next w-full" onClick={() => navigate('/onboard')}>← Back to Start</button>
        </>
      )}
    </div>
  );
}
