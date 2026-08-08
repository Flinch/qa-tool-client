import { useEffect, useRef, useState } from 'react'
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useToastStore } from '../store/toastStore.jsx'
import { useAuth } from '../store/AuthContext.jsx'
import { apiFetch } from '../lib/api.js'
import Icon from './Icon.jsx'
import EngineeringLink from './EngineeringLink.jsx'

const roleLabel = { admin: 'Admin', qa_engineer: 'QA Engineer', client: 'Client' }

// Click-the-current-project-name-to-switch, same outside-click-closes shape
// as NotificationBell's dropdown. Plain (non-interactive) text when there's
// only one project — nothing to switch to, so no point pretending it's a
// control. Client-only: staff already have the full Projects page + nav
// link for this.
function ClientProjectSwitcher({ projects, currentProjectId }) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const onClickOutside = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open])

  const current = projects.find(p => String(p.id) === String(currentProjectId))
  if (!current) return null

  const canSwitch = projects.length > 1

  return (
    <div style={{ position: 'relative', padding: '0 0.75rem', marginBottom: '1rem' }} ref={wrapRef}>
      <button
        onClick={() => canSwitch && setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem',
          width: '100%', padding: '0.55rem 0.75rem', background: 'var(--card2)', border: '1px solid var(--border)',
          color: 'var(--light)', fontSize: '0.85rem', fontWeight: 600, cursor: canSwitch ? 'pointer' : 'default',
          textAlign: 'left',
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{current.name}</span>
        {canSwitch && <Icon name="chevronRight" size={12} style={{ flexShrink: 0, opacity: 0.6, transform: 'rotate(90deg)' }} />}
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: '0.75rem', right: '0.75rem', zIndex: 60,
          background: 'var(--card)', border: '1px solid var(--border2)', maxHeight: 280, overflowY: 'auto',
        }}>
          {projects.map(p => (
            <button
              key={p.id}
              onClick={() => { setOpen(false); if (String(p.id) !== String(currentProjectId)) navigate(`/projects/${p.id}`) }}
              style={{
                display: 'block', width: '100%', textAlign: 'left', padding: '0.55rem 0.75rem',
                background: String(p.id) === String(currentProjectId) ? 'var(--accent-tint)' : 'transparent',
                color: String(p.id) === String(currentProjectId) ? 'var(--accent)' : 'var(--light)',
                border: 'none', fontSize: '0.85rem', cursor: 'pointer',
              }}
            >
              {p.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

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
  // fetched to power ClientProjectSwitcher below, which itself no-ops down
  // to plain text when there's nothing to switch to.
  const [clientProjects, setClientProjects] = useState([])
  useEffect(() => {
    if (user?.role !== 'client') return
    apiFetch('/projects').then(setClientProjects).catch(() => {})
  }, [user?.role])

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-logo">Blue<span>print</span></div>
        {user?.role === 'client' && projectId && (
          <ClientProjectSwitcher projects={clientProjects} currentProjectId={projectId} />
        )}
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