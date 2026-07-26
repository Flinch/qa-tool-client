import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useNavigate } from 'react-router-dom'
import { apiFetch } from '../lib/api.js'
import { useAuth } from '../store/AuthContext.jsx'
import { timeAgo } from '../lib/timeAgo.js'
import Icon from './Icon.jsx'
import NotificationBell from './NotificationBell.jsx'

const STATUS_META = {
  excellent:        { label: 'Excellent',          color: 'var(--success)' },
  good:             { label: 'Good',                color: 'var(--warning)' },
  needs_attention:  { label: 'Needs attention',     color: 'var(--danger)' },
  insufficient_data:{ label: 'Not enough data yet', color: 'var(--muted)' },
}

const SEVERITY_ORDER = ['critical', 'high', 'medium', 'low']
const SEVERITY_LABEL = { critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low' }
const SEVERITY_RANK = { critical: 0, high: 1, medium: 2, low: 3 }

function greetingWord() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

// Turns the health payload into a plain-English headline + subline. Kept
// entirely derived from real numbers already on `data` — no invented deltas.
function buildSummary(data, projectName) {
  const { healthStatus, passRate, bugsBySeverity, testCases } = data
  const critical = bugsBySeverity.critical
  const high = bugsBySeverity.high

  if (healthStatus === 'insufficient_data') {
    return {
      headline: `${projectName} is just getting started.`,
      sub: testCases.total > 0
        ? 'Test cases are in place — run your first execution to see a pass rate here.'
        : 'Once test cases exist and executions start running, the snapshot shows up here.',
    }
  }
  if (healthStatus === 'needs_attention') {
    const issues = []
    if (critical > 0) issues.push(`${critical} critical issue${critical === 1 ? '' : 's'}`)
    if (high > 0) issues.push(`${high} high-priority issue${high === 1 ? '' : 's'}`)
    return {
      headline: `${projectName} needs a look.`,
      sub: issues.length
        ? `${issues.join(' and ')} open, and the pass rate is at ${passRate}%.`
        : `Pass rate has dropped to ${passRate}%.`,
    }
  }
  if (healthStatus === 'good') {
    return {
      headline: `${projectName} is in good shape.`,
      sub: high > 0
        ? `${passRate}% of tests are passing. ${high} high-priority bug${high === 1 ? '' : 's'} worth a look this week.`
        : `${passRate}% of tests are passing — a few things short of full health.`,
    }
  }
  return {
    headline: `${projectName} is in excellent shape.`,
    sub: `${passRate}% of your tests are passing and nothing critical is open.`,
  }
}

// Renders the per-feature pass-rate breakdown row — same bar+text shape
// whether it's showing real data or the "not enough info" empty state.
function FeatureBreakdownRow({ f }) {
  // Pass rate against the feature's *whole* test case count, not just the
  // ones that have run — an untested test case should drag the rate down,
  // not be excluded, so this reads as real stability rather than "of the
  // ones we bothered to check."
  const hasData = f.test_case_count > 0 && (f.passed > 0 || f.failed > 0)
  const rate = hasData ? Math.round((f.passed / f.test_case_count) * 100) : 0
  const color = hasData ? featureHealthColor(rate) : 'var(--muted)'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.3rem 0' }}>
      <div style={{ width: 92, flexShrink: 0, fontSize: '0.78rem', color: 'var(--light)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={f.name}>
        {f.name}
      </div>
      <div style={{ flex: 1, height: 5, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
        {hasData && <div style={{ width: `${rate}%`, height: '100%', background: color, borderRadius: 3 }} />}
      </div>
      <div style={{ width: 60, flexShrink: 0, textAlign: 'right', fontSize: '0.72rem', color, fontWeight: hasData ? 600 : 400 }}>
        {hasData ? `${rate}%` : '—'}
      </div>
    </div>
  )
}

// The gauge's percentage is a single blended number — hovering reveals the
// per-feature breakdown behind it. Portaled to document.body (not just
// absolutely positioned in place) because `.health-hero` clips overflow for
// its background glow effect, which would otherwise cut the popover off.
function Gauge({ value, color, breakdown }) {
  const r = 54, c = 2 * Math.PI * r
  const offset = value === null ? 0 : c * (1 - value / 100)
  const [hover, setHover] = useState(false)
  const [pos, setPos] = useState(null)
  const wrapRef = useRef(null)

  const onEnter = () => {
    if (wrapRef.current) {
      const rect = wrapRef.current.getBoundingClientRect()
      setPos({ top: rect.bottom + 10, left: rect.left + rect.width / 2 })
    }
    setHover(true)
  }

  const hasBreakdown = breakdown && breakdown.length > 0

  return (
    <div
      ref={wrapRef}
      style={{ position: 'relative', flexShrink: 0, cursor: hasBreakdown ? 'default' : undefined }}
      onMouseEnter={hasBreakdown ? onEnter : undefined}
      onMouseLeave={() => setHover(false)}
    >
      <svg width={128} height={128} viewBox="0 0 128 128" style={{ display: 'block' }}>
        <circle cx="64" cy="64" r={r} fill="none" stroke="var(--border)" strokeWidth="10" />
        {value !== null && (
          <circle
            cx="64" cy="64" r={r} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round"
            strokeDasharray={c} strokeDashoffset={offset} transform="rotate(-90 64 64)"
            style={{ transition: 'stroke-dashoffset 0.6s ease' }}
          />
        )}
        <text x="64" y="60" textAnchor="middle" style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 800, fontSize: 28, fill: 'var(--white)' }}>
          {value !== null ? `${value}%` : '—'}
        </text>
        <text x="64" y="78" textAnchor="middle" style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, letterSpacing: '0.05em', fill: 'var(--muted)' }}>
          PASS RATE
        </text>
      </svg>
      {hover && hasBreakdown && pos && createPortal(
        <div
          className="notif-bell-dropdown"
          style={{ position: 'fixed', top: pos.top, left: pos.left, transform: 'translateX(-50%)', width: 260 }}
        >
          <div className="notif-bell-title">Pass rate by feature</div>
          {breakdown.map(f => <FeatureBreakdownRow key={f.id} f={f} />)}
        </div>,
        document.body
      )}
    </div>
  )
}

