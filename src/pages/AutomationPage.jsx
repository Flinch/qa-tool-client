import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { apiFetch } from '../lib/api.js'
import { useToastStore } from '../store/toastStore.jsx'

const API_BASE = import.meta.env.VITE_API_URL || '/api'

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

function SuiteCard({ suite, onRun, running }) {
  const passRate = suite.latest_passed != null && (suite.latest_passed + suite.latest_failed) > 0
    ? Math.round((suite.latest_passed / (suite.latest_passed + suite.latest_failed)) * 100)
    : null

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
        <div>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, color: 'var(--white)' }}>{suite.name}</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>{suite.test_case_count} test case{suite.test_case_count === 1 ? '' : 's'}</div>
        </div>
        {suite.latest_status && <StatusPill status={suite.latest_status} />}
      </div>
      {passRate !== null && (
        <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginBottom: '1rem' }}>
          Last run: <span style={{ color: 'var(--success)' }}>{suite.latest_passed} passed</span>
          {suite.latest_failed > 0 && <>, <span style={{ color: 'var(--danger)' }}>{suite.latest_failed} failed</span></>}
        </div>
      )}
      <button
        className="btn btn-primary btn-sm"
        onClick={() => onRun(suite)}
        disabled={running}
        style={{ width: '100%' }}
      >
        {running ? 'Running…' : 'Run suite'}
      </button>
    </div>
  )
}

function RunRow({ run }) {
  const total = run.total ?? 0
  const passRate = total > 0 ? Math.round((run.passed / total) * 100) : null

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
  const [suites, setSuites] = useState([])
  const [runs, setRuns] = useState([])
  const [loading, setLoading] = useState(true)
  const [triggeringSuiteId, setTriggeringSuiteId] = useState(null)
  const eventSourceRef = useRef(null)

  const load = useCallback(async () => {
    try {
      const [suiteData, runData] = await Promise.all([
        apiFetch(`/projects/${id}/automation/suites`),
        apiFetch(`/projects/${id}/automation/runs`),
      ])
      setSuites(suiteData)
      setRuns(runData)
    } catch (e) {
      console.error(e)
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
    eventSourceRef.current = es

    es.addEventListener('run_completed', () => {
      load()
      setTriggeringSuiteId(null)
    })

    es.onerror = () => {
      // Connection dropped (sleep, network blip) — just let the browser retry;
      // a manual refresh of the page also re-establishes it.
    }

    return () => es.close()
  }, [id, load])

  const runSuite = async (suite) => {
    setTriggeringSuiteId(suite.id)
    try {
      await apiFetch(`/projects/${id}/automation/runs/trigger`, {
        method: 'POST',
        body: JSON.stringify({ suite_id: suite.id }),
      })
      addToast(`${suite.name} run started`)
      load()
    } catch (e) {
      addToast(e.message, 'error')
      setTriggeringSuiteId(null)
    }
  }

  const nightlyRuns = runs.filter(r => r.trigger_type === 'nightly').slice(0, 10)

  return (
    <>
      <div className="topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
          <Link to="/projects" style={{ color: 'var(--muted)', textDecoration: 'none' }}>Projects</Link>
          <span style={{ color: 'var(--muted)' }}>/</span>
          <Link to={`/projects/${id}`} style={{ color: 'var(--muted)', textDecoration: 'none' }}>Project</Link>
          <span style={{ color: 'var(--muted)' }}>/</span>
          <span className="topbar-title">Automation</span>
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
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1rem' }}>
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