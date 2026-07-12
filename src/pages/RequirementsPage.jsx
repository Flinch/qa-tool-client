import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { apiFetch } from '../lib/api.js'
import { useToastStore } from '../store/toastStore.jsx'
import Icon from '../components/Icon.jsx'

function CreateRequirementModal({ projectId, onClose, onCreated }) {
  const { addToast } = useToastStore()
  const [form, setForm] = useState({ title: '', description: '' })
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const submit = async () => {
    if (!form.title.trim()) return
    setSaving(true)
    try {
      const created = await apiFetch(`/projects/${projectId}/requirements`, {
        method: 'POST',
        body: JSON.stringify(form),
      })
      addToast('Requirement created')
      onCreated(created)
      onClose()
    } catch (e) {
      addToast(e.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 560 }}>
        <div className="modal-title">New requirement</div>
        <div className="form-group">
          <label className="form-label">Title</label>
          <input className="form-input" value={form.title} onChange={e => set('title', e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Description</label>
          <textarea
            className="form-textarea"
            style={{ minHeight: 120 }}
            placeholder="What this requirement covers..."
            value={form.description}
            onChange={e => set('description', e.target.value)}
          />
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn btn-primary" onClick={submit} disabled={saving || !form.title.trim()}>
            {saving ? 'Creating...' : 'Create requirement'}
          </button>
        </div>
      </div>
    </div>
  )
}

function LinkTestCasesModal({ projectId, requirement, linkedIds, onClose, onLinked }) {
  const { addToast } = useToastStore()
  const [testCases, setTestCases] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(new Set())
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    apiFetch(`/projects/${projectId}/test-cases`)
      .then(setTestCases)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [projectId])

  const available = testCases.filter(tc => !linkedIds.has(tc.id))

  const toggle = (id) => setSelected(s => {
    const next = new Set(s)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })

  const submit = async () => {
    if (selected.size === 0) return
    setSaving(true)
    try {
      await apiFetch(`/projects/${projectId}/requirements/${requirement.id}/test-cases`, {
        method: 'POST',
        body: JSON.stringify({ test_case_ids: [...selected] }),
      })
      addToast(`Linked ${selected.size} test case${selected.size === 1 ? '' : 's'}`)
      onLinked(selected.size)
      onClose()
    } catch (e) {
      addToast(e.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 560 }}>
        <div className="modal-title">Link test cases</div>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}><div className="spinner" /></div>
        ) : available.length === 0 ? (
          <div style={{ fontSize: '0.85rem', color: 'var(--muted)', padding: '1rem 0' }}>
            All test cases in this project are already linked to this requirement.
          </div>
        ) : (
          <div style={{ maxHeight: 360, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {available.map(tc => (
              <label
                key={tc.id}
                style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.55rem 0.75rem', background: 'var(--bg2)', border: '1px solid var(--border)', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--light)' }}
              >
                <input type="checkbox" checked={selected.has(tc.id)} onChange={() => toggle(tc.id)} />
                {tc.title}
              </label>
            ))}
          </div>
        )}
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn btn-primary" onClick={submit} disabled={saving || selected.size === 0}>
            {saving ? 'Linking...' : `Link ${selected.size || ''} test case${selected.size === 1 ? '' : 's'}`}
          </button>
        </div>
      </div>
    </div>
  )
}

