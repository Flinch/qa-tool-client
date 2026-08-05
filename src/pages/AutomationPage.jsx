import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { apiFetch } from '../lib/api.js'
import { useToastStore } from '../store/toastStore.jsx'
import { useAuth } from '../store/AuthContext.jsx'
import { describeRunPhase } from '../lib/runPhase.js'
import { suggestBatches } from '../lib/batchSuggestion.js'
import Icon from '../components/Icon.jsx'
import RerunFailedTestsModal from '../components/RerunFailedTestsModal.jsx'

const API_BASE = import.meta.env.VITE_API_URL || '/api'
const POLL_INTERVAL_MS = 4000
const POLL_TIMEOUT_MS = 5 * 60 * 1000
const SSE_MAX_CONSECUTIVE_ERRORS = 3
const MAX_BATCH_SIZE = 3
// The five non-terminal statuses generation_runs.status can be in, per the
// server's CHECK constraint (migrate.js) — used both to know when to keep
// polling and to render a phase label/index.
export const GENERATION_PHASES = ['pending', 'exploring', 'generating', 'healing', 'opening_pr']

export function StatusPill({ status }) {
  const map = {
    completed: { label: 'Completed', color: 'var(--success)' },
    pending: { label: 'Pending', color: 'var(--warning)' },
    running: { label: 'Running', color: 'var(--warning)' },
    failed: { label: 'Failed', color: 'var(--danger)' },
    cancelled: { label: 'Cancelled', color: 'var(--muted)' },
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

function PlatformBadge({ platform }) {
  const map = {
    web: { label: 'Web', color: 'var(--accent)' },
    android: { label: 'Android', color: 'var(--success)' },
    ios: { label: 'iOS', color: 'var(--info)' },
  }
  const p = map[platform] || { label: platform || 'Unknown', color: 'var(--muted)' }
  return (
    <span style={{
      fontSize: '0.68rem', fontWeight: 600, color: p.color,
      border: `1px solid ${p.color}`, borderRadius: 0, padding: '0.1rem 0.5rem',
    }}>
      {p.label}
    </span>
  )
}

export function describeGenerationPhase(status) {
  if (status === 'pending') return 'Starting…'
  if (status === 'exploring') return 'Exploring the app…'
  if (status === 'generating') return 'Writing tests…'
  if (status === 'healing') return 'Healing failures…'
  if (status === 'opening_pr') return 'Opening PR…'
  return null
}

export function formatWhen(dateStr) {
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

function slugifySuiteName(name) {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

// Suites used to only be creatable via a direct API call ("ask your
// engineer to set one up") — a new project with zero suites had nowhere for
// "Generate automated tests" to target, a real dead end. This is that
// missing UI, plus the same web/ios/android + engine shape the CLI-created
// suites already use (see automation.js's POST /suites).
function CreateSuiteModal({ projectId, onClose, onCreated }) {
  const { addToast } = useToastStore()
  const [name, setName] = useState('')
  const [platform, setPlatform] = useState('web')
  // 'browser' | 'api' when platform='web' (browser maps to a null engine —
  // Playwright UI is web's implicit default, same convention every
  // existing web suite already uses); 'maestro' | 'appium' for mobile.
  const [engine, setEngine] = useState('browser')
  const [saving, setSaving] = useState(false)

  const handlePlatformChange = (p) => {
    setPlatform(p)
    setEngine(p === 'web' ? 'browser' : 'maestro')
  }

  const submit = async () => {
    if (!name.trim()) return
    setSaving(true)
    try {
      const suite = await apiFetch(`/projects/${projectId}/automation/suites`, {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          slug: slugifySuiteName(name),
          platform,
          engine: platform === 'web' ? (engine === 'api' ? 'api' : null) : engine,
        }),
      })
      addToast(`Suite "${suite.name}" created`)
      onCreated(suite)
      onClose()
    } catch (e) {
      addToast(e.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 420 }}>
        <div className="modal-title">New automation suite</div>
        <div className="form-group">
          <label className="form-label">Name</label>
          <input
            className="form-input"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Regression Tests"
            autoFocus
          />
        </div>
        <div className="form-group">
          <label className="form-label">Platform</label>
          <select className="form-select" value={platform} onChange={e => handlePlatformChange(e.target.value)}>
            <option value="web">Web</option>
            <option value="ios">iOS</option>
            <option value="android">Android</option>
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Engine</label>
          <select className="form-select" value={engine} onChange={e => setEngine(e.target.value)}>
            {platform === 'web' ? (
              <>
                <option value="browser">Browser (Playwright UI)</option>
                <option value="api">API (HTTP requests)</option>
              </>
            ) : (
              <>
                <option value="maestro">Maestro</option>
                <option value="appium">Appium</option>
              </>
            )}
          </select>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn btn-primary" onClick={submit} disabled={saving || !name.trim()}>
            {saving ? 'Creating...' : 'Create suite'}
          </button>
        </div>
      </div>
    </div>
  )
}

function SuiteCard({ suite, onRun, running, readOnly }) {
  const passRate = suite.latest_passed != null && (suite.latest_passed + suite.latest_failed) > 0
    ? Math.round((suite.latest_passed / (suite.latest_passed + suite.latest_failed)) * 100)
    : null

  const isRunning = running || suite.latest_status === 'pending' || suite.latest_status === 'running'
  const phase = isRunning ? describeRunPhase(suite.latest_status || 'pending', suite.latest_started_at) : null
  // A status pill only earns its place while in-flight (pending/running) —
  // the only point it's the sole signal before real counts exist. Once a
  // run is terminal, the pass/fail badges below already say everything the
  // pill would (a red "N failed" badge already means "failed"; a clean pass
  // rate already means "completed") — the pill was pure duplication. RunRow
  // (the execution-history list) is different: there every status including
  // Completed is a real history log entry, not a duplicate of adjacent info.
  const lastRunAt = suite.latest_completed_at || suite.latest_started_at

  return (
    <div
      className="card suite-card"
      style={{
        display: 'flex', flexDirection: 'column', height: '100%',
        borderLeft: isRunning ? '3px solid var(--warning)' : undefined,
        animation: isRunning ? 'cardPulse 2s ease-in-out infinite' : undefined,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.65rem', minHeight: '2.7rem' }}>
        <div>
          <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 700, fontSize: '0.95rem', color: 'var(--white)', lineHeight: 1.25 }}>{suite.name}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.3rem' }}>
            <PlatformBadge platform={suite.platform} />
            {suite.engine === 'api' && (
              <span style={{
                fontSize: '0.68rem', fontWeight: 600, color: 'var(--accent2)',
                border: '1px solid var(--accent2)', borderRadius: 0, padding: '0.1rem 0.5rem',
              }}>
                API
              </span>
            )}
            <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>{suite.test_case_count} test case{suite.test_case_count === 1 ? '' : 's'}</span>
          </div>
        </div>
        {isRunning && <StatusPill status={suite.latest_status} />}
      </div>

      {!isRunning && lastRunAt && (
        <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginBottom: '0.65rem' }}>
          Last run {formatWhen(lastRunAt)}
        </div>
      )}
      {passRate !== null && (
        <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.65rem' }}>
          <span className="badge badge-pass">{suite.latest_passed} passed</span>
          {suite.latest_failed > 0 && <span className="badge badge-fail">{suite.latest_failed} failed</span>}
        </div>
      )}
      {suite.latest_status === 'failed' && suite.latest_error_message && (
        <div
          title={suite.latest_error_message}
          style={{
            fontSize: '0.76rem', color: 'var(--danger)', background: 'rgba(193,68,58,0.08)',
            border: '1px solid rgba(193,68,58,0.25)', padding: '0.5rem 0.65rem', marginBottom: '0.65rem',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}
        >
          {suite.latest_error_message}
        </div>
      )}

      <div style={{ marginTop: 'auto' }}>
        {isRunning && (
          <>
            <div style={{
              height: '6px', width: '100%', background: 'var(--border)',
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
        {!readOnly && (
          <button
            className="btn btn-primary btn-sm"
            onClick={() => onRun(suite)}
            disabled={isRunning}
            style={{ width: '100%', justifyContent: 'center', marginBottom: '0.5rem' }}
          >
            {isRunning ? 'Running…' : 'Run suite'}
          </button>
        )}
        <Link
          to={`/projects/${suite.project_id}/automation/suites/${suite.id}/test-cases`}
          className="btn btn-ghost btn-sm"
          style={{ width: '100%', justifyContent: 'center' }}
        >
          View test cases
        </Link>
      </div>
    </div>
  )
}

function RunRow({ run, canRerun, onRerun, onCancel }) {
  const isRunning = run.status === 'pending' || run.status === 'running'
  const phase = isRunning ? describeRunPhase(run.status, run.started_at) : null
  // Every run this page ever sees is scope='suite' now — diagnostic/grouped
  // re-runs live exclusively on the Engineering page's Runs panel (see
  // GET /automation/runs's unconditional scope filter).
  const canRerunThis = canRerun && run.status === 'completed' && run.failed > 0

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
        {canRerunThis ? (
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => onRerun(run)}
            style={{ color: 'var(--danger)', borderColor: 'rgba(193,68,58,0.4)' }}
          >
            {run.failed} failed
          </button>
        ) : (
          <div style={{ fontSize: '0.82rem', color: run.failed > 0 ? 'var(--danger)' : 'var(--muted)' }}>{run.failed ?? '—'} failed</div>
        )}
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {isRunning && canRerun && (
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => onCancel(run)}
              style={{ color: 'var(--danger)', borderColor: 'rgba(193,68,58,0.4)' }}
            >
              Cancel
            </button>
          )}
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

// Terminal-style view of a run's agent-step log (see webhooks.js's POST
// /generation-logs, written by each CI script's printStreamEvent). Self-
// contained rather than fed by a parent SSE subscription — GenerationRunRow
// is used from GenerationHistoryPage.jsx, which has no live connection at
// all, so this fetches on open and, while the run is still active, polls
// the same persisted-log endpoint every 2s (matching the CI-side flush
// cadence) instead. Works identically regardless of which page opens it.
function GenerationLogModal({ run, projectId, onClose }) {
  const [lines, setLines] = useState([])
  const [loading, setLoading] = useState(true)
  const isRunning = GENERATION_PHASES.includes(run.status)
  const bottomRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    const fetchLines = () => apiFetch(`/projects/${projectId}/automation/generation-runs/${run.id}/log`)
      .then(data => { if (!cancelled) setLines(data.lines) })
      .catch(console.error)
      .finally(() => { if (!cancelled) setLoading(false) })

    fetchLines()
    const interval = isRunning ? setInterval(fetchLines, 2000) : null
    return () => { cancelled = true; if (interval) clearInterval(interval) }
  }, [projectId, run.id, isRunning])

  // Only the agent's own narration (💬 text, 🤔 thinking) — not the 🔧 tool
  // calls or ↳ tool-result/code output printStreamEvent also logs. Those
  // are the useful "what is it doing and why" story; the raw tool traffic
  // is high-volume and low-signal for a human watching this modal live.
  const narrationLines = lines.filter(line => line.startsWith('💬') || line.startsWith('🤔'))

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' })
  }, [narrationLines.length])

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 720, width: '90vw' }}>
        <div className="modal-title">Agent log — {run.suite_name}{run.kind === 'heal' ? ' (heal)' : ''}</div>
        <div
          style={{
            background: '#0a0a0a', border: '1px solid var(--border)', borderRadius: 4,
            padding: '0.75rem 1rem', height: 420, overflowY: 'auto',
            fontFamily: "'JetBrains Mono', 'Menlo', monospace", fontSize: '0.76rem',
            lineHeight: 1.6, color: '#d4d4d4', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          }}
        >
          {loading ? (
            <div style={{ color: 'var(--muted)' }}>Loading…</div>
          ) : narrationLines.length === 0 ? (
            <div style={{ color: 'var(--muted)' }}>No agent output yet.</div>
          ) : (
            narrationLines.map((line, i) => <div key={i}>{line}</div>)
          )}
          <div ref={bottomRef} />
        </div>
        {isRunning && (
          <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginTop: '0.5rem' }}>Live — updating every few seconds…</div>
        )}
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}

