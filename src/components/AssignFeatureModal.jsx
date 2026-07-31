import { useState } from 'react'
import { useToastStore } from '../store/toastStore.jsx'

// Generic bulk "assign to feature" confirm step — shared by TestCasesPage's,
// RequirementsPage's, and BugsPage's multi-select. Persistence is the
// caller's job via onAssign (they PATCH different endpoints), this is just
// the feature-picker + confirm UI, same split CombineTestCasesModal uses
// for its own apply step.
//
// `required` (bugs.feature_id is NOT NULL, unlike test cases/requirements
// where a blank feature is valid) drops the "No feature" option and blocks
// Assign until something's actually picked.
export default function AssignFeatureModal({ count, features, required = false, onClose, onAssign }) {
  const { addToast } = useToastStore()
  const [featureId, setFeatureId] = useState('')
  const [saving, setSaving] = useState(false)

  const apply = async () => {
    if (required && !featureId) return
    setSaving(true)
    try {
      await onAssign(featureId || null)
      onClose()
    } catch (e) {
      addToast(e.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 420 }}>
        <div className="modal-title">Assign feature</div>
        <div style={{ fontSize: '0.85rem', color: 'var(--muted)', marginBottom: '1rem' }}>
          Set the feature for {count} selected item{count === 1 ? '' : 's'}.
        </div>
        <select className="form-input" value={featureId} onChange={e => setFeatureId(e.target.value)} style={{ marginBottom: '1rem' }}>
          <option value="">{required ? 'Select a feature...' : 'No feature'}</option>
          {features.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn btn-primary" onClick={apply} disabled={saving || (required && !featureId)}>
            {saving ? 'Applying...' : `Assign ${count} item${count === 1 ? '' : 's'}`}
          </button>
        </div>
      </div>
    </div>
  )
}
