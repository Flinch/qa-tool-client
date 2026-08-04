import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { apiFetch } from '../lib/api.js'
import { useAuth } from '../store/AuthContext.jsx'
import { useToastStore } from '../store/toastStore.jsx'
import Icon from '../components/Icon.jsx'
import QualityHealth, { TrendChart, featureHealthColor } from '../components/QualityHealth.jsx'

const SEVERITY_ORDER = ['critical', 'high', 'medium', 'low']

// Engineer-toned counterpart to QualityHealth's buildSummary — same idea
// (plain-English headline derived from real numbers, no invented deltas)
// but weighted toward CI/pipeline signals a client never sees, not bug
// counts alone.
function buildEngineerSummary(projectName, { failingCount, flakyCount, brokenEnvCount, passRate, hasRunHistory }) {
  if (!hasRunHistory) {
    return {
      headline: `${projectName} is just getting started.`,
      sub: 'Once automated suites have run a few times, a pass-rate snapshot shows up here.',
    }
  }
  const issues = []
  if (failingCount > 0) issues.push(`${failingCount} test${failingCount === 1 ? '' : 's'} failing`)
  if (flakyCount > 0) issues.push(`${flakyCount} test${flakyCount === 1 ? '' : 's'} flaky`)
  if (brokenEnvCount > 0) issues.push(`${brokenEnvCount} environment${brokenEnvCount === 1 ? '' : 's'} unstable`)
  if (issues.length === 0) {
    return {
      headline: `${projectName} is in good shape.`,
      sub: passRate !== null ? `${passRate}% of automated tests are passing and nothing needs attention.` : 'Nothing needs attention right now.',
    }
  }
  return {
    headline: `${projectName} needs a look.`,
    sub: passRate !== null
      ? `${issues.join(', ')}, and the pass rate has slipped to ${passRate}% over the last 5 runs.`
      : `${issues.join(', ')}.`,
  }
}

function NavCardLarge({ to, icon, title, sub }) {
  return (
    <Link to={to} style={{ textDecoration: 'none', display: 'block', height: '100%' }}>
      <div
        className="card"
        style={{ cursor: 'pointer', transition: 'border-color 0.2s', height: '100%', padding: '1.35rem 1.5rem' }}
        onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border2)'}
        onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
      >
        <div style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border2)', color: 'var(--muted)', marginBottom: '0.85rem' }}>
          <Icon name={icon} size={18} />
        </div>
        <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 700, fontSize: '1.02rem', color: 'var(--white)', marginBottom: '0.35rem' }}>{title}</div>
        <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>{sub}</div>
      </div>
    </Link>
  )
}

function NavCardSmall({ to, icon, title, sub }) {
  return (
    <Link to={to} style={{ textDecoration: 'none', display: 'block' }}>
      <div
        className="card"
        style={{ cursor: 'pointer', transition: 'border-color 0.2s', padding: '0.75rem 0.95rem', display: 'flex', alignItems: 'center', gap: '0.7rem' }}
        onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border2)'}
        onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
      >
        <div style={{ width: 24, height: 24, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border2)', color: 'var(--muted)' }}>
          <Icon name={icon} size={13} />
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 700, fontSize: '0.8rem', color: 'var(--white)', marginBottom: '0.15rem' }}>{title}</div>
          <div style={{ fontSize: '0.68rem', color: 'var(--muted)' }}>{sub}</div>
        </div>
      </div>
    </Link>
  )
}

// Click the text, it becomes an input (or textarea), Save/Cancel appear.
// One field editable at a time (editingField/editValue live in the parent)
// rather than three independent draft states — simpler to reason about and
// matches how this app's other single-value inline edits work.
function EditableField({ field, value, editingField, editValue, onEditValueChange, onStart, onSave, onCancel, saving, multiline, placeholder, textStyle, canEdit, as: Tag = 'div' }) {
  const isEditing = editingField === field

  if (isEditing) {
    const InputTag = multiline ? 'textarea' : 'input'
    return (
      <div style={{ marginBottom: '0.5rem' }}>
        <InputTag
          className={multiline ? 'form-textarea' : 'form-input'}
          value={editValue}
          onChange={e => onEditValueChange(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !multiline) onSave()
            if (e.key === 'Escape') onCancel()
          }}
          style={multiline ? { maxWidth: 600, minHeight: 70 } : { maxWidth: 400 }}
          autoFocus
        />
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.4rem' }}>
          <button className="btn btn-primary btn-sm" onClick={onSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
          <button className="btn btn-ghost btn-sm" onClick={onCancel} disabled={saving}>Cancel</button>
        </div>
      </div>
    )
  }

  if (!value) {
    return canEdit ? (
      <div
        onClick={() => onStart(field)}
        style={{ cursor: 'pointer', color: 'var(--muted)', fontSize: '0.85rem', fontStyle: 'italic', marginBottom: '0.5rem' }}
      >
        + Add {placeholder}
      </div>
    ) : null
  }

  return (
    <Tag
      onClick={canEdit ? () => onStart(field) : undefined}
      title={canEdit ? 'Click to edit' : undefined}
      style={{ ...textStyle, cursor: canEdit ? 'pointer' : 'default' }}
    >
      {value}
    </Tag>
  )
}