function TrendChart({ points }) {
  const w = 600, h = 140, pad = 6
  const xs = points.map((_, i) => points.length > 1 ? pad + (i / (points.length - 1)) * (w - pad * 2) : w / 2)
  const ys = points.map(p => pad + (1 - p.passRate / 100) * (h - pad * 2))
  const line = xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(' ')
  const area = `${line} L${xs[xs.length - 1].toFixed(1)},${h} L${xs[0].toFixed(1)},${h} Z`
  const lastX = xs[xs.length - 1], lastY = ys[ys.length - 1]

  return (
    <>
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ width: '100%', height: 140, display: 'block' }}>
        <line x1="0" y1={h * 0.25} x2={w} y2={h * 0.25} stroke="var(--border)" strokeWidth="1" />
        <line x1="0" y1={h * 0.5} x2={w} y2={h * 0.5} stroke="var(--border)" strokeWidth="1" />
        <line x1="0" y1={h * 0.75} x2={w} y2={h * 0.75} stroke="var(--border)" strokeWidth="1" />
        <path d={area} fill="var(--accent)" opacity="0.12" />
        <path d={line} fill="none" stroke="var(--accent2)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        <circle cx={lastX} cy={lastY} r="4" fill="var(--accent2)" />
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.68rem', color: 'var(--faint)', marginTop: '0.5rem' }}>
        <span>{new Date(points[0].date).toLocaleDateString()}</span>
        <span>{new Date(points[points.length - 1].date).toLocaleDateString()}</span>
      </div>
    </>
  )
}

// Same tiering as the pass-rate color used elsewhere (e.g. DashboardPage's
// recent-runs column) — kept consistent rather than inventing new thresholds.
function featureHealthColor(rate) {
  if (rate >= 90) return 'var(--success)'
  if (rate >= 70) return 'var(--warning)'
  return 'var(--danger)'
}

