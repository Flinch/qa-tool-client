import { Outlet, NavLink, useNavigate, useParams } from 'react-router-dom'
import { useUser, useClerk } from '@clerk/clerk-react'
import { useToastStore } from '../store/toastStore.jsx'

function Icon({ name }) {
  const icons = {
    dashboard: <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />,
    projects:  <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />,
    tests:     <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />,
    bugs:      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />,
    signout:   <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />,
  }
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      {icons[name]}
    </svg>
  )
}

export default function AppShell() {
  const { user } = useUser()
  const { signOut } = useClerk()
  const navigate = useNavigate()
  const { toasts } = useToastStore()
  const role = user?.publicMetadata?.role || 'qa_engineer'

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
          <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginBottom: '0.6rem', padding: '0 0.5rem' }}>
            <div style={{ color: 'var(--light)', fontWeight: 600, marginBottom: '0.1rem' }}>
              {user?.firstName || user?.emailAddresses?.[0]?.emailAddress}
            </div>
            <div style={{ textTransform: 'capitalize' }}>{role.replace('_', ' ')}</div>
          </div>
          <button className="sidebar-link" onClick={() => signOut(() => navigate('/sign-in'))}>
            <Icon name="signout" /> Sign out
          </button>
        </div>
      </aside>

      <main className="main-content">
        <Outlet />
      </main>

      {/* Toast notifications */}
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
