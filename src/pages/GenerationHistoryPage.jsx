import { useEffect, useState } from 'react'
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom'
import { apiFetch } from '../lib/api.js'
import { GenerationRunRow } from './AutomationPage.jsx'
import Icon from '../components/Icon.jsx'

export default function GenerationHistoryPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const mergedOnly = searchParams.get('merged') === 'true'
  const [project, setProject] = useState(null)
  const [runs, setRuns] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { apiFetch(`/projects/${id}`).then(setProject).catch(console.error) }, [id])

  useEffect(() => {
    setLoading(true)
    apiFetch(`/projects/${id}/automation/generation-runs${mergedOnly ? '?merged=true' : ''}`)
      .then(setRuns)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [id, mergedOnly])

  return (
    <>
      <div className="topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button className="back-btn" onClick={() => navigate(-1)} title="Back" aria-label="Back"><Icon name="arrowLeft" size={14} /></button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
            <Link to="/projects" style={{ color: 'var(--muted)', textDecoration: 'none' }}>Projects</Link>
            <span style={{ color: 'var(--muted)' }}>/</span>
            <Link to={`/projects/${id}`} style={{ color: 'var(--muted)', textDecoration: 'none' }}>{project?.name || 'Project'}</Link>
            <span style={{ color: 'var(--muted)' }}>/</span>
            <Link to={`/projects/${id}/automation`} style={{ color: 'var(--muted)', textDecoration: 'none' }}>Automation</Link>
            <span style={{ color: 'var(--muted)' }}>/</span>
            <span className="topbar-title">{mergedOnly ? 'Merged PRs' : 'Generation history'}</span>
          </div>
        </div>
      </div>
      <div className="page-content fade-in">
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}><div className="spinner" /></div>
        ) : runs.length === 0 ? (
          <div className="empty-state">
            <h3>{mergedOnly ? 'No merged PRs yet' : 'No generation runs yet'}</h3>
            <p>{mergedOnly ? 'Once a heal, generate, or move PR is merged, it shows up here.' : 'Use "Generate automated tests" on the Automation page to write a test case with AI.'}</p>
          </div>
        ) : (
          <div className="card" style={{ padding: '0 1rem' }}>
            {runs.map(run => <GenerationRunRow key={run.id} run={run} projectId={id} />)}
          </div>
        )}
      </div>
    </>
  )
}
