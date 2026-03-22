// client/src/screens/Home.jsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Home() {
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <>
      {/* Hero */}
      <div className="hero">
        <div className="hero-tag">
          <span>✦</span> Human Perspective · AI-Supported
        </div>
        <h1>Express yourself,<br /><em>truly and safely.</em></h1>
        <p>
          Confused by a text? Mixed signals? A hard conversation you can't navigate?
          Wingmate connects you with a real, neutral human who gets it — guided by AI.
        </p>
        <div className="hero-cta">
          <button
            className="btn btn-primary"
            onClick={() => navigate(user ? '/onboard' : '/get-started')}
          >
            Start a Free Session ↗
          </button>
          <button className="btn btn-secondary" onClick={() => navigate('/insights')}>
            See How It Works
          </button>
        </div>
        <div className="trust-pills">
          <div className="pill"><span className="pill-icon">🔒</span> Radical Anonymity</div>
          <div className="pill"><span className="pill-icon">🤝</span> Verified Humans</div>
          <div className="pill"><span className="pill-icon">✨</span> AI-Assisted Clarity</div>
          <div className="pill"><span className="pill-icon">⚡</span> Matched in Minutes</div>
        </div>
      </div>

      {/* Features */}
      <div className="features">
        {[
          {
            icon: '💬',
            title: 'Share Your Situation',
            desc: "Describe what's confusing you. Our AI helps you put feelings into words if you're stuck.",
          },
          {
            icon: '🎯',
            title: 'Get Matched Instantly',
            desc: 'AI matches you with the right Wingmate — someone who has navigated similar experiences.',
          },
          {
            icon: '🧠',
            title: 'Gain Real Clarity',
            desc: 'Talk it through. Our AI surfaces patterns and key insights from your conversation in real-time.',
          },
          {
            icon: '📞',
            title: 'Voice Calls Too',
            desc: 'Switch to an anonymous voice call any time. Your voice is masked. Your identity stays safe.',
          },
        ].map(f => (
          <div className="feat-card" key={f.title}>
            <div className="feat-icon">{f.icon}</div>
            <h3>{f.title}</h3>
            <p>{f.desc}</p>
          </div>
        ))}
      </div>

      {/* Social proof */}
      <div className="social-proof">
        <div className="proof-label">✦ What people say</div>
        <div className="proof-grid">
          {[
            { quote: "I finally understood why I kept overthinking their replies. My Wingmate saw it immediately.", tag: "Clarity moment" },
            { quote: "The AI noticed I used the word 'maybe' 8 times. That hit different.", tag: "Pattern found" },
            { quote: "I sent the message. It went well. I wouldn't have done it without this.", tag: "After the session" },
            { quote: "Switching to a voice call made everything clearer. No judgment, just real talk.", tag: "Voice call" },
          ].map((p, i) => (
            <div className="proof-card" key={i}>
              <div className="proof-tag">✦ {p.tag}</div>
              <div className="proof-quote">"{p.quote}"</div>
              <div className="proof-author">— Anonymous</div>
            </div>
          ))}
        </div>
      </div>

      {/* CTA strip */}
      <div className="cta-strip">
        <h2>Ready to find clarity?</h2>
        <p>Your first session is free. No real name required.</p>
        <button
          className="btn btn-primary"
          onClick={() => navigate(user ? '/onboard' : '/get-started')}
        >
          Get Started Free →
        </button>
      </div>
    </>
  );
}
