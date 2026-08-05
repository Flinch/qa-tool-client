import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useNavigate } from 'react-router-dom'
import { apiFetch } from '../lib/api.js'
import { useAuth } from '../store/AuthContext.jsx'
import { timeAgo } from '../lib/timeAgo.js'
import { buildActivity } from '../lib/buildActivity.js'
import Icon from './Icon.jsx'
import NotificationBell from './NotificationBell.jsx'
import { ProjectLogoPlaceholder, ProjectLinksList } from './ProjectBrandBox.jsx'

const STATUS_META = {
  excellent:        { label: 'Excellent',          color: 'var(--success)' },
  good:             { label: 'Good',                color: 'var(--warning)' },
  needs_attention:  { label: 'Needs attention',     color: 'var(--danger)' },
  insufficient_data:{ label: 'Not enough data yet', color: 'var(--muted)' },
}

const SEVERITY_ORDER = ['critical', 'high', 'medium', 'low']

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

// The score is a single blended number — hovering reveals the per-feature
// breakdown behind it. Portaled to document.body (not just absolutely
// positioned in place) because `.health-hero` clips overflow for its
// background glow effect, which would otherwise cut the popover off. Lives
// under the headline/sub text and fills that column's width, rather than a
// fixed-footprint circular gauge off to the side.
function ScoreBar({ value, color, breakdown }) {
  const [hover, setHover] = useState(false)
  const [pos, setPos] = useState(null)
  const wrapRef = useRef(null)

  const onEnter = () => {
    if (wrapRef.current) {
      const rect = wrapRef.current.getBoundingClientRect()
      setPos({ top: rect.bottom + 10, left: rect.left })
    }
    setHover(true)
  }

  const hasBreakdown = breakdown && breakdown.length > 0

  return (
    <div
      ref={wrapRef}
      style={{ marginTop: '0.9rem', cursor: hasBreakdown ? 'default' : undefined }}
      onMouseEnter={hasBreakdown ? onEnter : undefined}
      onMouseLeave={() => setHover(false)}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.64rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--muted)' }}>
          Quality score
        </span>
        <span style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 800, fontSize: '1.05rem', color: 'var(--white)' }}>
          {value !== null ? value : '—'}
        </span>
      </div>
      <div style={{ height: 8, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
        {value !== null && (
          <div style={{ width: `${value}%`, height: '100%', background: color, borderRadius: 4, transition: 'width 0.6s ease' }} />
        )}
      </div>
      {hover && hasBreakdown && pos && createPortal(
        <div
          className="notif-bell-dropdown"
          style={{ position: 'fixed', top: pos.top, left: pos.left, width: 260 }}
        >
          <div className="notif-bell-title">Pass rate by feature</div>
          {breakdown.map(f => <FeatureBreakdownRow key={f.id} f={f} />)}
        </div>,
        document.body
      )}
    </div>
  )
}

