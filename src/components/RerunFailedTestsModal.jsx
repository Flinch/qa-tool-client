import { useEffect, useState } from 'react'
import { apiFetch } from '../lib/api.js'
import { useToastStore } from '../store/toastStore.jsx'
import HealConfirmModal from './HealConfirmModal.jsx'
import DiagnosisModal from './DiagnosisModal.jsx'
import ApiTraceModal from './ApiTraceModal.jsx'

export default function RerunFailedTestsModal({ projectId, run, onClose, onRerunTriggered, onHealTriggered }) {
  const { addToast } = useToastStore()
  const [loading, setLoading] = useState(true)
  const [failedResults, setFailedResults] = useState([])
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [rerunning, setRerunning] = useState(false)
  const [healing, setHealing] = useState(false)
  // Confirm-before-heal is a second step within this same modal, same
  // select-then-confirm shape GenerateTestsModal already uses for its own
  // real-cost CI dispatch — not a native window.confirm().
  const [confirmingHeal, setConfirmingHeal] = useState(false)
  // Diagnose has no confirm step of its own (read-only, no CI spend) — it
  // just swaps in the DiagnosisModal directly, same swap-panel shape as
  // confirmingHeal above.
  const [diagnosing, setDiagnosing] = useState(false)
  // Same swap-panel shape again, per-row instead of selection-gated — the
  // trace is read-only and instant, so no selection/confirm step needed.
  const [viewingTrace, setViewingTrace] = useState(null)

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

  // Heal (and Diagnose) act on the current selection, same as Re-run — but
  // only ever ONE test at a time: heal because it dispatches a real CI job +
  // AI agent spend + a PR per file, diagnose because an explanation only
  // makes sense for one specific failure at a time. Enforced via each
  // button's own disabled state below (enabled only when exactly one result
  // is checked).
  const selectedForHeal = failedResults.find(r => selectedIds.has(r.id))

  const heal = async (context) => {
    if (!selectedForHeal) return
    setHealing(true)
    try {
      const healRun = await apiFetch(`/projects/${projectId}/automation/runs/${run.id}/heal`, {
        method: 'POST',
        body: JSON.stringify({ result_id: selectedForHeal.id, context: context || undefined }),
      })
      addToast(`Healing started for "${selectedForHeal.test_title}"`)
      onHealTriggered(healRun)
      onClose()
    } catch (e) {
      addToast(e.message, 'error')
      setHealing(false)
    }
  }

  if (viewingTrace) {
    return (
      <ApiTraceModal
        trace={viewingTrace.api_trace}
        testTitle={viewingTrace.test_title}
        onClose={() => setViewingTrace(null)}
      />
    )
  }

  if (diagnosing && selectedForHeal) {
    return (
      <DiagnosisModal
        projectId={projectId}
        runId={run.id}
        resultId={selectedForHeal.id}
        testTitle={selectedForHeal.test_title}
        suiteName={run.suite_name}
        onClose={() => setDiagnosing(false)}
        onRequestHeal={() => { setDiagnosing(false); setConfirmingHeal(true) }}
      />
    )
  }

  if (confirmingHeal && selectedForHeal) {
    return (
      <HealConfirmModal
        testTitle={selectedForHeal.test_title}
        suiteName={run.suite_name}
        healing={healing}
        onCancel={() => setConfirmingHeal(false)}
        onConfirm={heal}
      />
    )
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
              <div
                key={r.id}
                style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', padding: '0.55rem 0.75rem', background: 'var(--bg2)', border: '1px solid var(--border)' }}
              >
                <input
                  type="checkbox"
                  checked={selectedIds.has(r.id)}
                  onChange={() => toggle(r.id)}
                  style={{ marginTop: '0.2rem', cursor: 'pointer' }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ fontSize: '0.85rem', color: 'var(--light)' }}>{r.test_title}</div>
                    {/* api_trace only ever gets populated by the apiTrace-wrapped
                        request fixture (see helpers/apiTrace.ts) — its presence
                        IS proof this specific failed result came from an API
                        test, same signal already driving the trace button
                        below, now surfaced as an explicit badge too. */}
                    {r.api_trace && <span className="badge badge-api">API</span>}
                  </div>
                  {r.error_message && (
                    <div style={{ fontSize: '0.74rem', color: 'var(--danger)', marginTop: '0.2rem' }}>{r.error_message}</div>
                  )}
                  {r.api_trace && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      style={{ marginTop: '0.35rem' }}
                      onClick={() => setViewingTrace(r)}
                    >
                      View request/response
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose} disabled={rerunning || healing}>Cancel</button>
          <button
            className="btn btn-ghost"
            onClick={() => setDiagnosing(true)}
            disabled={healing || rerunning || selectedIds.size !== 1}
            title={selectedIds.size !== 1 ? 'Select exactly one test case to diagnose' : undefined}
          >
            Diagnose selected
          </button>
          <button
            className="btn btn-ghost"
            onClick={() => setConfirmingHeal(true)}
            disabled={healing || rerunning || selectedIds.size !== 1}
            title={selectedIds.size !== 1 ? 'Select exactly one test case to heal' : undefined}
          >
            Heal selected
          </button>
          <button className="btn btn-primary" onClick={rerun} disabled={rerunning || healing || selectedIds.size === 0}>
            {rerunning ? 'Starting...' : `Re-run selected (${selectedIds.size})`}
          </button>
        </div>
      </div>
    </div>
  )
}
