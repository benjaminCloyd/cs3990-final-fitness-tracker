import { useState } from 'react';
import { useAuth }  from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { apiUpdateExercise, apiDeleteExercise } from '../api.js';

function epley(weight, reps) {
  return reps === 1 ? weight : weight * (1 + reps / 30);
}

function makeSet(weight = '', reps = '') { return { weight, reps }; }

export default function ExerciseCard({ exercise: ex, sessionId, onChanged }) {
  const { logout }    = useAuth();
  const { showToast } = useToast();

  const [editing, setEditing] = useState(false);
  const [editSets, setEditSets] = useState([]);

  function openEdit() {
    setEditSets(ex.sets.map((s) => makeSet(String(s.weight), String(s.reps))));
    setEditing(true);
  }
  function closeEdit() { setEditing(false); }

  function updateSet(i, field, val) {
    setEditSets((prev) => prev.map((s, idx) => idx === i ? { ...s, [field]: val } : s));
  }
  function addEditSet()     { setEditSets((prev) => [...prev, makeSet()]); }
  function removeEditSet(i) { setEditSets((prev) => prev.filter((_, idx) => idx !== i)); }

  function validEditSets() {
    return editSets
      .filter((s) => parseFloat(s.weight) > 0 && parseInt(s.reps) > 0)
      .map((s)    => ({ weight: parseFloat(s.weight), reps: parseInt(s.reps) }));
  }

  async function handleSave() {
    const v = validEditSets();
    if (!v.length) { showToast('At least one valid set required.', 'error'); return; }
    try {
      const updated = await apiUpdateExercise(sessionId, ex.id, { name: ex.name, sets: v });
      showToast(`${updated.name} updated — new 1RM: ${updated.best_1rm} lbs`);
      setEditing(false);
      onChanged();
    } catch (err) {
      if (err.message === 'UNAUTHORIZED') { logout(); return; }
      showToast(err.message, 'error');
    }
  }

  async function handleDelete() {
    if (!window.confirm('Delete this exercise?')) return;
    try {
      await apiDeleteExercise(sessionId, ex.id);
      showToast('Exercise removed.');
      onChanged();
    } catch (err) {
      if (err.message === 'UNAUTHORIZED') { logout(); return; }
      showToast(err.message, 'error');
    }
  }

  return (
    <div className="exercise-card">

      {/* ── header ── */}
      <div className="exercise-card-header">
        <span className="ex-name">{ex.name}</span>
        <span className="badge-1rm">1RM ~{ex.best_1rm} LBS</span>
        <button className="btn-edit" onClick={editing ? closeEdit : openEdit}>
          {editing ? 'CANCEL' : 'EDIT'}
        </button>
        <button className="btn-danger" onClick={handleDelete}>REMOVE</button>
      </div>

      {/* ── sets table ── */}
      <table className="sets-table">
        <thead>
          <tr>
            <th>SET</th><th>WEIGHT (LBS)</th><th>REPS</th><th>EST. 1RM</th>
          </tr>
        </thead>
        <tbody>
          {ex.sets.map((s, i) => (
            <tr key={i}>
              <td className="set-num">{i + 1}</td>
              <td>{s.weight}</td>
              <td>{s.reps}</td>
              <td className="set-1rm">{epley(s.weight, s.reps).toFixed(1)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* ── inline edit form ── */}
      {editing && (
        <div className="edit-form">
          <div className="edit-title">✏ EDIT SETS FOR {ex.name.toUpperCase()}</div>

          {editSets.map((s, i) => (
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
              <button className="btn-remove-set" onClick={() => removeEditSet(i)}>✕</button>
            </div>
          ))}

          <button className="btn-ghost btn-sm" style={{ marginBottom: '12px' }} onClick={addEditSet}>
            + ADD SET
          </button>

          <div className="edit-actions">
            <button className="btn-save" onClick={handleSave}>SAVE CHANGES</button>
            <button className="btn-ghost" onClick={closeEdit}>CANCEL</button>
          </div>
        </div>
      )}
    </div>
  );
}
