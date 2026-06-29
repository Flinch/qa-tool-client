import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { apiFetch } from '../lib/api.js'
import { useToastStore } from '../store/toastStore.jsx'

const SEVERITIES = ['critical', 'high', 'medium', 'low']
const STATUSES = ['open', 'in_progress', 'resolved']
const STATUS_LABELS = { open: 'Open', in_progress: 'In progress', resolved: 'Resolved' }

function BugModal({ projectId, onClose, onCreated }) {
  const { addToast } = useToastStore()
  const [form, setForm] = useState({ title: '', severity: 'high', steps_to_reproduce: '', expected: '', actual: '', notes: '' })
  const [loading, setLoading] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const submit = async () => {
    if (!form.title.trim()) return
    setLoading(true)
    try {
      const bug = await apiFetch(`/projects/${projectId}/bugs`, {
        method: 'POST',
        body: JSON.stringify(form),
      })
      addToast('Bug logged')
      onCreated(bug)
      onClose()
    } catch (e) {
      addToast(e.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 600 }}>
        <div className="modal-title">Log a bug</div>
        <div className="form-group">
          <label className="form-label">Title *</label>
          <input className="form-input" placeholder="Short description of the bug" value={form.title} onChange={e => set('title', e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Severity</label>
          <select className="form-select" value={form.severity} onChange={e => set('severity', e.target.value)}>
            {SEVERITIES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Steps to reproduce</label>
          <textarea className="form-textarea" placeholder="1. Go to...&#10;2. Click on...&#10;3. Observe..." value={form.steps_to_reproduce} onChange={e => set('steps_to_reproduce', e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Expected result</label>
          <input className="form-input" placeholder="What should happen" value={form.expected} onChange={e => set('expected', e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Actual result</label>
          <input className="form-input" placeholder="What actually happens" value={form.actual} onChange={e => set('actual', e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Notes</label>
          <textarea className="form-textarea" placeholder="Additional context..." style={{ minHeight: 60 }} value={form.notes} onChange={e => set('notes', e.target.value)} />
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={submit} disabled={loading || !form.title.trim()}>{loading ? 'Logging...' : 'Log bug'}</button>
        </div>
      </div>
    </div>
  )
}

export default function BugsPage() {
  const { id } = useParams()
  const { addToast } = useToastStore()
  const [bugs, setBugs] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    apiFetch(`/projects/${id}/bugs`)
      .then(setBugs)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [id])

  const updateStatus = async (bugId, status) => {
    try {
      await apiFetch(`/bugs/${bugId}`, { method: 'PATCH', body: JSON.stringify({ status }) })
      setBugs(bs => bs.map(b => b.id === bugId ? { ...b, status } : b))
      addToast('Status updated')
    } catch (e) {
      addToast(e.message, 'error')
    }
  }

  const filtered = filter === 'all' ? bugs : bugs.filter(b =>
    SEVERITIES.includes(filter) ? b.severity === filter : b.status === filter
  )

  return (
    <>
      <div className="topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
          <Link to="/projects" style={{ color: 'var(--muted)', textDecoration: 'none' }}>Projects</Link>
          <span style={{ color: 'var(--muted)' }}>/</span>
          <Link to={`/projects/${id}`} style={{ color: 'var(--muted)', textDecoration: 'none' }}>Project</Link>
          <span style={{ color: 'var(--muted)' }}>/</span>
          <span className="topbar-title">Bugs</span>
        </div>
        <div className="topbar-actions">
          <button className="btn btn-primary btn-sm" onClick={() => setShowModal(true)}>+ Log bug</button>
        </div>
      </div>
      <div className="page-content fade-in">
        {bugs.length > 0 && (
          <div className="stats-row" style={{ marginBottom: '1.5rem' }}>
            <div className="stat-card"><div className="stat-num">{bugs.length}</div><div className="stat-label">Total bugs</div></div>
            <div className="stat-card"><div className="stat-num" style={{ color: 'var(--danger)' }}>{bugs.filter(b => b.status === 'open').length}</div><div className="stat-label">Open</div></div>
            <div className="stat-card"><div className="stat-num" style={{ color: 'var(--danger)' }}>{bugs.filter(b => b.severity === 'critical').length}</div><div className="stat-label">Critical</div></div>
            <div className="stat-card"><div className="stat-num" style={{ color: 'var(--success)' }}>{bugs.filter(b => b.status === 'resolved').length}</div><div className="stat-label">Resolved</div></div>
          </div>
        )}
        <div className="filters-row">
          {['all', 'open', 'in_progress', 'resolved', 'critical', 'high', 'medium', 'low'].map(f => (
            <button key={f} className={`filter-btn${filter === f ? ' active' : ''}`} onClick={() => setFilter(f)}>
              {f === 'all' ? 'All' : f === 'in_progress' ? 'In progress' : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}><div className="spinner" /></div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <h3>{bugs.length === 0 ? 'No bugs logged yet' : 'No results for this filter'}</h3>
            <p>{bugs.length === 0 ? 'Found something broken? Log it here.' : 'Try a different filter.'}</p>
            {bugs.length === 0 && <button className="btn btn-primary" onClick={() => setShowModal(true)}>Log a bug</button>}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {filtered.map(bug => (
              <div key={bug.id} className="card-sm">
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 600, color: 'var(--light)', fontSize: '0.92rem' }}>{bug.title}</span>
                      <span className={`badge badge-${bug.severity}`}>{bug.severity}</span>
                      <span className={`badge badge-${bug.status.replace('_', '-')}`}>{STATUS_LABELS[bug.status]}</span>
                    </div>
                    {bug.steps_to_reproduce && <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginBottom: '0.3rem' }}><strong style={{ color: 'var(--light)' }}>Steps: </strong>{bug.steps_to_reproduce.substring(0, 120)}{bug.steps_to_reproduce.length > 120 ? '...' : ''}</div>}
                    {bug.expected && <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}><strong style={{ color: 'var(--light)' }}>Expected:</strong> {bug.expected}</div>}
                    {bug.actual && <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}><strong style={{ color: 'var(--danger)' }}>Actual:</strong> {bug.actual}</div>}
                  </div>
                  <select className="form-select" style={{ width: 'auto', padding: '0.3rem 0.6rem', fontSize: '0.78rem' }} value={bug.status} onChange={e => updateStatus(bug.id, e.target.value)}>
                    {STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                  </select>
                </div>
                <div style={{ fontSize: '0.73rem', color: 'var(--muted)', marginTop: '0.6rem' }}>Logged {new Date(bug.created_at).toLocaleDateString()}</div>
              </div>
            ))}
          </div>
        )}
      </div>
      {showModal && <BugModal projectId={id} onClose={() => setShowModal(false)} onCreated={b => setBugs(bs => [b, ...bs])} />}
    </>
  )
}