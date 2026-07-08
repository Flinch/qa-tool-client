import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { apiFetch } from '../lib/api.js'
import { useToastStore } from '../store/toastStore.jsx'

const API_BASE = import.meta.env.VITE_API_URL || '/api'
const POLL_INTERVAL_MS = 4000
const POLL_TIMEOUT_MS = 5 * 60 * 1000

function StatusPill({ status }) {
  const map = {
    completed: { label: 'Completed', color: 'var(--success)' },
    pending: { label: 'Pending', color: 'var(--warning)' },
    running: { label: 'Running', color: 'var(--warning)' },
    failed: { label: 'Failed', color: 'var(--danger)' },
  }
  const s = map[status] || { label: status || 'Unknown', color: 'var(--muted)' }
  return (
    <span style={{
      fontSize: '0.72rem', fontWeight: 600, color: s.color,
      border: `1px solid ${s.color}`, borderRadius: 20, padding: '0.15rem 0.6rem',
    }}>
      {s.label}
    </span>
  )
}

function formatWhen(dateStr) {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now - date
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays === 1) return 'yesterday'
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function SuiteCard({ suite, onRun, running }) {
  const passRate = suite.latest_passed != null && (suite.latest_passed + suite.latest_failed) > 0
    ? Math.round((suite.latest_passed / (suite.latest_passed + suite.latest_failed)) * 100)
    : null

  const isRunning = running || suite.latest_status === 'pending' || suite.latest_status === 'running'

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem', minHeight: '2.7rem' }}>
        <div>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, color: 'var(--white)', lineHeight: 1.25 }}>{suite.name}</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>{suite.test_case_count} test case{suite.test_case_count === 1 ? '' : 's'}</div>
        </div>
        {suite.latest_status && <StatusPill status={suite.latest_status} />}
      </div>

      {suite.latest_completed_at && (
        <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginBottom: '0.3rem' }}>
          Last run {formatWhen(suite.latest_completed_at)}
        </div>
      )}
      {passRate !== null && (
        <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginBottom: '1rem' }}>
          <span style={{ color: 'var(--success)' }}>{suite.latest_passed} passed</span>
          {suite.latest_failed > 0 && <>, <span style={{ color: 'var(--danger)' }}>{suite.latest_failed} failed</span></>}
        </div>
      )}

      <div style={{ marginTop: 'auto' }}>
        {isRunning && (
          <div style={{
            height: '4px', width: '100%', background: 'var(--border)',
            borderRadius: '2px', overflow: 'hidden', marginBottom: '0.6rem', position: 'relative',
          }}>
            <div style={{
              position: 'absolute', top: 0, left: 0, height: '100%', width: '40%',
              background: 'var(--accent)', borderRadius: '2px',
              animation: 'suiteLoaderSlide 1.1s ease-in-out infinite',
            }} />
          </div>
        )}
        <button
          className="btn btn-primary btn-sm"
          onClick={() => onRun(suite)}
          disabled={isRunning}
          style={{ width: '100%' }}
        >
          {isRunning ? 'Running…' : 'Run suite'}
        </button>
      </div>
    </div>
  )
}

function RunRow({ run }) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '1fr auto auto auto auto', gap: '1rem', alignItems: 'center',
      padding: '0.85rem 0', borderBottom: '1px solid var(--border)',
    }}>
      <div>
        <div style={{ color: 'var(--white)', fontSize: '0.88rem', fontWeight: 600 }}>{run.suite_name}</div>
        <div style={{ color: 'var(--muted)', fontSize: '0.76rem' }}>
          {run.trigger_type === 'nightly' ? 'Nightly' : 'Manual'} · {new Date(run.started_at).toLocaleString()}
        </div>
      </div>
      <StatusPill status={run.status} />
      <div style={{ fontSize: '0.82rem', color: 'var(--success)' }}>{run.passed ?? '—'} passed</div>
      <div style={{ fontSize: '0.82rem', color: run.failed > 0 ? 'var(--danger)' : 'var(--muted)' }}>{run.failed ?? '—'} failed</div>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        {run.report_url && (
          <a href={run.report_url} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm">Report</a>
        )}
        {run.github_run_url && (
          <a href={run.github_run_url} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm">CI logs</a>
        )}
      </div>
    </div>
  )
}

