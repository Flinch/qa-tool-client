import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { apiFetch } from '../lib/api.js'
import { useToastStore } from '../store/toastStore.jsx'
import { useAuth } from '../store/AuthContext.jsx'
import { describeRunPhase } from '../lib/runPhase.js'
import { suggestBatches } from '../lib/batchSuggestion.js'
import Icon from '../components/Icon.jsx'

const API_BASE = import.meta.env.VITE_API_URL || '/api'
const POLL_INTERVAL_MS = 4000
const POLL_TIMEOUT_MS = 5 * 60 * 1000
const SSE_MAX_CONSECUTIVE_ERRORS = 3
const MAX_BATCH_SIZE = 3
// The five non-terminal statuses generation_runs.status can be in, per the
// server's CHECK constraint (migrate.js) — used both to know when to keep
// polling and to render a phase label/index.
const GENERATION_PHASES = ['pending', 'exploring', 'generating', 'healing', 'opening_pr']

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
      border: `1px solid ${s.color}`, borderRadius: 0, padding: '0.15rem 0.6rem',
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
  const phase = isRunning ? describeRunPhase(suite.latest_status || 'pending', suite.latest_started_at) : null

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem', minHeight: '2.7rem' }}>
        <div>
          <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 700, color: 'var(--white)', lineHeight: 1.25 }}>{suite.name}</div>
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
      {suite.latest_status === 'failed' && suite.latest_error_message && (
        <div style={{ fontSize: '0.76rem', color: 'var(--danger)', background: 'rgba(193,68,58,0.08)', border: '1px solid rgba(193,68,58,0.25)', padding: '0.5rem 0.65rem', marginBottom: '0.75rem', lineHeight: 1.4 }}>
          {suite.latest_error_message}
        </div>
      )}

      <div style={{ marginTop: 'auto' }}>
        {isRunning && (
          <>
            <div style={{
              height: '4px', width: '100%', background: 'var(--border)',
              borderRadius: 0, overflow: 'hidden', marginBottom: '0.4rem', position: 'relative',
            }}>
              <div style={{
                position: 'absolute', top: 0, left: 0, height: '100%', width: '40%',
                background: 'var(--accent)', borderRadius: 0,
                animation: 'suiteLoaderSlide 1.1s ease-in-out infinite',
              }} />
            </div>
            {phase && (
              <div style={{ fontSize: '0.74rem', color: 'var(--muted)', marginBottom: '0.6rem' }}>{phase}</div>
            )}
          </>
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
  const isRunning = run.status === 'pending' || run.status === 'running'
  const phase = isRunning ? describeRunPhase(run.status, run.started_at) : null

  return (
    <div style={{ padding: '0.85rem 0', borderBottom: '1px solid var(--border)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto auto', gap: '1rem', alignItems: 'center' }}>
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
      {phase && <div style={{ fontSize: '0.74rem', color: 'var(--muted)', marginTop: '0.4rem' }}>{phase}</div>}
      {run.status === 'failed' && run.error_message && (
        <div style={{ fontSize: '0.76rem', color: 'var(--danger)', marginTop: '0.4rem' }}>{run.error_message}</div>
      )}
    </div>
  )
}

function GenerateTestsModal({ projectId, suites, onClose, onDispatched }) {
  const { addToast } = useToastStore()
  const [candidates, setCandidates] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedIds, setSelectedIds] = useState([])
  const [suiteId, setSuiteId] = useState(suites[0]?.id ? String(suites[0].id) : '')
  const [step, setStep] = useState('select') // 'select' | 'confirm'
  const [dispatching, setDispatching] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)

  useEffect(() => {
    apiFetch(`/projects/${projectId}/test-cases`)
      .then(tcs => setCandidates(tcs.filter(tc => tc.automation_candidate)))
      .catch(e => addToast(e.message, 'error'))
      .finally(() => setLoading(false))
  }, [projectId, addToast])

  const toggle = (tcId) => {
    setSelectedIds(ids => {
      if (ids.includes(tcId)) return ids.filter(x => x !== tcId)
      if (ids.length >= MAX_BATCH_SIZE) return ids
      return [...ids, tcId]
    })
  }

  const suggestions = showSuggestions ? suggestBatches(candidates, MAX_BATCH_SIZE) : []
  const applySuggestion = (batch) => {
    setSelectedIds(batch.tcs.map(tc => tc.id))
    setShowSuggestions(false)
  }

  const selected = candidates.filter(tc => selectedIds.includes(tc.id))
  const selectedSuite = suites.find(s => s.id === Number(suiteId))

  const dispatch = async () => {
    setDispatching(true)
    try {
      const run = await apiFetch(`/projects/${projectId}/automation/generate`, {
        method: 'POST',
        body: JSON.stringify({ suite_id: Number(suiteId), test_case_ids: selectedIds }),
      })
      addToast('Test generation started')
      onDispatched(run)
      onClose()
    } catch (e) {
      addToast(e.message, 'error')
    } finally {
      setDispatching(false)
    }
  }

  if (step === 'confirm') {
    return (
      <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
        <div className="modal" style={{ maxWidth: 520 }}>
          <div className="modal-title">Confirm test generation</div>

          <div style={{ marginBottom: '1rem' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '0.5rem' }}>
              Test cases ({selected.length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {selected.map(tc => (
                <div key={tc.id} style={{ fontSize: '0.85rem', color: 'var(--light)', padding: '0.5rem 0.7rem', background: 'var(--bg2)', border: '1px solid var(--border)' }}>
                  {tc.title}
                </div>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: '1rem', fontSize: '0.85rem', color: 'var(--light)' }}>
            Suite: <strong>{selectedSuite?.name}</strong>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', fontSize: '0.8rem', color: 'var(--muted)', marginBottom: '1rem', lineHeight: 1.6, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 0, padding: '0.6rem 0.85rem' }}>
            <Icon name="zap" size={14} style={{ color: 'var(--accent)', marginTop: '0.1rem', flexShrink: 0 }} />
            <span>
              This dispatches a real CI workflow that uses AI agents to write and open a PR with Playwright tests.
              Rough cost for a batch this size: ~$1.50–$4, depending on complexity — not exact, but a real spend, not a simulation.
            </span>
          </div>

          <div className="modal-footer">
            <button className="btn btn-ghost" onClick={() => setStep('select')} disabled={dispatching}>Back</button>
            <button className="btn btn-primary" onClick={dispatch} disabled={dispatching}>
              {dispatching ? 'Starting...' : 'Confirm & Generate'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 560 }}>
        <div className="modal-title">Generate automated tests</div>

        <div className="form-group">
          <label className="form-label">Suite</label>
          <select className="form-select" value={suiteId} onChange={e => setSuiteId(e.target.value)}>
            {suites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>

        <div className="form-group">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label className="form-label" style={{ marginBottom: 0 }}>Test cases (select up to {MAX_BATCH_SIZE})</label>
            {candidates.length > 1 && (
              <button className="btn btn-ghost btn-sm" onClick={() => setShowSuggestions(s => !s)} type="button">
                {showSuggestions ? 'Hide suggestions' : 'Suggest batches'}
              </button>
            )}
          </div>

          {showSuggestions && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '0.75rem' }}>
              {suggestions.length === 0 ? (
                <div style={{ fontSize: '0.78rem', color: 'var(--muted)', padding: '0.5rem 0.7rem' }}>
                  No multi-TC groupings found — nothing shares a detectable setup step.
                </div>
              ) : suggestions.map((batch, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => applySuggestion(batch)}
                  style={{
                    textAlign: 'left', padding: '0.55rem 0.75rem', cursor: 'pointer',
                    background: 'rgba(184,70,31,0.08)', border: '1px solid var(--border)', borderRadius: 0,
                  }}
                >
                  <div style={{ fontSize: '0.82rem', color: 'var(--light)', marginBottom: '0.2rem' }}>
                    {batch.tcs.map(tc => tc.title).join(', ')}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>{batch.reason}</div>
                </button>
              ))}
              <div style={{ fontSize: '0.7rem', color: 'var(--muted)', lineHeight: 1.5 }}>
                Heuristic only — recognizes today's known shared setup steps (e.g. ticket creation), not a general
                similarity model. Click a suggestion to select it, then review before confirming.
              </div>
            </div>
          )}

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '1.5rem' }}><div className="spinner" /></div>
          ) : candidates.length === 0 ? (
            <div style={{ fontSize: '0.82rem', color: 'var(--muted)', padding: '0.75rem', background: 'var(--bg2)', border: '1px solid var(--border)', textAlign: 'center' }}>
              No test cases are flagged as automation candidates yet. Flag some on the Test Cases page first.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: 280, overflowY: 'auto' }}>
              {candidates.map(tc => {
                const checked = selectedIds.includes(tc.id)
                const disabled = !checked && selectedIds.length >= MAX_BATCH_SIZE
                return (
                  <label
                    key={tc.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.55rem 0.75rem',
                      background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 0,
                      cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
                    }}
                  >
                    <input type="checkbox" checked={checked} disabled={disabled} onChange={() => toggle(tc.id)} />
                    <span style={{ fontSize: '0.85rem', color: 'var(--light)' }}>{tc.title}</span>
                  </label>
                )
              })}
            </div>
          )}
          {selectedIds.length >= MAX_BATCH_SIZE && (
            <div style={{ fontSize: '0.74rem', color: 'var(--muted)', marginTop: '0.4rem' }}>
              Maximum of {MAX_BATCH_SIZE} test cases per batch — CI has a wall-clock budget and larger batches risk not finishing.
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-primary"
            onClick={() => setStep('confirm')}
            disabled={selectedIds.length === 0 || !suiteId}
          >
            Review & Continue
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AutomationPage() {
  const { id } = useParams()
  const { addToast } = useToastStore()
  const { user } = useAuth()
  const isClient = user?.role === 'client'
  const [project, setProject] = useState(null)
  const [suites, setSuites] = useState([])
  const [runs, setRuns] = useState([])
  const [loading, setLoading] = useState(true)
  const [triggeringSuiteId, setTriggeringSuiteId] = useState(null)
  const [showGenerateTests, setShowGenerateTests] = useState(false)
  const [activeGenerationRun, setActiveGenerationRun] = useState(null)
  const pollRef = useRef(null)
  const pollStartedAt = useRef(null)
  const sseErrorCount = useRef(0)
  const triggeredSuiteId = useRef(null)
  const genPollRef = useRef(null)
  const genPollStartedAt = useRef(null)

  useEffect(() => { apiFetch(`/projects/${id}`).then(setProject).catch(console.error) }, [id])

  // Throws on failure instead of swallowing it, so callers (the poll loop in
  // particular) can tell "fetch failed" apart from "nothing in flight" —
  // those used to look identical and let a network error masquerade as a
  // completed run.
  const load = useCallback(async () => {
    try {
      const [suiteData, runData] = await Promise.all([
        apiFetch(`/projects/${id}/automation/suites`),
        apiFetch(`/projects/${id}/automation/runs`),
      ])
      setSuites(suiteData)
      setRuns(runData)
      return runData
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load().catch(e => addToast(e.message, 'error')) }, [load])

  // Live updates via SSE — native EventSource can't send Authorization headers,
  // so the token is passed as a query param and verified server-side instead.
  useEffect(() => {
    const token = localStorage.getItem('qa_tool_token')
    if (!token) return

    const url = `${API_BASE}/projects/${id}/automation/runs/stream?token=${encodeURIComponent(token)}`
    const es = new EventSource(url)

    es.addEventListener('connected', () => { sseErrorCount.current = 0 })

    es.addEventListener('run_completed', () => {
      sseErrorCount.current = 0
      load().catch(e => addToast(e.message, 'error'))
      setTriggeringSuiteId(null)
      stopPolling()
    })

    // Broadcast/subscribe are keyed only by project id, not event name or
    // route (see sse.js) — this same connection already receives these two
    // events, no separate stream needed.
    es.addEventListener('generation_progress', (e) => {
      sseErrorCount.current = 0
      const data = JSON.parse(e.data)
      setActiveGenerationRun(run => run && run.id === data.generation_run_id ? { ...run, status: data.status } : run)
    })

    es.addEventListener('generation_completed', (e) => {
      sseErrorCount.current = 0
      const data = JSON.parse(e.data)
      setActiveGenerationRun(run => (run && run.id === data.generation_run_id) ? null : run)
      stopGenPolling()
      // The event only carries the run id, not the final status/pr_url — go
      // get the real row rather than guess at what to toast.
      apiFetch(`/projects/${id}/automation/generation-runs`)
        .then(runs => {
          const finished = runs.find(r => r.id === data.generation_run_id)
          if (!finished) return
          if (finished.status === 'completed') {
            addToast(finished.pr_url ? 'Test generation complete — PR is ready for review' : 'Test generation complete')
          } else if (finished.status === 'failed') {
            addToast(finished.error_message || 'Test generation failed', 'error')
          }
        })
        .catch(e => addToast(e.message, 'error'))
    })

    es.onerror = () => {
      // EventSource auto-reconnects forever by default. The polling fallback
      // already covers transient drops, so give up on SSE specifically after
      // a few failures in a row rather than retrying indefinitely.
      sseErrorCount.current += 1
      if (sseErrorCount.current >= SSE_MAX_CONSECUTIVE_ERRORS) {
        es.close()
      }
    }

    return () => es.close()
  }, [id, load, addToast])

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }

  // Fallback: poll while anything is pending/running, in case SSE
  // never connects or drops. Bounded so it can't run forever, and a real
  // fetch error stops the loop with a visible toast rather than being
  // mistaken for the run finishing.
  const startPolling = useCallback(() => {
    stopPolling()
    pollStartedAt.current = Date.now()
    pollRef.current = setInterval(async () => {
      if (Date.now() - pollStartedAt.current > POLL_TIMEOUT_MS) {
        stopPolling()
        setTriggeringSuiteId(null)
        addToast('Still waiting on results — check GitHub Actions directly if this persists', 'error')
        return
      }
      let latest
      try {
        latest = await load()
      } catch (e) {
        stopPolling()
        setTriggeringSuiteId(null)
        addToast(`Lost connection while watching the run: ${e.message}`, 'error')
        return
      }
      const stillInFlight = latest.some(r => r.status === 'pending' || r.status === 'running')
      if (!stillInFlight) {
        stopPolling()
        setTriggeringSuiteId(null)
        const triggeredRun = latest.find(r => r.suite_id === triggeredSuiteId.current)
        if (triggeredRun?.status === 'failed' && triggeredRun.error_message) {
          addToast(`${triggeredRun.suite_name}: ${triggeredRun.error_message}`, 'error')
        }
      }
    }, POLL_INTERVAL_MS)
  }, [load, addToast])

  useEffect(() => () => stopPolling(), [])

  const stopGenPolling = () => {
    if (genPollRef.current) {
      clearInterval(genPollRef.current)
      genPollRef.current = null
    }
  }

  // Same bounded-polling-fallback shape as suite runs (startPolling above),
  // against GET /generation-runs instead, in case SSE never connects or drops.
  const startGenPolling = useCallback((runId) => {
    stopGenPolling()
    genPollStartedAt.current = Date.now()
    genPollRef.current = setInterval(async () => {
      if (Date.now() - genPollStartedAt.current > POLL_TIMEOUT_MS) {
        stopGenPolling()
        setActiveGenerationRun(null)
        addToast('Still waiting on generation results — check GitHub Actions directly if this persists', 'error')
        return
      }
      let latest
      try {
        latest = await apiFetch(`/projects/${id}/automation/generation-runs`)
      } catch (e) {
        stopGenPolling()
        setActiveGenerationRun(null)
        addToast(`Lost connection while watching test generation: ${e.message}`, 'error')
        return
      }
      const run = latest.find(r => r.id === runId)
      if (!run || !GENERATION_PHASES.includes(run.status)) {
        stopGenPolling()
        setActiveGenerationRun(null)
        if (run?.status === 'completed') addToast(run.pr_url ? 'Test generation complete — PR is ready for review' : 'Test generation complete')
        else if (run?.status === 'failed') addToast(run.error_message || 'Test generation failed', 'error')
        return
      }
      setActiveGenerationRun(r => (r && r.id === runId) ? { ...r, status: run.status } : r)
    }, POLL_INTERVAL_MS)
  }, [id, addToast])

  useEffect(() => () => stopGenPolling(), [])

  const handleGenerationDispatched = (run) => {
    setActiveGenerationRun({ id: run.id, status: run.status })
    startGenPolling(run.id)
  }

  const runSuite = async (suite) => {
    setTriggeringSuiteId(suite.id)
    triggeredSuiteId.current = suite.id
    try {
      await apiFetch(`/projects/${id}/automation/runs/trigger`, {
        method: 'POST',
        body: JSON.stringify({ suite_id: suite.id }),
      })
      addToast(`${suite.name} run started`)
      await load().catch(e => addToast(e.message, 'error'))
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
          <Link to={`/projects/${id}`} className="back-btn" title="Back to project" aria-label="Back to project"><Icon name="arrowLeft" size={14} /></Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
            <Link to="/projects" style={{ color: 'var(--muted)', textDecoration: 'none' }}>Projects</Link>
            <span style={{ color: 'var(--muted)' }}>/</span>
            <Link to={`/projects/${id}`} style={{ color: 'var(--muted)', textDecoration: 'none' }}>{project?.name || 'Project'}</Link>
            <span style={{ color: 'var(--muted)' }}>/</span>
            <span className="topbar-title">Automation</span>
          </div>
        </div>
        {!isClient && (
          <div className="topbar-actions" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {activeGenerationRun && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', minWidth: 140 }}>
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{ width: `${((GENERATION_PHASES.indexOf(activeGenerationRun.status) + 1) / GENERATION_PHASES.length) * 100}%` }}
                  />
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--muted)', textAlign: 'right' }}>
                  {activeGenerationRun.status === 'pending' ? 'Starting…'
                    : activeGenerationRun.status === 'exploring' ? 'Exploring the app…'
                    : activeGenerationRun.status === 'generating' ? 'Writing tests…'
                    : activeGenerationRun.status === 'healing' ? 'Healing failures…'
                    : 'Opening PR…'}
                </div>
              </div>
            )}
            <button className="btn btn-primary btn-sm" onClick={() => setShowGenerateTests(true)} disabled={!!activeGenerationRun}>
              <Icon name="zap" size={13} /> Generate automated tests
            </button>
          </div>
        )}
      </div>
      <div className="page-content fade-in">
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}><div className="spinner" /></div>
        ) : isClient ? (
          suites.length === 0 ? (
            <div className="empty-state"><h3>No automation suites yet</h3></div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {suites.map(s => {
                const suiteRuns = runs.filter(r => r.suite_id === s.id)
                return (
                  <div key={s.id} className="card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                      <div>
                        <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 700, color: 'var(--white)' }}>{s.name}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>{s.test_case_count} test case{s.test_case_count === 1 ? '' : 's'}</div>
                      </div>
                      {s.latest_status && <StatusPill status={s.latest_status} />}
                    </div>
                    {suiteRuns.length === 0 ? (
                      <div style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>No runs yet for this suite.</div>
                    ) : (
                      <div>{suiteRuns.map(r => <RunRow key={r.id} run={r} />)}</div>
                    )}
                  </div>
                )
              })}
            </div>
          )
        ) : (
          <>
            <div style={{ marginBottom: '2rem' }}>
              <h2 style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: '1.1rem', color: 'var(--white)', marginBottom: '1rem' }}>Suites</h2>
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
              <h2 style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: '1.1rem', color: 'var(--white)', marginBottom: '1rem' }}>Recent executions</h2>
              {runs.length === 0 ? (
                <div className="empty-state"><h3>No runs yet</h3><p>Trigger a suite above to see results here.</p></div>
              ) : (
                <div className="card" style={{ padding: '0 1rem' }}>
                  {runs.map(r => <RunRow key={r.id} run={r} />)}
                </div>
              )}
            </div>

            <div>
              <h2 style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: '1.1rem', color: 'var(--white)', marginBottom: '1rem' }}>Nightly builds</h2>
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

      {showGenerateTests && (
        <GenerateTestsModal
          projectId={id}
          suites={suites}
          onClose={() => setShowGenerateTests(false)}
          onDispatched={handleGenerationDispatched}
        />
      )}
    </>
  )
}