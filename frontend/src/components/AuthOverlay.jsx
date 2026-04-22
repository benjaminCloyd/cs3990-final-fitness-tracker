import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { apiLogin, apiSignup } from '../api.js';

export default function AuthOverlay() {
  const { login } = useAuth();
  const [tab, setTab]       = useState('login');  // 'login' | 'signup'
  const [error, setError]   = useState('');
  const [busy, setBusy]     = useState(false);

  // Shared field state
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  function switchTab(t) {
    setTab(t);
    setError('');
    setUsername('');
    setPassword('');
  }

  async function handleLogin(e) {
    e.preventDefault();
    if (!username || !password) { setError('Enter username and password.'); return; }
    setBusy(true);
    setError('');
    try {
      const data = await apiLogin(username, password);
      login(data.access_token, data.username, data.role);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleSignup(e) {
    e.preventDefault();
    if (!username || !password) { setError('Enter username and password.'); return; }
    if (password.length < 6)    { setError('Password must be at least 6 characters.'); return; }
    setBusy(true);
    setError('');
    try {
      await apiSignup(username, password);
      // Auto-login after successful signup
      const data = await apiLogin(username, password);
      login(data.access_token, data.username, data.role);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="auth-overlay">
      <div className="auth-card">
        <div className="auth-logo">IRONLOG</div>
        <p className="auth-tagline">TRACK YOUR LIFTS. OWN YOUR DATA.</p>

        <div className="auth-tabs">
          <button
            className={`auth-tab ${tab === 'login' ? 'active' : ''}`}
            onClick={() => switchTab('login')}
          >
            SIGN IN
          </button>
          <button
            className={`auth-tab ${tab === 'signup' ? 'active' : ''}`}
            onClick={() => switchTab('signup')}
          >
            SIGN UP
          </button>
        </div>

        <form onSubmit={tab === 'login' ? handleLogin : handleSignup} noValidate>
          <div className="form-row">
            <label>Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="your username"
              autoComplete="username"
              autoFocus
            />
          </div>

          <div className="form-row">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
            />
          </div>

          {error && <p className="auth-error">{error}</p>}

          <button className="btn btn-primary btn-full" type="submit" disabled={busy}>
            {busy ? '...' : tab === 'login' ? 'SIGN IN' : 'CREATE ACCOUNT'}
          </button>
        </form>
      </div>
    </div>
  );
}
