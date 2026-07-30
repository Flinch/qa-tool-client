import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiFetch } from '../lib/api.js'
import { useAuth } from '../store/AuthContext.jsx'

// Each project is now its own physically separate database (Phase A:
// DB-per-client multi-tenancy), so creating one means provisioning real
// infrastructure — a new Postgres database plus schema migrations — not
// just an INSERT. That's a deliberate CLI-only operation
// (scripts/provisionTenant.js) run by hand off the always-on server, so the
// database-creation credential it needs never has to live on that process.
// This modal just points to the runbook instead of a form.
function ProjectModal({ onClose }) {
  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-title">New project</div>
        <p style={{ color: 'var(--muted)', fontSize: '0.88rem', lineHeight: 1.6 }}>
          New clients are provisioned from the command line now, not through the
          UI — each one gets its own isolated database. Run:
        </p>
        <pre style={{ background: 'var(--bg-secondary, #1a1a1a)', padding: '0.75rem', borderRadius: 6, fontSize: '0.82rem', overflowX: 'auto' }}>
          node scripts/provisionTenant.js --name "Client Name"
        </pre>
        <p style={{ color: 'var(--muted)', fontSize: '0.82rem' }}>
          from the qa-tool-server repo. The new project appears here once it finishes.
        </p>
        <div className="modal-footer">
          <button className="btn btn-primary" onClick={onClose}>Got it</button>
        </div>
      </div>
    </div>
  )
}

export default function ProjectsPage() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)

  useEffect(() => {
    apiFetch('/projects').then(setProjects).catch(console.error).finally(() => setLoading(false))
  }, [])

  return (
    <>
      <div className="topbar">
        <span className="topbar-title">Projects</span>
        {isAdmin && (
          <div className="topbar-actions">
            <button className="btn btn-primary btn-sm" onClick={() => setShowModal(true)}>+ New project</button>
          </div>
        )}
      </div>
      <div className="page-content fade-in">
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}><div className="spinner" /></div>
        ) : projects.length === 0 ? (
          <div className="empty-state">
            <h3>No projects yet</h3>
            <p>{isAdmin ? 'Create your first project to start managing test cases and bugs.' : 'No projects have been shared with you yet.'}</p>
            {isAdmin && <button className="btn btn-primary" onClick={() => setShowModal(true)}>Create project</button>}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
            {projects.map(p => (
              <Link to={`/projects/${p.id}`} key={p.id} style={{ textDecoration: 'none' }}>
                <div className="card-sm" style={{ cursor: 'pointer', height: '100%' }}>
                  <div style={{ fontWeight: 600, color: 'var(--white)', fontSize: '0.95rem', marginBottom: '0.25rem' }}>{p.name}</div>
                  {p.client_name && <div style={{ fontSize: '0.8rem', color: 'var(--accent)', marginBottom: '0.5rem' }}>{p.client_name}</div>}
                  {p.description && <div style={{ fontSize: '0.82rem', color: 'var(--muted)', marginBottom: '0.85rem', lineHeight: 1.55 }}>{p.description}</div>}
                  <div style={{ display: 'flex', gap: '1.25rem', fontSize: '0.78rem', color: 'var(--muted)', paddingTop: '0.75rem', borderTop: '1px solid var(--border)' }}>
                    <span><strong style={{ color: 'var(--light)' }}>{p.test_case_count ?? 0}</strong> tests</span>
                    <span><strong style={{ color: 'var(--danger)' }}>{p.open_bug_count ?? 0}</strong> open bugs</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
      {showModal && <ProjectModal onClose={() => setShowModal(false)} />}
    </>
  )
}