import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { apiFetch } from '../lib/api.js'
import Icon from '../components/Icon.jsx'

// Only execution_test_cases views route through here (bugs views link
// straight to /bugs?viewId=... from SavedViewsPage — no ambiguity to
// resolve). This page's whole job is asking the server which execution run
// is currently "latest" so a saved/shared view link never goes stale.
export default function ViewRedirectPage() {
  const { id, viewId } = useParams()
  const navigate = useNavigate()
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    apiFetch(`/projects/${id}/saved-views/${viewId}`)
      .then(async view => {
        if (cancelled) return
        if (view.type !== 'execution_test_cases') {
          navigate(`/projects/${id}/bugs?viewId=${viewId}`, { replace: true })
          return
        }
        try {
          const latest = await apiFetch(`/projects/${id}/execution-runs/latest`)
          if (!cancelled) navigate(`/projects/${id}/executions/${latest.id}?viewId=${viewId}`, { replace: true })
        } catch {
          if (!cancelled) setError('This project has no execution runs yet.')
        }
      })
      .catch(() => { if (!cancelled) setError('This saved view no longer exists.') })
    return () => { cancelled = true }
  }, [id, viewId, navigate])

  return (
    <>
      <div className="topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
          <span className="topbar-title">Opening view…</span>
        </div>
      </div>
      {error ? (
        <div className="page-content">
          <div className="empty-state">
            <Icon name="alertTriangle" size={20} />
            <h3>{error}</h3>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}><div className="spinner" /></div>
      )}
    </>
  )
}
