import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { apiFetch } from '../lib/api.js'
import { useToastStore } from '../store/toastStore.jsx'
import { timeAgo } from '../lib/timeAgo.js'
import Icon from '../components/Icon.jsx'

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

// Staff-only counterpart to QualityHealth — engineering-facing signal
// (failing tests, broken environments, PR validation, automation review
// backlog) rather than the client-facing health story. Everything here is
// off-limits to the client role under the AI-visibility rule.
export default function EngineeringDashboardPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { addToast } = useToastStore()
  const [project, setProject] = useState(null)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [advisorRecs, setAdvisorRecs] = useState(null)
  const [advisorLoading, setAdvisorLoading] = useState(false)

  useEffect(() => { apiFetch(`/projects/${id}`).then(setProject).catch(console.error) }, [id])

  useEffect(() => {
    setLoading(true)
    apiFetch(`/projects/${id}/engineering-health`)
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [id])

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
      </div>
      <div className="page-content fade-in">
        {loading || !data ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}><div className="spinner" /></div>
        ) : (
          <div className="health-body-grid">
            <div>
              <div className="health-panel">
                <div className="health-panel-head">
                  <div className="health-panel-title">Failing tests</div>
                  <Link to={`/projects/${id}/automation`} className="health-panel-link">Automation <Icon name="arrowRight" size={11} /></Link>
                </div>
                {data.failingTests.length === 0 ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--success)' }}>
                    <Icon name="check" size={15} /> Nothing failing right now.
                  </div>
                ) : (
                  data.failingTests.map((t, i) => (
                    <div key={`${t.suite_id}-${t.test_title}`} style={{ padding: '0.6rem 0', borderBottom: i < data.failingTests.length - 1 ? '1px solid var(--border)' : 'none' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem' }}>
                        <span style={{ fontSize: '0.85rem', color: 'var(--light)', fontWeight: 600 }}>{t.test_title}</span>
                        <span style={{ fontSize: '0.72rem', color: 'var(--faint)', flexShrink: 0 }}>{timeAgo(t.completed_at)}</span>
                      </div>
                      <div style={{ fontSize: '0.76rem', color: 'var(--accent2)', marginTop: '0.1rem' }}>{t.suite_name}</div>
                      {t.error_message && (
                        <div style={{ fontSize: '0.74rem', color: 'var(--danger)', marginTop: '0.25rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {t.error_message}
                        </div>
                      )}
                    </div>
                  ))
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
                  data.prValidation.map((r, i) => (
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
                  ))
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
                  data.brokenEnvironments.map(b => (
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
                  ))
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
                  data.flakyTests.map((t, i) => (
                    <div key={`${t.suite_name}-${t.test_title}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 0', borderBottom: i < data.flakyTests.length - 1 ? '1px solid var(--border)' : 'none' }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: '0.85rem', color: 'var(--light)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.test_title}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--accent2)' }}>{t.suite_name}</div>
                      </div>
                      <span style={{ fontSize: '0.78rem', color: 'var(--warning)', fontWeight: 600, flexShrink: 0 }}>
                        {t.failed_count}/{t.runs_considered} failed
                      </span>
                    </div>
                  ))
                )}
              </div>

              <div className="health-panel">
                <div className="health-panel-head">
                  <div className="health-panel-title">Automation review backlog</div>
                  <Link to={`/projects/${id}/automation/generated-test-cases`} className="health-panel-link">The Lab <Icon name="arrowRight" size={11} /></Link>
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
    </>
  )
}
