import { useEffect, useState } from 'react'
import { apiFetch } from '../lib/api.js'
import { useToastStore } from '../store/toastStore.jsx'

export default function RerunFailedTestsModal({ projectId, run, onClose, onRerunTriggered }) {
  const { addToast } = useToastStore()
  const [loading, setLoading] = useState(true)
  const [failedResults, setFailedResults] = useState([])
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [rerunning, setRerunning] = useState(false)

  useEffect(() => {
    apiFetch(`/projects/${projectId}/automation/runs/${run.id}`)
      .then(detail => {
        const failed = detail.results.filter(r => r.status === 'failed')
        setFailedResults(failed)
        setSelectedIds(new Set(failed.map(r => r.id)))
      })
      .catch(e => addToast(e.message, 'error'))
      .finally(() => setLoading(false))
  }, [projectId, run.id, addToast])

  const toggle = (id) => setSelectedIds(ids => {
    const next = new Set(ids)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })

  const rerun = async () => {
    if (selectedIds.size === 0) return
    setRerunning(true)
    try {
      await apiFetch(`/projects/${projectId}/automation/runs/${run.id}/rerun`, {
        method: 'POST',
        body: JSON.stringify({ result_ids: [...selectedIds] }),
      })
      addToast(`Re-run started for ${selectedIds.size} test case${selectedIds.size === 1 ? '' : 's'}`)
      onRerunTriggered()
    } catch (e) {
      addToast(e.message, 'error')
      setRerunning(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 560 }}>
        <div className="modal-title">Re-run failed test cases</div>
        <div style={{ fontSize: '0.82rem', color: 'var(--muted)', marginBottom: '1.25rem' }}>
          From "{run.suite_name}" · {new Date(run.started_at).toLocaleString()}. This dispatches a new, separate run
          for just the test cases you select below — it won't change this run's stored results.
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '1.5rem' }}><div className="spinner" /></div>
        ) : failedResults.length === 0 ? (
          <div style={{ fontSize: '0.82rem', color: 'var(--muted)', padding: '0.75rem', background: 'var(--bg2)', border: '1px solid var(--border)', textAlign: 'center' }}>
            No failed test cases on this run.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: 320, overflowY: 'auto' }}>
            {failedResults.map(r => (
              <label
                key={r.id}
                style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', padding: '0.55rem 0.75rem', background: 'var(--bg2)', border: '1px solid var(--border)', cursor: 'pointer' }}
              >
                <input type="checkbox" checked={selectedIds.has(r.id)} onChange={() => toggle(r.id)} style={{ marginTop: '0.2rem' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.85rem', color: 'var(--light)' }}>{r.test_title}</div>
                  {r.error_message && (
                    <div style={{ fontSize: '0.74rem', color: 'var(--danger)', marginTop: '0.2rem' }}>{r.error_message}</div>
                  )}
                </div>
              </label>
            ))}
          </div>
        )}

        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose} disabled={rerunning}>Cancel</button>
          <button className="btn btn-primary" onClick={rerun} disabled={rerunning || selectedIds.size === 0}>
            {rerunning ? 'Starting...' : `Re-run selected (${selectedIds.size})`}
          </button>
        </div>
      </div>
    </div>
  )
}
