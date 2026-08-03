import { useEffect, useState } from 'react'
import { apiFetch } from '../lib/api.js'
import Icon from './Icon.jsx'

const VERDICT_LABEL = {
  flaky: 'Likely flaky / environmental',
  regression: 'Likely a real regression',
  unclear: 'Unclear',
}
const VERDICT_COLOR = {
  flaky: 'var(--warning)',
  regression: 'var(--danger)',
  unclear: 'var(--muted)',
}
const VERDICT_ICON = {
  flaky: 'clock',
  regression: 'bug',
  unclear: 'alertTriangle',
}

// Fast, read-only "why did this fail" step — separate from Heal, which is
// the slow/costed CI dispatch that actually fixes the test. Fetches on
// mount rather than needing a confirm click first, since this is just an
// explanation, not something that spends money or opens a PR.
export default function DiagnosisModal({ projectId, runId, resultId, testTitle, suiteName, onClose, onRequestHeal }) {
  const [diagnosis, setDiagnosis] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    apiFetch(`/projects/${projectId}/automation/runs/${runId}/diagnose`, {
      method: 'POST',
      body: JSON.stringify({ result_id: resultId }),
    })
      .then(data => { if (!cancelled) setDiagnosis(data) })
      .catch(e => { if (!cancelled) setError(e.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [projectId, runId, resultId])

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 520 }}>
        <div className="modal-title">Diagnose</div>

        <div style={{ marginBottom: '1rem' }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--light)', padding: '0.5rem 0.7rem', background: 'var(--bg2)', border: '1px solid var(--border)' }}>
            {testTitle}
          </div>
          {suiteName && <div style={{ fontSize: '0.8rem', color: 'var(--accent2)', marginTop: '0.4rem' }}>{suiteName}</div>}
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}><div className="spinner" /></div>
        ) : error ? (
          <div style={{ fontSize: '0.85rem', color: 'var(--danger)', padding: '0.75rem', background: 'rgba(193,68,58,0.08)', border: '1px solid rgba(193,68,58,0.25)' }}>
            {error}
          </div>
        ) : (
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <Icon name={VERDICT_ICON[diagnosis.verdict]} size={16} style={{ color: VERDICT_COLOR[diagnosis.verdict] }} />
              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: VERDICT_COLOR[diagnosis.verdict], textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {VERDICT_LABEL[diagnosis.verdict]}
              </span>
            </div>
            <div style={{ fontSize: '0.88rem', color: 'var(--light)', lineHeight: 1.6 }}>{diagnosis.summary}</div>
          </div>
        )}

        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Close</button>
          {onRequestHeal && (
            <button className="btn btn-primary" onClick={onRequestHeal} disabled={loading}>
              Heal this
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
