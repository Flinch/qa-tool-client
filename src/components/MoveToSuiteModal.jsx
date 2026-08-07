import { useState } from 'react'

// Confirm-then-dispatch step for "add this generated test case to a suite" —
// same select-then-confirm shape as HealConfirmModal. Only suites sharing the
// source's platform+engine are offered: the file is real code written for
// one specific framework/target, so a mismatched suite could never actually
// run it (enforced again server-side in automationTrigger.js's
// triggerMoveRun, this is just so the picker doesn't offer a choice that
// would just come back as an error).
export default function MoveToSuiteModal({ testCaseTitle, sourceSuiteId, sourceSuiteName, sourcePlatform, sourceEngine, suites, moving, onConfirm, onCancel }) {
  const eligible = suites.filter(s => s.id !== sourceSuiteId && s.platform === sourcePlatform && s.engine === sourceEngine)
  const [targetSuiteId, setTargetSuiteId] = useState(eligible[0]?.id ?? null)

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onCancel()}>
      <div className="modal" style={{ maxWidth: 480 }}>
        <div className="modal-title">Add to suite</div>

        <div style={{ marginBottom: '1rem' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '0.5rem' }}>
            Test case
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--light)', padding: '0.5rem 0.7rem', background: 'var(--bg2)', border: '1px solid var(--border)' }}>
            {testCaseTitle}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: '0.4rem' }}>Currently in: <strong>{sourceSuiteName}</strong></div>
        </div>

        {eligible.length === 0 ? (
          <div style={{ fontSize: '0.85rem', color: 'var(--muted)', marginBottom: '1rem' }}>
            No other {sourcePlatform}/{sourceEngine} suites in this project to add it to.
          </div>
        ) : (
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '0.5rem' }}>
              Add to
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {eligible.map(s => (
                <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', fontSize: '0.86rem', color: 'var(--light)', cursor: 'pointer' }}>
                  <input type="radio" name="target-suite" checked={targetSuiteId === s.id} onChange={() => setTargetSuiteId(s.id)} />
                  {s.name}
                </label>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', fontSize: '0.8rem', color: 'var(--muted)', marginBottom: '1rem', lineHeight: 1.6, background: 'var(--bg2)', border: '1px solid var(--border)', padding: '0.6rem 0.85rem' }}>
          This moves the test's real file into the target suite via a PR — it starts running as part of that suite once the PR is merged, and stops running as part of {sourceSuiteName}.
        </div>

        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onCancel} disabled={moving}>Cancel</button>
          <button className="btn btn-primary" onClick={() => onConfirm(targetSuiteId)} disabled={moving || !targetSuiteId}>
            {moving ? 'Starting…' : 'Add to suite'}
          </button>
        </div>
      </div>
    </div>
  )
}