function AccessTile({ to, icon, title, sub }) {
  return (
    <Link to={to} style={{ textDecoration: 'none' }}>
      <div className="card-sm access-tile" style={{ transition: 'border-color 0.2s', height: '100%', display: 'flex', flexDirection: 'column' }}>
        <div className="access-tile-icon" style={{ width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border2)', color: 'var(--accent)', marginBottom: '0.75rem', transition: 'color 0.2s, border-color 0.2s, background 0.2s' }}>
          <Icon name={icon} size={18} />
        </div>
        <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 700, color: 'var(--white)', fontSize: '0.92rem', marginBottom: '0.2rem' }}>{title}</div>
        {/* Fixed min-height so a two-line sub (e.g. "Run manual & automated
            tests") doesn't make its tile taller than the rest of the row —
            every tile reserves the same space regardless of wording length. */}
        <div style={{ fontSize: '0.76rem', color: 'var(--muted)', minHeight: '2.1em' }}>{sub}</div>
      </div>
    </Link>
  )
}

// Merges bugs + execution runs + requirements into one chronological feed.
// No dedicated activity-log table exists server-side, so this is built from
// the same list endpoints the rest of the app already uses (see
// DECISIONS.md if that changes and a real feed becomes worth adding).
function buildActivity(bugs, runs, requirements) {
  const events = []

  for (const b of bugs) {
    if (b.status === 'resolved') {
      events.push({ time: b.updated_at, text: `Bug #${b.id} "${b.title}" resolved`, dotColor: 'var(--success)', bugId: b.id })
    } else {
      events.push({
        time: b.created_at,
        text: `Bug #${b.id} "${b.title}" reported`,
        dotColor: (b.severity === 'critical' || b.severity === 'high') ? 'var(--severity-high)' : 'var(--border2)',
        bugId: b.id,
      })
    }
  }

  for (const r of runs) {
    if (r.status === 'completed' && r.completed_at) {
      events.push({
        time: r.completed_at,
        text: `Execution run "${r.name}" finished — ${r.passed}/${r.total_test_cases} passed`,
        dotColor: 'var(--accent2)',
        runId: r.id,
      })
    }
  }

  // Requirements added within ~10 minutes of each other came from the same
  // upload/generation batch — group them into one line instead of five.
  const sortedReqs = [...requirements].sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
  const bucketMs = 10 * 60 * 1000
  let i = 0
  while (i < sortedReqs.length) {
    let j = i + 1
    while (j < sortedReqs.length && new Date(sortedReqs[j].created_at) - new Date(sortedReqs[i].created_at) < bucketMs) j++
    const group = sortedReqs.slice(i, j)
    const latest = group[group.length - 1]
    events.push({
      time: latest.created_at,
      text: group.length === 1 ? `Requirement "${latest.title}" added` : `${group.length} requirements added`,
      dotColor: 'var(--border2)',
    })
    i = j
  }

  return events.sort((a, b) => new Date(b.time) - new Date(a.time)).slice(0, 5)
}