export default function AutomationPage() {
  const { id } = useParams()
  const { addToast } = useToastStore()
  const [project, setProject] = useState(null)
  const [suites, setSuites] = useState([])
  const [runs, setRuns] = useState([])
  const [loading, setLoading] = useState(true)
  const [triggeringSuiteId, setTriggeringSuiteId] = useState(null)
  const pollRef = useRef(null)
  const pollStartedAt = useRef(null)

  useEffect(() => { apiFetch(`/projects/${id}`).then(setProject).catch(console.error) }, [id])

  const load = useCallback(async () => {
    try {
      const [suiteData, runData] = await Promise.all([
        apiFetch(`/projects/${id}/automation/suites`),
        apiFetch(`/projects/${id}/automation/runs`),
      ])
      setSuites(suiteData)
      setRuns(runData)
      return runData
    } catch (e) {
      console.error(e)
      return []
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  // Live updates via SSE — native EventSource can't send Authorization headers,
  // so the token is passed as a query param and verified server-side instead.
  useEffect(() => {
    const token = localStorage.getItem('qa_tool_token')
    if (!token) return

    const url = `${API_BASE}/projects/${id}/automation/runs/stream?token=${encodeURIComponent(token)}`
    const es = new EventSource(url)

    es.addEventListener('run_completed', () => {
      load()
      setTriggeringSuiteId(null)
      stopPolling()
    })

    es.onerror = () => {
      // SSE dropped or never connected (e.g. token issue) — the polling
      // fallback below still catches completion, so this is non-fatal.
    }

    return () => es.close()
  }, [id, load])

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }

  // Fallback: poll while anything is pending/running, in case SSE
  // never connects or drops. Bounded so it can't run forever.
  const startPolling = useCallback(() => {
    stopPolling()
    pollStartedAt.current = Date.now()
    pollRef.current = setInterval(async () => {
      if (Date.now() - pollStartedAt.current > POLL_TIMEOUT_MS) {
        stopPolling()
        addToast('Still waiting on results — check GitHub Actions directly if this persists', 'error')
        return
      }
      const latest = await load()
      const stillInFlight = latest.some(r => r.status === 'pending' || r.status === 'running')
      if (!stillInFlight) {
        stopPolling()
        setTriggeringSuiteId(null)
      }
    }, POLL_INTERVAL_MS)
  }, [load, addToast])

  useEffect(() => () => stopPolling(), [])

  const runSuite = async (suite) => {
    setTriggeringSuiteId(suite.id)
    try {
      await apiFetch(`/projects/${id}/automation/runs/trigger`, {
        method: 'POST',
        body: JSON.stringify({ suite_id: suite.id }),
      })
      addToast(`${suite.name} run started`)
      await load()
      startPolling()
    } catch (e) {
      addToast(e.message, 'error')
      setTriggeringSuiteId(null)
    }
  }

  const nightlyRuns = runs.filter(r => r.trigger_type === 'nightly').slice(0, 10)

  return (
    <>
      <style>{`
  @keyframes suiteLoaderSlide {
    0% { left: -40%; }
    100% { left: 100%; }
  }
`}</style>
      <div className="topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Link to={`/projects/${id}`} className="back-btn" title="Back to project" aria-label="Back to project">←</Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
            <Link to="/projects" style={{ color: 'var(--muted)', textDecoration: 'none' }}>Projects</Link>
            <span style={{ color: 'var(--muted)' }}>/</span>
            <Link to={`/projects/${id}`} style={{ color: 'var(--muted)', textDecoration: 'none' }}>{project?.name || 'Project'}</Link>
            <span style={{ color: 'var(--muted)' }}>/</span>
            <span className="topbar-title">Automation</span>
          </div>
        </div>
      </div>
      <div className="page-content fade-in">
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}><div className="spinner" /></div>
        ) : (
          <>
            <div style={{ marginBottom: '2rem' }}>
              <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '1.1rem', color: 'var(--white)', marginBottom: '1rem' }}>Suites</h2>
              {suites.length === 0 ? (
                <div className="empty-state"><h3>No automation suites yet</h3><p>Suites are created via the API for now — ask your engineer to set one up.</p></div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1rem', alignItems: 'stretch' }}>
                  {suites.map(s => (
                    <SuiteCard key={s.id} suite={s} onRun={runSuite} running={triggeringSuiteId === s.id} />
                  ))}
                </div>
              )}
            </div>

            <div style={{ marginBottom: '2rem' }}>
              <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '1.1rem', color: 'var(--white)', marginBottom: '1rem' }}>Recent executions</h2>
              {runs.length === 0 ? (
                <div className="empty-state"><h3>No runs yet</h3><p>Trigger a suite above to see results here.</p></div>
              ) : (
                <div className="card" style={{ padding: '0 1rem' }}>
                  {runs.map(r => <RunRow key={r.id} run={r} />)}
                </div>
              )}
            </div>

            <div>
              <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '1.1rem', color: 'var(--white)', marginBottom: '1rem' }}>Nightly builds</h2>
              {nightlyRuns.length === 0 ? (
                <div className="empty-state"><h3>No nightly runs yet</h3><p>These populate automatically once the scheduled workflow runs.</p></div>
              ) : (
                <div className="card" style={{ padding: '0 1rem' }}>
                  {nightlyRuns.map(r => <RunRow key={r.id} run={r} />)}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </>
  )
}