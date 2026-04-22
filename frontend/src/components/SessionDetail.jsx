import { useState } from 'react';
import { useAuth }  from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { apiDeleteSession, apiAddExercise } from '../api.js';
import ExerciseCard from './ExerciseCard.jsx';

function formatDate(date) {
  if (!date) return '';
  const [m, d, y] = date.split('/');
  const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  return `${months[+m - 1]} ${d}, ${y}`;
}

function makeSet() { return { weight: '', reps: '' }; }

export default function SessionDetail({ session, isAdmin, onReload, onDeleted }) {
  const { logout }    = useAuth();
  const { showToast } = useToast();

  const [exName, setExName] = useState('');
  const [sets, setSets]     = useState([makeSet(), makeSet(), makeSet()]);

  /* ── set row helpers ── */
  function updateSet(i, field, val) {
    setSets((prev) => prev.map((s, idx) => idx === i ? { ...s, [field]: val } : s));
  }
  function addSet()      { setSets((prev) => [...prev, makeSet()]); }
  function removeSet(i)  { setSets((prev) => prev.filter((_, idx) => idx !== i)); }
  function resetSets()   { setSets([makeSet(), makeSet(), makeSet()]); setExName(''); }

  function validSets() {
    return sets
      .filter((s) => parseFloat(s.weight) > 0 && parseInt(s.reps) > 0)
      .map((s)  => ({ weight: parseFloat(s.weight), reps: parseInt(s.reps) }));
  }

  /* ── actions ── */
  async function handleDeleteSession() {
    if (!window.confirm('Delete this session and all its exercises?')) return;
    try {
      await apiDeleteSession(session.id);
      showToast('Session deleted.');
      onDeleted();
    } catch (err) {
      if (err.message === 'UNAUTHORIZED') { logout(); return; }
      showToast(err.message, 'error');
    }
  }

  async function handleAddExercise() {
    if (!exName.trim()) { showToast('Enter an exercise name.', 'error'); return; }
    const v = validSets();
    if (!v.length)      { showToast('Add at least one valid set.', 'error'); return; }

    try {
      const ex = await apiAddExercise(session.id, { name: exName.trim(), sets: v });
      showToast(`${ex.name} logged — est. 1RM: ${ex.best_1rm} lbs`);
      resetSets();
      onReload();
    } catch (err) {
      if (err.message === 'UNAUTHORIZED') { logout(); return; }
      showToast(err.message, 'error');
    }
  }

  return (
    <div className="detail-content">

      {/* ── header ── */}
      <div className="detail-header">
        <div>
          <h1 className="session-title">{session.name}</h1>
          <span className="session-date-badge">{formatDate(session.date)}</span>
          {isAdmin && session.owner && (
            <span className="session-owner-badge">@{session.owner}</span>
          )}
        </div>
        <button className="btn-danger" onClick={handleDeleteSession}>
          DELETE SESSION
        </button>
      </div>

      {/* ── exercises ── */}
      <section className="exercises-section">
        <h3>EXERCISES — {session.exercises.length}</h3>

        {session.exercises.length === 0 ? (
          <div className="empty-state"><p>No exercises logged yet.</p></div>
        ) : (
          session.exercises.map((ex) => (
            <ExerciseCard
              key={ex.id}
              exercise={ex}
              sessionId={session.id}
              onChanged={onReload}
            />
          ))
        )}
      </section>

      {/* ── log exercise form ── */}
      <section className="add-exercise-section">
        <h3>LOG EXERCISE</h3>

        <div className="form-row">
          <label>Exercise Name</label>
          <input
            type="text"
            value={exName}
            onChange={(e) => setExName(e.target.value)}
            placeholder="Bench Press, Squat…"
          />
        </div>

        <div className="sets-builder">
          <div className="sets-builder-header">
            <span>SETS</span>
            <button className="btn-ghost btn-sm" onClick={addSet}>+ ADD SET</button>
          </div>

          {sets.map((s, i) => (
            <div className="set-row" key={i}>
              <div className="set-label">S{i + 1}</div>
              <input
                className="w-input"
                type="number"
                placeholder="LBS"
                min="0"
                step="2.5"
                value={s.weight}
                onChange={(e) => updateSet(i, 'weight', e.target.value)}
              />
              <input
                className="r-input"
                type="number"
                placeholder="REPS"
                min="1"
                max="100"
                value={s.reps}
                onChange={(e) => updateSet(i, 'reps', e.target.value)}
              />
              <button className="btn-remove-set" onClick={() => removeSet(i)}>✕</button>
            </div>
          ))}
        </div>

        <div className="add-exercise-actions">
          <button className="btn btn-primary" onClick={handleAddExercise}>LOG EXERCISE</button>
          <button className="btn-ghost"       onClick={resetSets}>RESET</button>
        </div>
      </section>

    </div>
  );
}
