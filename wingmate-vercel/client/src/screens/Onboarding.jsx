// client/src/screens/Onboarding.jsx
import React, { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSession } from '../context/SessionContext';
import { ai } from '../lib/api';

const CATEGORIES = [
  'A confusing text or message',
  'Mixed signals from someone',
  'A breakup or distance',
  'How to start a conversation',
  'Relationship tension',
  'Friendship issue',
  'Something else',
];

export default function Onboarding() {
  const { user } = useAuth();
  const { startSession, isMatching } = useSession();
  const navigate = useNavigate();

  const [step, setStep]           = useState(0);
  const [role, setRole]           = useState(user?.role || 'seeker');
  const [category, setCategory]   = useState('');
  const [situation, setSituation] = useState('');
  const [genderPref, setGenderPref] = useState('Any');
  const [needType, setNeedType]   = useState('');
  const [alias]                   = useState(user?.alias || '');

  const [aiSuggestion, setAiSuggestion] = useState('');
  const [aiLoading, setAiLoading]       = useState(false);
  const [err, setErr]                   = useState('');
  const rephraseTimeout = useRef(null);

  // AI rephrase — fires after user pauses typing
  const handleSituationChange = useCallback(async (val) => {
    setSituation(val);
    clearTimeout(rephraseTimeout.current);
    if (val.trim().length < 15) { setAiSuggestion(''); return; }
    rephraseTimeout.current = setTimeout(async () => {
      setAiLoading(true);
      try {
        const { rephrased } = await ai.rephrase(val);
        if (rephrased) setAiSuggestion(rephrased);
      } catch { /* non-fatal */ }
      finally { setAiLoading(false); }
    }, 900);
  }, []);

  function useAiSuggestion() {
    setSituation(aiSuggestion);
    setAiSuggestion('');
  }

  async function handleFinish() {
    setErr('');
    try {
      await startSession({ situation, category, genderPref, needs: needType ? [needType] : [] });
      navigate('/matching');
    } catch (e) {
      setErr(e.message || 'Could not start session. Please try again.');
    }
  }

  function next() {
    setErr('');
    if (step === 1 && !category) { setErr('Please select a category'); return; }
    if (step === 1 && !situation.trim()) { setErr('Please describe your situation'); return; }
    setStep(s => s + 1);
  }

  function back() { setErr(''); setStep(s => s - 1); }

  return (
    <div className="onboard-wrap">
      {/* Step dots */}
      <div className="step-indicator">
        {[0,1,2,3].map(i => (
          <div key={i} className={`step-dot ${i < step ? 'done' : ''} ${i === step ? 'active' : ''}`} />
        ))}
      </div>

      {err && <div className="form-error" style={{marginBottom:16}}>{err}</div>}

      {/* ── Step 0: Role ── */}
      {step === 0 && (
        <div className="onboard-card">
          <h2>Welcome, {alias || 'there'}. 👋</h2>
          <p className="sub">How would you like to use Wingmate today?</p>
          <div className="choice-grid">
            {[
              { id: 'seeker',   icon: '🙋', label: "I need perspective on something" },
              { id: 'wingmate', icon: '🦋', label: "I want to be someone's Wingmate" },
            ].map(r => (
              <div key={r.id} className={`choice-btn ${role === r.id ? 'selected' : ''}`}
                onClick={() => setRole(r.id)}>
                <span className="choice-icon">{r.icon}</span>
                {r.label}
              </div>
            ))}
          </div>
          <div className="form-actions" style={{marginTop:28}}>
            <button className="btn-next w-full" onClick={next}>Continue →</button>
          </div>
        </div>
      )}

      {/* ── Step 1: Situation ── */}
      {step === 1 && (
        <div className="onboard-card">
          <h2>What's on your mind?</h2>
          <p className="sub">Describe your situation. There's no wrong way to start.</p>

          <div className="form-group">
            <label>What category fits best?</label>
            <select value={category} onChange={e => setCategory(e.target.value)}>
              <option value="">— Select —</option>
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>

          <div className="form-group">
            <label>Tell us more (in your own words)</label>
            <textarea
              rows={4}
              value={situation}
              placeholder="e.g. They seemed fine yesterday but today they're distant. I don't know what I did…"
              onChange={e => handleSituationChange(e.target.value)}
            />
          </div>

          {/* AI reflection */}
          <div className="ai-helper">
            <div className="ai-helper-label">✦ AI Reflection</div>
            {aiLoading && <div className="ai-suggestion" style={{opacity:0.5}}>Thinking…</div>}
            {!aiLoading && aiSuggestion && (
              <>
                <div className="ai-suggestion">{aiSuggestion}</div>
                <button className="ai-use-btn" onClick={useAiSuggestion}>Use this phrasing →</button>
              </>
            )}
            {!aiLoading && !aiSuggestion && (
              <div className="ai-suggestion">Start typing and I'll help you clarify your feelings…</div>
            )}
          </div>

          <div className="form-actions">
            <button className="btn-back" onClick={back}>← Back</button>
            <button className="btn-next" onClick={next}>Continue →</button>
          </div>
        </div>
      )}

      {/* ── Step 2: Preferences ── */}
      {step === 2 && (
        <div className="onboard-card">
          <h2>Your preferences</h2>
          <p className="sub">Help us find the right Wingmate for you.</p>

          <div className="form-group">
            <label>Preferred Wingmate gender</label>
            <div className="choice-grid">
              {['Any','Woman','Man','Non-binary'].map(g => (
                <div key={g} className={`choice-btn ${genderPref === g ? 'selected' : ''}`}
                  onClick={() => setGenderPref(g)}>{g}</div>
              ))}
            </div>
          </div>

          <div className="form-group" style={{marginTop:16}}>
            <label>What do you need most?</label>
            <div className="choice-grid">
              {['Someone to listen','Honest advice','Help with wording','Outside perspective'].map(n => (
                <div key={n} className={`choice-btn ${needType === n ? 'selected' : ''}`}
                  onClick={() => setNeedType(n)}>{n}</div>
              ))}
            </div>
          </div>

          <div className="form-actions">
            <button className="btn-back" onClick={back}>← Back</button>
            <button className="btn-next" onClick={next}>Find My Wingmate →</button>
          </div>
        </div>
      )}

      {/* ── Step 3: Anonymity confirmation ── */}
      {step === 3 && (
        <div className="onboard-card">
          <h2>Your safe space 🔒</h2>
          <p className="sub">Everything here is anonymous. No real names, no judgment.</p>

          <div className="safety-banner">
            <div className="safety-icon">🛡️</div>
            <div>
              <div className="safety-title">Radical Anonymity</div>
              <div className="safety-text">
                You and your Wingmate only see each other's alias. Conversations disappear after your session ends.
              </div>
            </div>
          </div>

          <div className="safety-banner" style={{marginTop:12}}>
            <div className="safety-icon">🤖</div>
            <div>
              <div className="safety-title">Human Heart, AI Brain</div>
              <div className="safety-text">
                AI helps with matching and clarity — but every word of support comes from a real human.
              </div>
            </div>
          </div>

          <div className="form-actions" style={{marginTop:24}}>
            <button className="btn-back" onClick={back}>← Back</button>
            <button
              className="btn-next"
              onClick={handleFinish}
              disabled={isMatching}
            >
              {isMatching ? 'Finding your Wingmate…' : "I'm ready →"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
