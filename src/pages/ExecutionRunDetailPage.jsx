import { Fragment, useEffect, useState, useCallback, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useSwipeable } from 'react-swipeable'
import { apiFetch } from '../lib/api.js'
import { useToastStore } from '../store/toastStore.jsx'
import { useAuth } from '../store/AuthContext.jsx'
import { LogBugModal } from './TestCasesPage.jsx'
import { RunStatusBadge } from './ExecutionRunsPage.jsx'
import { generateExecutionReportPdf } from '../lib/executionReport.js'

const API_BASE = import.meta.env.VITE_API_URL || '/api'
const POLL_INTERVAL_MS = 4000
const POLL_TIMEOUT_MS = 5 * 60 * 1000

const TYPE_LABELS = { functional: 'Functional', integration: 'Integration', e2e: 'E2E' }
const STATUS_LABELS = { pass: 'Pass', fail: 'Fail', not_run: 'Not run', blocked: 'Blocked' }

function StatusPill({ status }) {
  const map = {
    completed: { label: 'Completed', color: 'var(--success)' },
    pending: { label: 'Pending', color: 'var(--warning)' },
    running: { label: 'Running', color: 'var(--warning)' },
    failed: { label: 'Failed', color: 'var(--danger)' },
  }
  const s = map[status] || { label: status || 'Unknown', color: 'var(--muted)' }
  return (
    <span style={{ fontSize: '0.72rem', fontWeight: 600, color: s.color, border: `1px solid ${s.color}`, borderRadius: 20, padding: '0.15rem 0.6rem' }}>
      {s.label}
    </span>
  )
}

function SwipeCard({ etc, onMark, onLogBug }) {
  const [dragX, setDragX] = useState(0)
  const handlers = useSwipeable({
    onSwiping: (e) => setDragX(e.deltaX),
    onSwipedLeft: () => { setDragX(0); onMark('fail') },
    onSwipedRight: () => { setDragX(0); onMark('pass') },
    onSwiped: () => setDragX(0),
    trackMouse: true,
  })

  const tint = dragX > 0
    ? `rgba(34,197,94,${Math.min(Math.abs(dragX) / 200, 0.35)})`
    : dragX < 0
    ? `rgba(239,68,68,${Math.min(Math.abs(dragX) / 200, 0.35)})`
    : 'transparent'

  return (
    <div
      {...handlers}
      className="swipe-card"
      style={{
        transform: `translateX(${dragX}px) rotate(${dragX / 24}deg)`,
        boxShadow: `0 12px 32px rgba(0,0,0,0.35), inset 0 0 0 999px ${tint}`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <span className={`badge badge-${etc.type}`}>{TYPE_LABELS[etc.type]}</span>
          {etc.bug_count > 0 && <span style={{ fontSize: '0.78rem', color: 'var(--danger)', fontWeight: 600 }}>🐛 {etc.bug_count}</span>}
        </div>
        <span
          className={`badge badge-${etc.status === 'not_run' ? 'not-run' : etc.status}`}
          style={{ fontSize: '0.82rem', fontWeight: 700, padding: '0.35rem 0.85rem', flexShrink: 0 }}
        >
          {STATUS_LABELS[etc.status]}
        </span>
      </div>
      <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '1.05rem', fontWeight: 700, color: 'var(--white)', marginBottom: '1rem', lineHeight: 1.3 }}>
        {etc.title}
      </h2>
      {etc.steps?.length > 0 && (
        <div style={{ marginBottom: '1.1rem' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '0.5rem' }}>Steps</div>
          <ol style={{ paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            {etc.steps.map((step, i) => <li key={i} style={{ fontSize: '0.86rem', color: 'var(--light)', lineHeight: 1.5 }}>{step}</li>)}
          </ol>
        </div>
      )}
      {etc.expected && (
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.7rem 0.9rem' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '0.3rem' }}>Expected result</div>
          <div style={{ fontSize: '0.86rem', color: 'var(--light)', lineHeight: 1.5 }}>{etc.expected}</div>
        </div>
      )}
      <button className="btn btn-ghost btn-sm" style={{ marginTop: '1rem' }} onClick={onLogBug}>🐛 Log bug</button>
    </div>
  )
}

function ExecutionSuiteCard({ suite, onRun, running, readOnly }) {
  const isRunning = running || suite.latest_status === 'pending' || suite.latest_status === 'running'
  const hasResult = suite.total != null

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, color: 'var(--white)' }}>{suite.suite_name}</div>
        {suite.latest_status && <StatusPill status={suite.latest_status} />}
      </div>
      {hasResult && (
        <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginBottom: '0.75rem' }}>
          <span style={{ color: 'var(--success)' }}>{suite.passed} passed</span>
          {suite.failed > 0 && <>, <span style={{ color: 'var(--danger)' }}>{suite.failed} failed</span></>}
        </div>
      )}
      {(suite.report_url || suite.github_run_url) && (
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
          {suite.report_url && <a href={suite.report_url} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm">Report</a>}
          {suite.github_run_url && <a href={suite.github_run_url} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm">CI logs</a>}
        </div>
      )}
      <div style={{ marginTop: 'auto' }}>
        {isRunning && (
          <div style={{ height: '4px', width: '100%', background: 'var(--border)', borderRadius: '2px', overflow: 'hidden', marginBottom: '0.6rem', position: 'relative' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, height: '100%', width: '40%', background: 'var(--accent)', borderRadius: '2px', animation: 'suiteLoaderSlide 1.1s ease-in-out infinite' }} />
          </div>
        )}
        {!readOnly && (
          <button className="btn btn-primary btn-sm" onClick={() => onRun(suite.suite_id)} disabled={isRunning} style={{ width: '100%' }}>
            {isRunning ? 'Running…' : 'Run suite'}
          </button>
        )}
      </div>
    </div>
  )
}

