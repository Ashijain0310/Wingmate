// client/src/lib/api.js
const BASE = process.env.REACT_APP_API_URL || '/api';

class ApiError extends Error {
  constructor(message, status) { super(message); this.status = status; }
}

async function request(path, options = {}) {
  const token = localStorage.getItem('wm_token');
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error || 'Request failed', res.status);
  return data;
}

// ── Auth ──────────────────────────────────────────────────────────────────────
export const auth = {
  signup:  (payload)          => request('/auth/signup',  { method: 'POST', body: payload }),
  signin:  (email, password)  => request('/auth/signin',  { method: 'POST', body: { email, password } }),
  google:  (idToken, alias, role) => request('/auth/google', { method: 'POST', body: { idToken, alias, role } }),
  me:      ()                 => request('/auth/me'),
  signout: () => { localStorage.removeItem('wm_token'); localStorage.removeItem('wm_user'); },
};

// ── Sessions ──────────────────────────────────────────────────────────────────
export const sessions = {
  create:      (payload)    => request('/sessions',                 { method: 'POST', body: payload }),
  get:         (id)         => request(`/sessions/${id}`),
  getMessages: (id)         => request(`/sessions/${id}/messages`),
  sendMessage: (id, content)=> request(`/sessions/${id}/message`,  { method: 'POST', body: { content } }),
  end:         (id)         => request(`/sessions/${id}/end`,       { method: 'POST' }),
  list:        ()           => request('/sessions/list'),
};

// ── AI ────────────────────────────────────────────────────────────────────────
export const ai = {
  rephrase:      (text)               => request('/ai/rephrase',  { method: 'POST', body: { text } }),
  suggest:       (draft, sessionId)   => request('/ai/suggest',   { method: 'POST', body: { draft, sessionId } }),
  insight:       (sessionId)          => request('/ai/insight',   { method: 'POST', body: { sessionId } }),
  getInsights:   ()                   => request('/ai/insights'),
  deleteInsight: (id)                 => request(`/ai/insights/${id}`, { method: 'DELETE' }),
};

// ── Users ─────────────────────────────────────────────────────────────────────
export const users = {
  getProfile:     ()            => request('/users/profile'),
  updateMe:       (body)        => request('/users/me',       { method: 'PATCH', body }),
  updateWingmate: (body)        => request('/users/wingmate', { method: 'PATCH', body }),
  rate:           (sessionId, score) => request('/users/rate', { method: 'POST', body: { sessionId, score } }),
  deleteAccount:  ()            => request('/users/me',       { method: 'DELETE' }),
};

// ── Token helpers ──────────────────────────────────────────────────────────────
export function saveAuth(token, user) {
  localStorage.setItem('wm_token', token);
  localStorage.setItem('wm_user', JSON.stringify(user));
}
export function getStoredUser() {
  try { return JSON.parse(localStorage.getItem('wm_user')); } catch { return null; }
}
export function isLoggedIn() { return !!localStorage.getItem('wm_token'); }
export { ApiError };
