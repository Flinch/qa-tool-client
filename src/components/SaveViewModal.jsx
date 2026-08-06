import { useState } from 'react'
import { useToastStore } from '../store/toastStore.jsx'
import { apiFetch } from '../lib/api.js'

// Saves the caller's current filter state (bugs or execution_test_cases) as
// a named, team-wide-shared view, which then shows up on the Views tab.
// `filters` is the plain state object the caller already maintains for its
// own filtering — this modal doesn't interpret it, just persists it.
export default function SaveViewModal({ projectId, type, filters, onClose, onSaved }) {
  const { addToast } = useToastStore()
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (!name.trim()) return
    setSaving(true)
    try {
      const view = await apiFetch(`/projects/${projectId}/saved-views`, {
        method: 'POST',
        body: JSON.stringify({ name: name.trim(), type, filters }),
      })
      addToast('View saved')
      onSaved?.(view)
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
        <div className="modal-title">Save as view</div>
        <div className="form-group">
          <label className="form-label">Name</label>
          <input
            className="form-input" autoFocus placeholder="e.g. Critical bugs this week"
            value={name} onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && save()}
          />
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving || !name.trim()}>
            {saving ? 'Saving...' : 'Save view'}
          </button>
        </div>
      </div>
    </div>
  )
}