// The real target URL/credentials/mobile app ids CI dispatches against for
// this project (see routes/projects.js's test-config endpoints). Password
// is never round-tripped from the server — this form always starts blank
// for it, with a note when one's already saved, same "leave blank to keep
// the current secret" convention the backend PATCH already implements.
function TestConfigModal({ projectId, config, onClose, onSaved }) {
  const { addToast } = useToastStore()
  const [targetUrl, setTargetUrl] = useState(config.target_url || '')
  const [apiBaseUrl, setApiBaseUrl] = useState(config.api_base_url || '')
  const [mobileAppIdIos, setMobileAppIdIos] = useState(config.mobile_app_id_ios || '')
  const [mobileAppIdAndroid, setMobileAppIdAndroid] = useState(config.mobile_app_id_android || '')
  const [username, setUsername] = useState(config.credentialUsername || '')
  const [password, setPassword] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    setSaving(true)
    try {
      const body = {
        target_url: targetUrl,
        api_base_url: apiBaseUrl,
        mobile_app_id_ios: mobileAppIdIos,
        mobile_app_id_android: mobileAppIdAndroid,
      }
      // Only send credentials if the staffer actually typed a new password —
      // an empty password field means "leave the saved one alone," not
      // "clear it," matching the backend's own omit-to-keep semantics.
      if (username.trim() && password) {
        body.test_credentials = { username: username.trim(), password }
      }
      const updated = await apiFetch(`/projects/${projectId}/test-config`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      })
      addToast('Test environment updated')
      onSaved(updated)
      onClose()
    } catch (e) {
      addToast(e.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 480 }}>
        <div className="modal-title">Test environment</div>
        <div style={{ fontSize: '0.82rem', color: 'var(--muted)', marginBottom: '1rem' }}>
          What CI actually tests against — the app link, an API base URL if
          it's different, mobile app ids, and the login used to authenticate.
        </div>
        <div className="form-group">
          <label className="form-label">Target URL (web app)</label>
          <input className="form-input" value={targetUrl} onChange={e => setTargetUrl(e.target.value)} placeholder="https://app.example.com" />
        </div>
        <div className="form-group">
          <label className="form-label">API base URL (optional)</label>
          <input className="form-input" value={apiBaseUrl} onChange={e => setApiBaseUrl(e.target.value)} placeholder="Defaults to Target URL" />
        </div>
        <div className="form-group">
          <label className="form-label">Mobile app id — iOS (optional)</label>
          <input className="form-input" value={mobileAppIdIos} onChange={e => setMobileAppIdIos(e.target.value)} placeholder="com.example.app" />
        </div>
        <div className="form-group">
          <label className="form-label">Mobile app id — Android (optional)</label>
          <input className="form-input" value={mobileAppIdAndroid} onChange={e => setMobileAppIdAndroid(e.target.value)} placeholder="com.example.app" />
        </div>
        <div className="form-group">
          <label className="form-label">Test username</label>
          <input className="form-input" value={username} onChange={e => setUsername(e.target.value)} placeholder="Test account username" />
        </div>
        <div className="form-group">
          <label className="form-label">Test password</label>
          <input className="form-input" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder={config.hasCredentials ? 'Saved — leave blank to keep it' : 'Test account password'} />
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn btn-primary" onClick={submit} disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ProjectDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { addToast } = useToastStore()
  const [project, setProject] = useState(null)
  const [loading, setLoading] = useState(true)
  const [clientEmail, setClientEmail] = useState('')
  const [adding, setAdding] = useState(false)
  const [members, setMembers] = useState([])
  const [removingId, setRemovingId] = useState(null)
  const [editingField, setEditingField] = useState(null) // 'name' | 'client_name' | 'description' | null
  const [editValue, setEditValue] = useState('')
  const [savingField, setSavingField] = useState(false)
  const [testConfig, setTestConfig] = useState(null)
  const [showTestConfigModal, setShowTestConfigModal] = useState(false)
  const [generatingAuthSetup, setGeneratingAuthSetup] = useState(false)

  // Staff-only overview data — the hero/Engineering-card/nav-card stats and
  // snapshot panels. All reused from existing endpoints (health,
  // engineering-health, suites, runs, execution-runs) rather than one new
  // aggregating route, same multi-fetch-and-compose pattern QualityHealth
  // already uses for the client-facing view.
  const [health, setHealth] = useState(null)
  const [engHealth, setEngHealth] = useState(null)
  const [suites, setSuites] = useState([])
  const [automationRuns, setAutomationRuns] = useState([])
  const [executionRuns, setExecutionRuns] = useState([])
  const [overviewLoading, setOverviewLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const p = await apiFetch(`/projects/${id}`)
        setProject(p)
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  const loadMembers = () => {
    if (user?.role !== 'admin') return
    apiFetch(`/projects/${id}/members`).then(setMembers).catch(console.error)
  }

  useEffect(loadMembers, [id, user?.role])

  useEffect(() => {
    if (user?.role === 'client') return
    let cancelled = false
    setOverviewLoading(true)
    Promise.all([
      apiFetch(`/projects/${id}/health`),
      apiFetch(`/projects/${id}/engineering-health`),
      apiFetch(`/projects/${id}/automation/suites`).catch(() => []),
      apiFetch(`/projects/${id}/automation/runs`).catch(() => []),
      apiFetch(`/projects/${id}/execution-runs`).catch(() => []),
    ])
      .then(([h, eh, suiteRows, runRows, execRows]) => {
        if (cancelled) return
        setHealth(h)
        setEngHealth(eh)
        setSuites(suiteRows)
        setAutomationRuns(runRows)
        setExecutionRuns(execRows)
      })
      .catch(console.error)
      .finally(() => { if (!cancelled) setOverviewLoading(false) })
    return () => { cancelled = true }
  }, [id, user?.role])

  // Staff-only (qa_engineer or admin), same as the backend route — the
  // real target/credentials CI dispatches against, never client-visible.
  const loadTestConfig = () => {
    if (user?.role === 'client') return
    apiFetch(`/projects/${id}/test-config`).then(setTestConfig).catch(console.error)
  }

  useEffect(loadTestConfig, [id, user?.role])

  // In-flight auth-setup runs have no SSE hookup here (unlike AutomationPage's
  // generation runs) — a simple poll while it's actually running is enough
  // for this one status line, and stops as soon as it leaves 'in_progress'.
  useEffect(() => {
    if (testConfig?.authSetupStatus?.status !== 'in_progress') return
    const interval = setInterval(loadTestConfig, 5000)
    return () => clearInterval(interval)
  }, [testConfig?.authSetupStatus?.status, id, user?.role])

  const generateAuthSetup = async () => {
    setGeneratingAuthSetup(true)
    try {
      await apiFetch(`/projects/${id}/automation/auth-setup/generate`, { method: 'POST' })
      addToast('Generating login flow…')
      loadTestConfig()
    } catch (e) {
      addToast(e.message, 'error')
    } finally {
      setGeneratingAuthSetup(false)
    }
  }

  const startEditField = (field) => {
    setEditingField(field)
    setEditValue(project[field] || '')
  }

  const cancelEditField = () => {
    setEditingField(null)
    setEditValue('')
  }

  const saveEditField = async () => {
    if (editingField === 'name' && !editValue.trim()) {
      addToast('Name cannot be empty', 'error')
      return
    }
    setSavingField(true)
    try {
      const updated = await apiFetch(`/projects/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ [editingField]: editValue }),
      })
      setProject(p => ({ ...p, ...updated }))
      setEditingField(null)
      setEditValue('')
    } catch (e) {
      addToast(e.message, 'error')
    } finally {
      setSavingField(false)
    }
  }

  const addClient = async () => {
    if (!clientEmail.trim()) return
    setAdding(true)
    try {
      await apiFetch(`/projects/${id}/members`, { method: 'POST', body: JSON.stringify({ email: clientEmail.trim() }) })
      addToast(`${clientEmail} can now view this project`)
      setClientEmail('')
      loadMembers()
    } catch (e) {
      addToast(e.message, 'error')
    } finally {
      setAdding(false)
    }
  }

  const removeClient = async (member) => {
    if (!window.confirm(`Revoke ${member.email}'s access to this project?`)) return
    setRemovingId(member.id)
    try {
      await apiFetch(`/projects/${id}/members/${member.id}`, { method: 'DELETE' })
      setMembers(ms => ms.filter(m => m.id !== member.id))
      addToast(`${member.email} no longer has access to this project`)
    } catch (e) {
      addToast(e.message, 'error')
    } finally {
      setRemovingId(null)
    }
  }

  if (loading) return (
    <>
      <div className="topbar"><span className="topbar-title">Project</span></div>
      <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}><div className="spinner" /></div>
    </>
  )

  if (!project) return (
    <>
      <div className="topbar"><span className="topbar-title">Project</span></div>
      <div className="page-content"><div className="empty-state"><h3>Project not found</h3></div></div>
    </>
  )

  const isClient = user?.role === 'client'
  const isAdmin = user?.role === 'admin'

  // Staff-only derived values for the redesigned overview — computed at
  // render time from the health/engHealth/automationRuns state rather than
  // stashed in their own effect, so they never drift a render behind.
  let overview = null
  if (!isClient && health && engHealth) {
    const failingCount = engHealth.failingTests.length
    const flakyCount = engHealth.flakyTests.length
    const brokenEnvCount = engHealth.brokenEnvironments.length
    const prPendingCount = engHealth.prValidation.filter(r => !r.pr_status?.merged).length

    const completedRuns = automationRuns.filter(r => r.status === 'completed' && r.total > 0)
    const last5 = completedRuns.slice(0, 5)
    const passRateLast5 = last5.length > 0
      ? Math.round((last5.reduce((s, r) => s + r.passed, 0) / last5.reduce((s, r) => s + r.total, 0)) * 100)
      : null
    const trendPoints = completedRuns.slice(0, 10).map(r => ({ date: r.completed_at, passRate: Math.round((r.passed / r.total) * 100) })).reverse()

    const openBugsTotal = SEVERITY_ORDER.reduce((sum, s) => sum + health.bugsBySeverity[s], 0)
    const bugsSub = health.bugsBySeverity.critical > 0
      ? `${openBugsTotal} open · ${health.bugsBySeverity.critical} critical`
      : health.bugsBySeverity.high > 0
        ? `${openBugsTotal} open · ${health.bugsBySeverity.high} high priority`
        : openBugsTotal > 0 ? `${openBugsTotal} open` : 'All clear'

    const summary = buildEngineerSummary(project.name, {
      failingCount, flakyCount, brokenEnvCount, passRate: passRateLast5, hasRunHistory: automationRuns.length > 0,
    })
    // Status pill is driven by pass rate + flaky count only — the two
    // signals that actually describe how healthy the automated suite is
    // right now. Same tiering QualityHealth's client-facing score already
    // uses (< 70 needs attention, < 90 good, else excellent), with flaky
    // tests as an added trigger since a high pass rate propped up by
    // inconsistent tests isn't actually "excellent." Failing-test count and
    // broken environments are real and still shown (KPI strip, Engineering
    // card), just not what decides this specific badge.
    const status = (automationRuns.length === 0 || passRateLast5 === null)
      ? { label: 'Not enough data yet', color: 'var(--muted)' }
      : (passRateLast5 < 70 || flakyCount >= 3)
        ? { label: 'Needs attention', color: 'var(--danger)' }
        : (passRateLast5 < 90 || flakyCount > 0)
          ? { label: 'Good', color: 'var(--warning)' }
          : { label: 'Excellent', color: 'var(--success)' }

    const engDescParts = []
    if (failingCount > 0) engDescParts.push(`${failingCount} test${failingCount === 1 ? '' : 's'} failing`)
    if (brokenEnvCount > 0) engDescParts.push(`${brokenEnvCount} environment${brokenEnvCount === 1 ? '' : 's'} down`)
    if (prPendingCount > 0) engDescParts.push(`${prPendingCount} PR${prPendingCount === 1 ? '' : 's'} waiting on review`)
    const engDesc = engDescParts.length > 0
      ? `${engDescParts.join(', ')} — triage and fix it all from here.`
      : 'Nothing urgent right now — browse failing tests, flaky history, and PR review from here.'

    overview = { failingCount, flakyCount, brokenEnvCount, passRateLast5, trendPoints, openBugsTotal, bugsSub, summary, status, engDesc }
  }

  return (
    <>
      <div className="topbar">
        {isClient ? (
          <>
            <span className="topbar-title">{project.name}</span>
            {/* QualityHealth portals its NotificationBell into this node —
                keeps the bell in the actual page topbar (true "top of the
                page") without QualityHealth needing to duplicate the
                bugs/runs/requirements fetch it already owns. */}
            <div className="topbar-actions" id="client-topbar-bell" />
          </>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button className="back-btn" onClick={() => navigate(-1)} title="Back" aria-label="Back"><Icon name="arrowLeft" size={14} /></button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
              <Link to="/projects" style={{ color: 'var(--muted)', textDecoration: 'none' }}>Projects</Link>
              <span style={{ color: 'var(--muted)' }}>/</span>
              <span className="topbar-title">{project.name}</span>
            </div>
          </div>
        )}
      </div>
      <div className="page-content fade-in">
        <div style={{ marginBottom: '2rem' }}>
          <EditableField
            as="h1" field="name" value={project.name} canEdit={!isClient}
            editingField={editingField} editValue={editValue} onEditValueChange={setEditValue}
            onStart={startEditField} onSave={saveEditField} onCancel={cancelEditField} saving={savingField}
            textStyle={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: '1.5rem', fontWeight: 700, color: 'var(--white)', marginBottom: '0.25rem' }}
          />
          <EditableField
            field="client_name" value={project.client_name} canEdit={!isClient} placeholder="company name"
            editingField={editingField} editValue={editValue} onEditValueChange={setEditValue}
            onStart={startEditField} onSave={saveEditField} onCancel={cancelEditField} saving={savingField}
            textStyle={{ color: 'var(--accent)', fontSize: '0.88rem', marginBottom: '0.5rem' }}
          />
          <EditableField
            field="description" value={project.description} canEdit={!isClient} placeholder="description" multiline
            editingField={editingField} editValue={editValue} onEditValueChange={setEditValue}
            onStart={startEditField} onSave={saveEditField} onCancel={cancelEditField} saving={savingField}
            textStyle={{ color: 'var(--muted)', fontSize: '0.9rem', maxWidth: 600 }}
          />
        </div>

        {isClient ? (
          <QualityHealth projectId={id} projectName={project.name} />
        ) : (
          <>
            {overviewLoading || !overview ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}><div className="spinner" /></div>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: '1.1rem', marginBottom: '1.1rem', alignItems: 'start' }}>
                  <div className="health-hero" style={{ marginBottom: 0 }}>
                    <div className="health-hero-top">
                      <div>
                        <h1 className="health-greeting-h1" style={{ marginBottom: '0.3rem' }}>{overview.summary.headline}</h1>
                        <div className="health-greeting-sub">{overview.summary.sub}</div>
                      </div>
                      <div className="health-status-pill" style={{ borderColor: overview.status.color, color: overview.status.color }}>
                        <span className="health-status-dot" style={{ background: overview.status.color }} />
                        {overview.status.label}
                      </div>
                    </div>
                    <div className="health-kpi-strip" style={{ marginTop: '1.35rem' }}>
                      <div className="health-kpi">
                        <div className="health-kpi-label">Pass rate</div>
                        <div className="health-kpi-num" style={{ color: overview.passRateLast5 === null ? 'var(--white)' : featureHealthColor(overview.passRateLast5) }}>
                          {overview.passRateLast5 === null ? '—' : `${overview.passRateLast5}%`}
                        </div>
                        <div className="health-kpi-sub">last 5 runs</div>
                      </div>
                      <div className="health-kpi">
                        <div className="health-kpi-label">Failing now</div>
                        <div className="health-kpi-num" style={{ color: overview.failingCount > 0 ? 'var(--danger)' : 'var(--white)' }}>{overview.failingCount}</div>
                        <div className="health-kpi-sub">{overview.failingCount > 0 ? 'in the latest run' : 'nothing failing'}</div>
                      </div>
                      <div className="health-kpi">
                        <div className="health-kpi-label">Flaky tests</div>
                        <div className="health-kpi-num" style={{ color: overview.flakyCount > 0 ? 'var(--warning)' : 'var(--white)' }}>{overview.flakyCount}</div>
                        <div className="health-kpi-sub">flipped pass/fail</div>
                      </div>
                      <div className="health-kpi">
                        <div className="health-kpi-label">Automated</div>
                        <div className="health-kpi-num">{health.automationCoverage !== null ? `${health.automationCoverage}%` : '—'}</div>
                        <div className="health-kpi-sub">{health.totalTestCases > 0 ? `${health.automatedTestCases} of ${health.totalTestCases} cases` : 'No test cases yet'}</div>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
                    {isAdmin && (
                      <div className="card">
                        <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 700, color: 'var(--white)', marginBottom: '0.5rem' }}>Share with a client</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginBottom: '0.75rem' }}>
                          They need to have already signed up. This gives them read-only access to this project's stats.
                        </div>
                        {members.length > 0 && (
                          <div style={{ marginBottom: '0.9rem' }}>
                            {members.map(m => (
                              <div key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.4rem 0', borderBottom: '1px solid var(--border)' }}>
                                <div style={{ fontSize: '0.83rem', color: 'var(--light)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name || m.email}</div>
                                <button
                                  className="btn btn-danger btn-sm"
                                  onClick={() => removeClient(m)}
                                  disabled={removingId === m.id}
                                  style={{ flexShrink: 0 }}
                                >
                                  {removingId === m.id ? 'Removing…' : 'Unshare'}
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <input
                            className="form-input"
                            placeholder="client@company.com"
                            value={clientEmail}
                            onChange={e => setClientEmail(e.target.value)}
                            style={{ flex: 1, minWidth: 0 }}
                          />
                          <button className="btn btn-primary btn-sm" onClick={addClient} disabled={adding || !clientEmail.trim()}>
                            {adding ? 'Adding…' : 'Add'}
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="health-panel" style={{ flex: 1 }}>
                      <div className="health-panel-head">
                        <div className="health-panel-title">Flaky tests</div>
                        <Link to={`/projects/${id}/engineering`} className="health-panel-link">Engineering <Icon name="arrowRight" size={11} /></Link>
                      </div>
                      {engHealth.flakyTests.length === 0 ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--success)' }}>
                          <Icon name="check" size={15} /> No flaky tests detected.
                        </div>
                      ) : (
                        engHealth.flakyTests.map((t, i) => (
                          <div key={`${t.suite_name}-${t.test_title}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 0', borderBottom: i < engHealth.flakyTests.length - 1 ? '1px solid var(--border)' : 'none' }}>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: '0.85rem', color: 'var(--light)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.test_title}</div>
                              <div style={{ fontSize: '0.72rem', color: 'var(--accent2)' }}>{t.suite_name}</div>
                            </div>
                            <span style={{ fontSize: '0.78rem', color: 'var(--warning)', fontWeight: 600, flexShrink: 0 }}>{t.passed_count}/{t.runs_considered} passed</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                <Link
                  to={`/projects/${id}/engineering`}
                  style={{
                    textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '1.4rem',
                    background: 'linear-gradient(180deg, var(--accent-tint), var(--accent-glow-soft))',
                    border: '1px solid var(--accent-border)', padding: '1.4rem 1.75rem', marginBottom: '1.1rem',
                  }}
                >
                  <div style={{ width: 50, height: 50, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--accent)', color: 'var(--white)' }}>
                    <Icon name="hammer" size={22} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem', marginBottom: '0.35rem' }}>
                      <span style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: '1.25rem', fontWeight: 700, color: 'var(--white)' }}>Engineering</span>
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.64rem', letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--accent2)' }}>Most visited</span>
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--light)', maxWidth: '62ch', lineHeight: 1.5 }}>{overview.engDesc}</div>
                  </div>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'var(--accent)', color: 'var(--white)', fontWeight: 700, fontSize: '0.88rem', padding: '0.7rem 1.3rem', flexShrink: 0 }}>
                    Open Engineering <Icon name="arrowRight" size={14} />
                  </span>
                </Link>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '0.9rem', marginBottom: '0.8rem' }}>
                  <NavCardLarge
                    to={`/projects/${id}/automation`} icon="gear" title="Automation"
                    sub={`${suites.length} suite${suites.length === 1 ? '' : 's'} · nightly + on-demand runs`}
                  />
                  <NavCardLarge to={`/projects/${id}/bugs`} icon="bug" title="Bugs" sub={overview.bugsSub} />
                  <NavCardLarge
                    to={`/projects/${id}/executions`} icon="play" title="Executions"
                    sub={executionRuns.length > 0 ? `${executionRuns.length} session${executionRuns.length === 1 ? '' : 's'} logged` : 'No sessions logged yet'}
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.75rem', marginBottom: '1.4rem' }}>
                  <NavCardSmall
                    to={`/projects/${id}/tests`} icon="check" title="Test cases"
                    sub={`${health.testCases.total} cases · ${health.automatedTestCases} automated`}
                  />
                  <NavCardSmall
                    to={`/projects/${id}/requirements`} icon="target" title="Requirements"
                    sub={health.totalRequirements > 0 ? `${health.totalRequirements} requirements · ${health.requirementCoverage}% covered` : 'No requirements tracked yet'}
                  />
                </div>

                <div className="health-panel" style={{ marginBottom: '1.1rem' }}>
                  <div className="health-panel-head">
                    <div className="health-panel-title">Pass rate — last 10 runs</div>
                    <Link to={`/projects/${id}/automation`} className="health-panel-link">Automation <Icon name="arrowRight" size={11} /></Link>
                  </div>
                  {overview.trendPoints.length >= 2 ? (
                    <TrendChart points={overview.trendPoints} />
                  ) : (
                    <div style={{ fontSize: '0.85rem', color: 'var(--muted)', padding: '0.75rem 0' }}>Run a suite a few more times to start tracking a trend here.</div>
                  )}
                </div>
              </>
            )}
            {testConfig && (
              <div className="health-panel" style={{ marginBottom: '1.25rem' }}>
                <div className="health-panel-head">
                  <div className="health-panel-title">Test environment</div>
                  <button className="btn btn-ghost btn-sm" onClick={() => setShowTestConfigModal(true)}>Edit</button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.9rem 2rem' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.64rem', letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--faint)', marginBottom: '0.3rem' }}>Target</div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--light)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {testConfig.target_url || 'Using default demo app'}
                    </div>
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.64rem', letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--faint)', marginBottom: '0.3rem' }}>Login</div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--light)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {testConfig.hasCredentials ? testConfig.credentialUsername : 'Using default demo account'}
                    </div>
                  </div>
                </div>

                {testConfig.authSetupStatus?.needed && (
                  <div style={{ marginTop: '1rem', paddingTop: '0.85rem', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
                    {testConfig.authSetupStatus.status === 'verified' && (
                      <span style={{ fontSize: '0.83rem', color: 'var(--success)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <Icon name="check" size={14} /> Login flow verified
                      </span>
                    )}
                    {testConfig.authSetupStatus.status === 'not_generated' && (
                      <>
                        <span style={{ fontSize: '0.83rem', color: 'var(--muted)' }}>Login flow not generated yet</span>
                        <button className="btn btn-primary btn-sm" onClick={generateAuthSetup} disabled={generatingAuthSetup}>
                          {generatingAuthSetup ? 'Starting…' : 'Generate login flow'}
                        </button>
                      </>
                    )}
                    {testConfig.authSetupStatus.status === 'in_progress' && (
                      <span style={{ fontSize: '0.83rem', color: 'var(--warning)' }}>Login flow generating…</span>
                    )}
                    {testConfig.authSetupStatus.status === 'pending_review' && (
                      <>
                        <span style={{ fontSize: '0.83rem', color: 'var(--warning)' }}>Login flow PR awaiting merge</span>
                        {testConfig.authSetupStatus.pr_url && (
                          <a href={testConfig.authSetupStatus.pr_url} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm">View PR</a>
                        )}
                      </>
                    )}
                    {testConfig.authSetupStatus.status === 'failed' && (
                      <>
                        <span style={{ fontSize: '0.83rem', color: 'var(--danger)' }}>Login flow generation failed</span>
                        <button className="btn btn-primary btn-sm" onClick={generateAuthSetup} disabled={generatingAuthSetup}>
                          {generatingAuthSetup ? 'Starting…' : 'Retry'}
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
      {showTestConfigModal && testConfig && (
        <TestConfigModal
          projectId={id}
          config={testConfig}
          onClose={() => setShowTestConfigModal(false)}
          onSaved={setTestConfig}
        />
      )}
    </>
  )
}