export default function QualityHealth({ projectId, projectName }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [bugs, setBugs] = useState([])
  const [runs, setRuns] = useState([])
  const [requirements, setRequirements] = useState([])
  const [features, setFeatures] = useState([])
  const [automationRuns, setAutomationRuns] = useState([])
  const [loading, setLoading] = useState(true)
  // The bell lives in the real page topbar (rendered by ProjectDetailPage),
  // not inside this component's own hero card — portaled into the mount
  // point ProjectDetailPage reserves for it, so it reads as "top of the
  // page" rather than "top of the first card." Declared up here with the
  // other hooks since this component has early returns below (loading/error
  // states) and hooks can't follow those conditionally.
  const [bellMount, setBellMount] = useState(null)
  useEffect(() => { setBellMount(document.getElementById('client-topbar-bell')) }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([
      apiFetch(`/projects/${projectId}/health`),
      apiFetch(`/projects/${projectId}/bugs`).catch(() => []),
      apiFetch(`/projects/${projectId}/execution-runs`).catch(() => []),
      apiFetch(`/projects/${projectId}/requirements`).catch(() => []),
      apiFetch(`/projects/${projectId}/features`).catch(() => []),
      apiFetch(`/projects/${projectId}/automation/runs`).catch(() => []),
    ])
      .then(([health, bugRows, runRows, reqRows, featureRows, automationRunRows]) => {
        if (cancelled) return
        setData(health)
        setBugs(bugRows)
        setRuns(runRows)
        setRequirements(reqRows)
        setFeatures(featureRows)
        setAutomationRuns(automationRunRows)
      })
      .catch(console.error)
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [projectId])

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}><div className="spinner" /></div>
  }
  if (!data) {
    return <div className="empty-state"><h3>Couldn't load quality data</h3></div>
  }

  const status = STATUS_META[data.healthStatus] || STATUS_META.insufficient_data
  const tc = data.testCases
  const openBugsTotal = SEVERITY_ORDER.reduce((sum, s) => sum + data.bugsBySeverity[s], 0)
  const summary = buildSummary(data, projectName || 'This project')
  const firstName = user?.name?.split(' ')[0]

  const attention = bugs
    .filter(b => b.status !== 'resolved' && (b.severity === 'critical' || b.severity === 'high'))
    .sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || new Date(a.created_at) - new Date(b.created_at))
    .slice(0, 3)

  const activity = buildActivity(bugs, runs, requirements)
  const activityForBell = activity.map((ev, i) => ({
    ...ev,
    key: i,
    link: ev.bugId ? `/projects/${projectId}/bugs?bugId=${ev.bugId}`
      : ev.runId ? `/projects/${projectId}/executions/${ev.runId}`
      : null,
  }))

  return (
    <div className="fade-in">
      {bellMount && createPortal(
        <NotificationBell activity={activityForBell} storageKey={`qa_tool_activity_seen_project_${projectId}`} />,
        bellMount
      )}
      <div className="health-hero">
        <div className="health-hero-top">
          <div>
            <div className="health-greeting-eyebrow">{greetingWord()}{firstName ? `, ${firstName}` : ''}</div>
            <h1 className="health-greeting-h1">{summary.headline}</h1>
            <div className="health-greeting-sub">{summary.sub}</div>
          </div>
          <div className="health-status-pill" style={{ borderColor: status.color, color: status.color }}>
            <span className="health-status-dot" style={{ background: status.color }} />
            {status.label}
          </div>
        </div>

        <div className="health-gauge-row">
          <Gauge value={data.passRate} color={status.color} breakdown={features} />

          <div className="health-kpi-strip">
            <div className="health-kpi">
              <div className="health-kpi-label">Tests</div>
              <div className="health-kpi-num">{tc.total}</div>
              <div className="health-kpi-sub" style={{ color: tc.total > 0 ? 'var(--success)' : 'var(--muted)' }}>
                {tc.total > 0 ? `${tc.passed} passing` : 'No test cases yet'}
              </div>
            </div>
            <div className="health-kpi">
              <div className="health-kpi-label">Open bugs</div>
              <div className="health-kpi-num">{openBugsTotal}</div>
              <div className="health-kpi-sub" style={{ color: data.bugsBySeverity.critical > 0 ? 'var(--severity-critical)' : data.bugsBySeverity.high > 0 ? 'var(--severity-high)' : 'var(--muted)' }}>
                {data.bugsBySeverity.critical > 0
                  ? `${data.bugsBySeverity.critical} critical`
                  : data.bugsBySeverity.high > 0
                    ? `${data.bugsBySeverity.high} high priority`
                    : openBugsTotal > 0 ? 'All minor' : 'All clear'}
              </div>
            </div>
            <div className="health-kpi">
              <div className="health-kpi-label">Automated</div>
              <div className="health-kpi-num">{data.automationCoverage !== null ? `${data.automationCoverage}%` : '—'}</div>
              <div className="health-kpi-sub">
                {data.totalTestCases > 0 ? `${data.automatedTestCases} of ${data.totalTestCases} cases` : 'No test cases yet'}
              </div>
            </div>
            <div className="health-kpi">
              <div className="health-kpi-label">Req. coverage</div>
              <div className="health-kpi-num">{data.requirementCoverage !== null ? `${data.requirementCoverage}%` : '—'}</div>
              <div className="health-kpi-sub">
                {data.totalRequirements > 0 ? `${data.coveredRequirements} of ${data.totalRequirements} covered` : 'No requirements tracked yet'}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="health-body-grid">
        <div>
          <div className="health-panel">
            <div className="health-panel-head">
              <div className="health-panel-title">Pass rate — recent runs</div>
              <Link to={`/projects/${projectId}/executions`} className="health-panel-link">Executions <Icon name="arrowRight" size={11} /></Link>
            </div>
            {data.passRateTrend.length >= 2 ? (
              <TrendChart points={data.passRateTrend} />
            ) : (
              <div style={{ fontSize: '0.85rem', color: 'var(--muted)', padding: '0.75rem 0' }}>
                Run your first execution to start tracking trends over time.
              </div>
            )}
          </div>

          <div className="health-panel">
            <div className="health-panel-head">
              <div className="health-panel-title">Recent automation runs</div>
              <Link to={`/projects/${projectId}/automation`} className="health-panel-link">Automation <Icon name="arrowRight" size={11} /></Link>
            </div>
            {automationRuns.length === 0 ? (
              <div style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>No automation runs yet.</div>
            ) : (
              <div>
                {automationRuns.slice(0, 5).map((r, i, arr) => {
                  const hasResult = r.status === 'completed' && r.total > 0
                  const rate = hasResult ? Math.round((r.passed / r.total) * 100) : null
                  const rateColor = rate === null ? 'var(--muted)' : featureHealthColor(rate)
                  const statusText = hasResult
                    ? `${rate}% (${r.passed}/${r.total})`
                    : r.status === 'failed' ? 'Failed to run'
                    : r.status === 'running' ? 'Running…'
                    : 'Pending'
                  return (
                    <div
                      key={r.id}
                      onClick={() => navigate(`/projects/${projectId}/automation`)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '0.75rem',
                        padding: '0.55rem 0', cursor: 'pointer',
                        borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none',
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0, fontSize: '0.85rem', color: 'var(--light)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {r.suite_name}
                      </div>
                      <div style={{ fontSize: '0.8rem', fontWeight: 600, color: rateColor, flexShrink: 0 }}>
                        {statusText}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--faint)', flexShrink: 0, width: 68, textAlign: 'right' }}>
                        {timeAgo(r.completed_at || r.started_at)}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        <div>
          <div className="health-panel">
            <div className="health-panel-head">
              <div className="health-panel-title">Needs attention</div>
              <Link to={`/projects/${projectId}/bugs`} className="health-panel-link">Bugs <Icon name="arrowRight" size={11} /></Link>
            </div>
            {attention.length === 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--success)' }}>
                <Icon name="check" size={15} /> Nothing urgent open right now.
              </div>
            ) : (
              attention.map(b => (
                <div
                  className="health-attn-row"
                  key={b.id}
                  onClick={() => navigate(`/projects/${projectId}/bugs?bugId=${b.id}`)}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="health-sev-stripe" style={{ background: `var(--severity-${b.severity})` }} />
                  <div>
                    <div className="health-attn-title">{b.title}</div>
                    <div className="health-attn-meta">
                      <span className="health-sev-tag" style={{ color: `var(--severity-${b.severity})` }}>{SEVERITY_LABEL[b.severity]}</span>
                      · #{b.id} · opened {timeAgo(b.created_at)}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="health-panel">
            <div className="health-panel-head"><div className="health-panel-title">Jump in</div></div>
            <div className="health-access-grid">
              <AccessTile to={`/projects/${projectId}/requirements`} icon="target" title="Requirements"
                sub={data.totalRequirements > 0 ? `${data.coveredRequirements} of ${data.totalRequirements} covered` : 'None tracked yet'} />
              <AccessTile to={`/projects/${projectId}/tests`} icon="check" title="Test cases"
                sub={`${tc.total} total`} />
              <AccessTile to={`/projects/${projectId}/executions`} icon="play" title="Executions"
                sub="Run manual & automated tests" />
              <AccessTile to={`/projects/${projectId}/bugs`} icon="bug" title="Bug reports"
                sub={`${openBugsTotal} open`} />
              <AccessTile to={`/projects/${projectId}/automation`} icon="gear" title="Automation"
                sub={data.automationCoverage !== null ? `${data.automationCoverage}% covered` : 'Not set up yet'} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