function RequirementModal({ requirement, projectId, onClose, onUpdated }) {
  const { addToast } = useToastStore()
  const [linkedTestCases, setLinkedTestCases] = useState([])
  const [loadingLinked, setLoadingLinked] = useState(true)
  const [showLinkModal, setShowLinkModal] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editForm, setEditForm] = useState({ title: requirement.title, description: requirement.description || '' })
  const [saving, setSaving] = useState(false)

  const loadLinked = () => {
    setLoadingLinked(true)
    apiFetch(`/projects/${projectId}/requirements/${requirement.id}/test-cases`)
      .then(setLinkedTestCases)
      .catch(console.error)
      .finally(() => setLoadingLinked(false))
  }

  useEffect(loadLinked, [requirement.id])

  const unlink = async (tcId) => {
    try {
      await apiFetch(`/projects/${projectId}/requirements/${requirement.id}/test-cases/${tcId}`, { method: 'DELETE' })
      setLinkedTestCases(tcs => tcs.filter(t => t.id !== tcId))
      onUpdated({ ...requirement, linked_test_case_count: linkedTestCases.length - 1 })
    } catch (e) {
      addToast(e.message, 'error')
    }
  }

  const saveEdit = async () => {
    if (!editForm.title.trim()) return
    setSaving(true)
    try {
      const updated = await apiFetch(`/requirements/${requirement.id}`, {
        method: 'PATCH',
        body: JSON.stringify(editForm),
      })
      onUpdated({ ...requirement, ...updated })
      setIsEditing(false)
      addToast('Requirement updated')
    } catch (e) {
      addToast(e.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  if (showLinkModal) return (
    <LinkTestCasesModal
      projectId={projectId}
      requirement={requirement}
      linkedIds={new Set(linkedTestCases.map(t => t.id))}
      onClose={() => setShowLinkModal(false)}
      onLinked={(count) => {
        loadLinked()
        onUpdated({ ...requirement, linked_test_case_count: (requirement.linked_test_case_count || 0) + count })
      }}
    />
  )

  if (isEditing) {
    return (
      <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
        <div className="modal" style={{ maxWidth: 560 }}>
          <div className="modal-title">Edit requirement</div>
          <div className="form-group">
            <label className="form-label">Title</label>
            <input className="form-input" value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea
              className="form-textarea"
              style={{ minHeight: 120 }}
              value={editForm.description}
              onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
            />
          </div>
          <div className="modal-footer">
            <button className="btn btn-ghost" onClick={() => setIsEditing(false)} disabled={saving}>Cancel</button>
            <button className="btn btn-primary" onClick={saveEdit} disabled={saving || !editForm.title.trim()}>
              {saving ? 'Saving...' : 'Save changes'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 560 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', marginBottom: '1.25rem' }}>
          <h2 style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: '1rem', fontWeight: 700, color: 'var(--white)', lineHeight: 1.3 }}>{requirement.title}</h2>
          <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setIsEditing(true)}>Edit</button>
            <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--muted)', cursor: 'pointer', display: 'flex' }}><Icon name="x" size={16} /></button>
          </div>
        </div>

        {requirement.description && (
          <div style={{ marginBottom: '1.25rem', background: 'var(--bg2)', border: '1px solid var(--border)', padding: '0.75rem 1rem' }}>
            <div style={{ fontSize: '0.88rem', color: 'var(--light)', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{requirement.description}</div>
          </div>
        )}

        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)' }}>
              Linked test cases {linkedTestCases.length > 0 && `(${linkedTestCases.length})`}
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowLinkModal(true)}>+ Link test cases</button>
          </div>
          {loadingLinked ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '1rem' }}><div className="spinner" /></div>
          ) : linkedTestCases.length === 0 ? (
            <div style={{ fontSize: '0.82rem', color: 'var(--muted)', padding: '0.75rem', background: 'var(--bg2)', border: '1px solid var(--border)', textAlign: 'center' }}>
              No test cases linked yet — this requirement has no coverage.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {linkedTestCases.map(tc => (
                <div key={tc.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.55rem 0.75rem', background: 'var(--bg2)', border: '1px solid var(--border)' }}>
                  <span style={{ fontSize: '0.82rem', color: 'var(--light)', flex: 1 }}>{tc.title}</span>
                  <button className="btn btn-ghost btn-sm" onClick={() => unlink(tc.id)}>Unlink</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function RequirementsPage() {
  const { id } = useParams()
  const [project, setProject] = useState(null)
  const [requirements, setRequirements] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [selected, setSelected] = useState(null)

  useEffect(() => { apiFetch(`/projects/${id}`).then(setProject).catch(console.error) }, [id])

  useEffect(() => {
    apiFetch(`/projects/${id}/requirements`)
      .then(setRequirements)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [id])

  const uncoveredCount = requirements.filter(r => r.linked_test_case_count === 0).length

  return (
    <>
      <div className="topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Link to={`/projects/${id}`} className="back-btn" title="Back to project" aria-label="Back to project"><Icon name="arrowLeft" size={14} /></Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
            <Link to="/projects" style={{ color: 'var(--muted)', textDecoration: 'none' }}>Projects</Link>
            <span style={{ color: 'var(--muted)' }}>/</span>
            <Link to={`/projects/${id}`} style={{ color: 'var(--muted)', textDecoration: 'none' }}>{project?.name || 'Project'}</Link>
            <span style={{ color: 'var(--muted)' }}>/</span>
            <span className="topbar-title">Requirements</span>
          </div>
        </div>
        <div className="topbar-actions">
          <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>+ New requirement</button>
        </div>
      </div>

      <div className="page-content fade-in">
        {requirements.length > 0 && (
          <div className="stats-row" style={{ marginBottom: '1.5rem' }}>
            <div className="stat-card"><div className="stat-num">{requirements.length}</div><div className="stat-label">Total</div></div>
            <div className="stat-card"><div className="stat-num" style={{ color: uncoveredCount > 0 ? 'var(--danger)' : 'var(--success)' }}>{uncoveredCount}</div><div className="stat-label">No test coverage</div></div>
          </div>
        )}

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}><div className="spinner" /></div>
        ) : requirements.length === 0 ? (
          <div className="empty-state">
            <h3>No requirements yet</h3>
            <p>Add requirements to track which test cases actually cover them.</p>
            <button className="btn btn-primary" onClick={() => setShowCreate(true)}>+ New requirement</button>
          </div>
        ) : (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Requirement</th>
                    <th>Test cases</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {requirements.map(r => (
                    <tr key={r.id} onClick={() => setSelected(r)} style={{ cursor: 'pointer' }}>
                      <td style={{ maxWidth: 420 }}>
                        <div style={{ fontWeight: 500, color: 'var(--light)', marginBottom: '0.15rem' }}>{r.title}</div>
                        {r.description && <div style={{ fontSize: '0.72rem', color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.description}</div>}
                      </td>
                      <td>
                        {r.linked_test_case_count > 0
                          ? <span style={{ fontSize: '0.82rem', color: 'var(--light)' }}>{r.linked_test_case_count}</span>
                          : <span style={{ fontSize: '0.78rem', color: 'var(--danger)' }}>No coverage</span>}
                      </td>
                      <td style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>{new Date(r.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {showCreate && (
        <CreateRequirementModal
          projectId={id}
          onClose={() => setShowCreate(false)}
          onCreated={r => setRequirements(rs => [r, ...rs])}
        />
      )}

      {selected && (
        <RequirementModal
          requirement={selected}
          projectId={id}
          onClose={() => setSelected(null)}
          onUpdated={(updated) => {
            setRequirements(rs => rs.map(r => r.id === updated.id ? { ...r, ...updated } : r))
            setSelected(prev => ({ ...prev, ...updated }))
          }}
        />
      )}
    </>
  )
}
