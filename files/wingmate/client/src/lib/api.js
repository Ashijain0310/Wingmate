// client/src/lib/api.js
// All HTTP calls to the Wingmate backend

const BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:4000/api';

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function request(path, options = {}) {
  const token = localStorage.getItem('wm_token');
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new ApiError(data.error || 'Request failed', res.status);
  }

  return data;
}

// ─── AUTH ─────────────────────────────────────────────────────────────────────
export const auth = {
  signup: (payload) => request('/auth/signup', { method: 'POST', body: payload }),
  signin: (email, password) => request('/auth/signin', { method: 'POST', body: { email, password } }),
  google: (idToken, alias, role) => request('/auth/google', { method: 'POST', body: { idToken, alias, role } }),
  me: () => request('/auth/me'),
  signout: () => {
    request('/auth/signout', { method: 'POST' }).catch(() => {});
    localStorage.removeItem('wm_token');
    localStorage.removeItem('wm_user');
  },
};

// ─── SESSIONS ─────────────────────────────────────────────────────────────────
export const sessions = {
  create: (payload) => request('/sessions', { method: 'POST', body: payload }),
  get: (id) => request(`/sessions/${id}`),
  getMessages: (id) => request(`/sessions/${id}/messages`),
  end: (id) => request(`/sessions/${id}/end`, { method: 'POST' }),
  list: () => request('/sessions'),
};

// ─── AI ───────────────────────────────────────────────────────────────────────
export const ai = {
  rephrase: (text) => request('/ai/rephrase', { method: 'POST', body: { text } }),
  suggest: (draft, sessionId) => request('/ai/suggest', { method: 'POST', body: { draft, sessionId } }),
  insight: (sessionId) => request('/ai/insight', { method: 'POST', body: { sessionId } }),
  getInsights: () => request('/ai/insights'),
  deleteInsight: (id) => request(`/ai/insights/${id}`, { method: 'DELETE' }),
};

// ─── CALLS ────────────────────────────────────────────────────────────────────
export const calls = {
  getToken: (sessionId) => request('/calls/token', { method: 'POST', body: { sessionId } }),
  start: (sessionId) => request('/calls/start', { method: 'POST', body: { sessionId } }),
  end: (sessionId) => request('/calls/end', { method: 'POST', body: { sessionId } }),
};

// ─── USERS ────────────────────────────────────────────────────────────────────
export const users = {
  getProfile:      ()            => request('/users/me/profile'),
  updateMe:        (body)        => request('/users/me', { method: 'PATCH', body }),
  updateWingmate:  (body)        => request('/users/me/wingmate', { method: 'PATCH', body }),
  rate:            (sessionId, score) => request('/users/rate', { method: 'POST', body: { sessionId, score } }),
  deleteAccount:   ()            => request('/users/me', { method: 'DELETE' }),
};

// Token helpers
export function saveAuth(token, user) {
  localStorage.setItem('wm_token', token);
  localStorage.setItem('wm_user', JSON.stringify(user));
}

export function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem('wm_user'));
  } catch { return null; }
}

export function isLoggedIn() {
  return !!localStorage.getItem('wm_token');
}

export { ApiError };
