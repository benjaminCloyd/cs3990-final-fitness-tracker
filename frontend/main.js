const BASE_URL = '/sessions';

let sessions = [];
let selectedSessionId = null;
let activeExercise = null;
let progressChart = null;
let setCount = 0;

// api stuff

const getSessions = async () => {
  try {
    const res = await fetch(BASE_URL, { method: 'GET', headers: { 'Content-Type': 'application/json' } });
    if (!res.ok) throw new Error(`HTTP error! Status: ${res.status}`);
    return await res.json();
  } catch (err) { console.error('Error fetching sessions:', err); throw err; }
};

const createSession = async (session) => {
  try {
    const res = await fetch(BASE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(session),
    });
    if (!res.ok) throw new Error(`HTTP error! Status: ${res.status}`);
    return await res.json();
  } catch (err) { console.error('Error creating session:', err); throw err; }
};

const deleteSession = async (id) => {
  try {
    const res = await fetch(`${BASE_URL}/${id}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' } });
    if (!res.ok) throw new Error(`HTTP error! Status: ${res.status}`);
    return true;
  } catch (err) { console.error('Error deleting session:', err); throw err; }
};

const getSession = async (id) => {
  try {
    const res = await fetch(`${BASE_URL}/${id}`, { method: 'GET', headers: { 'Content-Type': 'application/json' } });
    if (!res.ok) throw new Error(`HTTP error! Status: ${res.status}`);
    return await res.json();
  } catch (err) { console.error('Error fetching session:', err); throw err; }
};

const createExercise = async (sessionId, exercise) => {
  try {
    const res = await fetch(`${BASE_URL}/${sessionId}/exercises`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(exercise),
    });
    if (!res.ok) throw new Error(`HTTP error! Status: ${res.status}`);
    return await res.json();
  } catch (err) { console.error('Error creating exercise:', err); throw err; }
};

const updateExercise = async (sessionId, exId, exercise) => {
  try {
    const res = await fetch(`${BASE_URL}/${sessionId}/exercises/${exId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(exercise),
    });
    if (!res.ok) throw new Error(`HTTP error! Status: ${res.status}`);
    return await res.json();
  } catch (err) { console.error('Error updating exercise:', err); throw err; }
};

