const BASE  = '/sessions';
const ABASE = '/auth';
const RBASE = '/recipes';

const getToken = () => localStorage.getItem('token');

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${getToken()}`,
  };
}

async function apiFetchFile(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: { ...authHeaders(), ...(options.headers || {}) },
  });

  if (res.status === 401 || res.status === 403) {
    throw Object.assign(new Error('UNAUTHORIZED'), { status: res.status });
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.blob(); // Return the response as a Blob for file downloads
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
    let errorMessage = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      errorMessage = body.detail || body.message || errorMessage;
    } catch (e) {
      // If response isn't JSON, try to get text
      try {
        const text = await res.text();
        errorMessage = text || errorMessage;
      } catch (e2) {
        // Keep default error message
      }
    }
    throw new Error(errorMessage);
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
export const apiUpdateProfile = (data) => apiFetch(`${ABASE}/update`, { method: 'PUT', body: JSON.stringify(data) });

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

// ── nutrition & recipes ───────────────────────────────────────────────────────

export const apiGetRecipes = ()                   => apiFetch(RBASE);
export const apiCreateRecipe = (data)             => apiFetch(RBASE, { method: 'POST', body: JSON.stringify(data) });
export const apiUpdateRecipe = (id, data)         => apiFetch(`${RBASE}/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const apiGetRecipe = (id)                  => apiFetch(`${RBASE}/${id}`);
export const apiDeleteRecipe = (id)               => apiFetch(`${RBASE}/${id}`, { method: 'DELETE' });
export const apiUploadRecipeImage = async (file) => {
  console.log('Uploading file:', file.name, file.size, file.type);
  const formData = new FormData();
  formData.append('file', file);
  console.log('FormData created with file');

  const token = getToken();
  const res = await fetch(`${RBASE}/upload-image`, {
    method: 'POST',
    body: formData,
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (res.status === 401 || res.status === 403) {
    throw Object.assign(new Error('UNAUTHORIZED'), { status: res.status });
  }

  if (!res.ok) {
    let errorMessage = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      errorMessage = body.detail || body.message || errorMessage;
    } catch (e) {
      try {
        const text = await res.text();
        errorMessage = text || errorMessage;
      } catch (e2) {
        // Keep default error message
      }
    }
    throw new Error(errorMessage);
  }

  return res.json();
};

// USDA Search
export const apiSearchUSDA = (query) => apiFetch(`${RBASE}/search-nutrients?query=${encodeURIComponent(query)}`);

// Grocery Lists
export const apiGenerateGroceryList = (planId) => apiFetch(`${RBASE}/meal-plans/${planId}/generate-grocery-list`, { method: 'POST' });
export const apiGetLatestGrocery = () => apiFetch(`${RBASE}/grocery-lists/latest`);
export const apiDownloadGroceryList = (listId) => apiFetchFile(`${RBASE}/grocery-lists/download/${listId}`);
export const apiToggleGroceryItem = (listId, idx) => apiFetch(`${RBASE}/grocery-lists/${listId}/toggle/${idx}`, { method: 'PUT' });

// ── meal plans ───────────────────────────────────────────────────────────────

export const apiGetMealPlans = () => apiFetch(`${RBASE}/meal-plans/all`);
export const apiCreateMealPlan = (data) => apiFetch(`${RBASE}/meal-plans`, { method: 'POST', body: JSON.stringify(data) });
export const apiUpdateMealPlan = (id, data) => apiFetch(`${RBASE}/meal-plans/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const apiDeleteMealPlan = (id) => apiFetch(`${RBASE}/meal-plans/${id}`, { method: 'DELETE' });
export const apiGetMealPlanMacros = (planId) => apiFetch(`${RBASE}/meal-plans/macros/${planId}`);