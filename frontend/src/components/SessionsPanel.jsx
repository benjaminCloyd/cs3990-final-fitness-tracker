import { useState } from 'react';
import { useAuth }  from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { apiCreateSession, apiDeleteSession, apiGetSession } from '../api.js';
import SessionDetail from './SessionDetail.jsx';

function formatDate(date) {
  if (!date) return '';
  const [m, d, y] = date.split('/');
  const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  return `${months[+m - 1]} ${d}, ${y}`;
}

export default function SessionsPanel({ sessions, setSessions, onReload }) {
  const { user, logout } = useAuth();
  const { showToast }    = useToast();

  const [name, setName]           = useState('');
  const [date, setDate]           = useState('');
  const [formErr, setFormErr]     = useState('');
  const [selected, setSelected]   = useState(null);  // full session object
  const [loadingId, setLoadingId] = useState(null);

  async function handleCreate() {
    if (!name.trim() || !date.trim()) { setFormErr('Enter a name and date.'); return; }
    setFormErr('');
    try {
      const s = await apiCreateSession({ name: name.trim(), date });
      setSessions((prev) => [s, ...prev]);
      setName('');
      setDate('');
      showToast(`Session "${s.name}" created.`);
      loadSession(s.id);
    } catch (err) {
      if (err.message === 'UNAUTHORIZED') { logout(); return; }
      showToast(err.message, 'error');
    }
  }

  async function loadSession(id) {
    setLoadingId(id);
    try {
      const s = await apiGetSession(id);
      setSelected(s);
      // Keep the sidebar list in sync
      setSessions((prev) => prev.map((p) => (p.id === id ? s : p)));
    } catch (err) {
      if (err.message === 'UNAUTHORIZED') logout();
    } finally {
      setLoadingId(null);
    }
  }

  async function handleDelete(id, e) {
    e.stopPropagation();
    if (!window.confirm('Delete this session and all its exercises?')) return;
    try {
      await apiDeleteSession(id);
      setSessions((prev) => prev.filter((s) => s.id !== id));
      if (selected?.id === id) setSelected(null);
      showToast('Session deleted.');
    } catch (err) {
      if (err.message === 'UNAUTHORIZED') { logout(); return; }
      showToast(err.message, 'error');
    }
  }

  return (
    <div className="sessions-layout">

      {/* ── sidebar ─────────────────────────────────────────────────── */}
      <aside className="sessions-sidebar">
        <div className="sidebar-header"><h2>WORKOUTS</h2></div>

        <div className="create-form">
          <div className="form-row">
            <label>Session Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Push Day, Leg Day…"
            />
          </div>
          <div className="form-row">
            <label>Date</label>
            <input
              type="text"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              placeholder="MM/DD/YYYY"
            />
          </div>
          {formErr && <p className="field-error">{formErr}</p>}
          <button className="btn btn-primary btn-full" onClick={handleCreate}>
            + CREATE SESSION
          </button>
        </div>

        <div className="session-list">
          {sessions.length === 0 ? (
            <div className="empty-state">
              <p>No sessions yet.<br />Create your first workout.</p>
            </div>
          ) : (
            sessions.map((s) => (
              <div
                key={s.id}
                className={`session-item ${selected?.id === s.id ? 'selected' : ''} ${loadingId === s.id ? 'loading' : ''}`}
                onClick={() => loadSession(s.id)}
              >
                <div className="session-item-body">
                  <div className="s-date">{formatDate(s.date)}</div>
                  <div className="s-name">{s.name}</div>
                  {user.role === 'admin' && s.owner && (
                    <div className="s-owner">@{s.owner}</div>
                  )}
                  <div className="s-meta">
                    {s.exercises.length} exercise{s.exercises.length !== 1 ? 's' : ''}
                  </div>
                </div>
                <button
                  className="btn-danger del-btn"
                  onClick={(e) => handleDelete(s.id, e)}
                >
                  DEL
                </button>
              </div>
            ))
          )}
        </div>
      </aside>

      {/* ── detail ──────────────────────────────────────────────────── */}
      <div className="session-detail">
        {selected ? (
          <SessionDetail
            session={selected}
            isAdmin={user.role === 'admin'}
            onReload={() => loadSession(selected.id)}
            onDeleted={() => {
              setSessions((prev) => prev.filter((s) => s.id !== selected.id));
              setSelected(null);
            }}
          />
        ) : (
          <div className="detail-placeholder">
            <p>Select a session to view</p>
          </div>
        )}
      </div>

    </div>
  );
}
