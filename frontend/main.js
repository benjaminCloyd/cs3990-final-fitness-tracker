const BASE_URL = '/sessions';
const AUTH_URL = '/auth';

let sessions = [];
let selectedSessionId = null;
let activeExercise = null;
let progressChart = null;
let setCount = 0;

// ── auth state ────────────────────────────────────────────────────────────────

let authToken = localStorage.getItem('token') || null;
let currentUser = localStorage.getItem('username') || null;
let currentRole = localStorage.getItem('role') || null;

function saveAuth(token, username, role) {
  authToken = token;
  currentUser = username;
  currentRole = role;
  localStorage.setItem('token', token);
  localStorage.setItem('username', username);
  localStorage.setItem('role', role);
}

function clearAuth() {
  authToken = null;
  currentUser = null;
  currentRole = null;
  localStorage.removeItem('token');
  localStorage.removeItem('username');
  localStorage.removeItem('role');
}

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${authToken}`,
  };
}

function handleUnauthorized() {
  clearAuth();
  showAuthOverlay();
}

// ── auth overlay ──────────────────────────────────────────────────────────────

function showAuthOverlay() {
  document.getElementById('auth-overlay').style.display = 'flex';
}

function hideAuthOverlay() {
  document.getElementById('auth-overlay').style.display = 'none';
}

function switchAuthTab(tab) {
  const tabs = document.querySelectorAll('.auth-tab');
  tabs.forEach((t, i) => t.classList.toggle('active', (i === 0) === (tab === 'login')));
  document.getElementById('auth-login').style.display = tab === 'login' ? '' : 'none';
  document.getElementById('auth-signup').style.display = tab === 'signup' ? '' : 'none';
  document.getElementById('login-error').textContent = '';
  document.getElementById('signup-error').textContent = '';
}

async function handleLogin() {
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;
  const errEl = document.getElementById('login-error');
  errEl.textContent = '';

  if (!username || !password) { errEl.textContent = 'Enter username and password.'; return; }

  try {
    const form = new URLSearchParams();
    form.append('username', username);
    form.append('password', password);

    const res = await fetch(`${AUTH_URL}/sign-in`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form,
    });

    if (res.status === 401) { errEl.textContent = 'Invalid username or password.'; return; }
    if (!res.ok) { errEl.textContent = 'Login failed. Try again.'; return; }

    const data = await res.json();
    saveAuth(data.access_token, data.username, data.role);
    hideAuthOverlay();
    initApp();
  } catch (err) {
    errEl.textContent = 'Network error. Is the server running?';
  }
}

async function handleSignup() {
  const username = document.getElementById('signup-username').value.trim();
  const password = document.getElementById('signup-password').value;
  const errEl = document.getElementById('signup-error');
  errEl.textContent = '';

  if (!username || !password) { errEl.textContent = 'Enter username and password.'; return; }
  if (password.length < 6) { errEl.textContent = 'Password must be at least 6 characters.'; return; }

  try {
    const res = await fetch(`${AUTH_URL}/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    if (res.status === 409) { errEl.textContent = 'Username already taken.'; return; }
    if (!res.ok) { errEl.textContent = 'Signup failed. Try again.'; return; }

    // auto-login after signup
    document.getElementById('login-username').value = username;
    document.getElementById('login-password').value = password;
    switchAuthTab('login');
    await handleLogin();
  } catch (err) {
    errEl.textContent = 'Network error. Is the server running?';
  }
}

function handleLogout() {
  clearAuth();
  sessions = [];
  selectedSessionId = null;
  activeExercise = null;
  if (progressChart) { progressChart.destroy(); progressChart = null; }
  showAuthOverlay();
  document.getElementById('header-user').style.display = 'none';
  // Remove admin tab if present
  const adminTab = document.getElementById('tab-admin');
  if (adminTab) adminTab.remove();
}

// ── header user display ───────────────────────────────────────────────────────