export function TrendChart({ points }) {
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
export function featureHealthColor(rate) {
  if (rate >= 90) return 'var(--success)'
  if (rate >= 70) return 'var(--warning)'
  return 'var(--danger)'
}

export default function QualityHealth({ projectId, projectName, logo, links = [] }) {
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

  // "New bugs reported" — bugs filed in the last 7 days, regardless of
  // current status (a bug that's already been resolved same-day is still
  // real news worth seeing, not just currently-open ones — that's what the
  // KPI strip and bug hotspots already cover). Distinct from the activity
  // bell: this is a dedicated, always-visible panel for "what did QA just
  // find," not a dismiss-once notification feed.
  const RECENT_BUGS_WINDOW_MS = 7 * 24 * 60 * 60 * 1000
  const recentBugs = bugs
    .filter(b => Date.now() - new Date(b.created_at).getTime() < RECENT_BUGS_WINDOW_MS)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

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
      <div className="health-hero" style={{ padding: '1.5rem 1.75rem 1.5rem' }}>
        <div className="health-hero-top">
          {/* Heading aligned to the top of the logo box rather than
              vertically centered against it — reads as anchored to the
              image instead of floating in the middle of a taller column
              once links are stacked underneath the logo. */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1.25rem', flex: 1, minWidth: 0 }}>
            <div>
              <ProjectLogoPlaceholder inline logo={logo} />
              <div style={{ marginTop: '0.5rem' }}>
                <ProjectLinksList projectId={projectId} links={links} canEdit={false} />
              </div>
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="health-greeting-eyebrow">{greetingWord()}{firstName ? `, ${firstName}` : ''}</div>
              <h1 className="health-greeting-h1">{summary.headline}</h1>
              <div className="health-greeting-sub">{summary.sub}</div>
              <ScoreBar value={data.qualityScore} color={status.color} breakdown={features} />
            </div>
          </div>

          <div className="health-status-pill" style={{ borderColor: status.color, color: status.color, flexShrink: 0 }}>
            <span className="health-status-dot" style={{ background: status.color }} />
            {status.label}
          </div>
        </div>

        {/* Full-width now (not squeezed by the gauge/badge column above),
            so all five quicklinks stay on one line, in line with the KPI
            strip below. marginLeft matches the logo placeholder's width +
            gap so this row starts under the HEADING text, not the logo. */}
        <div style={{ display: 'flex', gap: '0.6rem', marginTop: '0.3rem', marginLeft: 'calc(140px + 1.25rem)' }}>
          <Link to={`/projects/${projectId}/requirements`} className="health-quicklink"><Icon name="target" size={14} /> Requirements</Link>
          <Link to={`/projects/${projectId}/executions`} className="health-quicklink"><Icon name="play" size={14} /> Executions</Link>
          <Link to={`/projects/${projectId}/bugs`} className="health-quicklink"><Icon name="bug" size={14} /> Bug reports</Link>
          <Link to={`/projects/${projectId}/automation`} className="health-quicklink"><Icon name="gear" size={14} /> Automation</Link>
          <Link to={`/projects/${projectId}/timeline`} className="health-quicklink"><Icon name="clock" size={14} /> Timeline</Link>
        </div>

        <div className="health-kpi-strip" style={{ marginTop: '0.75rem' }}>
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
              <div className="health-panel-title">Uncovered requirements</div>
              <Link to={`/projects/${projectId}/requirements`} className="health-panel-link">Requirements <Icon name="arrowRight" size={11} /></Link>
            </div>
            {data.uncoveredRequirements.length === 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--success)' }}>
                <Icon name="check" size={15} /> Every requirement has test coverage.
              </div>
            ) : (
              data.uncoveredRequirements.map(r => (
                <div
                  key={r.id}
                  onClick={() => navigate(`/projects/${projectId}/requirements`)}
                  style={{
                    padding: '0.5rem 0', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--light)',
                    borderBottom: '1px solid var(--border)',
                  }}
                >
                  {r.title}
                </div>
              ))
            )}
          </div>
        </div>

        <div>
          {/* Merges what used to be two panels ("Needs attention" — urgent
              individual bugs, severity-filtered — and "Bug hotspots" —
              feature concentration, severity-blind). Both were answering
              overlapping questions with the same underlying bug data; this
              gives "where" (feature) and "how urgent" (worst severity
              present) in one place instead of two redundant lists. */}
          <div className="health-panel">
            <div className="health-panel-head">
              <div className="health-panel-title">New bugs reported{recentBugs.length > 0 ? ` (${recentBugs.length})` : ''}</div>
              <Link to={`/projects/${projectId}/bugs`} className="health-panel-link">Bugs <Icon name="arrowRight" size={11} /></Link>
            </div>
            {recentBugs.length === 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--success)' }}>
                <Icon name="check" size={15} /> No new bugs in the last 7 days.
              </div>
            ) : (
              recentBugs.slice(0, 5).map((b, i, arr) => (
                <div
                  key={b.id}
                  onClick={() => navigate(`/projects/${projectId}/bugs?bugId=${b.id}`)}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.45rem 0', cursor: 'pointer', borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}
                >
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: `var(--severity-${b.severity})`, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0, fontSize: '0.83rem', color: 'var(--light)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {b.title}
                  </div>
                  <span style={{ fontSize: '0.7rem', color: 'var(--faint)', flexShrink: 0 }}>{timeAgo(b.created_at)}</span>
                </div>
              ))
            )}
          </div>

          <div className="health-panel">
            <div className="health-panel-head">
              <div className="health-panel-title">Bug hotspots</div>
              <Link to={`/projects/${projectId}/bugs`} className="health-panel-link">Bugs <Icon name="arrowRight" size={11} /></Link>
            </div>
            {data.bugHotspots.length === 0 ? (
              <div style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>No features tracked yet.</div>
            ) : (
              data.bugHotspots.map(h => {
                const worst = h.criticalCount > 0 ? 'critical' : h.highCount > 0 ? 'high' : h.mediumCount > 0 ? 'medium' : h.lowCount > 0 ? 'low' : null
                const color = worst ? `var(--severity-${worst})` : 'var(--muted)'
                const breakdown = worst
                  ? [
                      h.criticalCount > 0 && `${h.criticalCount} critical`,
                      h.highCount > 0 && `${h.highCount} high`,
                      h.mediumCount > 0 && `${h.mediumCount} medium`,
                      h.lowCount > 0 && `${h.lowCount} low`,
                    ].filter(Boolean).join(' · ')
                  : 'No open bugs'
                return (
                  <div
                    key={h.featureId}
                    onClick={() => navigate(`/projects/${projectId}/bugs`)}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.4rem 0', cursor: 'pointer' }}
                  >
                    <div style={{ width: 96, flexShrink: 0 }}>
                      <div style={{ fontSize: '0.78rem', color: 'var(--light)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={h.featureName}>
                        {h.featureName}
                      </div>
                      <div style={{ fontSize: '0.68rem', color }}>{breakdown}</div>
                    </div>
                    <div style={{ flex: 1, height: 5, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                      {h.openBugCount > 0 && (
                        <div style={{ width: `${Math.min(100, h.openBugCount * 20)}%`, height: '100%', background: color, borderRadius: 3 }} />
                      )}
                    </div>
                    <div style={{ width: 24, flexShrink: 0, textAlign: 'right', fontSize: '0.72rem', color, fontWeight: 600 }}>
                      {h.openBugCount}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>

      {/* Full-width, not nested in the 2-column grid above — with only
          "Needs attention" in the right column, this had nothing beside it
          and looked like a stray leftover. A wider list also gives the
          suite-name column more room instead of being squeezed. */}
      <div className="health-panel">
        <div className="health-panel-head">
          <div className="health-panel-title">Recent automation runs</div>
          <Link to={`/projects/${projectId}/automation`} className="health-panel-link">Automation <Icon name="arrowRight" size={11} /></Link>
        </div>
        {automationRuns.length === 0 ? (
          <div style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>No automation runs yet.</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', columnGap: '2rem' }}>
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
  )
}
