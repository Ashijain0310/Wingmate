// client/src/context/AuthContext.jsx
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { auth, saveAuth, getStoredUser, isLoggedIn } from '../lib/api';
import { getPusherClient, disconnectPusher, subscribeToUser } from '../lib/pusher';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  // Connect Pusher and subscribe to private user channel
  function connectRealtime(userId) {
    try {
      getPusherClient(); // initialise
      subscribeToUser(userId);
    } catch (e) {
      console.warn('[pusher] could not connect:', e.message);
    }
  }

  // Restore session on app load
  useEffect(() => {
    async function restore() {
      if (!isLoggedIn()) { setLoading(false); return; }
      const stored = getStoredUser();
      if (stored) { setUser(stored); connectRealtime(stored.id); }
      try {
        const { user: fresh } = await auth.me();
        setUser(fresh);
        connectRealtime(fresh.id);
      } catch {
        localStorage.removeItem('wm_token');
        localStorage.removeItem('wm_user');
        setUser(null);
      } finally {
        setLoading(false);
      }
    }
    restore();
  }, []);

  const signup = useCallback(async (payload) => {
    setError(null);
    const { token, user: u } = await auth.signup(payload);
    saveAuth(token, u);
    setUser(u);
    connectRealtime(u.id);
    return u;
  }, []);

  const signin = useCallback(async (email, password) => {
    setError(null);
    const { token, user: u } = await auth.signin(email, password);
    saveAuth(token, u);
    setUser(u);
    connectRealtime(u.id);
    return u;
  }, []);

  const googleLogin = useCallback(async (idToken, alias, role) => {
    setError(null);
    const { token, user: u } = await auth.google(idToken, alias, role);
    saveAuth(token, u);
    setUser(u);
    connectRealtime(u.id);
    return u;
  }, []);

  const signout = useCallback(() => {
    auth.signout();
    disconnectPusher();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, error, setError, signup, signin, googleLogin, signout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
