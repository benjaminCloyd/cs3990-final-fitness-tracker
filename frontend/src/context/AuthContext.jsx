import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiMe } from '../api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]     = useState(null);   // Full UserResponse | null
  const [loading, setLoading] = useState(true); // verifying stored token on mount

  // Restore session from localStorage on first render
  useEffect(() => {
    const token    = localStorage.getItem('token');
    const username = localStorage.getItem('username');
    const role     = localStorage.getItem('role');

    if (!token || !username) { setLoading(false); return; }

    // Verify the token is still valid server-side
    apiMe()
      .then((me) => {
        // Refresh role in case it changed since last login
        saveAuth(token, me.username, me.role);
        setUser(me);
      })
      .catch(() => {
        clearAuth();
      })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (token, username, role) => {
    saveAuth(token, username, role);
    // Fetch full profile immediately after login to get macro targets
    try {
      const me = await apiMe();
      setUser(me);
    } catch {
      setUser({ username, role });
    }
  }, []);

  const refreshUser = useCallback(async () => {
    const me = await apiMe();
    setUser(me);
  }, []);

  const logout = useCallback(() => {
    clearAuth();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

// ── helpers ───────────────────────────────────────────────────────────────────

function saveAuth(token, username, role) {
  localStorage.setItem('token', token);
  localStorage.setItem('username', username);
  localStorage.setItem('role', role);
}

function clearAuth() {
  localStorage.removeItem('token');
  localStorage.removeItem('username');
  localStorage.removeItem('role');
}