function renderHeaderUser() {
  const wrap = document.getElementById('header-user');
  wrap.style.display = 'flex';
  document.getElementById('header-username').textContent = currentUser;
  const badge = document.getElementById('header-role-badge');
  badge.textContent = currentRole.toUpperCase();
  badge.className = 'role-badge role-' + currentRole;

  // Inject admin tab if needed and not already present
  if (currentRole === 'admin' && !document.getElementById('tab-admin')) {
    const nav = document.getElementById('nav-tabs');
    const btn = document.createElement('button');
    btn.className = 'nav-tab';
    btn.id = 'tab-admin';
    btn.textContent = 'Users';
    btn.onclick = function () { showPanel('admin', this); };
    nav.appendChild(btn);
  }
}

// ── api helpers ───────────────────────────────────────────────────────────────

async function apiFetch(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: { ...authHeaders(), ...(options.headers || {}) },
  });
  if (res.status === 401 || res.status === 403) {
    handleUnauthorized();
    throw new Error('Unauthorized');
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res;
}

const getSessions = async () => (await apiFetch(BASE_URL)).json();

const createSession = async (session) =>
  (await apiFetch(BASE_URL, { method: 'POST', body: JSON.stringify(session) })).json();

const deleteSession = async (id) => {
  await apiFetch(`${BASE_URL}/${id}`, { method: 'DELETE' });
  return true;
};

const getSession = async (id) => (await apiFetch(`${BASE_URL}/${id}`)).json();

const createExercise = async (sessionId, exercise) =>
  (await apiFetch(`${BASE_URL}/${sessionId}/exercises`, { method: 'POST', body: JSON.stringify(exercise) })).json();

const updateExercise = async (sessionId, exId, exercise) =>
  (await apiFetch(`${BASE_URL}/${sessionId}/exercises/${exId}`, { method: 'PUT', body: JSON.stringify(exercise) })).json();

const deleteExercise = async (sessionId, exId) => {
  await apiFetch(`${BASE_URL}/${sessionId}/exercises/${exId}`, { method: 'DELETE' });
  return true;
};

const getProgress = async (exerciseName) =>
  (await apiFetch(`${BASE_URL}/progress/${encodeURIComponent(exerciseName)}`)).json();

const getUsers = async () => (await apiFetch(`${AUTH_URL}/users`)).json();

const setUserRole = async (username, role) =>
  (await apiFetch(`${AUTH_URL}/users/${username}/role?role=${role}`, { method: 'PUT' })).json();

// ── helpers ───────────────────────────────────────────────────────────────────

function toast(msg, type = 'ok') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'show' + (type === 'error' ? ' error' : '');
  clearTimeout(window._tt);
  window._tt = setTimeout(() => { el.className = ''; }, 3000);
}

function showPanel(name, btn) {
  ['sessions', 'progress', 'admin'].forEach(p => {
    const panel = document.getElementById('panel-' + p);
    if (panel) panel.classList.remove('active');
  });
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));

  const target = document.getElementById('panel-' + name);
  if (target) target.classList.add('active');
  if (btn) btn.classList.add('active');

  if (name === 'progress') loadProgressPanel();
  if (name === 'admin') loadAdminPanel();
}

function formatDate(date) {
  if (!date) return '';
  const [m, d, y] = date.split('/');
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  return `${months[+m - 1]} ${d}, ${y}`;
}

function epley(weight, reps) {
  return reps === 1 ? weight : weight * (1 + reps / 30);
}

function getSets(containerId) {
  const sets = [];
  const rows = document.getElementById(containerId).getElementsByClassName('set-row');
  for (let i = 0; i < rows.length; i++) {
    const w = parseFloat(rows[i].getElementsByClassName('w-input')[0].value);
    const r = parseInt(rows[i].getElementsByClassName('r-input')[0].value);
    if (w > 0 && r > 0) sets.push({ weight: w, reps: r });
  }
  return sets;
}

function addSetRow(containerId, weight = '', reps = '') {
  setCount++;
  const row = document.createElement('div');
  row.className = 'set-row';
  row.innerHTML = `
    <div class="set-label">S${setCount}</div>
    <input class="w-input" type="number" placeholder="LBS" min="0" step="2.5" value="${weight}">
    <input class="r-input" type="number" placeholder="REPS" min="1" max="100" value="${reps}">
    <button class="btn-remove-set" onclick="this.closest('.set-row').remove()">✕</button>
  `;
  document.getElementById(containerId).appendChild(row);
}

