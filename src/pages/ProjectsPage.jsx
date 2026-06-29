import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiFetch } from '../lib/api.js'
import { useToastStore } from '../store/toastStore.jsx'

function ProjectModal({ onClose, onCreated }) {
  const { addToast } = useToastStore()
  const [form, setForm] = useState({ name: '', client_name: '', description: '' })
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    if (!form.name.trim()) return
    setLoading(true)
    try {
      const project = await apiFetch('/projects', {
        method: 'POST',
        body: JSON.stringify(form),
      })
      addToast(`Project "${project.name}" created`)
      onCreated(project)
      onClose()
    } catch (e) {
      addToast(e.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-title">New project</div>
        <div className="form-group">
          <label className="form-label">Project name *</label>
          <input className="form-input" placeholder="e.g. Acme Booking App" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
        </div>
        <div className="form-group">
          <label className="form-label">Client name</label>
          <input className="form-input" placeholder="e.g. Acme Corp" value={form.client_name} onChange={e => setForm(f => ({ ...f, client_name: e.target.value }))} />
        </div>
        <div className="form-group">
          <label className="form-label">Description</label>
          <textarea className="form-textarea" placeholder="Brief description..." value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} style={{ minHeight: 80 }} />
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={submit} disabled={loading || !form.name.trim()}>
            {loading ? 'Creating...' : 'Create project'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)

  useEffect(() => {
    apiFetch('/projects')
      .then(setProjects)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  return (
    <>
      <div className="topbar">
        <span className="topbar-title">Projects</span>
        <div className="topbar-actions">
          <button className="btn btn-primary btn-sm" onClick={() => setShowModal(true)}>+ New project</button>
        </div>
      </div>
      <div className="page-content fade-in">
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}><div className="spinner" /></div>
        ) : projects.length === 0 ? (
          <div className="empty-state">
            <h3>No projects yet</h3>
            <p>Create your first project to start managing test cases and bugs.</p>
            <button className="btn btn-primary" onClick={() => setShowModal(true)}>Create project</button>
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
      {showModal && <ProjectModal onClose={() => setShowModal(false)} onCreated={p => setProjects(ps => [p, ...ps])} />}
    </>
  )
}
