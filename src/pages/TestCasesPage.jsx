import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAuth } from '@clerk/clerk-react'
import { apiFetch } from '../lib/api.js'
import { useToastStore } from '../store/toastStore.jsx'

const TYPE_LABELS = { functional: 'Functional', integration: 'Integration', e2e: 'E2E' }
const STATUS_LABELS = { pass: 'Pass', fail: 'Fail', not_run: 'Not run' }

function GenerateModal({ projectId, onClose, onGenerated }) {
  const { getToken } = useAuth()
  const { addToast } = useToastStore()
  const [requirements, setRequirements] = useState('')
  const [loading, setLoading] = useState(false)

  const generate = async () => {
    if (!requirements.trim()) return
    setLoading(true)
    try {
      const cases = await apiFetch(`/projects/${projectId}/test-cases/generate`, {
        method: 'POST',
        body: JSON.stringify({ requirements }),
      }, getToken)
      addToast(`${cases.length} test cases generated`)
      onGenerated(cases)
      onClose()
    } catch (e) {
      addToast(e.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 640 }}>
        <div className="modal-title">Generate test cases with AI</div>
        <div style={{ fontSize: '0.85rem', color: 'var(--muted)', marginBottom: '1rem', lineHeight: 1.6 }}>
          Paste requirements, user stories, or feature descriptions. The AI will generate functional, integration, and e2e test cases.
        </div>
        <div className="form-group">
          <label className="form-label">Requirements</label>
          <textarea
            className="form-textarea"
            style={{ minHeight: 180 }}
            placeholder="e.g. Users should be able to create an account with email and password. The email must be unique. Password must be at least 8 characters..."
            value={requirements}
            onChange={e => setRequirements(e.target.value)}
          />
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose} disabled={loading}>Cancel</button>
          <button className="btn btn-primary" onClick={generate} disabled={loading || !requirements.trim()}>
            {loading ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div className="spinner" style={{ width: 14, height: 14, borderWidth: 1.5 }} /> Generating...
              </span>
            ) : '✨ Generate'}
          </button>
        </div>
      </div>
    </div>
  )
}

function TestCaseRow({ tc, onStatusChange }) {
  const { getToken } = useAuth()
  const { addToast } = useToastStore()
  const [updating, setUpdating] = useState(false)

  const cycleStatus = async () => {
    const next = { not_run: 'pass', pass: 'fail', fail: 'not_run' }[tc.status]
    setUpdating(true)
    try {
      await apiFetch(`/test-cases/${tc.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: next }),
      }, getToken)
      onStatusChange(tc.id, next)
    } catch (e) {
      addToast(e.message, 'error')
    } finally {
      setUpdating(false)
    }
  }

  return (
    <tr>
      <td style={{ maxWidth: 320 }}>
        <div style={{ fontWeight: 500, color: 'var(--light)', marginBottom: '0.2rem' }}>{tc.title}</div>
        {tc.steps?.length > 0 && (
          <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>{tc.steps.length} step{tc.steps.length !== 1 ? 's' : ''}</div>
        )}
      </td>
      <td><span className={`badge badge-${tc.type}`}>{TYPE_LABELS[tc.type]}</span></td>
      <td>
        <button
          onClick={cycleStatus}
          disabled={updating}
          className={`badge badge-${tc.status === 'not_run' ? 'not-run' : tc.status}`}
          style={{ cursor: 'pointer', border: 'none', background: 'inherit' }}
          title="Click to cycle status"
        >
          {STATUS_LABELS[tc.status]}
        </button>
      </td>
      <td style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>
        {new Date(tc.created_at).toLocaleDateString()}
      </td>
    </tr>
  )
}

export default function TestCasesPage() {
  const { id } = useParams()
  const { getToken } = useAuth()
  const [testCases, setTestCases] = useState([])
  const [loading, setLoading] = useState(true)
  const [showGenerate, setShowGenerate] = useState(false)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    apiFetch(`/projects/${id}/test-cases`, {}, getToken)
      .then(setTestCases)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [id])

  const handleStatusChange = (tcId, newStatus) => {
    setTestCases(tcs => tcs.map(tc => tc.id === tcId ? { ...tc, status: newStatus } : tc))
  }

  const filtered = filter === 'all' ? testCases : testCases.filter(tc =>
    filter === 'pass' || filter === 'fail' || filter === 'not_run' ? tc.status === filter : tc.type === filter
  )

  const counts = {
    pass: testCases.filter(t => t.status === 'pass').length,
    fail: testCases.filter(t => t.status === 'fail').length,
    not_run: testCases.filter(t => t.status === 'not_run').length,
  }

  return (
    <>
      <div className="topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
          <Link to="/projects" style={{ color: 'var(--muted)', textDecoration: 'none' }}>Projects</Link>
          <span style={{ color: 'var(--muted)' }}>/</span>
          <Link to={`/projects/${id}`} style={{ color: 'var(--muted)', textDecoration: 'none' }}>Project</Link>
          <span style={{ color: 'var(--muted)' }}>/</span>
          <span className="topbar-title">Test cases</span>
        </div>
        <div className="topbar-actions">
          <button className="btn btn-primary btn-sm" onClick={() => setShowGenerate(true)}>✨ Generate</button>
        </div>
      </div>

      <div className="page-content fade-in">
        {testCases.length > 0 && (
          <div className="stats-row" style={{ marginBottom: '1.5rem' }}>
            <div className="stat-card"><div className="stat-num">{testCases.length}</div><div className="stat-label">Total</div></div>
            <div className="stat-card"><div className="stat-num" style={{ color: 'var(--success)' }}>{counts.pass}</div><div className="stat-label">Passed</div></div>
            <div className="stat-card"><div className="stat-num" style={{ color: 'var(--danger)' }}>{counts.fail}</div><div className="stat-label">Failed</div></div>
            <div className="stat-card"><div className="stat-num" style={{ color: 'var(--muted)' }}>{counts.not_run}</div><div className="stat-label">Not run</div></div>
          </div>
        )}

        <div className="filters-row">
          {['all','functional','integration','e2e','pass','fail','not_run'].map(f => (
            <button key={f} className={`filter-btn${filter === f ? ' active' : ''}`} onClick={() => setFilter(f)}>
              {f === 'all' ? 'All' : f === 'not_run' ? 'Not run' : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}><div className="spinner" /></div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <h3>{testCases.length === 0 ? 'No test cases yet' : 'No results for this filter'}</h3>
            <p>{testCases.length === 0 ? 'Generate test cases from requirements or add them manually.' : 'Try a different filter.'}</p>
            {testCases.length === 0 && <button className="btn btn-primary" onClick={() => setShowGenerate(true)}>✨ Generate test cases</button>}
          </div>
        ) : (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Test case</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(tc => (
                    <TestCaseRow key={tc.id} tc={tc} onStatusChange={handleStatusChange} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {showGenerate && (
        <GenerateModal
          projectId={id}
          onClose={() => setShowGenerate(false)}
          onGenerated={cases => setTestCases(tcs => [...cases, ...tcs])}
        />
      )}
    </>
  )
}
