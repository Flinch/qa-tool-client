import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { apiFetch } from '../lib/api.js'
import { useAuth } from '../store/AuthContext.jsx'
import { useToastStore } from '../store/toastStore.jsx'
import Icon from '../components/Icon.jsx'
import HealConfirmModal from '../components/HealConfirmModal.jsx'

const REVIEW_STATUS_LABEL = {
  pending_review: 'Pending review',
  healed_pending_review: 'Healed — pending review',
  flagged_regression: 'Flagged regression',
}
const REVIEW_STATUS_COLOR = {
  pending_review: 'var(--warning)',
  healed_pending_review: 'var(--warning)',
  flagged_regression: 'var(--danger)',
}

// A test's last real (non-diagnostic) run status — 'Never run' when it has
// never been part of a real suite execution yet.
function LastRunBadge({ status }) {
  if (!status) return <span style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>Never run</span>
  if (status === 'passed') return <span className="badge badge-pass">Passed</span>
  if (status === 'failed') return <span className="badge badge-fail">Failed</span>
  return <span style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>{status}</span>
}

// One row per automated_test_cases roster entry. `isLab` is only true on
// the cross-suite "The Lab" view (the old "Generated test cases" page,
// renamed) — that's the only place last-run status + re-run/heal actions
// apply; on a single suite's own roster page, which suite it's in is
// already obvious from the breadcrumb and this stays a plain browsing list.
function TestCaseRow({ tc, isLab, onRerun, onRequestHeal, busy }) {
  const reviewLabel = REVIEW_STATUS_LABEL[tc.review_status]
  return (
    <div style={{ padding: '0.85rem 0', borderBottom: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <div style={{ color: 'var(--white)', fontSize: '0.88rem', fontWeight: 600, marginBottom: '0.15rem' }}>
            {tc.linked_test_case_title || tc.title}
          </div>
          <div style={{ color: 'var(--muted)', fontSize: '0.76rem' }}>
            {isLab && <span style={{ color: 'var(--accent2)' }}>{tc.suite_name} · </span>}
            {tc.linked_test_case_title ? tc.title : tc.origin === 'generated' ? 'Generated' : 'Manual'}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexShrink: 0 }}>
          {isLab && <LastRunBadge status={tc.last_status} />}
          {reviewLabel && (
            <span style={{
              fontSize: '0.72rem', fontWeight: 600, color: REVIEW_STATUS_COLOR[tc.review_status],
              border: `1px solid ${REVIEW_STATUS_COLOR[tc.review_status]}`, borderRadius: 0, padding: '0.15rem 0.6rem',
            }}>
              {reviewLabel}
            </span>
          )}
        </div>
      </div>
      {isLab && tc.last_status === 'failed' && tc.last_error_message && (
        <div style={{ fontSize: '0.74rem', color: 'var(--danger)', marginTop: '0.4rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {tc.last_error_message}
        </div>
      )}
      <div style={{ marginTop: '0.5rem', display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
        {tc.github_url && (
          <a href={tc.github_url} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm">
            <Icon name="link" size={12} /> View on GitHub
          </a>
        )}
        {isLab && tc.last_status === 'failed' && (
          <>
            <button className="btn btn-ghost btn-sm" onClick={() => onRerun(tc)} disabled={busy}>
              Re-run
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => onRequestHeal(tc)} disabled={busy}>
              Diagnose &amp; heal
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export default function SuiteTestCasesPage() {
  const { id, suiteId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const isClient = user?.role === 'client'
  const { addToast } = useToastStore()
  const [project, setProject] = useState(null)
  const [suite, setSuite] = useState(null)
  const [testCases, setTestCases] = useState([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState(null)
  const [healConfirm, setHealConfirm] = useState(null) // { runId, resultId, title, suiteName }
  const [healing, setHealing] = useState(false)

  const isLab = !suiteId

  useEffect(() => { apiFetch(`/projects/${id}`).then(setProject).catch(console.error) }, [id])

  // The Lab is staff-only (AI generation/healing internals) — a client who
  // lands here (bookmarked/typed URL) is bounced back to Automation instead
  // of mounting a page whose data now 403s. The single-suite roster below
  // stays client-visible.
  useEffect(() => {
    if (isLab && isClient) navigate(`/projects/${id}/automation`, { replace: true })
  }, [isLab, isClient, id, navigate])

  const load = () => {
    if (isLab && isClient) { setLoading(false); return Promise.resolve() }
    setLoading(true)
    const path = suiteId
      ? `/projects/${id}/automation/suites/${suiteId}/test-cases`
      : `/projects/${id}/automation/generated-test-cases`
    return apiFetch(path)
      .then(data => {
        setSuite(data.suite || null)
        setTestCases(data.testCases)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [id, suiteId])

  const rerun = async (tc) => {
    setBusyId(tc.id)
    try {
      await apiFetch(`/projects/${id}/automation/runs/${tc.last_run_id}/rerun`, {
        method: 'POST',
        body: JSON.stringify({ result_ids: [tc.last_result_id] }),
      })
      addToast(`Re-run started for "${tc.title}"`)
    } catch (e) {
      addToast(e.message, 'error')
    } finally {
      setBusyId(null)
    }
  }

  const confirmHeal = async (context) => {
    if (!healConfirm) return
    setHealing(true)
    try {
      await apiFetch(`/projects/${id}/automation/runs/${healConfirm.runId}/heal`, {
        method: 'POST',
        body: JSON.stringify({ result_id: healConfirm.resultId, context: context || undefined }),
      })
      addToast(`Healing started for "${healConfirm.title}"`)
      setHealConfirm(null)
    } catch (e) {
      addToast(e.message, 'error')
    } finally {
      setHealing(false)
    }
  }

  const pageTitle = suiteId ? (suite?.name || 'Suite') : 'The Lab'

  return (
    <>
      <div className="topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button className="back-btn" onClick={() => navigate(-1)} title="Back" aria-label="Back"><Icon name="arrowLeft" size={14} /></button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
            <Link to="/projects" style={{ color: 'var(--muted)', textDecoration: 'none' }}>Projects</Link>
            <span style={{ color: 'var(--muted)' }}>/</span>
            <Link to={`/projects/${id}`} style={{ color: 'var(--muted)', textDecoration: 'none' }}>{project?.name || 'Project'}</Link>
            <span style={{ color: 'var(--muted)' }}>/</span>
            <Link to={`/projects/${id}/automation`} style={{ color: 'var(--muted)', textDecoration: 'none' }}>Automation</Link>
            <span style={{ color: 'var(--muted)' }}>/</span>
            <span className="topbar-title">{pageTitle}</span>
          </div>
        </div>
      </div>
      <div className="page-content fade-in">
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}><div className="spinner" /></div>
        ) : testCases.length === 0 ? (
          <div className="empty-state">
            <h3>No test cases yet</h3>
            <p>
              {suiteId
                ? 'This suite has no automated test cases in its roster yet — it picks them up automatically the first time it runs.'
                : 'No AI-generated test cases found yet across any suite in this project.'}
            </p>
          </div>
        ) : (
          <div className="card" style={{ padding: '0 1rem' }}>
            {testCases.map(tc => (
              <TestCaseRow
                key={tc.id}
                tc={tc}
                isLab={isLab}
                busy={busyId === tc.id}
                onRerun={rerun}
                onRequestHeal={(t) => setHealConfirm({ runId: t.last_run_id, resultId: t.last_result_id, title: t.title, suiteName: t.suite_name })}
              />
            ))}
          </div>
        )}
      </div>

      {healConfirm && (
        <HealConfirmModal
          testTitle={healConfirm.title}
          suiteName={healConfirm.suiteName}
          healing={healing}
          onCancel={() => setHealConfirm(null)}
          onConfirm={confirmHeal}
        />
      )}
    </>
  )
}