export default function ExecutionRunDetailPage() {
  const { id, runId } = useParams()
  const { addToast } = useToastStore()
  const { user } = useAuth()
  const isClient = user?.role === 'client'
  const [project, setProject] = useState(null)
  const [run, setRun] = useState(null)
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState('swipe')
  const [statusFilter, setStatusFilter] = useState('all')
  const [cardIndex, setCardIndex] = useState(0)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [expandedIds, setExpandedIds] = useState(new Set())
  const [logBugFor, setLogBugFor] = useState(null)
  const [triggeringSuiteId, setTriggeringSuiteId] = useState(null)
  const [allBugs, setAllBugs] = useState([])
  const pollRef = useRef(null)
  const pollStartedAt = useRef(null)

  const load = useCallback(async () => {
    try {
      const r = await apiFetch(`/projects/${id}/execution-runs/${runId}`)
      setRun(r)
      return r
    } catch (e) {
      addToast(e.message, 'error')
      return null
    } finally {
      setLoading(false)
    }
  }, [id, runId])

  useEffect(() => {
    apiFetch(`/projects/${id}`).then(setProject).catch(console.error)
    apiFetch(`/projects/${id}/bugs`).then(setAllBugs).catch(console.error)
    load()
  }, [id, runId, load])

  // Live updates for automation suites triggered from this run — same SSE
  // channel + poll fallback the Automation page uses.
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
    es.onerror = () => {}
    return () => es.close()
  }, [id, load])

  const stopPolling = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
  }
  const startPolling = useCallback(() => {
    stopPolling()
    pollStartedAt.current = Date.now()
    pollRef.current = setInterval(async () => {
      if (Date.now() - pollStartedAt.current > POLL_TIMEOUT_MS) {
        stopPolling()
        addToast('Still waiting on suite results — check GitHub Actions directly if this persists', 'error')
        return
      }
      const latest = await load()
      const stillRunning = latest?.suites.some(s => s.latest_status === 'pending' || s.latest_status === 'running')
      if (!stillRunning) { stopPolling(); setTriggeringSuiteId(null) }
    }, POLL_INTERVAL_MS)
  }, [load, addToast])
  useEffect(() => () => stopPolling(), [])

  useEffect(() => { setCardIndex(0) }, [statusFilter])

  const markSingle = async (etcId, status) => {
    try {
      const updated = await apiFetch(`/projects/${id}/execution-runs/${runId}/test-cases/${etcId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      })
      setRun(r => ({
        ...r,
        status: r.status === 'not_started' ? 'in_progress' : r.status,
        test_cases: r.test_cases.map(tc => tc.execution_test_case_id === etcId ? { ...tc, status: updated.status } : tc),
      }))
    } catch (e) {
      addToast(e.message, 'error')
    }
  }

  const markBulk = async (ids, status) => {
    try {
      await apiFetch(`/projects/${id}/execution-runs/${runId}/test-cases/bulk`, {
        method: 'PATCH',
        body: JSON.stringify({ ids, status }),
      })
      const count = ids === 'all' ? run.test_cases.length : ids.length
      addToast(`Marked ${count} test case${count === 1 ? '' : 's'} as ${status}`)
      setSelectedIds(new Set())
      await load()
    } catch (e) {
      addToast(e.message, 'error')
    }
  }

  const runSuite = async (suiteId) => {
    setTriggeringSuiteId(suiteId)
    try {
      await apiFetch(`/projects/${id}/execution-runs/${runId}/suites/${suiteId}/run`, { method: 'POST' })
      addToast('Suite run started')
      await load()
      startPolling()
    } catch (e) {
      addToast(e.message, 'error')
      setTriggeringSuiteId(null)
    }
  }

  const completeRun = async () => {
    try {
      const updated = await apiFetch(`/projects/${id}/execution-runs/${runId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'completed' }),
      })
      setRun(r => ({ ...r, status: updated.status, completed_at: updated.completed_at }))
      addToast('Execution marked complete')
    } catch (e) {
      addToast(e.message, 'error')
    }
  }

  const openLogBug = (etc) => setLogBugFor({
    id: etc.test_case_id,
    execution_test_case_id: etc.execution_test_case_id,
    title: etc.title,
    steps: etc.steps,
    expected: etc.expected,
  })

  const downloadReport = () => {
    const runBugs = allBugs.filter(b => b.execution_run_id === Number(runId))
    generateExecutionReportPdf({ run, project, bugs: runBugs })
  }

  const handleSwipeMark = async (status) => {
    if (!run) return
    const filtered = statusFilter === 'all' ? run.test_cases : run.test_cases.filter(tc => tc.status === statusFilter)
    const current = filtered[cardIndex]
    if (!current) return
    await markSingle(current.execution_test_case_id, status)
    setCardIndex(i => Math.min(i + 1, filtered.length))
  }

  const toggleSelected = (etcId) => setSelectedIds(s => {
    const next = new Set(s)
    next.has(etcId) ? next.delete(etcId) : next.add(etcId)
    return next
  })

  const toggleExpanded = (etcId) => setExpandedIds(s => {
    const next = new Set(s)
    next.has(etcId) ? next.delete(etcId) : next.add(etcId)
    return next
  })

  if (loading) return (
    <>
      <div className="topbar"><span className="topbar-title">Execution</span></div>
      <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}><div className="spinner" /></div>
    </>
  )

  if (!run) return (
    <>
      <div className="topbar"><span className="topbar-title">Execution</span></div>
      <div className="page-content"><div className="empty-state"><h3>Execution run not found</h3></div></div>
    </>
  )

  const total = run.test_cases.length
  const counts = {
    pass: run.test_cases.filter(t => t.status === 'pass').length,
    fail: run.test_cases.filter(t => t.status === 'fail').length,
    blocked: run.test_cases.filter(t => t.status === 'blocked').length,
    not_run: run.test_cases.filter(t => t.status === 'not_run').length,
  }
  const executedCount = total - counts.not_run
  const progressPct = total > 0 ? Math.round((executedCount / total) * 100) : 0
  const effectiveMode = isClient ? 'list' : mode
  const filteredTestCases = statusFilter === 'all' ? run.test_cases : run.test_cases.filter(tc => tc.status === statusFilter)
  const filteredTotal = filteredTestCases.length
  const currentCard = filteredTestCases[cardIndex]
  const STATUS_DOT_COLOR = { pass: 'var(--success)', fail: 'var(--danger)', blocked: 'var(--warning)', not_run: 'var(--border2)' }

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
          <Link to={`/projects/${id}/executions`} className="back-btn" title="Back to executions" aria-label="Back to executions">←</Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
            <Link to="/projects" style={{ color: 'var(--muted)', textDecoration: 'none' }}>Projects</Link>
            <span style={{ color: 'var(--muted)' }}>/</span>
            <Link to={`/projects/${id}`} style={{ color: 'var(--muted)', textDecoration: 'none' }}>{project?.name || 'Project'}</Link>
            <span style={{ color: 'var(--muted)' }}>/</span>
            <Link to={`/projects/${id}/executions`} style={{ color: 'var(--muted)', textDecoration: 'none' }}>Executions</Link>
            <span style={{ color: 'var(--muted)' }}>/</span>
            <span className="topbar-title">{run.name}</span>
          </div>
        </div>
        <div className="topbar-actions">
          {(!isClient || run.status === 'completed') && (
            <button className="btn btn-ghost btn-sm" onClick={downloadReport}>⬇ Download report</button>
          )}
          {!isClient && run.status !== 'completed' && (
            <button className="btn btn-primary btn-sm" onClick={completeRun}>Mark complete</button>
          )}
        </div>
      </div>

      <div className="page-content fade-in">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
          <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '1.4rem', fontWeight: 700, color: 'var(--white)' }}>{run.name}</h1>
          <RunStatusBadge status={run.status} />
        </div>

        {total > 0 && (
          <>
            <div className="stats-row">
              <div className="stat-card"><div className="stat-num">{total}</div><div className="stat-label">Total</div></div>
              <div className="stat-card"><div className="stat-num" style={{ color: 'var(--success)' }}>{counts.pass}</div><div className="stat-label">Passed</div></div>
              <div className="stat-card"><div className="stat-num" style={{ color: 'var(--danger)' }}>{counts.fail}</div><div className="stat-label">Failed</div></div>
              <div className="stat-card"><div className="stat-num" style={{ color: 'var(--warning)' }}>{counts.blocked}</div><div className="stat-label">Blocked</div></div>
              <div className="stat-card"><div className="stat-num" style={{ color: 'var(--muted)' }}>{counts.not_run}</div><div className="stat-label">Not run</div></div>
            </div>
            <div style={{ marginBottom: '2rem' }}>
              <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginBottom: '0.4rem' }}>Overall run completion — {executedCount} of {total} test cases executed</div>
              <div className="progress-bar" style={{ height: 8 }}>
                <div className="progress-fill" style={{ width: `${progressPct}%` }} />
              </div>
            </div>
          </>
        )}

        <div className="section-header">
          <div className="section-title">Manual test cases</div>
          {!isClient && total > 0 && (
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className={`filter-btn${mode === 'swipe' ? ' active' : ''}`} onClick={() => setMode('swipe')}>Swipe</button>
              <button className={`filter-btn${mode === 'list' ? ' active' : ''}`} onClick={() => setMode('list')}>List</button>
            </div>
          )}
        </div>

        {total > 0 && (
          <div className="filters-row">
            {['all', 'pass', 'fail', 'blocked', 'not_run'].map(f => (
              <button key={f} className={`filter-btn${statusFilter === f ? ' active' : ''}`} onClick={() => setStatusFilter(f)}>
                {f === 'all' ? 'All' : STATUS_LABELS[f]}
              </button>
            ))}
          </div>
        )}

        {total === 0 ? (
          <div className="empty-state"><h3>No manual test cases in this run</h3></div>
        ) : effectiveMode === 'swipe' ? (
          <>
            <div className="swipe-arena">
              <button className="swipe-arrow left" disabled={cardIndex === 0} onClick={() => setCardIndex(i => Math.max(i - 1, 0))} title="Previous">←</button>
              {currentCard ? (
                <SwipeCard
                  key={currentCard.execution_test_case_id}
                  etc={currentCard}
                  onMark={handleSwipeMark}
                  onLogBug={() => openLogBug(currentCard)}
                />
              ) : filteredTotal === 0 ? (
                <div className="empty-state" style={{ maxWidth: 400 }}>
                  <h3>No test cases match this filter</h3>
                  <p>Try a different filter above.</p>
                </div>
              ) : (
                <div className="empty-state" style={{ maxWidth: 400 }}>
                  <h3>All caught up</h3>
                  <p>You've gone through every test case in this view.</p>
                  <button className="btn btn-ghost btn-sm" onClick={() => setCardIndex(0)}>Review from start</button>
                </div>
              )}
              <button className="swipe-arrow right" disabled={cardIndex >= filteredTotal} onClick={() => setCardIndex(i => Math.min(i + 1, filteredTotal))} title="Next">→</button>
            </div>
            {currentCard && (
              <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'center', marginBottom: '0.75rem' }}>
                <button className="btn btn-danger btn-sm" onClick={() => handleSwipeMark('fail')}>✕ Fail</button>
                <button className="btn btn-warning btn-sm" onClick={() => handleSwipeMark('blocked')}>⛔ Blocked</button>
                <button className="btn btn-primary btn-sm" onClick={() => handleSwipeMark('pass')}>✓ Pass</button>
              </div>
            )}
            {filteredTotal > 0 && (
              <div style={{ display: 'flex', gap: '4px', justifyContent: 'center', flexWrap: 'wrap', maxWidth: 480, margin: '0 auto 0.5rem' }}>
                {filteredTestCases.map((tc, i) => (
                  <div
                    key={tc.execution_test_case_id}
                    style={{
                      height: 4, width: 16, borderRadius: 2,
                      background: STATUS_DOT_COLOR[tc.status],
                      opacity: i === cardIndex ? 1 : 0.4,
                      transition: 'opacity 0.15s',
                    }}
                  />
                ))}
              </div>
            )}
            <div style={{ textAlign: 'center', fontSize: '0.78rem', color: 'var(--muted)', marginBottom: '1.5rem' }}>
              Test {Math.min(cardIndex + 1, filteredTotal)} of {filteredTotal}
            </div>
          </>
        ) : (
          <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: '1.5rem' }}>
            {filteredTotal === 0 ? (
              <div className="empty-state"><h3>No test cases match this filter</h3><p>Try a different filter above.</p></div>
            ) : (
              <>
                {!isClient && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.85rem 1rem', borderBottom: '1px solid var(--border)', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', color: 'var(--muted)', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={selectedIds.size === filteredTotal && filteredTotal > 0}
                        onChange={() => setSelectedIds(selectedIds.size === filteredTotal ? new Set() : new Set(filteredTestCases.map(t => t.execution_test_case_id)))}
                      />
                      {selectedIds.size > 0 ? `${selectedIds.size} selected` : 'Select all'}
                    </label>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      {selectedIds.size > 0 && (
                        <>
                          <button className="btn btn-danger btn-sm" onClick={() => markBulk([...selectedIds], 'fail')}>Mark selected fail</button>
                          <button className="btn btn-warning btn-sm" onClick={() => markBulk([...selectedIds], 'blocked')}>Mark selected blocked</button>
                          <button className="btn btn-primary btn-sm" onClick={() => markBulk([...selectedIds], 'pass')}>Mark selected pass</button>
                        </>
                      )}
                      <button className="btn btn-ghost btn-sm" onClick={() => markBulk(statusFilter === 'all' ? 'all' : filteredTestCases.map(t => t.execution_test_case_id), 'fail')}>
                        Mark {statusFilter === 'all' ? 'all' : 'visible'} fail
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={() => markBulk(statusFilter === 'all' ? 'all' : filteredTestCases.map(t => t.execution_test_case_id), 'pass')}>
                        Mark {statusFilter === 'all' ? 'all' : 'visible'} pass
                      </button>
                    </div>
                  </div>
                )}
                {filteredTestCases.map(etc => {
                  const expanded = expandedIds.has(etc.execution_test_case_id)
                  return (
                    <Fragment key={etc.execution_test_case_id}>
                      <div className="select-row" style={expanded ? { borderBottom: 'none' } : undefined}>
                        {!isClient && (
                          <input
                            type="checkbox"
                            checked={selectedIds.has(etc.execution_test_case_id)}
                            onChange={() => toggleSelected(etc.execution_test_case_id)}
                          />
                        )}
                        <div
                          onClick={() => toggleExpanded(etc.execution_test_case_id)}
                          style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}
                        >
                          <span style={{ color: 'var(--muted)', fontSize: '0.65rem', display: 'inline-block', transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s', flexShrink: 0 }}>▶</span>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 500, color: 'var(--light)' }}>{etc.title}</div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>
                              {TYPE_LABELS[etc.type]}{etc.bug_count > 0 && ` · 🐛 ${etc.bug_count}`}
                            </div>
                          </div>
                        </div>
                        <span className={`badge badge-${etc.status === 'not_run' ? 'not-run' : etc.status}`}>{STATUS_LABELS[etc.status]}</span>
                        {!isClient && (
                          <div style={{ display: 'flex', gap: '0.35rem' }}>
                            <button className="btn btn-ghost btn-sm" onClick={() => markSingle(etc.execution_test_case_id, 'fail')}>Fail</button>
                            <button className="btn btn-ghost btn-sm" onClick={() => markSingle(etc.execution_test_case_id, 'blocked')}>Blocked</button>
                            <button className="btn btn-ghost btn-sm" onClick={() => markSingle(etc.execution_test_case_id, 'pass')}>Pass</button>
                            <button className="btn btn-ghost btn-sm" onClick={() => openLogBug(etc)}>🐛</button>
                          </div>
                        )}
                      </div>
                      {expanded && (
                        <div style={{ padding: '0 1rem 1rem 2.9rem', borderBottom: '1px solid var(--border)' }}>
                          {etc.steps?.length > 0 && (
                            <div style={{ marginBottom: etc.expected ? '0.85rem' : 0 }}>
                              <div style={{ fontSize: '0.68rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '0.4rem' }}>Steps</div>
                              <ol style={{ paddingLeft: '1.1rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                                {etc.steps.map((step, i) => <li key={i} style={{ fontSize: '0.84rem', color: 'var(--light)', lineHeight: 1.5 }}>{step}</li>)}
                              </ol>
                            </div>
                          )}
                          {etc.expected && (
                            <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.6rem 0.85rem' }}>
                              <div style={{ fontSize: '0.66rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '0.3rem' }}>Expected result</div>
                              <div style={{ fontSize: '0.84rem', color: 'var(--light)', lineHeight: 1.5 }}>{etc.expected}</div>
                            </div>
                          )}
                          {!etc.steps?.length && !etc.expected && (
                            <div style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>No additional details for this test case.</div>
                          )}
                        </div>
                      )}
                    </Fragment>
                  )
                })}
              </>
            )}
          </div>
        )}

        <div className="section-header" style={{ marginTop: '1rem' }}>
          <div className="section-title">Automation suites</div>
        </div>
        {run.suites.length === 0 ? (
          <div className="empty-state"><h3>No automation suites in this run</h3></div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1rem' }}>
            {run.suites.map(s => (
              <ExecutionSuiteCard key={s.execution_suite_id} suite={s} onRun={runSuite} running={triggeringSuiteId === s.suite_id} readOnly={isClient} />
            ))}
          </div>
        )}
      </div>

      {logBugFor && (
        <LogBugModal
          projectId={id}
          testCase={logBugFor}
          executionRunId={Number(runId)}
          onClose={() => setLogBugFor(null)}
          onLogged={(bug) => {
            setAllBugs(bs => [bug, ...bs])
            setRun(r => ({
              ...r,
              test_cases: r.test_cases.map(tc =>
                tc.execution_test_case_id === logBugFor.execution_test_case_id
                  ? { ...tc, bug_count: (tc.bug_count || 0) + 1 }
                  : tc
              ),
            }))
          }}
        />
      )}
    </>
  )
}
