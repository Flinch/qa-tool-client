import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { apiFetch } from '../lib/api.js'
import { useToastStore } from '../store/toastStore.jsx'
import { timeAgo } from '../lib/timeAgo.js'
import { formatStep } from '../lib/steps.js'
import { describeRunPhase } from '../lib/runPhase.js'
import Icon from '../components/Icon.jsx'
import RerunFailedTestsModal from '../components/RerunFailedTestsModal.jsx'
import HealConfirmModal from '../components/HealConfirmModal.jsx'
import DiagnosisModal from '../components/DiagnosisModal.jsx'
import { StatusPill, formatWhen, GenerateTestsModal, GENERATION_PHASES, describeGenerationPhase } from './AutomationPage.jsx'
import { TestCaseRow } from './SuiteTestCasesPage.jsx'
import { tcLabel } from '../lib/testCaseLabel.js'

const API_BASE = import.meta.env.VITE_API_URL || '/api'
const GEN_POLL_INTERVAL_MS = 4000
const GEN_POLL_TIMEOUT_MS = 5 * 60 * 1000
const SSE_MAX_CONSECUTIVE_ERRORS = 3

const REVIEW_STATUS_LABEL = {
  active: 'Active',
  pending_review: 'Pending review',
  healed_pending_review: 'Healed — pending review',
  flagged_regression: 'Flagged regression',
}
const REVIEW_STATUS_COLOR = {
  active: 'var(--muted)',
  pending_review: 'var(--warning)',
  healed_pending_review: 'var(--warning)',
  flagged_regression: 'var(--danger)',
}
const PRIORITY_COLOR = { high: 'var(--danger)', medium: 'var(--warning)', low: 'var(--muted)' }
const RUN_GROUPS_POLL_MS = 4000

