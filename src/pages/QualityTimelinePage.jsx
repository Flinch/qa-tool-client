import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { apiFetch } from '../lib/api.js'
import { buildActivity } from '../lib/buildActivity.js'
import { timeAgo } from '../lib/timeAgo.js'
import Icon from '../components/Icon.jsx'

// Full history behind QualityHealth's 5-item preview — same buildActivity
// merge (bugs/execution runs/requirements, real state changes only, never
// AI-pipeline events), just the whole feed instead of a slice.
const HISTORY_LIMIT = 200

export default function QualityTimelinePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [project, setProject] = useState(null)
  const [activity, setActivity] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { apiFetch(`/projects/${id}`).then(setProject).catch(console.error) }, [id])

  useEffect(() => {
    setLoading(true)
    Promise.all([
      apiFetch(`/projects/${id}/bugs`).catch(() => []),
      apiFetch(`/projects/${id}/execution-runs`).catch(() => []),
      apiFetch(`/projects/${id}/requirements`).catch(() => []),
    ])
      .then(([bugs, runs, requirements]) => setActivity(buildActivity(bugs, runs, requirements, HISTORY_LIMIT)))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [id])

  const linkFor = (ev) => ev.bugId ? `/projects/${id}/bugs?bugId=${ev.bugId}` : ev.runId ? `/projects/${id}/executions/${ev.runId}` : null

  return (
    <>
      <div className="topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button className="back-btn" onClick={() => navigate(-1)} title="Back" aria-label="Back"><Icon name="arrowLeft" size={14} /></button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
            <Link to={`/projects/${id}`} style={{ color: 'var(--muted)', textDecoration: 'none' }}>{project?.name || 'Project'}</Link>
            <span style={{ color: 'var(--muted)' }}>/</span>
            <span className="topbar-title">Timeline</span>
          </div>
        </div>
      </div>
      <div className="page-content fade-in">
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}><div className="spinner" /></div>
        ) : activity.length === 0 ? (
          <div className="empty-state">
            <h3>Nothing here yet</h3>
            <p>Bug reports, finished execution runs, and new requirements will show up here as they happen.</p>
          </div>
        ) : (
          <div className="card" style={{ padding: '0 1rem' }}>
            {activity.map((ev, i) => {
              const href = linkFor(ev)
              const row = (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 0', borderBottom: i < activity.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: ev.dotColor, flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: '0.85rem', color: 'var(--light)' }}>{ev.text}</span>
                  <span style={{ fontSize: '0.72rem', color: 'var(--faint)', flexShrink: 0 }}>{timeAgo(ev.time)}</span>
                </div>
              )
              return href
                ? <Link key={i} to={href} style={{ textDecoration: 'none', display: 'block' }}>{row}</Link>
                : <div key={i}>{row}</div>
            })}
          </div>
        )}
      </div>
    </>
  )
}