// One row per AI test-generation attempt — the "where's my PR" answer.
// Completed rows resolve to either a live "review this PR" link (still
// open) or direct links to the generated file(s) at HEAD (already merged,
// via a live GitHub check — see run.pr_status from generation-runs).
export function GenerationRunRow({ run, projectId }) {
  const { addToast } = useToastStore()
  const isRunning = GENERATION_PHASES.includes(run.status)
  const tcCount = run.test_case_ids?.length || 0
  const failedCount = run.failed_test_case_ids?.length || 0
  const [rerunning, setRerunning] = useState(false)
  const [showLog, setShowLog] = useState(false)

  const rerunFailed = async () => {
    setRerunning(true)
    try {
      await apiFetch(`/projects/${projectId}/automation/generate`, {
        method: 'POST',
        body: JSON.stringify({ suite_id: run.suite_id, test_case_ids: run.failed_test_case_ids }),
      })
      addToast('Test generation started')
    } catch (e) {
      addToast(e.message, 'error')
    } finally {
      setRerunning(false)
    }
  }

  return (
    <div style={{ padding: '0.85rem 0', borderBottom: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.15rem' }}>
            <span style={{ color: 'var(--white)', fontSize: '0.88rem', fontWeight: 600 }}>{run.suite_name}</span>
            {run.kind === 'heal' && (
              <span style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--accent)', border: '1px solid rgba(184,70,31,0.4)', padding: '0.1rem 0.4rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Heal
              </span>
            )}
          </div>
          <div style={{ color: 'var(--muted)', fontSize: '0.76rem' }}>
            {run.kind === 'heal' ? `Healing: ${run.target_title}` : `${tcCount} test case${tcCount === 1 ? '' : 's'}`} · {formatWhen(run.started_at)}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <StatusPill status={isRunning ? 'running' : run.status} />
          <button className="btn btn-ghost btn-sm" onClick={() => setShowLog(true)}>View log</button>
        </div>
      </div>
      {isRunning && (
        <div style={{ fontSize: '0.74rem', color: 'var(--muted)', marginTop: '0.4rem' }}>{describeGenerationPhase(run.status)}</div>
      )}
      {run.status === 'failed' && run.error_message && (
        <div style={{ fontSize: '0.76rem', color: 'var(--danger)', marginTop: '0.4rem' }}>{run.error_message}</div>
      )}
      {run.status === 'failed' && run.branch_url && (
        <div style={{ marginTop: '0.5rem' }}>
          <a href={run.branch_url} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm">
            <Icon name="link" size={12} /> View checkpointed progress
          </a>
        </div>
      )}
      {run.status === 'completed' && (
        <div style={{ marginTop: '0.5rem', display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          {run.pr_status?.merged ? (
            run.pr_status.files.map(f => (
              <a key={f.path} href={f.url} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm">
                <Icon name="link" size={12} /> {f.path.split('/').pop()}
              </a>
            ))
          ) : run.pr_url ? (
            <a href={run.pr_url} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm">
              <Icon name="link" size={12} /> Review PR ↗
            </a>
          ) : null}
        </div>
      )}
      {failedCount > 0 && (
        <div style={{ marginTop: '0.5rem' }}>
          <button className="btn btn-ghost btn-sm" onClick={rerunFailed} disabled={rerunning} style={{ color: 'var(--danger)', borderColor: 'rgba(193,68,58,0.4)' }}>
            {rerunning ? 'Starting...' : `Re-run failed (${failedCount})`}
          </button>
        </div>
      )}
      {showLog && <GenerationLogModal run={run} projectId={projectId} onClose={() => setShowLog(false)} />}
    </div>
  )
}

export function GenerateTestsModal({ projectId, suites, onClose, onDispatched }) {
  const { addToast } = useToastStore()
  const [notAutomated, setNotAutomated] = useState([])
  const [alreadyAutomatedCount, setAlreadyAutomatedCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [selectedIds, setSelectedIds] = useState([])
  const [suiteId, setSuiteId] = useState(suites[0]?.id ? String(suites[0].id) : '')
  const [step, setStep] = useState('select') // 'select' | 'confirm'
  const [dispatching, setDispatching] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  // automation_candidate is now reserved for the curated critical-flow set
  // (see "Review critical flows" on the Requirements page) — default to
  // showing just those, since they're the ones worth automating first.
  // "All test cases" is the escape hatch for manually promoting something
  // the AI didn't flag.
  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
    Promise.all([
      apiFetch(`/projects/${projectId}/test-cases`),
      // Test cases that already have a real generated automated test
      // shouldn't be offered again here — picking them would just dispatch
      // a duplicate generation run for something that already exists.
      apiFetch(`/projects/${projectId}/automation/generated-test-cases`),
    ])
      .then(([tcs, generated]) => {
        const automatedIds = new Set(generated.testCases.filter(g => g.test_case_id).map(g => g.test_case_id))
        setAlreadyAutomatedCount(tcs.filter(tc => tc.automation_candidate && automatedIds.has(tc.id)).length)
        setNotAutomated(tcs.filter(tc => !automatedIds.has(tc.id)))
      })
      .catch(e => addToast(e.message, 'error'))
      .finally(() => setLoading(false))
  }, [projectId, addToast])

  const selectedSuite = suites.find(s => s.id === Number(suiteId))
  // An api-engine suite can only ever run api-type test cases (the
  // generator writes request/fetch specs, not browser flows) — so its
  // candidate pool is a completely separate bucket from the "critical
  // flows curated for automation" concept below, which was designed for
  // top-to-bottom UI journeys and doesn't apply to a single endpoint check.
  // Every api-type test case is fair game by default here, the same way
  // "Critical flows" used to be the only default-visible set for everyone.
  const isApiSuite = selectedSuite?.engine === 'api'
  const allCandidates = isApiSuite
    ? notAutomated.filter(tc => tc.type === 'api')
    : (showAll ? notAutomated : notAutomated.filter(tc => tc.automation_candidate)).filter(tc => tc.type !== 'api')

  // test_cases.platform is coarse (web/mobile), unlike a suite's own
  // web/ios/android — both ios and android suites accept 'mobile' TCs.
  const suiteCategory = selectedSuite ? (selectedSuite.platform === 'web' ? 'web' : 'mobile') : null
  const candidates = suiteCategory ? allCandidates.filter(tc => tc.platform === suiteCategory) : allCandidates

  // A TC checked while one suite was selected shouldn't silently ride along
  // after switching to a different-platform suite.
  useEffect(() => {
    setSelectedIds(ids => ids.filter(id => candidates.some(tc => tc.id === id)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suiteId])

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
          {/* The "curated critical flow" distinction is about which UI
              journeys are worth the E2E-automation investment — it has no
              equivalent for API test cases, where every well-formed one is
              already a cheap, deterministic automation candidate. So an
              api-engine suite skips this toggle entirely and just shows
              every api-type test case for the platform. */}
          {!isApiSuite && (
            <div className="platform-tabs" style={{ marginBottom: '0.6rem' }}>
              <button
                type="button" className="platform-tab" aria-selected={!showAll}
                onClick={() => { setShowAll(false); setSelectedIds(ids => ids.filter(id => notAutomated.some(tc => tc.id === id && tc.automation_candidate))) }}
              >
                Critical flows
              </button>
              <button type="button" className="platform-tab" aria-selected={showAll} onClick={() => setShowAll(true)}>
                All test cases
              </button>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <label className="form-label" style={{ marginBottom: 0 }}>
                {isApiSuite ? 'API test cases' : 'Test cases'} (select up to {MAX_BATCH_SIZE})
              </label>
              {!isApiSuite && !showAll && alreadyAutomatedCount > 0 && (
                <div style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>
                  {alreadyAutomatedCount} already-automated test case{alreadyAutomatedCount === 1 ? '' : 's'} hidden
                </div>
              )}
            </div>
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
              {isApiSuite
                ? 'No API test cases tracked for this platform yet — generate test cases from API-flavored requirements on the Requirements page first, or mark an existing test case\'s type as "API".'
                : showAll
                  ? 'No other test cases for this platform.'
                  : alreadyAutomatedCount > 0
                    ? 'Every critical flow for this platform is already automated.'
                    : 'No critical flows tracked yet for this platform — use "Review critical flows" on the Requirements page, or switch to "All test cases" to pick one manually.'}
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
  const navigate = useNavigate()
  const { addToast } = useToastStore()
  const { user } = useAuth()
  const isClient = user?.role === 'client'
  const [project, setProject] = useState(null)
  const [suites, setSuites] = useState([])
  const [runs, setRuns] = useState([])
  const [loading, setLoading] = useState(true)
  const [triggeringSuiteId, setTriggeringSuiteId] = useState(null)
  const [showCreateSuite, setShowCreateSuite] = useState(false)
  const [rerunRun, setRerunRun] = useState(null)
  // null until suites load once, then set to whichever category actually has
  // suites (defaults to 'web' if both do) — the `prev ??` guard in the setter
  // below means a later SSE/poll refresh never yanks the user back to the
  // default tab mid-session.
  const [platformTab, setPlatformTab] = useState(null)
  const pollRef = useRef(null)
  const pollStartedAt = useRef(null)
  const sseErrorCount = useRef(0)
  const triggeredSuiteId = useRef(null)

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
      const hasWeb = suiteData.some(s => s.platform === 'web')
      const hasMobile = suiteData.some(s => s.platform !== 'web')
      setPlatformTab(prev => prev ?? (hasWeb ? 'web' : 'mobile'))
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

  // App-side only for now — the GH workflow keeps running (server refuses
  // its late report for a cancelled run); actually stopping the workflow is
  // a known later fix. The reload puts the suite card/run row straight back
  // to a settled state without waiting for the SSE echo.
  const cancelRun = async (run) => {
    try {
      await apiFetch(`/projects/${id}/automation/runs/${run.id}/cancel`, { method: 'POST' })
      addToast('Run cancelled')
      setTriggeringSuiteId(null)
      stopPolling()
      await load().catch(e => addToast(e.message, 'error'))
    } catch (e) {
      addToast(e.message, 'error')
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
  @keyframes cardPulse {
    0%, 100% { box-shadow: 0 0 0 rgba(201,162,39,0); }
    50% { box-shadow: 0 0 12px rgba(201,162,39,0.25); }
  }
  .suite-card { transition: border-color 0.2s, box-shadow 0.2s; }
  .suite-card:hover { border-color: var(--border2); }
`}</style>
      <div className="topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button className="back-btn" onClick={() => navigate(-1)} title="Back" aria-label="Back"><Icon name="arrowLeft" size={14} /></button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
            {!isClient && (
              <>
                <Link to="/projects" style={{ color: 'var(--muted)', textDecoration: 'none' }}>Projects</Link>
                <span style={{ color: 'var(--muted)' }}>/</span>
              </>
            )}
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
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <h2 style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: '1.1rem', color: 'var(--white)' }}>Suites</h2>
                {!isClient && <button className="btn btn-ghost btn-sm" onClick={() => setShowCreateSuite(true)}>+ New suite</button>}
              </div>
              {suites.length === 0 ? (
                <div className="empty-state">
                  <h3>No automation suites yet</h3>
                  {!isClient && (
                    <>
                      <p>Create a suite to have somewhere for generated tests to target.</p>
                      <button className="btn btn-primary" onClick={() => setShowCreateSuite(true)}>+ New suite</button>
                    </>
                  )}
                </div>
              ) : (
                <>
                  <div className="platform-tabs">
                    <button
                      className="platform-tab" aria-selected={platformTab === 'web'}
                      disabled={!suites.some(s => s.platform === 'web')}
                      onClick={() => setPlatformTab('web')}
                    >
                      Web
                    </button>
                    <button
                      className="platform-tab" aria-selected={platformTab === 'mobile'}
                      disabled={!suites.some(s => s.platform !== 'web')}
                      onClick={() => setPlatformTab('mobile')}
                    >
                      Mobile
                    </button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1.25rem', alignItems: 'stretch' }}>
                    {suites.filter(s => platformTab === 'web' ? s.platform === 'web' : s.platform !== 'web').map(s => (
                      <SuiteCard key={s.id} suite={s} onRun={runSuite} running={triggeringSuiteId === s.id} readOnly={isClient} />
                    ))}
                  </div>
                </>
              )}
            </div>

            <div style={{ marginBottom: '2rem' }}>
              <h2 style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: '1.1rem', color: 'var(--white)', marginBottom: '1rem' }}>Recent executions</h2>
              {runs.length === 0 ? (
                <div className="empty-state"><h3>No runs yet</h3><p>{isClient ? 'No suite runs have happened yet.' : 'Trigger a suite above to see results here.'}</p></div>
              ) : (
                <div className="card" style={{ padding: '0 1rem' }}>
                  {runs.map(r => <RunRow key={r.id} run={r} canRerun={!isClient} onRerun={setRerunRun} onCancel={cancelRun} />)}
                </div>
              )}
            </div>

            <div>
              <h2 style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: '1.1rem', color: 'var(--white)', marginBottom: '1rem' }}>Nightly builds</h2>
              {nightlyRuns.length === 0 ? (
                <div className="empty-state"><h3>No nightly runs yet</h3><p>These populate automatically once the scheduled workflow runs.</p></div>
              ) : (
                <div className="card" style={{ padding: '0 1rem' }}>
                  {nightlyRuns.map(r => <RunRow key={r.id} run={r} canRerun={!isClient} onRerun={setRerunRun} onCancel={cancelRun} />)}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {showCreateSuite && (
        <CreateSuiteModal
          projectId={id}
          onClose={() => setShowCreateSuite(false)}
          onCreated={(suite) => {
            // Re-fetch rather than appending the raw POST response — the
            // list view's test_case_count/latest_* fields are computed by
            // GET /suites's query, not present on a bare INSERT ... RETURNING *.
            load().catch(e => addToast(e.message, 'error'))
            setPlatformTab(suite.platform === 'web' ? 'web' : 'mobile')
          }}
        />
      )}

      {rerunRun && (
        <RerunFailedTestsModal
          projectId={id}
          run={rerunRun}
          onClose={() => setRerunRun(null)}
          onRerunTriggered={() => { setRerunRun(null); load() }}
          onHealTriggered={() => { setRerunRun(null); addToast('Healing started — track progress on the Engineering page') }}
        />
      )}
    </>
  )
}