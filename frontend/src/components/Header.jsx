import { useAuth } from '../context/AuthContext.jsx';

export default function Header({ activePanel, setPanel }) {
  const { user, logout } = useAuth();

  const tabs = [
    { id: 'sessions', label: 'Sessions' },
    { id: 'progress', label: 'Progress' },
    ...(user?.role === 'admin' ? [{ id: 'admin', label: 'Users' }] : []),
  ];

  return (
    <header className="header">
      <div className="header-logo">IRONLOG</div>

      <nav className="nav-tabs">
        {tabs.map((t) => (
          <button
            key={t.id}
            className={`nav-tab ${activePanel === t.id ? 'active' : ''}`}
            onClick={() => setPanel(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div className="header-user">
        <span className="header-username">{user?.username}</span>
        <span className={`role-badge role-${user?.role}`}>
          {user?.role?.toUpperCase()}
        </span>
        <button className="btn-ghost btn-sm" onClick={logout}>
          LOG OUT
        </button>
      </div>
    </header>
  );
}
