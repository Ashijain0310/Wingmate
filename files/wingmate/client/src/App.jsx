// client/src/App.jsx
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SessionProvider } from './context/SessionContext';
import { useNotifications } from './hooks/useNotifications';

import SignIn      from './screens/SignIn';
import GetStarted  from './screens/GetStarted';
import Chat        from './screens/Chat';
import Insights    from './screens/Insights';
import Profile     from './screens/Profile';
import WingmateDashboard from './screens/WingmateDashboard';
import ErrorBoundary from './components/ErrorBoundary';

// Lazy-import existing screens from the static HTML converted to components
// For now, import inline placeholders that link to those flows
import Home        from './screens/Home';
import Onboarding  from './screens/Onboarding';
import Matching    from './screens/Matching';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="screen-center"><div className="matching-anim"><div className="orbit"><div className="orbit-dot"/></div><div className="orbit-center">🦋</div></div></div>;
  if (!user) return <Navigate to="/signin" replace />;
  return children;
}

function AppRoutes() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/"            element={<Home />} />
      <Route path="/signin"      element={user ? <Navigate to="/onboard" /> : <SignIn />} />
      <Route path="/get-started" element={user ? <Navigate to="/onboard" /> : <GetStarted />} />
      <Route path="/onboard"     element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
      <Route path="/matching"    element={<ProtectedRoute><Matching /></ProtectedRoute>} />
      <Route path="/chat"        element={<ProtectedRoute><Chat /></ProtectedRoute>} />
      <Route path="/insights"    element={<ProtectedRoute><Insights /></ProtectedRoute>} />
      <Route path="/profile"     element={<ProtectedRoute><Profile /></ProtectedRoute>} />
      <Route path="/wingmate"    element={<ProtectedRoute><WingmateDashboard /></ProtectedRoute>} />
      <Route path="*"            element={<Navigate to="/" />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <AuthProvider>
          <SessionProvider>
            <Nav />
            <NotificationBootstrap />
            <AppRoutes />
            <BottomNav />
            <Toast />
          </SessionProvider>
        </AuthProvider>
      </ErrorBoundary>
    </BrowserRouter>
  );
}

// Mounts the notification hook inside the auth/session providers
function NotificationBootstrap() {
  useNotifications();
  return null;
}

function Nav() {
  const { user, signout } = useAuth();
  return (
    <nav>
      <a href="/" className="logo"><span className="logo-dot"/>  Wingmate</a>
      <div className="nav-links" id="navLinks">
        {user ? (
          <>
            <span style={{color:'var(--text-muted)',fontSize:'0.85rem'}}>
              {user.alias}
            </span>
            <button className="nav-btn nav-ghost" onClick={signout}>Sign Out</button>
          </>
        ) : (
          <>
            <a href="/signin"      className="nav-btn nav-ghost">Sign In</a>
            <a href="/get-started" className="nav-btn nav-solid">Get Started</a>
          </>
        )}
      </div>
    </nav>
  );
}

// Global toast — can be triggered via window.showToast(msg)
function Toast() {
  const [msg, setMsg] = React.useState('');
  const [visible, setVisible] = React.useState(false);
  React.useEffect(() => {
    window.showToast = (text) => {
      setMsg(text); setVisible(true);
      setTimeout(() => setVisible(false), 2800);
    };
  }, []);
  return (
    <div id="toast" className={visible ? 'show' : ''} style={{ pointerEvents: 'none' }}>
      {msg}
    </div>
  );
}

function BottomNav() {
  const { user } = useAuth();
  const location = useLocation();
  if (!user) return null;

  const isWingmate = user.role === 'wingmate' || user.role === 'both';

  const items = isWingmate ? [
    { path: '/wingmate',  icon: '🦋', label: 'Dashboard' },
    { path: '/chat',      icon: '💬', label: 'Chat'      },
    { path: '/insights',  icon: '💡', label: 'Insights'  },
    { path: '/profile',   icon: '👤', label: 'Profile'   },
  ] : [
    { path: '/onboard',   icon: '🏠', label: 'Home'      },
    { path: '/chat',      icon: '💬', label: 'Chat'      },
    { path: '/insights',  icon: '💡', label: 'Insights'  },
    { path: '/profile',   icon: '👤', label: 'Profile'   },
  ];

  return (
    <div className="bottom-nav">
      {items.map(item => (
        <a key={item.path} href={item.path}
          className={`bnav-item ${location.pathname === item.path ? 'active' : ''}`}>
          <span className="bnav-icon">{item.icon}</span>
          {item.label}
        </a>
      ))}
    </div>
  );
}