const deleteExercise = async (sessionId, exId) => {
  try {
    const res = await fetch(`${BASE_URL}/${sessionId}/exercises/${exId}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' } });
    if (!res.ok) throw new Error(`HTTP error! Status: ${res.status}`);
    return true;
  } catch (err) { console.error('Error deleting exercise:', err); throw err; }
};

const getProgress = async (exerciseName) => {
  try {
    const res = await fetch(`${BASE_URL}/progress/${encodeURIComponent(exerciseName)}`, { method: 'GET', headers: { 'Content-Type': 'application/json' } });
    if (!res.ok) throw new Error(`HTTP error! Status: ${res.status}`);
    return await res.json();
  } catch (err) { console.error('Error fetching progress:', err); throw err; }
};

// helpers

function toast(msg, type = 'ok') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'show' + (type === 'error' ? ' error' : '');
  clearTimeout(window._tt);
  window._tt = setTimeout(() => { el.className = ''; }, 3000);
}

function showPanel(name, btn) {
  document.getElementById('panel-sessions').classList.remove('active');
  document.getElementById('panel-progress').classList.remove('active');
  document.getElementById('tab-sessions').classList.remove('active');
  document.getElementById('tab-progress').classList.remove('active');
  document.getElementById('panel-' + name).classList.add('active');
  btn.classList.add('active');
  if (name === 'progress') loadProgressPanel();
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

// sessions

const refreshSessions = () => {
  const el = document.getElementById('session-list');
  if (!sessions.length) {
    el.innerHTML = `<div class="empty-state"><p>No sessions yet.<br>Create your first workout.</p></div>`;
    return;
  }
  el.innerHTML = '';
  sessions.map(s => {
    el.innerHTML += `
      <div id="session-${s.id}" class="session-item ${s.id === selectedSessionId ? 'selected' : ''}"
           onclick="selectSession(${s.id})">
        <div style="flex:1;min-width:0">
          <div class="s-date">${formatDate(s.date)}</div>
          <div class="s-name">${s.name}</div>
          <div class="s-meta">${s.exercises.length} exercise${s.exercises.length !== 1 ? 's' : ''}</div>
        </div>
        <button class="btn-danger del-btn"
                onclick="event.stopPropagation(); removeSession(${s.id})">DEL</button>
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

  await createSession({ name: nameInput.value.trim(), date: dateInput.value }).then(s => {
    sessions.unshift(s);
    refreshSessions();
    msgDiv.innerHTML = '';
    nameInput.value = '';
    toast(`Session "${s.name}" created.`);
    selectSession(s.id);
  });
});

const removeSession = async (id) => {
  if (!confirm('Delete this session and all its exercises?')) return;
  await deleteSession(id).then(() => {
    sessions = sessions.filter(s => s.id !== id);
    toast('Session deleted.');
    if (selectedSessionId === id) {
      selectedSessionId = null;
      document.getElementById('detail-placeholder').style.display = '';
      document.getElementById('detail-content').style.display = 'none';
    }
    refreshSessions();
  });
};

const selectSession = async (id) => {
  selectedSessionId = id;
  await getSession(id).then(session => {
    const idx = sessions.findIndex(s => s.id === id);
    if (idx !== -1) sessions[idx] = session;
    refreshSessions();
    renderSessionDetail(session);
  });
};

// session detail

const renderSessionDetail = (session) => {
  document.getElementById('detail-placeholder').style.display = 'none';
  const content = document.getElementById('detail-content');
  content.style.display = '';

  const exercisesHtml = session.exercises.length
    ? session.exercises.map(ex => buildExerciseCard(session.id, ex)).join('')
    : `<div class="empty-state"><p>No exercises logged yet.</p></div>`;

  content.innerHTML = `
    <div class="detail-header">
      <div>
        <div class="session-title">${session.name}</div>
        <div class="session-date-badge">${formatDate(session.date)}</div>
      </div>
      <div style="flex:1"></div>
      <button class="btn-danger" onclick="removeSession(${session.id})">DELETE SESSION</button>
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
        <button class="btn btn-primary" onclick="addExercise(${session.id})">LOG EXERCISE</button>
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
        <button class="btn-danger" onclick="removeExercise(${sessionId}, ${ex.id})">REMOVE</button>
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
                  onclick="saveExercise(${sessionId}, ${ex.id}, '${ex.name}')">SAVE CHANGES</button>
          <button class="btn-ghost" onclick="toggleEdit(${ex.id})">CANCEL</button>
        </div>
      </div>
    </div>
  `;
};

// exercises

const addExercise = async (sessionId) => {
  const nameInput = document.getElementById('ex-name');
  const msgDiv = document.getElementById('ex-msg');

  if (!nameInput.value) { toast('Enter an exercise name.', 'error'); return; }
  const sets = getSets('sets-container');
  if (!sets.length) { toast('Add at least one valid set.', 'error'); return; }

  await createExercise(sessionId, { name: nameInput.value.trim(), sets }).then(ex => {
    toast(`${ex.name} logged — est. 1RM: ${ex.best_1rm} lbs`);
    selectSession(sessionId);
  });
};

const saveExercise = async (sessionId, exId, exName) => {
  const sets = getSets('edit-rows-' + exId);
  if (!sets.length) { toast('At least one valid set required.', 'error'); return; }

  await updateExercise(sessionId, exId, { name: exName, sets }).then(ex => {
    toast(`${ex.name} updated — new 1RM: ${ex.best_1rm} lbs`);
    selectSession(sessionId);
  });
};

const removeExercise = async (sessionId, exId) => {
  if (!confirm('Delete this exercise?')) return;
  await deleteExercise(sessionId, exId).then(() => {
    toast('Exercise removed.');
    selectSession(sessionId);
  });
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

// progress

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
  allNames.map(n => {
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
  const pills = document.getElementById('exercise-pills').getElementsByClassName('ex-pill');
  for (let i = 0; i < pills.length; i++) {
    pills[i].classList.remove('active');
  }
  if (btn) btn.classList.add('active');

  await getProgress(exerciseName).then(history => renderChart(exerciseName, history));
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

// init

(async () => {
  await getSessions().then(data => {
    sessions = data;
    refreshSessions();
  });
})();