function resetNewSets() {
  setCount = 0;
  const c = document.getElementById('sets-container');
  if (!c) return;
  c.innerHTML = '';
  addSetRow('sets-container');
  addSetRow('sets-container');
  addSetRow('sets-container');
}

// ── sessions ──────────────────────────────────────────────────────────────────

const refreshSessions = () => {
  const el = document.getElementById('session-list');
  if (!sessions.length) {
    el.innerHTML = `<div class="empty-state"><p>No sessions yet.<br>Create your first workout.</p></div>`;
    return;
  }
  el.innerHTML = '';
  sessions.forEach(s => {
    const ownerBadge = currentRole === 'admin' && s.owner
      ? `<div class="s-owner">@${s.owner}</div>` : '';
    el.innerHTML += `
      <div id="session-${s.id}" class="session-item ${s.id === selectedSessionId ? 'selected' : ''}"
           onclick="selectSession('${s.id}')">
        <div style="flex:1;min-width:0">
          <div class="s-date">${formatDate(s.date)}</div>
          <div class="s-name">${s.name}</div>
          ${ownerBadge}
          <div class="s-meta">${s.exercises.length} exercise${s.exercises.length !== 1 ? 's' : ''}</div>
        </div>
        <button class="btn-danger del-btn"
                onclick="event.stopPropagation(); removeSession('${s.id}')">DEL</button>
      </div>
    `;
  });
};

document.getElementById('create-session-btn').addEventListener('click', async () => {
  const nameInput = document.getElementById('new-session-name');
  const dateInput = document.getElementById('new-session-date');
  const msgDiv = document.getElementById('session-msg');

  if (!nameInput.value || !dateInput.value) {
    msgDiv.innerHTML = 'Please enter a name and date.';
    return;
  }

  try {
    const s = await createSession({ name: nameInput.value.trim(), date: dateInput.value });
    sessions.unshift(s);
    refreshSessions();
    msgDiv.innerHTML = '';
    nameInput.value = '';
    toast(`Session "${s.name}" created.`);
    selectSession(s.id);
  } catch (err) {
    if (err.message !== 'Unauthorized') toast('Failed to create session.', 'error');
  }
});

const removeSession = async (id) => {
  if (!confirm('Delete this session and all its exercises?')) return;
  try {
    await deleteSession(id);
    sessions = sessions.filter(s => s.id !== id);
    toast('Session deleted.');
    if (selectedSessionId === id) {
      selectedSessionId = null;
      document.getElementById('detail-placeholder').style.display = '';
      document.getElementById('detail-content').style.display = 'none';
    }
    refreshSessions();
  } catch (err) {
    if (err.message !== 'Unauthorized') toast('Failed to delete session.', 'error');
  }
};

const selectSession = async (id) => {
  selectedSessionId = id;
  try {
    const session = await getSession(id);
    const idx = sessions.findIndex(s => s.id === id);
    if (idx !== -1) sessions[idx] = session;
    refreshSessions();
    renderSessionDetail(session);
  } catch (err) {
    if (err.message !== 'Unauthorized') toast('Could not load session.', 'error');
  }
};

// ── session detail ────────────────────────────────────────────────────────────

