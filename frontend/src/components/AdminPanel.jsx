import { useState, useEffect } from 'react';
import { useAuth }  from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { apiGetUsers, apiSetRole } from '../api.js';

export default function AdminPanel() {
  const { user, logout } = useAuth();
  const { showToast }    = useToast();

  const [users,   setUsers]   = useState([]);
  const [loading, setLoading] = useState(true);

  async function loadUsers() {
    setLoading(true);
    try {
      setUsers(await apiGetUsers());
    } catch (err) {
      if (err.message === 'UNAUTHORIZED') logout();
      else showToast('Failed to load users.', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadUsers(); }, []);

  async function handleToggleRole(username, currentRole) {
    const next = currentRole === 'admin' ? 'user' : 'admin';
    const verb = next === 'admin' ? 'PROMOTE' : 'DEMOTE';
    if (!window.confirm(`${verb} @${username} to '${next}'?`)) return;
    try {
      const res = await apiSetRole(username, next);
      showToast(res.message);
      loadUsers();
    } catch (err) {
      if (err.message === 'UNAUTHORIZED') logout();
      else showToast(err.message, 'error');
    }
  }

  return (
    <div className="admin-panel">
      <div className="progress-header">
        <h2>USER MANAGEMENT</h2>
        <p className="subtitle">ADMIN ONLY — PROMOTE OR DEMOTE USERS</p>
      </div>

      {loading ? (
        <p className="muted-text">Loading users…</p>
      ) : users.length === 0 ? (
        <p className="muted-text">No users found.</p>
      ) : (
        <table className="admin-table">
          <thead>
            <tr>
              <th>USERNAME</th>
              <th>ROLE</th>
              <th>ACTION</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.username}>
                <td className="admin-username">{u.username}</td>
                <td>
                  <span className={`role-badge role-${u.role}`}>
                    {u.role.toUpperCase()}
                  </span>
                </td>
                <td>
                  {u.username === user.username ? (
                    <span className="muted-text" style={{ fontSize: '0.7rem' }}>YOU</span>
                  ) : (
                    <button
                      className="btn-ghost btn-sm"
                      onClick={() => handleToggleRole(u.username, u.role)}
                    >
                      {u.role === 'admin' ? 'DEMOTE' : 'PROMOTE'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
