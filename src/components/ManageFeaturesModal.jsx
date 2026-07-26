import { useState } from 'react'
import { apiFetch } from '../lib/api.js'
import { useToastStore } from '../store/toastStore.jsx'

// Shared CRUD modal for a project's features — reused verbatim from both
// RequirementsPage and TestCasesPage (identical in both places, so it's one
// component rather than duplicated). `onChanged` re-fetches the parent's
// feature list after any add/rename/delete.
export default function ManageFeaturesModal({ projectId, features, onClose, onChanged }) {
  const { addToast } = useToastStore()
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName] = useState('')
  const [savingId, setSavingId] = useState(null)
  const [deletingId, setDeletingId] = useState(null)

  const create = async () => {
    if (!newName.trim()) return
    setCreating(true)
    try {
      await apiFetch(`/projects/${projectId}/features`, {
        method: 'POST',
        body: JSON.stringify({ name: newName.trim() }),
      })
      setNewName('')
      onChanged()
    } catch (e) {
      addToast(e.message, 'error')
    } finally {
      setCreating(false)
    }
  }

  const startEdit = (f) => { setEditingId(f.id); setEditName(f.name) }

  const saveEdit = async (f) => {
    if (!editName.trim()) return
    setSavingId(f.id)
    try {
      await apiFetch(`/features/${f.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: editName.trim() }),
      })
      setEditingId(null)
      onChanged()
    } catch (e) {
      addToast(e.message, 'error')
    } finally {
      setSavingId(null)
    }
  }

  const remove = async (f) => {
    setDeletingId(f.id)
    try {
      await apiFetch(`/features/${f.id}`, { method: 'DELETE' })
      onChanged()
    } catch (e) {
      addToast(e.message, 'error')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 480 }}>
        <div className="modal-title">Manage features</div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.25rem', maxHeight: 320, overflowY: 'auto' }}>
          {features.length === 0 && (
            <div style={{ fontSize: '0.82rem', color: 'var(--muted)', padding: '0.5rem 0' }}>No features yet.</div>
          )}
          {features.map(f => (
            <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.55rem 0.75rem', background: 'var(--bg2)', border: '1px solid var(--border)' }}>
              {editingId === f.id ? (
                <>
                  <input
                    className="form-input"
                    style={{ flex: 1 }}
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && saveEdit(f)}
                    autoFocus
                  />
                  <button className="btn btn-ghost btn-sm" onClick={() => saveEdit(f)} disabled={savingId === f.id || !editName.trim()}>
                    {savingId === f.id ? 'Saving...' : 'Save'}
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setEditingId(null)}>Cancel</button>
                </>
              ) : (
                <>
                  <span style={{ flex: 1, fontSize: '0.85rem', color: 'var(--light)' }}>{f.name}</span>
                  <button className="btn btn-ghost btn-sm" onClick={() => startEdit(f)}>Rename</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => remove(f)} disabled={deletingId === f.id}>
                    {deletingId === f.id ? 'Deleting...' : 'Delete'}
                  </button>
                </>
              )}
            </div>
          ))}
        </div>

        <div className="form-group">
          <label className="form-label">New feature</label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              className="form-input"
              style={{ flex: 1 }}
              placeholder="e.g. Checkout"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && create()}
            />
            <button className="btn btn-primary btn-sm" onClick={create} disabled={creating || !newName.trim()}>
              {creating ? 'Adding...' : 'Add'}
            </button>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  )
}