const renderSessionDetail = (session) => {
  document.getElementById('detail-placeholder').style.display = 'none';
  const content = document.getElementById('detail-content');
  content.style.display = '';

  const exercisesHtml = session.exercises.length
    ? session.exercises.map(ex => buildExerciseCard(session.id, ex)).join('')
    : `<div class="empty-state"><p>No exercises logged yet.</p></div>`;

  const ownerLine = currentRole === 'admin' && session.owner
    ? `<div class="session-owner-badge">@${session.owner}</div>` : '';

  content.innerHTML = `
    <div class="detail-header">
      <div>
        <div class="session-title">${session.name}</div>
        <div class="session-date-badge">${formatDate(session.date)}</div>
        ${ownerLine}
      </div>
      <div style="flex:1"></div>
      <button class="btn-danger" onclick="removeSession('${session.id}')">DELETE SESSION</button>
    </div>
    <div class="exercises-section">
      <h3>EXERCISES — ${session.exercises.length}</h3>
      ${exercisesHtml}
    </div>
    <div class="add-exercise-section">
      <h3>LOG EXERCISE</h3>
      <div class="form-row">
        <label>Exercise Name</label>
        <input type="text" id="ex-name" placeholder="Bench Press, Squat…">
      </div>
      <div class="sets-builder">
        <div class="sets-builder-header">
          <span>SETS</span>
          <button class="btn-ghost" onclick="addSetRow('sets-container')">+ ADD SET</button>
        </div>
        <div id="sets-container"></div>
      </div>
      <div class="add-exercise-actions">
        <button class="btn btn-primary" onclick="addExercise('${session.id}')">LOG EXERCISE</button>
        <button class="btn-ghost" onclick="resetNewSets()">RESET</button>
      </div>
    </div>
  `;
  resetNewSets();
};

const buildExerciseCard = (sessionId, ex) => {
  const tableRows = ex.sets.map((s, j) => `
    <tr>
      <td class="set-num">${j + 1}</td>
      <td>${s.weight}</td>
      <td>${s.reps}</td>
      <td class="set-1rm">${epley(s.weight, s.reps).toFixed(1)}</td>
    </tr>
  `).join('');

  return `
    <div class="exercise-card" id="card-${ex.id}">
      <div class="exercise-card-header">
        <div class="ex-name">${ex.name}</div>
        <div class="badge-1rm">1RM ~${ex.best_1rm} LBS</div>
        <button class="btn-edit" onclick="toggleEdit(${ex.id})">EDIT</button>
        <button class="btn-danger" onclick="removeExercise('${sessionId}', ${ex.id})">REMOVE</button>
      </div>
      <table class="sets-table">
        <thead><tr><th>SET</th><th>WEIGHT (LBS)</th><th>REPS</th><th>EST. 1RM</th></tr></thead>
        <tbody>${tableRows}</tbody>
      </table>
      <div class="edit-form" id="edit-form-${ex.id}">
        <div class="edit-title">✏ EDIT SETS FOR ${ex.name.toUpperCase()}</div>
        <div id="edit-rows-${ex.id}"></div>
        <button class="btn-ghost" style="margin-bottom:12px"
        onclick="addSetRow('edit-rows-${ex.id}')">+ ADD SET</button>
        <div class="edit-actions">
          <button class="btn-save"
                  onclick="saveExercise('${sessionId}', ${ex.id}, '${ex.name}')">SAVE CHANGES</button>
          <button class="btn-ghost" onclick="toggleEdit(${ex.id})">CANCEL</button>
        </div>
      </div>
    </div>
  `;
};

// ── exercises ─────────────────────────────────────────────────────────────────

const addExercise = async (sessionId) => {
  const nameInput = document.getElementById('ex-name');
  if (!nameInput.value) { toast('Enter an exercise name.', 'error'); return; }
  const sets = getSets('sets-container');
  if (!sets.length) { toast('Add at least one valid set.', 'error'); return; }

  try {
    const ex = await createExercise(sessionId, { name: nameInput.value.trim(), sets });
    toast(`${ex.name} logged — est. 1RM: ${ex.best_1rm} lbs`);
    selectSession(sessionId);
  } catch (err) {
    if (err.message !== 'Unauthorized') toast('Failed to log exercise.', 'error');
  }
};

const saveExercise = async (sessionId, exId, exName) => {
  const sets = getSets('edit-rows-' + exId);
  if (!sets.length) { toast('At least one valid set required.', 'error'); return; }

  try {
    const ex = await updateExercise(sessionId, exId, { name: exName, sets });
    toast(`${ex.name} updated — new 1RM: ${ex.best_1rm} lbs`);
    selectSession(sessionId);
  } catch (err) {
    if (err.message !== 'Unauthorized') toast('Failed to update exercise.', 'error');
  }
};

