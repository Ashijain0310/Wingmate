// client/src/screens/GetStarted.jsx
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const STEPS = ['Role', 'Account', 'Profile', 'Done'];

export default function GetStarted() {
  const { signup } = useAuth();
  const navigate = useNavigate();

  const [step, setStep]         = useState(0);
  const [role, setRole]         = useState('');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [alias, setAlias]       = useState('');
  const [ageRange, setAgeRange] = useState('');
  const [needs, setNeeds]       = useState([]);
  const [termsOk, setTermsOk]   = useState(false);
  const [showPw, setShowPw]     = useState(false);
  const [loading, setLoading]   = useState(false);
  const [err, setErr]           = useState('');

  // Password strength
  function pwScore(pw) {
    let s = 0;
    if (pw.length >= 8)         s++;
    if (/[A-Z]/.test(pw))       s++;
    if (/[0-9]/.test(pw))       s++;
    if (/[^A-Za-z0-9]/.test(pw)) s++;
    return s;
  }
  const score = pwScore(password);
  const pwLabels = ['Too short', 'Weak', 'Fair', 'Strong', 'Very strong'];

  function toggleNeed(n) {
    setNeeds(prev => prev.includes(n) ? prev.filter(x => x !== n) : [...prev, n]);
  }

  async function handleNext() {
    setErr('');

    if (step === 0) {
      if (!role) { setErr('Please pick a role'); return; }
    }

    if (step === 1) {
      if (!email || !/\S+@\S+\.\S+/.test(email)) { setErr('Enter a valid email'); return; }
      if (password.length < 6) { setErr('Password needs at least 6 characters'); return; }
      if (!termsOk) { setErr('Please accept the terms to continue'); return; }
    }

    if (step === 2) {
      setLoading(true);
      try {
        await signup({ email, password, alias: alias || generateAlias(), role, ageRange, needs });
        setStep(3);
      } catch (e) {
        setErr(e.message);
      } finally {
        setLoading(false);
      }
      return;
    }

    if (step === 3) {
      navigate('/onboard');
      return;
    }

    setStep(s => s + 1);
  }

  return (
    <div className="auth-layout">
      <div className="auth-panel">
        <div className="auth-panel-glow" />
        <div className="panel-cards">
          {[
            { tag: 'Free to start', text: '"I signed up in under 2 minutes. First session changed how I saw things."' },
            { tag: 'Become a Wingmate', text: '"Helping others actually helped me understand my own patterns."' },
            { tag: 'Safe space', text: '"Knowing it disappears after gave me the courage to share."' },
          ].map((c, i) => (
            <div className="panel-card" key={i}>
              <div className="panel-card-tag">✦ {c.tag}</div>
              <div className="panel-card-text">{c.text}</div>
              <div className="panel-card-author"><div className="panel-card-dot" /> Anonymous</div>
            </div>
          ))}
        </div>
        <div className="panel-quote">
          <span className="panel-quote-mark">"</span>
          <div className="panel-quote-text">Express yourself, truly and safely.</div>
          <div className="panel-quote-attr">Join <span>12,400+</span> people finding clarity</div>
        </div>
      </div>

      <div className="auth-form-side">
        <div className="auth-box">
          <Link to="/" className="auth-back">← Back to home</Link>
          <div className="auth-logo"><span className="logo-dot" /> Wingmate</div>

          {/* Step progress */}
          <div className="gs-steps">
            {STEPS.map((label, i) => (
              <React.Fragment key={i}>
                <div className={`gs-step ${i < step ? 'done' : ''} ${i === step ? 'active' : ''}`}>
                  <div className="gs-step-num">{i < step ? '✓' : i + 1}</div>
                  <span>{label}</span>
                </div>
                {i < STEPS.length - 1 && <div className={`gs-connector ${i < step ? 'done' : ''}`} />}
              </React.Fragment>
            ))}
          </div>

          {err && <div className="form-error">{err}</div>}

          {/* Step 0 — Role */}
          {step === 0 && (
            <>
              <h1 className="auth-heading">How will you use Wingmate?</h1>
              <p className="auth-sub">Pick your path. You can always switch later.</p>
              <div className="plan-row">
                {[
                  { id: 'seeker',   emoji: '🙋', name: 'Seeker',        desc: 'I need perspective on a situation' },
                  { id: 'wingmate', emoji: '🦋', name: 'Wingmate',      desc: 'I want to help others' },
                  { id: 'both',     emoji: '✨', name: 'Both',          desc: 'Give and receive support' },
                  { id: 'explore',  emoji: '👀', name: 'Just exploring', desc: "I'm curious, not sure yet" },
                ].map(p => (
                  <div
                    key={p.id}
                    className={`plan-card ${role === p.id ? 'selected' : ''}`}
                    onClick={() => setRole(p.id)}
                  >
                    <div className="plan-emoji">{p.emoji}</div>
                    <div className="plan-name">{p.name}</div>
                    <div className="plan-desc">{p.desc}</div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Step 1 — Account */}
          {step === 1 && (
            <>
              <h1 className="auth-heading">Create your account.</h1>
              <p className="auth-sub">All free. No credit card needed.</p>
              <div className="input-wrap">
                <span className="input-icon">✉</span>
                <input type="email" value={email} placeholder="your@email.com"
                  onChange={e => setEmail(e.target.value)} autoComplete="email" />
              </div>
              <div className="input-wrap">
                <span className="input-icon">🔑</span>
                <input type={showPw ? 'text' : 'password'} value={password}
                  placeholder="Create a password" onChange={e => setPassword(e.target.value)}
                  autoComplete="new-password" />
                <button type="button" className="input-eye" onClick={() => setShowPw(p => !p)}>
                  {showPw ? '🙈' : '👁'}
                </button>
              </div>
              {password.length > 0 && (
                <div className="pw-strength">
                  <div className="pw-strength-bar">
                    {[1,2,3,4].map(i => (
                      <div key={i} className={`pw-seg ${score >= i ? `s${score}` : ''}`} />
                    ))}
                  </div>
                  <div className="pw-label">{pwLabels[score]}</div>
                </div>
              )}
              <label className="checkbox-row">
                <input type="checkbox" checked={termsOk} onChange={e => setTermsOk(e.target.checked)} />
                <span>I agree to the <a href="#terms">Terms</a> and <a href="#privacy">Privacy Policy</a>.
                  I understand conversations are ephemeral and anonymous.</span>
              </label>
              <div className="terms-note">🔒 Your data is never sold. Sessions auto-delete.</div>
            </>
          )}

          {/* Step 2 — Profile */}
          {step === 2 && (
            <>
              <h1 className="auth-heading">Almost there.</h1>
              <p className="auth-sub">A few quick details to personalise your experience.</p>
              <div className="input-wrap">
                <span className="input-icon">👤</span>
                <input value={alias} placeholder={`Choose an alias (e.g. ${generateAlias()})`}
                  onChange={e => setAlias(e.target.value)} />
              </div>
              <p className="input-hint ok">This is what your Wingmate will call you. Stay anonymous.</p>
              <div className="form-group" style={{marginTop:16}}>
                <label className="form-label">Age range</label>
                <div className="choice-grid" style={{gridTemplateColumns:'repeat(4,1fr)'}}>
                  {['18–24','25–32','33–45','46+'].map(a => (
                    <div key={a} className={`choice-btn ${ageRange === a ? 'selected' : ''}`}
                      onClick={() => setAgeRange(a)} style={{padding:'10px 6px',fontSize:'0.8rem'}}>
                      {a}
                    </div>
                  ))}
                </div>
              </div>
              <div className="form-group" style={{marginTop:16}}>
                <label className="form-label">What do you usually need most?</label>
                <div className="choice-grid">
                  {['Someone to vent to','Honest perspective','Help with wording','Pattern recognition'].map(n => (
                    <div key={n} className={`choice-btn ${needs.includes(n) ? 'selected' : ''}`}
                      onClick={() => toggleNeed(n)}>{n}</div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Step 3 — Done */}
          {step === 3 && (
            <div className="auth-success">
              <div className="success-circle">🦋</div>
              <h2 className="auth-heading" style={{fontSize:'1.7rem',marginBottom:8}}>You're all set!</h2>
              <p className="auth-sub" style={{marginBottom:28}}>Your anonymous safe space is ready.</p>
              <div className="safety-banner">
                <div className="safety-icon">🔒</div>
                <div>
                  <div className="safety-title">Radical Anonymity is ON</div>
                  <div className="safety-text">Your alias, your rules. No one sees your real email — ever.</div>
                </div>
              </div>
            </div>
          )}

          <button className="auth-submit" onClick={handleNext} disabled={loading}
            style={{marginTop: step === 2 ? 20 : 16}}>
            {loading ? 'Creating account…' : step === 3 ? 'Start My First Session →' : 'Continue →'}
          </button>

          {step < 2 && (
            <div className="auth-footer">
              Already have an account? <Link to="/signin">Sign in</Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function generateAlias() {
  const adj = ['Blue','Wild','Quiet','Bright','Calm','Swift','Deep','Soft'];
  const noun = ['Sky','River','Flower','Storm','Wave','Forest','Star','Moon'];
  return adj[Math.floor(Math.random()*adj.length)] + noun[Math.floor(Math.random()*noun.length)];
}
