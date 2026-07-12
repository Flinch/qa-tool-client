import { Outlet, NavLink, useLocation } from 'react-router-dom'
import { useToastStore } from '../store/toastStore.jsx'
import { useAuth } from '../store/AuthContext.jsx'
import Icon from './Icon.jsx'

const roleLabel = { admin: 'Admin', qa_engineer: 'QA Engineer', client: 'Client' }

export default function AppShell() {
  const { toasts } = useToastStore()
  const { user, logout } = useAuth()
  const { pathname } = useLocation()

  // Clients get a per-project Overview/Reports split as sidebar links (not
  // in-page tabs) — only meaningful while they're inside a project, so it's
  // derived from the URL rather than being a permanent nav item.
  const projectMatch = user?.role === 'client' && pathname.match(/^\/projects\/(\d+)/)
  const projectId = projectMatch?.[1]

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-logo">Blue<span>print</span></div>
        {user?.role !== 'client' && (
          <div className="sidebar-section">
            <div className="sidebar-label">Navigation</div>
            <NavLink to="/" end className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
              <Icon name="dashboard" /> Dashboard
            </NavLink>
            <NavLink to="/projects" className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
              <Icon name="projects" /> Projects
            </NavLink>
          </div>
        )}
        {projectId && (
          <div className="sidebar-section">
            <div className="sidebar-label">Project</div>
            <NavLink to={`/projects/${projectId}`} end className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
              <Icon name="dashboard" /> Overview
            </NavLink>
            <NavLink to={`/projects/${projectId}/reports`} className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
              <Icon name="check" /> Reports
            </NavLink>
          </div>
        )}
        <div className="sidebar-bottom">
          <div style={{ fontSize: '0.78rem', color: 'var(--muted)', padding: '0 0.5rem' }}>
            <div style={{ color: 'var(--light)', fontWeight: 600, marginBottom: '0.1rem' }} data-testid="sidebar-user-name">
              {user?.name}
            </div>
            <div data-testid="sidebar-user-role">
              {roleLabel[user?.role] || 'Client'}
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
            <Icon name={t.type === 'success' ? 'check' : 'x'} size={15} /> {t.message}
          </div>
        ))}
      </div>
    </div>
  )
}