const removeExercise = async (sessionId, exId) => {
  if (!confirm('Delete this exercise?')) return;
  try {
    await deleteExercise(sessionId, exId);
    toast('Exercise removed.');
    selectSession(sessionId);
  } catch (err) {
    if (err.message !== 'Unauthorized') toast('Failed to remove exercise.', 'error');
  }
};

const toggleEdit = (exId) => {
  const form = document.getElementById('edit-form-' + exId);
  form.classList.toggle('open');
  if (form.classList.contains('open')) {
    const editContainer = document.getElementById('edit-rows-' + exId);
    editContainer.innerHTML = '';
    const card = document.getElementById('card-' + exId);
    const rows = card.getElementsByTagName('tbody')[0].getElementsByTagName('tr');
    for (let i = 0; i < rows.length; i++) {
      const cells = rows[i].getElementsByTagName('td');
      addSetRow('edit-rows-' + exId, cells[1].textContent, cells[2].textContent);
    }
  }
};

// ── progress ──────────────────────────────────────────────────────────────────

const loadProgressPanel = () => {
  const allNames = [];
  sessions.forEach(s => s.exercises.forEach(ex => {
    if (!allNames.includes(ex.name)) allNames.push(ex.name);
  }));
  allNames.sort();

  const pills = document.getElementById('exercise-pills');
  if (!allNames.length) {
    pills.innerHTML = '<span class="muted-text">Log exercises in sessions first.</span>';
    document.getElementById('stat-row').style.display = 'none';
    document.getElementById('chart-placeholder').style.display = 'flex';
    document.getElementById('chart-content').style.display = 'none';
    return;
  }

  pills.innerHTML = '';
  allNames.forEach(n => {
    pills.innerHTML += `
      <button class="ex-pill ${n === activeExercise ? 'active' : ''}"
              id="pill-${n}"
              onclick="loadChart('${n}', this)">${n}</button>
    `;
  });

  if (activeExercise && allNames.includes(activeExercise)) {
    loadChart(activeExercise, document.getElementById('pill-' + activeExercise));
  }
};

const loadChart = async (exerciseName, btn) => {
  activeExercise = exerciseName;
  document.querySelectorAll('.ex-pill').forEach(p => p.classList.remove('active'));
  if (btn) btn.classList.add('active');

  try {
    const history = await getProgress(exerciseName);
    renderChart(exerciseName, history);
  } catch (err) {
    if (err.message !== 'Unauthorized') toast('Failed to load progress data.', 'error');
  }
};

const renderChart = (exerciseName, history) => {
  const placeholder = document.getElementById('chart-placeholder');
  const chartContent = document.getElementById('chart-content');
  const statRow = document.getElementById('stat-row');

  if (!history.length) {
    placeholder.style.display = 'flex';
    chartContent.style.display = 'none';
    statRow.style.display = 'none';
    return;
  }

  placeholder.style.display = 'none';
  chartContent.style.display = '';
  statRow.style.display = 'flex';

  const vals = history.map(h => h.best_1rm);
  const latest = vals[vals.length - 1];
  const delta = latest - vals[0];
  const peak = Math.max(...vals);

  document.getElementById('chart-title').textContent = exerciseName.toUpperCase();
  statRow.innerHTML = `
    <div class="stat-box">
      <div class="stat-val">${latest.toFixed(1)}</div>
      <div class="stat-label">LATEST 1RM (LBS)</div>
    </div>
    <div class="stat-box">
      <div class="stat-val" style="color:${delta >= 0 ? 'var(--green)' : 'var(--danger)'}">
        ${delta >= 0 ? '+' : ''}${delta.toFixed(1)}
      </div>
      <div class="stat-label">TOTAL CHANGE</div>
    </div>
    <div class="stat-box">
      <div class="stat-val">${peak.toFixed(1)}</div>
      <div class="stat-label">PEAK 1RM</div>
    </div>
    <div class="stat-box">
      <div class="stat-val">${history.length}</div>
      <div class="stat-label">DATA POINTS</div>
    </div>
  `;

  if (progressChart) { progressChart.destroy(); progressChart = null; }

  progressChart = new Chart(document.getElementById('progress-chart'), {
    type: 'line',
    data: {
      labels: history.map(h => formatDate(h.date)),
      datasets: [{
        data: vals,
        borderColor: '#f5c518',
        backgroundColor: 'rgba(245,197,24,0.08)',
        borderWidth: 3,
        pointBackgroundColor: '#f5c518',
        pointBorderColor: '#0a0a0a',
        pointBorderWidth: 2,
        pointRadius: 7,
        tension: 0.3,
        fill: true,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#1a1a1a',
          borderColor: '#f5c518',
          borderWidth: 1,
          titleColor: '#f5c518',
          bodyColor: '#e8e8e8',
          titleFont: { family: 'Bebas Neue', size: 17 },
          bodyFont: { family: 'JetBrains Mono', size: 12 },
          padding: 12,
          callbacks: { label: c => ` est. 1RM: ${c.parsed.y.toFixed(1)} lbs` }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: { color: '#888', font: { family: 'JetBrains Mono', size: 12 } }
        },
        y: {
          grid: { color: 'rgba(255,255,255,0.05)' },
          ticks: { color: '#888', font: { family: 'JetBrains Mono', size: 12 }, callback: v => v + ' lbs' }
        }
      }
    }
  });
};

