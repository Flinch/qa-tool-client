import Icon from './Icon.jsx'

// Shared confirm-before-heal step — same select-then-confirm shape
// GenerateTestsModal already uses for its own real-cost CI dispatch, not a
// native window.confirm(). Used both from RerunFailedTestsModal (healing a
// result from within a specific run's failed list) and The Lab (healing a
// generated test case directly from its last-known-failed status).
export default function HealConfirmModal({ testTitle, suiteName, onConfirm, onCancel, healing }) {
  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onCancel()}>
      <div className="modal" style={{ maxWidth: 520 }}>
        <div className="modal-title">Confirm diagnose &amp; heal</div>

        <div style={{ marginBottom: '1rem' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '0.5rem' }}>
            Test case
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--light)', padding: '0.5rem 0.7rem', background: 'var(--bg2)', border: '1px solid var(--border)' }}>
            {testTitle}
          </div>
        </div>

        <div style={{ marginBottom: '1rem', fontSize: '0.85rem', color: 'var(--light)' }}>
          Suite: <strong>{suiteName}</strong>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', fontSize: '0.8rem', color: 'var(--muted)', marginBottom: '1rem', lineHeight: 1.6, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 0, padding: '0.6rem 0.85rem' }}>
          <Icon name="zap" size={14} style={{ color: 'var(--accent)', marginTop: '0.1rem', flexShrink: 0 }} />
          <span>
            This dispatches a real CI workflow that uses an AI agent to diagnose and fix this test, then opens a PR
            with the change — a real spend, not a simulation.
          </span>
        </div>

        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onCancel} disabled={healing}>Back</button>
          <button className="btn btn-primary" onClick={onConfirm} disabled={healing}>
            {healing ? 'Starting...' : 'Confirm & Heal'}
          </button>
        </div>
      </div>
    </div>
  )
}
