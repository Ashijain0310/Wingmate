// client/src/components/ErrorBoundary.jsx
import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="screen-center" style={{ padding: 32, textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: 16 }}>😔</div>
          <h2 style={{ fontFamily: 'Playfair Display, serif', color: 'var(--white)', marginBottom: 8 }}>
            Something went wrong
          </h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: 24, maxWidth: 400 }}>
            {this.state.error?.message || 'An unexpected error occurred.'}
          </p>
          <button
            className="btn-next"
            style={{ width: 'auto', padding: '12px 28px' }}
            onClick={() => { this.setState({ hasError: false, error: null }); window.location.href = '/'; }}
          >
            Go Home
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
