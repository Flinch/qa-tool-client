import { useEffect, useState } from 'react'
import { Outlet, NavLink, useLocation } from 'react-router-dom'
import { useToastStore } from '../store/toastStore.jsx'
import { useAuth } from '../store/AuthContext.jsx'
import { apiFetch } from '../lib/api.js'
import Icon from './Icon.jsx'
import EngineeringLink from './EngineeringLink.jsx'

const roleLabel = { admin: 'Admin', qa_engineer: 'QA Engineer', client: 'Client' }

export default function AppShell() {
  const { toasts } = useToastStore()
  const { user, logout } = useAuth()
  const { pathname } = useLocation()

  // Which project (if any) the current URL is inside — used both for the
  // client's sidebar Dashboard/Views links (client-only) and for staff's
  // global Engineering shortcut (staff-only) below.
  const projectMatch = pathname.match(/^\/projects\/(\d+)/)
  const projectId = projectMatch?.[1]

  // Most clients have exactly one project and never need this — only
  // fetched to decide whether the "Switch project" link below is worth
  // showing at all, same "don't build a picker nobody needs" reasoning as
  // ClientHome's single-project redirect in App.jsx.
  const [clientProjectCount, setClientProjectCount] = useState(0)
  useEffect(() => {
    if (user?.role !== 'client') return
    apiFetch('/projects').then(ps => setClientProjectCount(ps.length)).catch(() => {})
  }, [user?.role])

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
        {user?.role === 'client' && projectId && (
          <div className="sidebar-section">
            <div className="sidebar-label">Project</div>
            <NavLink to={`/projects/${projectId}`} end className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
              <Icon name="dashboard" /> Dashboard
            </NavLink>
            <NavLink to={`/projects/${projectId}/views`} className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
              <Icon name="eye" /> Views
            </NavLink>
            {/* Only worth a link once there's actually more than one to
                switch between. Living inside this projectId-gated block is
                fine — a client's only other reachable routes are "/" (which
                immediately redirects) and "/projects" itself, where a link
                back to the same page would be pointless anyway. */}
            {clientProjectCount > 1 && (
              <NavLink to="/projects" className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
                <Icon name="projects" /> Switch project
              </NavLink>
            )}
          </div>
        )}
        {/* Staff have no other project-scoped sidebar nav (everything else
            is reached via ProjectDetailPage's own card grid) — Views gets
            a dedicated entry here anyway since it's the kind of thing you
            want to jump to directly while working a project, not dig for
            via Overview each time. */}
        {user?.role !== 'client' && projectId && (
          <div className="sidebar-section">
            <div className="sidebar-label">Project</div>
            <NavLink to={`/projects/${projectId}/views`} className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
              <Icon name="eye" /> Views
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
      {user?.role !== 'client' && (
        <div className="global-engineering-shortcut">
          <EngineeringLink projectId={projectId} className="btn btn-ghost btn-sm" />
        </div>
      )}
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