import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { apiFetch } from '../lib/api.js'
import Icon from '../components/Icon.jsx'

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

// One row per automated_test_cases roster entry. `showSuite` is only true on
// the cross-suite "Generated test cases" view — on a single suite's own
// page, which suite it's in is already obvious from the breadcrumb.
function TestCaseRow({ tc, showSuite }) {
  const reviewLabel = REVIEW_STATUS_LABEL[tc.review_status]
  return (
    <div style={{ padding: '0.85rem 0', borderBottom: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <div style={{ color: 'var(--white)', fontSize: '0.88rem', fontWeight: 600, marginBottom: '0.15rem' }}>
            {tc.linked_test_case_title || tc.title}
          </div>
          <div style={{ color: 'var(--muted)', fontSize: '0.76rem' }}>
            {showSuite && <span style={{ color: 'var(--accent2)' }}>{tc.suite_name} · </span>}
            {tc.linked_test_case_title ? tc.title : tc.origin === 'generated' ? 'Generated' : 'Manual'}
          </div>
        </div>
        {reviewLabel && (
          <span style={{
            fontSize: '0.72rem', fontWeight: 600, color: REVIEW_STATUS_COLOR[tc.review_status],
            border: `1px solid ${REVIEW_STATUS_COLOR[tc.review_status]}`, borderRadius: 0, padding: '0.15rem 0.6rem',
          }}>
            {reviewLabel}
          </span>
        )}
      </div>
      {tc.github_url && (
        <div style={{ marginTop: '0.5rem' }}>
          <a href={tc.github_url} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm">
            <Icon name="link" size={12} /> View on GitHub
          </a>
        </div>
      )}
    </div>
  )
}

export default function SuiteTestCasesPage() {
  const { id, suiteId } = useParams()
  const navigate = useNavigate()
  const [project, setProject] = useState(null)
  const [suite, setSuite] = useState(null)
  const [testCases, setTestCases] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { apiFetch(`/projects/${id}`).then(setProject).catch(console.error) }, [id])

  useEffect(() => {
    setLoading(true)
    const path = suiteId
      ? `/projects/${id}/automation/suites/${suiteId}/test-cases`
      : `/projects/${id}/automation/generated-test-cases`
    apiFetch(path)
      .then(data => {
        setSuite(data.suite || null)
        setTestCases(data.testCases)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [id, suiteId])

  const pageTitle = suiteId ? (suite?.name || 'Suite') : 'Generated test cases'

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
            {testCases.map(tc => <TestCaseRow key={tc.id} tc={tc} showSuite={!suiteId} />)}
          </div>
        )}
      </div>
    </>
  )
}
