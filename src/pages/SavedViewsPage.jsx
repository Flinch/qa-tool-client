import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { apiFetch } from '../lib/api.js'
import { useAuth } from '../store/AuthContext.jsx'
import { useToastStore } from '../store/toastStore.jsx'
import Icon from '../components/Icon.jsx'

const TYPE_META = {
  bugs: { icon: 'bug', label: 'Bugs view' },
  execution_test_cases: { icon: 'play', label: 'Execution view' },
}

// A bugs view has no ambiguity to resolve (no run/latest concept), so it
// links straight to the real page — no reason to pay for the extra
// fetch-then-redirect hop ViewRedirectPage exists for. An execution view
// DOES need that hop: it has to ask the server which run is currently
// "latest" so a saved/shared link never goes stale as new runs happen.
function viewHref(view, projectId) {
  return view.type === 'bugs'
    ? `/projects/${projectId}/bugs?viewId=${view.id}`
    : `/projects/${projectId}/views/${view.id}`
}

function ViewCard({ view, projectId, canDelete, onDeleted }) {
  const { addToast } = useToastStore()
  const meta = TYPE_META[view.type] || { icon: 'target', label: view.type }
  const href = viewHref(view, projectId)

  const copyLink = async (e) => {
    e.preventDefault(); e.stopPropagation()
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${href}`)
      addToast('Link copied')
    } catch {
      addToast('Could not copy link', 'error')
    }
  }

  const remove = async (e) => {
    e.preventDefault(); e.stopPropagation()
    try {
      await apiFetch(`/projects/${projectId}/saved-views/${view.id}`, { method: 'DELETE' })
      onDeleted(view.id)
    } catch (err) {
      addToast(err.message, 'error')
    }
  }

  return (
    <Link to={href} style={{ textDecoration: 'none', display: 'block' }}>
      <div
        className="card" style={{ cursor: 'pointer', transition: 'border-color 0.2s' }}
        onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(184,70,31,0.3)'}
        onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
          <div style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--accent)', background: 'var(--bg)', color: 'var(--accent)' }}>
            <Icon name={meta.icon} size={16} />
          </div>
          <div style={{ display: 'flex', gap: '0.3rem' }}>
            <button className="btn btn-ghost btn-sm" onClick={copyLink} title="Copy link">
              <Icon name="link" size={13} /> Copy link
            </button>
            {canDelete && (
              <button className="btn btn-ghost btn-sm" onClick={remove} title="Delete view">
                <Icon name="x" size={13} />
              </button>
            )}
          </div>
        </div>
        <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 700, color: 'var(--white)', marginBottom: '0.3rem' }}>{view.name}</div>
        <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>{meta.label}</div>
      </div>
    </Link>
  )
}

export default function SavedViewsPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const isClient = user?.role === 'client'
  const [project, setProject] = useState(null)
  const [views, setViews] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { apiFetch(`/projects/${id}`).then(setProject).catch(console.error) }, [id])
  useEffect(() => {
    apiFetch(`/projects/${id}/saved-views`).then(setViews).catch(console.error).finally(() => setLoading(false))
  }, [id])

  return (
    <>
      <div className="topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button className="back-btn" onClick={() => navigate(-1)} title="Back" aria-label="Back"><Icon name="arrowLeft" size={14} /></button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
            <Link to={`/projects/${id}`} style={{ color: 'var(--muted)', textDecoration: 'none' }}>{project?.name || 'Project'}</Link>
            <span style={{ color: 'var(--muted)' }}>/</span>
            <span className="topbar-title">Views</span>
          </div>
        </div>
      </div>
      <div className="page-content fade-in">
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}><div className="spinner" /></div>
        ) : views.length === 0 ? (
          <div className="empty-state">
            <h3>No saved views yet</h3>
            <p>Set up filters on the Bugs or Executions page, then use "Save as view" to pin them here.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
            {views.map(v => (
              <ViewCard
                key={v.id} view={v} projectId={id} canDelete={!isClient}
                onDeleted={deletedId => setViews(vs => vs.filter(x => x.id !== deletedId))}
              />
            ))}
          </div>
        )}
      </div>
    </>
  )
}