// ── admin panel ───────────────────────────────────────────────────────────────

const loadAdminPanel = async () => {
  const wrap = document.getElementById('user-table-wrap');
  wrap.innerHTML = '<p class="muted-text" style="font-family:\'JetBrains Mono\',monospace;font-size:0.8rem">Loading users…</p>';

  try {
    const users = await getUsers();
    if (!users.length) { wrap.innerHTML = '<p class="muted-text">No users found.</p>'; return; }

    wrap.innerHTML = `
      <table class="admin-table">
        <thead>
          <tr><th>USERNAME</th><th>ROLE</th><th>ACTION</th></tr>
        </thead>
        <tbody>
          ${users.map(u => `
            <tr>
              <td class="admin-username">${u.username}</td>
              <td>
                <span class="role-badge role-${u.role}">${u.role.toUpperCase()}</span>
              </td>
              <td>
                ${u.username === currentUser ? '<span class="muted-text" style="font-size:0.7rem;font-family:\'JetBrains Mono\',monospace">YOU</span>' : `
                  <button class="btn-ghost" style="font-size:0.75rem;padding:5px 12px"
                    onclick="toggleRole('${u.username}', '${u.role}')">
                    ${u.role === 'admin' ? 'DEMOTE' : 'PROMOTE'}
                  </button>
                `}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  } catch (err) {
    if (err.message !== 'Unauthorized') wrap.innerHTML = '<p class="muted-text">Failed to load users.</p>';
  }
};

const toggleRole = async (username, currentUserRole) => {
  const newRole = currentUserRole === 'admin' ? 'user' : 'admin';
  const verb = newRole === 'admin' ? 'promote' : 'demote';
  if (!confirm(`${verb.toUpperCase()} @${username} to '${newRole}'?`)) return;

  try {
    const res = await setUserRole(username, newRole);
    toast(res.message);
    loadAdminPanel();
  } catch (err) {
    if (err.message !== 'Unauthorized') toast('Failed to update role.', 'error');
  }
};

// ── init ──────────────────────────────────────────────────────────────────────

async function initApp() {
  renderHeaderUser();
  try {
    sessions = await getSessions();
    refreshSessions();
  } catch (err) {
    if (err.message !== 'Unauthorized') toast('Failed to load sessions.', 'error');
  }
}

// On page load: if token exists try to use it, else show login
(async () => {
  if (authToken) {
    try {
      // Verify the token is still valid
      const res = await fetch(`${AUTH_URL}/me`, { headers: authHeaders() });
      if (!res.ok) { handleUnauthorized(); return; }
      const me = await res.json();
      // Refresh role in case it changed since last login
      saveAuth(authToken, me.username, me.role);
      hideAuthOverlay();
      initApp();
    } catch {
      handleUnauthorized();
    }
  } else {
    showAuthOverlay();
  }
})();
