import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './context/AuthContext.jsx';
import { useToast } from './context/ToastContext.jsx';
import { apiGetSessions } from './api.js';

import AuthOverlay   from './components/AuthOverlay.jsx';
import Header        from './components/Header.jsx';
import SessionsPanel from './components/SessionsPanel.jsx';
import ProgressPanel from './components/ProgressPanel.jsx';
import AdminPanel    from './components/AdminPanel.jsx';
import Toast         from './components/Toast.jsx';

export default function App() {
  const { user, loading, logout } = useAuth();
  const { showToast }             = useToast();

  const [panel,    setPanel]    = useState('sessions');
  const [sessions, setSessions] = useState([]);

  // Load sessions whenever a user logs in
  const loadSessions = useCallback(async () => {
    if (!user) return;
    try {
      const data = await apiGetSessions();
      setSessions(data);
    } catch (err) {
      if (err.message === 'UNAUTHORIZED') { logout(); return; }
      showToast('Failed to load sessions.', 'error');
    }
  }, [user, logout, showToast]);

  useEffect(() => {
    if (user) loadSessions();
    else setSessions([]);
  }, [user]);

  // Show a full-screen spinner while we verify the stored token
  if (loading) {
    return (
      <div className="boot-screen">
        <span className="boot-logo">IRONLOG</span>
      </div>
    );
  }

  if (!user) return <AuthOverlay />;

  return (
    <>
      <Header activePanel={panel} setPanel={setPanel} />

      <main className="app-main">
        {panel === 'sessions' && (
          <SessionsPanel
            sessions={sessions}
            setSessions={setSessions}
            onReload={loadSessions}
          />
        )}
        {panel === 'progress' && (
          <ProgressPanel sessions={sessions} />
        )}
        {panel === 'admin' && user.role === 'admin' && (
          <AdminPanel />
        )}
      </main>

      <Toast />
    </>
  );
}
