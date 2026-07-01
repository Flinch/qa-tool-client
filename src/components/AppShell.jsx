import { Outlet, NavLink } from 'react-router-dom'
import { useToastStore } from '../store/toastStore.jsx'
import { useAuth } from '../store/AuthContext.jsx'

function Icon({ name }) {
  const icons = {
    dashboard: <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />,
    projects:  <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />,
  }
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      {icons[name]}
    </svg>
  )
}

export default function AppShell() {
  const { toasts } = useToastStore()
  const { user, logout } = useAuth()

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-logo">QA<span>Tool</span></div>
        <div className="sidebar-section">
          <div className="sidebar-label">Navigation</div>
          <NavLink to="/" end className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
            <Icon name="dashboard" /> Dashboard
          </NavLink>
          <NavLink to="/projects" className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
            <Icon name="projects" /> Projects
          </NavLink>
        </div>
        <div className="sidebar-bottom">
          <div style={{ fontSize: '0.78rem', color: 'var(--muted)', padding: '0 0.5rem' }}>
            <div style={{ color: 'var(--light)', fontWeight: 600, marginBottom: '0.1rem' }} data-testid="sidebar-user-name">
              {user?.name}
            </div>
            <div data-testid="sidebar-user-role">
              {user?.role === 'qa_engineer' ? 'QA Engineer' : 'Client'}
            </div>
            <button
              onClick={logout}
              data-testid="logout-button"
              style={{
                marginTop: '0.5rem',
                background: 'none',
                border: 'none',
                color: 'var(--muted)',
                fontSize: '0.75rem',
                cursor: 'pointer',
                padding: 0,
                textDecoration: 'underline',
              }}
            >
              Log out
            </button>
          </div>
        </div>
      </aside>
      <main className="main-content">
        <Outlet />
      </main>
      <div className="toast-wrap">
        {toasts.map(t => (
          <div key={t.id} className={`toast ${t.type}`}>
            {t.type === 'success' ? '✓' : '✗'} {t.message}
          </div>
        ))}
      </div>
    </div>
  )
}