// Read-only summary of a test case — steps/expected, and its last error if
// it has one, plus a link through to the full Test Cases page for anyone
// who wants to edit it. Deliberately not the full editable test-case modal:
// this is a quick "what does this test actually do" look from The Lab, not
// a place to manage the test case itself.
function TestCaseDetailModal({ test, projectId, onClose }) {
  const errorMessage = test.last_error_message || test.error_message
  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 560 }}>
        <div className="modal-title">
          {test.linked_test_case_title
            ? tcLabel(test.test_case_id, test.linked_test_case_title)
            : test.tc_title || test.title || test.test_title}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', fontSize: '0.8rem', color: 'var(--accent2)' }}>
          {test.suite_name}
          {test.type && <span style={{ color: 'var(--muted)' }}>· {test.type}</span>}
        </div>

        {test.steps?.length > 0 && (
          <div style={{ marginBottom: '1.25rem' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '0.6rem' }}>Steps</div>
            <ol style={{ paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {test.steps.map((step, i) => (
                <li key={i} style={{ fontSize: '0.88rem', color: 'var(--light)', lineHeight: 1.55 }}>{formatStep(step)}</li>
              ))}
            </ol>
          </div>
        )}

        {test.expected && (
          <div style={{ marginBottom: '1.25rem', background: 'var(--bg2)', border: '1px solid var(--border)', padding: '0.75rem 1rem' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '0.35rem' }}>Expected result</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--light)' }}>{test.expected}</div>
          </div>
        )}

        {errorMessage && (
          <div style={{ marginBottom: '1.25rem' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '0.35rem' }}>Last failure</div>
            <div style={{ fontSize: '0.82rem', color: 'var(--danger)', background: 'rgba(193,68,58,0.08)', border: '1px solid rgba(193,68,58,0.25)', padding: '0.6rem 0.75rem', whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 220, overflowY: 'auto' }}>
              {errorMessage}
            </div>
          </div>
        )}

        <div className="modal-footer">
          {test.test_case_id && (
            <Link to={`/projects/${projectId}/tests?tcId=${test.test_case_id}`} className="btn btn-ghost">
              Open in Test Cases
            </Link>
          )}
          <button className="btn btn-primary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}

// One "grouped run" card — a group of exactly one child renders exactly
// like a plain individual run; N>1 children render as a bundle with an
// aggregate line plus each suite's own dispatch underneath. Every child run
// is a real test_runs row, so it gets the same StatusPill/phase/rerun/
// cancel affordances AutomationPage's RunRow already has.
function RunGroupCard({ group, onRerunChild, onCancelChild }) {
  const runs = group.runs || []
  const anyRunning = runs.some(r => r.status === 'pending' || r.status === 'running')
  const totalPassed = runs.reduce((sum, r) => sum + (r.passed || 0), 0)
  const totalFailed = runs.reduce((sum, r) => sum + (r.failed || 0), 0)

  return (
    <div style={{ padding: '0.85rem 0', borderBottom: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ color: 'var(--white)', fontSize: '0.88rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {group.label || 'Re-run'}
            {runs.length > 1 && (
              <span style={{ marginLeft: '0.5rem', fontSize: '0.68rem', fontWeight: 600, color: 'var(--muted)', border: '1px solid var(--border)', padding: '0.1rem 0.4rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {runs.length} suites
              </span>
            )}
          </div>
          <div style={{ color: 'var(--muted)', fontSize: '0.76rem' }}>{formatWhen(group.created_at)}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {!anyRunning && (
            <>
              <span style={{ fontSize: '0.82rem', color: 'var(--success)' }}>{totalPassed} passed</span>
              <span style={{ fontSize: '0.82rem', color: totalFailed > 0 ? 'var(--danger)' : 'var(--muted)' }}>{totalFailed} failed</span>
            </>
          )}
          {anyRunning && <StatusPill status="running" />}
        </div>
      </div>

      <div style={{ marginTop: '0.6rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {runs.map(run => {
          const isRunning = run.status === 'pending' || run.status === 'running'
          const phase = isRunning ? describeRunPhase(run.status, run.started_at) : null
          const canRerunFailed = !isRunning && run.status === 'completed' && run.failed > 0
          return (
            <div key={run.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', padding: '0.4rem 0.6rem', background: 'var(--bg2)', border: '1px solid var(--border)' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '0.82rem', color: 'var(--light)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{run.suite_name}</div>
                {phase && <div style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>{phase}</div>}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                <StatusPill status={run.status} />
                {isRunning && (
                  <button className="btn btn-ghost btn-sm" onClick={() => onCancelChild(run)} style={{ color: 'var(--danger)', borderColor: 'rgba(193,68,58,0.4)' }}>
                    Cancel
                  </button>
                )}
                {canRerunFailed && (
                  <button className="btn btn-ghost btn-sm" onClick={() => onRerunChild(run)} style={{ color: 'var(--danger)', borderColor: 'rgba(193,68,58,0.4)' }}>
                    {run.failed} failed
                  </button>
                )}
                {run.report_url && <a href={run.report_url} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm">Report</a>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Staff-only counterpart to QualityHealth — engineering-facing signal
// (failing tests, broken environments, PR validation, automation review
// backlog) rather than the client-facing health story. Everything here is
// off-limits to the client role under the AI-visibility rule. Also home to
// what used to be split across the Automation page: diagnostic/grouped
// re-runs (the "Runs" panel) and "The Lab" (the generated-test roster) both
// live here now — Automation itself is suite-runs only.
export default function EngineeringDashboardPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { addToast } = useToastStore()
  const [project, setProject] = useState(null)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [advisorRecs, setAdvisorRecs] = useState(null)
  const [advisorLoading, setAdvisorLoading] = useState(false)

  const [runGroups, setRunGroups] = useState([])
  const [runGroupsLoading, setRunGroupsLoading] = useState(true)
  const [rerunChildRun, setRerunChildRun] = useState(null)
  const pollRef = useRef(null)

  const [labTestCases, setLabTestCases] = useState([])
  const [labLoading, setLabLoading] = useState(true)
  const [labBusyId, setLabBusyId] = useState(null)
  const [labDetail, setLabDetail] = useState(null)
  const [labDiagnose, setLabDiagnose] = useState(null)
  const [labHealConfirm, setLabHealConfirm] = useState(null)
  const [labHealing, setLabHealing] = useState(false)

  // Generation ("Generate automated tests") — moved here from the Automation
  // page, which is suite-runs only now. Same button, same GenerateTestsModal,
  // same generation_runs/generation-events pipeline; only the host page
  // changed.
  const [suites, setSuites] = useState([])
  const [showGenerateTests, setShowGenerateTests] = useState(false)
  const [generationRuns, setGenerationRuns] = useState([])
  const [activeGenerationRun, setActiveGenerationRun] = useState(null)
  const genPollRef = useRef(null)
  const genPollStartedAt = useRef(null)
  const sseErrorCount = useRef(0)

  // Dismissed generation-history chips — per-project, persisted client-side
  // only (no server-side "seen" concept for these, same as the notification
  // bell's own localStorage-backed approach). Dismissing just hides the chip
  // from this list; the underlying generation_runs row and its real history
  // are untouched.
  const dismissedGenRunsKey = `qa_tool_dismissed_gen_runs_project_${id}`
  const [dismissedGenRunIds, setDismissedGenRunIds] = useState(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem(dismissedGenRunsKey) || '[]'))
    } catch {
      return new Set()
    }
  })
  const dismissGenRun = (runId) => {
    setDismissedGenRunIds(prev => {
      const next = new Set(prev)
      next.add(runId)
      try { localStorage.setItem(dismissedGenRunsKey, JSON.stringify([...next])) } catch { /* ignore */ }
      return next
    })
  }

  useEffect(() => { apiFetch(`/projects/${id}`).then(setProject).catch(console.error) }, [id])

  const loadEngineeringHealth = useCallback(() => (
    apiFetch(`/projects/${id}/engineering-health`)
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false))
  ), [id])

  useEffect(() => { setLoading(true); loadEngineeringHealth() }, [loadEngineeringHealth])

  const loadRunGroups = useCallback(() => (
    apiFetch(`/projects/${id}/automation/run-groups`)
      .then(setRunGroups)
      .catch(console.error)
      .finally(() => setRunGroupsLoading(false))
  ), [id])

  useEffect(() => { loadRunGroups() }, [loadRunGroups])

  // Simple polling fallback while anything in the Runs panel is in flight —
  // this is a secondary diagnostic view, not the primary suite-trigger UX
  // (which already has its own SSE connection on the Automation page), so
  // plain polling is enough rather than duplicating that whole setup here.
  const wasRunningRef = useRef(false)
  useEffect(() => {
    const anyRunning = runGroups.some(g => g.runs?.some(r => r.status === 'pending' || r.status === 'running'))
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
    if (anyRunning) pollRef.current = setInterval(loadRunGroups, RUN_GROUPS_POLL_MS)
    // Failing tests / flaky-test pass rates only change once a run actually
    // finishes (they're computed from completed test_run_results, not
    // in-flight ones) — refetch engineering-health once here, on the
    // running->not-running edge, rather than polling it on the same fast
    // 4s cadence as run-groups. It does a live GitHub PR-status check per
    // row, so polling it that often would be wasteful for data that can't
    // have changed yet anyway.
    if (wasRunningRef.current && !anyRunning) loadEngineeringHealth()
    wasRunningRef.current = anyRunning
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [runGroups, loadRunGroups, loadEngineeringHealth])

  const loadLab = useCallback(() => {
    setLabLoading(true)
    return apiFetch(`/projects/${id}/automation/generated-test-cases`)
      .then(data => setLabTestCases(data.testCases))
      .catch(console.error)
      .finally(() => setLabLoading(false))
  }, [id])

  useEffect(() => { loadLab() }, [loadLab])

  useEffect(() => { apiFetch(`/projects/${id}/automation/suites`).then(setSuites).catch(console.error) }, [id])

  const loadGenerationRuns = useCallback(() => (
    apiFetch(`/projects/${id}/automation/generation-runs`)
      .then(setGenerationRuns)
      .catch(console.error)
  ), [id])

  useEffect(() => { loadGenerationRuns() }, [loadGenerationRuns])

  // Live updates via SSE — same project-scoped stream the Automation page
  // uses (broadcast/subscribe are keyed only by project id, see sse.js), so
  // no backend changes were needed to move this here. Native EventSource
  // can't send Authorization headers, so the token goes as a query param and
  // is verified server-side instead.
  useEffect(() => {
    const token = localStorage.getItem('qa_tool_token')
    if (!token) return

    const url = `${API_BASE}/projects/${id}/automation/runs/stream?token=${encodeURIComponent(token)}`
    const es = new EventSource(url)

    es.addEventListener('connected', () => { sseErrorCount.current = 0 })

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
      loadGenerationRuns().then(() => {
        apiFetch(`/projects/${id}/automation/generation-runs`).then(runs => {
          const finished = runs.find(r => r.id === data.generation_run_id)
          if (!finished) return
          if (finished.status === 'completed') {
            addToast(finished.pr_url ? 'Test generation complete — PR is ready for review' : 'Test generation complete')
          } else if (finished.status === 'failed') {
            addToast(finished.error_message || 'Test generation failed', 'error')
          }
        }).catch(() => {})
      })
    })

    es.onerror = () => {
      sseErrorCount.current += 1
      if (sseErrorCount.current >= SSE_MAX_CONSECUTIVE_ERRORS) es.close()
    }

    return () => es.close()
  }, [id, loadGenerationRuns, addToast])

  const stopGenPolling = () => {
    if (genPollRef.current) {
      clearInterval(genPollRef.current)
      genPollRef.current = null
    }
  }

  // Bounded polling fallback in case SSE never connects or drops — same
  // shape as the one this replaced on the Automation page.
  const startGenPolling = useCallback((runId) => {
    stopGenPolling()
    genPollStartedAt.current = Date.now()
    genPollRef.current = setInterval(async () => {
      if (Date.now() - genPollStartedAt.current > GEN_POLL_TIMEOUT_MS) {
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
      setGenerationRuns(latest)
      const run = latest.find(r => r.id === runId)
      if (!run || !GENERATION_PHASES.includes(run.status)) {
        stopGenPolling()
        setActiveGenerationRun(null)
        if (run?.status === 'completed') addToast(run.pr_url ? 'Test generation complete — PR is ready for review' : 'Test generation complete')
        else if (run?.status === 'failed') addToast(run.error_message || 'Test generation failed', 'error')
        return
      }
      setActiveGenerationRun(r => (r && r.id === runId) ? { ...r, status: run.status } : r)
    }, GEN_POLL_INTERVAL_MS)
  }, [id, addToast])

  useEffect(() => () => stopGenPolling(), [])

  const handleGenerationDispatched = (run) => {
    setActiveGenerationRun({ id: run.id, status: run.status })
    startGenPolling(run.id)
    loadGenerationRuns()
  }

  const runAdvisor = async () => {
    setAdvisorLoading(true)
    try {
      const result = await apiFetch(`/projects/${id}/advisor`, { method: 'POST' })
      setAdvisorRecs(result.recommendations)
    } catch (e) {
      addToast(e.message, 'error')
    } finally {
      setAdvisorLoading(false)
    }
  }

  const cancelChildRun = async (run) => {
    try {
      await apiFetch(`/projects/${id}/automation/runs/${run.id}/cancel`, { method: 'POST' })
      addToast('Run cancelled')
      loadRunGroups()
    } catch (e) {
      addToast(e.message, 'error')
    }
  }

  const labRerun = async (tc) => {
    setLabBusyId(tc.id)
    try {
      await apiFetch(`/projects/${id}/automation/runs/${tc.last_run_id}/rerun`, {
        method: 'POST',
        body: JSON.stringify({ result_ids: [tc.last_result_id], source: 'engineering_page' }),
      })
      addToast(`Re-run started for "${tc.linked_test_case_title ? tcLabel(tc.test_case_id, tc.linked_test_case_title) : tc.title}"`)
      loadRunGroups()
    } catch (e) {
      addToast(e.message, 'error')
    } finally {
      setLabBusyId(null)
    }
  }

  const confirmLabHeal = async (context) => {
    if (!labHealConfirm) return
    setLabHealing(true)
    try {
      await apiFetch(`/projects/${id}/automation/runs/${labHealConfirm.runId}/heal`, {
        method: 'POST',
        body: JSON.stringify({ result_id: labHealConfirm.resultId, context: context || undefined }),
      })
      addToast(`Healing started for "${labHealConfirm.title}"`)
      setLabHealConfirm(null)
    } catch (e) {
      addToast(e.message, 'error')
    } finally {
      setLabHealing(false)
    }
  }

  return (
    <>
      <div className="topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button className="back-btn" onClick={() => navigate(-1)} title="Back" aria-label="Back"><Icon name="arrowLeft" size={14} /></button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
            <Link to={`/projects/${id}`} style={{ color: 'var(--muted)', textDecoration: 'none' }}>{project?.name || 'Project'}</Link>
            <span style={{ color: 'var(--muted)' }}>/</span>
            <span className="topbar-title">Engineering</span>
          </div>
        </div>
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
                {describeGenerationPhase(activeGenerationRun.status)}
              </div>
            </div>
          )}
          <button
            className="btn btn-primary btn-sm"
            onClick={() => setShowGenerateTests(true)}
            disabled={!!activeGenerationRun || suites.length === 0}
            title={suites.length === 0 ? 'Create a suite on the Automation page first' : undefined}
          >
            <Icon name="zap" size={13} /> Generate automated tests
          </button>
          <Link to={`/projects/${id}/automation`} className="btn btn-ghost btn-sm"><Icon name="gear" size={13} /> Automation</Link>
          <Link to={`/projects/${id}/bugs`} className="btn btn-ghost btn-sm"><Icon name="bug" size={13} /> Bugs</Link>
          <Link to={`/projects/${id}/tests`} className="btn btn-ghost btn-sm"><Icon name="check" size={13} /> Test cases</Link>
          <Link to={`/projects/${id}/requirements`} className="btn btn-ghost btn-sm"><Icon name="target" size={13} /> Requirements</Link>
        </div>
      </div>
      <div className="page-content fade-in">
        {/* Generation history — recent "Generate automated tests" dispatches,
            each linking straight to its live GitHub Actions run (falling back
            to the PR once one exists) rather than only the full history page. */}
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', padding: '0.75rem 1.25rem', marginBottom: '1.25rem' }}>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.68rem', letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--faint)', flexShrink: 0 }}>
            Generation history
          </span>
          {(() => {
            const visibleRuns = generationRuns.filter(r => !dismissedGenRunIds.has(r.id))
            return visibleRuns.length === 0 ? (
              <span style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>
                {generationRuns.length === 0 ? 'No generation runs yet.' : 'No generation runs to show.'}
              </span>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', flex: 1 }}>
                {visibleRuns.slice(0, 4).map(r => {
                  const isRunning = GENERATION_PHASES.includes(r.status)
                  const color = isRunning ? 'var(--warning)' : r.status === 'failed' ? 'var(--danger)' : 'var(--success)'
                  const label = r.kind === 'heal' ? `Heal: ${r.target_title || r.suite_name}` : r.suite_name
                  const linkUrl = r.github_run_url || r.pr_url
                  const content = (
                    <>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>{label}</span>
                      <span style={{ color: 'var(--faint)' }}>· {isRunning ? describeGenerationPhase(r.status) : timeAgo(r.completed_at || r.started_at)}</span>
                    </>
                  )
                  const chipStyle = { display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.3rem 0.4rem 0.3rem 0.6rem', fontSize: '0.76rem', color: 'var(--light)', border: '1px solid var(--border2)', background: 'var(--card2)' }
                  return (
                    <div key={r.id} style={chipStyle}>
                      {linkUrl ? (
                        <a href={linkUrl} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', textDecoration: 'none', color: 'inherit' }} title="Opens the GitHub Actions run">
                          {content}
                          <Icon name="link" size={10} style={{ color: 'var(--faint)' }} />
                        </a>
                      ) : (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>{content}</span>
                      )}
                      <button
                        onClick={() => dismissGenRun(r.id)}
                        title="Dismiss"
                        aria-label={`Dismiss ${label}`}
                        style={{ display: 'inline-flex', alignItems: 'center', background: 'none', border: 'none', padding: '0.15rem', marginLeft: '0.15rem', cursor: 'pointer', color: 'var(--faint)' }}
                      >
                        <Icon name="x" size={10} />
                      </button>
                    </div>
                  )
                })}
              </div>
            )
          })()}
          <Link to={`/projects/${id}/automation/history`} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.7rem', color: 'var(--muted)', textDecoration: 'none', flexShrink: 0 }}>
            View all →
          </Link>
        </div>

        {/* The Lab sits above everything else, full width — independent of
            the engineering-health fetch below (its own loading state), so it
            shows up first regardless of how long that call takes. */}
        <div className="health-panel" id="the-lab">
          <div className="health-panel-head">
            <div className="health-panel-title">The Lab</div>
            <span style={{ fontSize: '0.76rem', color: 'var(--muted)' }}>Every AI-generated test, its last run, and the option to re-run or heal it</span>
          </div>
          {labLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '1rem' }}><div className="spinner" /></div>
          ) : labTestCases.length === 0 ? (
            <div style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>No AI-generated test cases found yet across any suite in this project.</div>
          ) : (
            <div className="health-panel-body">
              {labTestCases.map(tc => (
                <TestCaseRow
                  key={tc.id}
                  tc={tc}
                  isLab
                  busy={labBusyId === tc.id}
                  onView={setLabDetail}
                  onRerun={labRerun}
                  onDiagnose={(t) => setLabDiagnose({ runId: t.last_run_id, resultId: t.last_result_id, title: t.linked_test_case_title ? tcLabel(t.test_case_id, t.linked_test_case_title) : t.title, suiteName: t.suite_name })}
                  onRequestHeal={(t) => setLabHealConfirm({ runId: t.last_run_id, resultId: t.last_result_id, title: t.linked_test_case_title ? tcLabel(t.test_case_id, t.linked_test_case_title) : t.title, suiteName: t.suite_name })}
                />
              ))}
            </div>
          )}
        </div>

        {loading || !data ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}><div className="spinner" /></div>
        ) : (
          <div className="health-body-grid">
            <div>
              <div className="health-panel">
                <div className="health-panel-head">
                  <div className="health-panel-title">Runs</div>
                </div>
                {runGroupsLoading ? (
                  <div style={{ display: 'flex', justifyContent: 'center', padding: '1rem' }}><div className="spinner" /></div>
                ) : runGroups.length === 0 ? (
                  <div style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>No re-runs dispatched from here yet — select failing tests above and run them.</div>
                ) : (
                  <div className="health-panel-body">
                    {runGroups.map(g => (
                      <RunGroupCard key={g.id} group={g} onRerunChild={setRerunChildRun} onCancelChild={cancelChildRun} />
                    ))}
                  </div>
                )}
              </div>

              <div className="health-panel">
                <div className="health-panel-head">
                  <div className="health-panel-title">PR validation</div>
                  <Link to={`/projects/${id}/automation/history`} className="health-panel-link">Generation history <Icon name="arrowRight" size={11} /></Link>
                </div>
                {data.prValidation.length === 0 ? (
                  <div style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>No pull requests opened yet.</div>
                ) : (
                  <div className="health-panel-body">
                    {data.prValidation.map((r, i) => (
                      <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', padding: '0.55rem 0', borderBottom: i < data.prValidation.length - 1 ? '1px solid var(--border)' : 'none' }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: '0.85rem', color: 'var(--light)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {r.kind === 'heal' ? `Heal: ${r.target_title}` : (r.branch_name || `Run #${r.id}`)}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--faint)' }}>{timeAgo(r.completed_at)}</div>
                        </div>
                        <a href={r.pr_url} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm" style={{ flexShrink: 0 }}>
                          {r.pr_status?.merged ? 'Merged' : 'View PR'}
                        </a>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div>
              <div className="health-panel">
                <div className="health-panel-head">
                  <div className="health-panel-title">Broken environments</div>
                  <Link to={`/projects/${id}/bugs`} className="health-panel-link">Bugs <Icon name="arrowRight" size={11} /></Link>
                </div>
                {data.brokenEnvironments.length === 0 ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--success)' }}>
                    <Icon name="check" size={15} /> No open environmental issues.
                  </div>
                ) : (
                  <div className="health-panel-body">
                    {data.brokenEnvironments.map(b => (
                      <div
                        className="health-attn-row"
                        key={b.id}
                        onClick={() => navigate(`/projects/${id}/bugs?bugId=${b.id}`)}
                        style={{ cursor: 'pointer' }}
                      >
                        <div className="health-sev-stripe" style={{ background: `var(--severity-${b.severity})` }} />
                        <div>
                          <div className="health-attn-title">{b.title}</div>
                          <div className="health-attn-meta">#{b.id} · opened {timeAgo(b.created_at)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="health-panel">
                <div className="health-panel-head">
                  <div className="health-panel-title">Flaky tests</div>
                </div>
                {data.flakyTests.length === 0 ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--success)' }}>
                    <Icon name="check" size={15} /> No flaky tests detected.
                  </div>
                ) : (
                  <div className="health-panel-body">
                    {data.flakyTests.map((t, i) => (
                      <div key={`${t.suite_name}-${t.test_title}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 0', borderBottom: i < data.flakyTests.length - 1 ? '1px solid var(--border)' : 'none' }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: '0.85rem', color: 'var(--light)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.test_title}</div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--accent2)' }}>{t.suite_name}</div>
                        </div>
                        <span style={{ fontSize: '0.78rem', color: 'var(--warning)', fontWeight: 600, flexShrink: 0 }}>
                          {t.failed_count}/{t.runs_considered} failed
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="health-panel">
                <div className="health-panel-head">
                  <div className="health-panel-title">Automation review backlog</div>
                  <a href="#the-lab" className="health-panel-link">The Lab <Icon name="arrowRight" size={11} /></a>
                </div>
                {Object.entries(data.reviewStatusCounts).filter(([status]) => status !== 'active').every(([, count]) => count === 0) ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--success)' }}>
                    <Icon name="check" size={15} /> Nothing waiting on review.
                  </div>
                ) : (
                  Object.entries(data.reviewStatusCounts).filter(([status, count]) => status !== 'active' && count > 0).map(([status, count]) => (
                    <div key={status} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.4rem 0' }}>
                      <span style={{ fontSize: '0.85rem', color: REVIEW_STATUS_COLOR[status] }}>{REVIEW_STATUS_LABEL[status]}</span>
                      <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--white)' }}>{count}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {!loading && (
          <div className="health-panel">
            <div className="health-panel-head">
              <div className="health-panel-title">AI Quality Advisor</div>
              <button className="btn btn-primary btn-sm" onClick={runAdvisor} disabled={advisorLoading}>
                <Icon name="zap" size={13} /> {advisorLoading ? 'Thinking...' : advisorRecs ? 'Re-run' : 'Run advisor'}
              </button>
            </div>
            {advisorRecs === null ? (
              <div style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>
                Reasons over the signals above (bug hotspots, flaky tests, coverage gaps) to suggest what to prioritize next.
              </div>
            ) : advisorRecs.length === 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--success)' }}>
                <Icon name="check" size={15} /> Nothing stands out right now.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {advisorRecs.map((r, i) => (
                  <div key={i} style={{ display: 'flex', gap: '0.6rem', padding: '0.6rem 0', borderBottom: i < advisorRecs.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: PRIORITY_COLOR[r.priority], flexShrink: 0, marginTop: '0.4rem' }} />
                    <div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--light)', fontWeight: 600 }}>{r.title}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: '0.15rem' }}>{r.detail}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {labDetail && (
        <TestCaseDetailModal test={labDetail} projectId={id} onClose={() => setLabDetail(null)} />
      )}

      {showGenerateTests && (
        <GenerateTestsModal
          projectId={id}
          suites={suites}
          onClose={() => setShowGenerateTests(false)}
          onDispatched={handleGenerationDispatched}
        />
      )}

      {rerunChildRun && (
        <RerunFailedTestsModal
          projectId={id}
          run={rerunChildRun}
          source="engineering_page"
          onClose={() => setRerunChildRun(null)}
          onRerunTriggered={() => { setRerunChildRun(null); loadRunGroups() }}
          onHealTriggered={() => { setRerunChildRun(null); loadRunGroups() }}
        />
      )}

      {labDiagnose && (
        <DiagnosisModal
          projectId={id}
          runId={labDiagnose.runId}
          resultId={labDiagnose.resultId}
          testTitle={labDiagnose.title}
          suiteName={labDiagnose.suiteName}
          onClose={() => setLabDiagnose(null)}
          onRequestHeal={() => { setLabHealConfirm(labDiagnose); setLabDiagnose(null) }}
        />
      )}

      {labHealConfirm && (
        <HealConfirmModal
          testTitle={labHealConfirm.title}
          suiteName={labHealConfirm.suiteName}
          healing={labHealing}
          onCancel={() => setLabHealConfirm(null)}
          onConfirm={confirmLabHeal}
        />
      )}
    </>
  )
}
