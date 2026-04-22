const BASE  = '/sessions';
const ABASE = '/auth';

const getToken = () => localStorage.getItem('token');

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${getToken()}`,
  };
}

async function apiFetch(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: { ...authHeaders(), ...(options.headers || {}) },
  });

  if (res.status === 401 || res.status === 403) {
    throw Object.assign(new Error('UNAUTHORIZED'), { status: res.status });
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `HTTP ${res.status}`);
  }

  if (res.status === 204) return null;
  return res.json();
}

// ── auth ──────────────────────────────────────────────────────────────────────

export async function apiLogin(username, password) {
  const form = new URLSearchParams({ username, password });
  const res = await fetch(`${ABASE}/sign-in`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form,
  });
  if (res.status === 401) throw new Error('Invalid username or password.');
  if (!res.ok)            throw new Error('Login failed.');
  return res.json();
}

export async function apiSignup(username, password) {
  const res = await fetch(`${ABASE}/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (res.status === 409) throw new Error('Username already taken.');
  if (!res.ok)            throw new Error('Signup failed.');
  return res.json();
}

export const apiMe = () => apiFetch(`${ABASE}/me`);

// ── sessions ──────────────────────────────────────────────────────────────────

export const apiGetSessions   = ()           => apiFetch(BASE);
export const apiCreateSession = (data)       => apiFetch(BASE, { method: 'POST', body: JSON.stringify(data) });
export const apiGetSession    = (id)         => apiFetch(`${BASE}/${id}`);
export const apiDeleteSession = (id)         => apiFetch(`${BASE}/${id}`, { method: 'DELETE' });

// ── exercises ─────────────────────────────────────────────────────────────────

export const apiAddExercise    = (sid, data)       => apiFetch(`${BASE}/${sid}/exercises`,      { method: 'POST', body: JSON.stringify(data) });
export const apiUpdateExercise = (sid, eid, data)  => apiFetch(`${BASE}/${sid}/exercises/${eid}`, { method: 'PUT',  body: JSON.stringify(data) });
export const apiDeleteExercise = (sid, eid)        => apiFetch(`${BASE}/${sid}/exercises/${eid}`, { method: 'DELETE' });

// ── progress ──────────────────────────────────────────────────────────────────

export const apiGetProgress = (name) => apiFetch(`${BASE}/progress/${encodeURIComponent(name)}`);

// ── admin ─────────────────────────────────────────────────────────────────────

export const apiGetUsers   = ()               => apiFetch(`${ABASE}/users`);
export const apiSetRole    = (username, role) => apiFetch(`${ABASE}/users/${username}/role?role=${role}`, { method: 'PUT' });
