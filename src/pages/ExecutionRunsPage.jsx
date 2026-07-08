import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { apiFetch } from '../lib/api.js'
import { useToastStore } from '../store/toastStore.jsx'

const TYPE_LABELS = { functional: 'Functional', integration: 'Integration', e2e: 'E2E' }

export function RunStatusBadge({ status }) {
  const labels = { not_started: 'Not started', in_progress: 'In progress', completed: 'Completed' }
  const cls = status === 'in_progress' ? 'in-progress' : status.replace('_', '-')
  return <span className={`badge badge-${cls}`}>{labels[status] || status}</span>
}

function CreateRunModal({ projectId, onClose, onCreated }) {
  const { addToast } = useToastStore()
  const [name, setName] = useState('')
  const [testCases, setTestCases] = useState([])
  const [suites, setSuites] = useState([])
  const [selectedTcIds, setSelectedTcIds] = useState(new Set())
  const [selectedSuiteIds, setSelectedSuiteIds] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    Promise.all([
      apiFetch(`/projects/${projectId}/test-cases`),
      apiFetch(`/projects/${projectId}/automation/suites`),
    ]).then(([tcs, s]) => {
      setTestCases(tcs)
      setSuites(s)
    }).catch(e => addToast(e.message, 'error')).finally(() => setLoading(false))
  }, [projectId])

  const toggle = (set, setSet, id) => {
    const next = new Set(set)
    next.has(id) ? next.delete(id) : next.add(id)
    setSet(next)
  }

  const create = async () => {
    if (!name.trim()) return
    setSaving(true)
    try {
      const run = await apiFetch(`/projects/${projectId}/execution-runs`, {
        method: 'POST',
        body: JSON.stringify({
          name,
          test_case_ids: [...selectedTcIds],
          suite_ids: [...selectedSuiteIds],
        }),
      })
      addToast('Execution run created')
      onCreated(run)
      onClose()
    } catch (e) {
      addToast(e.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const canCreate = name.trim() && (selectedTcIds.size > 0 || selectedSuiteIds.size > 0)

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 640 }}>
        <div className="modal-title">New execution run</div>

        <div className="form-group">
          <label className="form-label">Name</label>
          <input className="form-input" placeholder="e.g. Sprint 14 regression" value={name} onChange={e => setName(e.target.value)} />
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}><div className="spinner" /></div>
        ) : (
          <>
            <div className="form-group">
              <label className="form-label">
                Test cases {selectedTcIds.size > 0 && `(${selectedTcIds.size} selected)`}
              </label>
              {testCases.length === 0 ? (
                <div className="form-hint">No test cases in this project yet.</div>
              ) : (
                <div className="checkbox-list">
                  {testCases.map(tc => (
                    <label key={tc.id}>
                      <input
                        type="checkbox"
                        checked={selectedTcIds.has(tc.id)}
                        onChange={() => toggle(selectedTcIds, setSelectedTcIds, tc.id)}
                      />
                      <span style={{ flex: 1 }}>{tc.title}</span>
                      <span className={`badge badge-${tc.type}`}>{TYPE_LABELS[tc.type]}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">
                Automation suites {selectedSuiteIds.size > 0 && `(${selectedSuiteIds.size} selected)`}
              </label>
              {suites.length === 0 ? (
                <div className="form-hint">No automation suites in this project yet.</div>
              ) : (
                <div className="checkbox-list">
                  {suites.map(s => (
                    <label key={s.id}>
                      <input
                        type="checkbox"
                        checked={selectedSuiteIds.has(s.id)}
                        onChange={() => toggle(selectedSuiteIds, setSelectedSuiteIds, s.id)}
                      />
                      <span style={{ flex: 1 }}>{s.name}</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{s.test_case_count} tests</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn btn-primary" onClick={create} disabled={saving || !canCreate}>
            {saving ? 'Creating...' : 'Create run'}
          </button>
        </div>
      </div>
    </div>
  )
}

function RunCard({ run, projectId }) {
  const navigate = useNavigate()
  const total = run.total_test_cases || 0
  const passRate = total > 0 ? Math.round((run.passed / total) * 100) : null

  return (
    <div
      className="card"
      style={{ cursor: 'pointer', transition: 'border-color 0.2s' }}
      onClick={() => navigate(`/projects/${projectId}/executions/${run.id}`)}
      onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(224,125,60,0.3)'}
      onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, color: 'var(--white)' }}>{run.name}</div>
        <RunStatusBadge status={run.status} />
      </div>
      <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginBottom: '0.75rem' }}>
        {total} test case{total === 1 ? '' : 's'} · {run.suite_count} suite{run.suite_count === 1 ? '' : 's'}
      </div>
      {total > 0 && (
        <>
          <div className="progress-bar" style={{ marginBottom: '0.5rem' }}>
            <div className="progress-fill green" style={{ width: `${passRate ?? 0}%` }} />
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>
            <span style={{ color: 'var(--success)' }}>{run.passed} passed</span>
            {run.failed > 0 && <>, <span style={{ color: 'var(--danger)' }}>{run.failed} failed</span></>}
            {run.not_run > 0 && <>, {run.not_run} not run</>}
          </div>
        </>
      )}
      <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginTop: '0.75rem' }}>
        Created {new Date(run.created_at).toLocaleDateString()}
      </div>
    </div>
  )
}

export default function ExecutionRunsPage() {
  const { id } = useParams()
  const [runs, setRuns] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)

  const load = () => {
    apiFetch(`/projects/${id}/execution-runs`)
      .then(setRuns)
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(load, [id])

  return (
    <>
      <div className="topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
          <Link to="/projects" style={{ color: 'var(--muted)', textDecoration: 'none' }}>Projects</Link>
          <span style={{ color: 'var(--muted)' }}>/</span>
          <Link to={`/projects/${id}`} style={{ color: 'var(--muted)', textDecoration: 'none' }}>Project</Link>
          <span style={{ color: 'var(--muted)' }}>/</span>
          <span className="topbar-title">Executions</span>
        </div>
        <div className="topbar-actions">
          <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>+ New execution run</button>
        </div>
      </div>

      <div className="page-content fade-in">
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}><div className="spinner" /></div>
        ) : runs.length === 0 ? (
          <div className="empty-state">
            <h3>No execution runs yet</h3>
            <p>Bundle test cases and automation suites into a run to start executing.</p>
            <button className="btn btn-primary" onClick={() => setShowCreate(true)}>+ New execution run</button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1rem' }}>
            {runs.map(r => <RunCard key={r.id} run={r} projectId={id} />)}
          </div>
        )}
      </div>

      {showCreate && (
        <CreateRunModal
          projectId={id}
          onClose={() => setShowCreate(false)}
          onCreated={run => setRuns(rs => [{ ...run, total_test_cases: 0, passed: 0, failed: 0, not_run: 0, skipped: 0, suite_count: 0 }, ...rs])}
        />
      )}
    </>
  )
}
