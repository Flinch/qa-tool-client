import { useEffect, useState, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { apiFetch } from '../lib/api.js'
import { useAuth } from '../store/AuthContext.jsx'
import { useToastStore } from '../store/toastStore.jsx'
import { readDocumentFile } from '../lib/documentUpload.js'
import Icon from '../components/Icon.jsx'

function UploadRequirementsModal({ projectId, onClose, onUploaded, onDiff }) {
  const { addToast } = useToastStore()
  const [mode, setMode] = useState('file')
  const [file, setFile] = useState(null)
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const fileInputRef = useRef(null)

  const handleFile = (e) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    setFile(f)
  }

  const submit = async () => {
    if (mode === 'file' && !file) return
    if (mode === 'text' && !text.trim()) return
    setLoading(true)
    try {
      const body = mode === 'file' ? await readDocumentFile(file) : { text }
      const result = await apiFetch(`/projects/${projectId}/requirements/upload`, {
        method: 'POST',
        body: JSON.stringify(body),
      })
      if (result.mode === 'diff') {
        onDiff(result.document, result.diff)
      } else {
        addToast(`${result.requirements.length} requirement${result.requirements.length === 1 ? '' : 's'} parsed from ${file?.name || 'pasted text'}`)
        onUploaded(result.requirements)
      }
      onClose()
    } catch (e) {
      addToast(e.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 620 }}>
        <div className="modal-title">Upload requirements document</div>

        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
          {[
            { value: 'file', label: 'Upload file', desc: '.txt, .md, .pdf, .docx' },
            { value: 'text', label: 'Paste text', desc: 'Paste requirements directly' },
          ].map(m => (
            <button
              key={m.value}
              onClick={() => setMode(m.value)}
              style={{
                flex: 1, padding: '0.6rem 1rem', borderRadius: 0, cursor: 'pointer',
                border: mode === m.value ? '1px solid var(--accent)' : '1px solid var(--border)',
                background: mode === m.value ? 'rgba(184,70,31,0.1)' : 'var(--bg2)',
                color: mode === m.value ? 'var(--accent)' : 'var(--muted)',
                textAlign: 'left', transition: 'all 0.15s',
              }}
            >
              <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.15rem' }}>{m.label}</div>
              <div style={{ fontSize: '0.72rem' }}>{m.desc}</div>
            </button>
          ))}
        </div>

        {mode === 'file' ? (
          <div className="form-group">
            <label className="form-label">Document</label>
            <input ref={fileInputRef} type="file" accept=".txt,.md,.pdf,.docx" onChange={handleFile} style={{ display: 'none' }} />
            {file ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.6rem 0.85rem', background: 'var(--bg2)', border: '1px solid var(--border)' }}>
                <Icon name="image" size={15} style={{ color: 'var(--accent)' }} />
                <span style={{ fontSize: '0.85rem', color: 'var(--light)', flex: 1 }}>{file.name}</span>
                <button className="btn btn-ghost btn-sm" onClick={() => setFile(null)}>Remove</button>
              </div>
            ) : (
              <button className="btn btn-ghost btn-sm" onClick={() => fileInputRef.current?.click()}>Choose file</button>
            )}
          </div>
        ) : (
          <div className="form-group">
            <label className="form-label">Requirements text</label>
            <textarea
              className="form-textarea"
              style={{ minHeight: 200 }}
              placeholder="Paste the requirements document text here..."
              value={text}
              onChange={e => setText(e.target.value)}
            />
          </div>
        )}

        <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginBottom: '0.5rem' }}>
          If this project already has requirements, you'll get a chance to review what changed before anything is updated.
        </div>

        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose} disabled={loading}>Cancel</button>
          <button
            className="btn btn-primary"
            onClick={submit}
            disabled={loading || (mode === 'file' ? !file : !text.trim())}
          >
            {loading ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div className="spinner" style={{ width: 14, height: 14, borderWidth: 1.5 }} /> Parsing...
              </span>
            ) : 'Upload & parse'}
          </button>
        </div>
      </div>
    </div>
  )
}

function DiffReviewModal({ projectId, documentId, diff, onClose, onApplied }) {
  const { addToast } = useToastStore()
  const [approvedModified, setApprovedModified] = useState(() => new Set(diff.modified.map(m => m.id)))
  const [approvedRemoved, setApprovedRemoved] = useState(() => new Set(diff.removed.map(r => r.id)))
  const [approvedNew, setApprovedNew] = useState(() => new Set(diff.new.map((_, i) => i)))
  const [saving, setSaving] = useState(false)

  const toggle = (setFn, key) => setFn(s => {
    const next = new Set(s)
    next.has(key) ? next.delete(key) : next.add(key)
    return next
  })

  const totalSelected = approvedModified.size + approvedRemoved.size + approvedNew.size

  const apply = async () => {
    setSaving(true)
    try {
      const result = await apiFetch(`/projects/${projectId}/requirements/apply-diff`, {
        method: 'POST',
        body: JSON.stringify({
          documentId,
          modified: diff.modified.filter(m => approvedModified.has(m.id)).map(m => ({ id: m.id, title: m.title, description: m.description })),
          removed: diff.removed.filter(r => approvedRemoved.has(r.id)).map(r => r.id),
          added: diff.new.filter((_, i) => approvedNew.has(i)),
        }),
      })
      addToast(`Applied: ${result.updated.length} updated, ${result.removedIds.length} removed, ${result.inserted.length} added`)
      onApplied(result)
      onClose()
    } catch (e) {
      addToast(e.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 640 }}>
        <div className="modal-title">Review requirement changes</div>
        <div style={{ fontSize: '0.82rem', color: 'var(--muted)', marginBottom: '1.25rem' }}>
          {diff.unchangedCount} unchanged · {diff.modified.length} modified · {diff.removed.length} removed · {diff.new.length} new.
          Uncheck anything you don't want applied.
        </div>

        <div style={{ maxHeight: 420, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {diff.modified.length > 0 && (
            <div>
              <div style={{ fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--warning)', marginBottom: '0.6rem' }}>Modified</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {diff.modified.map(m => (
                  <label key={m.id} style={{ display: 'flex', gap: '0.6rem', padding: '0.65rem 0.85rem', background: 'var(--bg2)', border: '1px solid var(--border)', cursor: 'pointer' }}>
                    <input type="checkbox" checked={approvedModified.has(m.id)} onChange={() => toggle(setApprovedModified, m.id)} style={{ marginTop: '0.2rem' }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.82rem', color: 'var(--muted)', textDecoration: 'line-through', marginBottom: '0.2rem' }}>{m.old.title}</div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--light)', fontWeight: 600, marginBottom: '0.3rem' }}>{m.title}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>{m.description}</div>
                      {m.old.linked_test_case_count > 0 && (
                        <div style={{ fontSize: '0.72rem', color: 'var(--info)', marginTop: '0.3rem' }}>{m.old.linked_test_case_count} linked test case{m.old.linked_test_case_count === 1 ? '' : 's'} — kept as-is</div>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {diff.removed.length > 0 && (
            <div>
              <div style={{ fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--danger)', marginBottom: '0.6rem' }}>Removed</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {diff.removed.map(r => (
                  <label key={r.id} style={{ display: 'flex', gap: '0.6rem', padding: '0.65rem 0.85rem', background: 'var(--bg2)', border: '1px solid var(--border)', cursor: 'pointer' }}>
                    <input type="checkbox" checked={approvedRemoved.has(r.id)} onChange={() => toggle(setApprovedRemoved, r.id)} style={{ marginTop: '0.2rem' }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.85rem', color: 'var(--light)', fontWeight: 600, marginBottom: '0.2rem' }}>{r.title}</div>
                      {r.linked_test_case_count > 0 && (
                        <div style={{ fontSize: '0.72rem', color: 'var(--danger)' }}>{r.linked_test_case_count} linked test case{r.linked_test_case_count === 1 ? '' : 's'} will lose this requirement link</div>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {diff.new.length > 0 && (
            <div>
              <div style={{ fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--success)', marginBottom: '0.6rem' }}>New</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {diff.new.map((n, i) => (
                  <label key={i} style={{ display: 'flex', gap: '0.6rem', padding: '0.65rem 0.85rem', background: 'var(--bg2)', border: '1px solid var(--border)', cursor: 'pointer' }}>
                    <input type="checkbox" checked={approvedNew.has(i)} onChange={() => toggle(setApprovedNew, i)} style={{ marginTop: '0.2rem' }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.85rem', color: 'var(--light)', fontWeight: 600, marginBottom: '0.2rem' }}>{n.title}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>{n.description}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn btn-primary" onClick={apply} disabled={saving || totalSelected === 0}>
            {saving ? 'Applying...' : `Apply ${totalSelected} change${totalSelected === 1 ? '' : 's'}`}
          </button>
        </div>
      </div>
    </div>
  )
}

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

function RequirementModal({ requirement, projectId, isClient, onClose, onUpdated, onDeleted }) {
  const { addToast } = useToastStore()
  const [linkedTestCases, setLinkedTestCases] = useState([])
  const [loadingLinked, setLoadingLinked] = useState(true)
  const [showLinkModal, setShowLinkModal] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editForm, setEditForm] = useState({ title: requirement.title, description: requirement.description || '' })
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)

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

  const generateTestCase = async () => {
    setGenerating(true)
    try {
      const result = await apiFetch(`/projects/${projectId}/requirements/${requirement.id}/generate-test-case`, { method: 'POST' })
      addToast(`Generated ${result.testCases.length} test case${result.testCases.length === 1 ? '' : 's'}`)
      loadLinked()
      onUpdated({ ...requirement, linked_test_case_count: result.linked_test_case_count })
    } catch (e) {
      addToast(e.message, 'error')
    } finally {
      setGenerating(false)
    }
  }

  const deleteRequirement = async () => {
    if (!window.confirm(`Delete "${requirement.title}"? This can be undone by re-adding it, but it will disappear from the active list.`)) return
    try {
      await apiFetch(`/requirements/${requirement.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'removed' }) })
      addToast('Requirement deleted')
      onDeleted(requirement.id)
      onClose()
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
            {!isClient && <button className="btn btn-ghost btn-sm" onClick={() => setIsEditing(true)}>Edit</button>}
            {!isClient && <button className="btn btn-danger btn-sm" onClick={deleteRequirement}>Delete</button>}
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
            {!isClient && (
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                {requirement.linked_test_case_count === 0 && (
                  <button className="btn btn-primary btn-sm" onClick={generateTestCase} disabled={generating}>
                    {generating ? 'Generating...' : 'Generate test case'}
                  </button>
                )}
                <button className="btn btn-ghost btn-sm" onClick={() => setShowLinkModal(true)}>+ Link test cases</button>
              </div>
            )}
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
                  {!isClient && <button className="btn btn-ghost btn-sm" onClick={() => unlink(tc.id)}>Unlink</button>}
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
  const { user } = useAuth()
  const isClient = user?.role === 'client'
  const { addToast } = useToastStore()
  const [project, setProject] = useState(null)
  const [requirements, setRequirements] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [showUpload, setShowUpload] = useState(false)
  const [pendingDiff, setPendingDiff] = useState(null)
  const [selected, setSelected] = useState(null)
  const [generatingIds, setGeneratingIds] = useState(new Set())
  const [bulkGenerating, setBulkGenerating] = useState(false)

  useEffect(() => { apiFetch(`/projects/${id}`).then(setProject).catch(console.error) }, [id])

  useEffect(() => {
    apiFetch(`/projects/${id}/requirements`)
      .then(setRequirements)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [id])

  const uncoveredCount = requirements.filter(r => r.linked_test_case_count === 0).length

  const generateOne = async (reqId, e) => {
    e?.stopPropagation()
    setGeneratingIds(s => new Set(s).add(reqId))
    try {
      const result = await apiFetch(`/projects/${id}/requirements/${reqId}/generate-test-case`, { method: 'POST' })
      addToast(`Generated ${result.testCases.length} test case${result.testCases.length === 1 ? '' : 's'}`)
      setRequirements(rs => rs.map(r => r.id === reqId ? { ...r, linked_test_case_count: result.linked_test_case_count } : r))
    } catch (err) {
      addToast(err.message, 'error')
    } finally {
      setGeneratingIds(s => { const next = new Set(s); next.delete(reqId); return next })
    }
  }

  const generateAll = async () => {
    setBulkGenerating(true)
    try {
      const result = await apiFetch(`/projects/${id}/requirements/generate-test-cases`, { method: 'POST' })
      addToast(`Generated ${result.totalTestCases} test case${result.totalTestCases === 1 ? '' : 's'} across ${result.generated.length} requirement${result.generated.length === 1 ? '' : 's'}`)
      const counts = Object.fromEntries(result.generated.map(g => [g.requirementId, g.testCases.length]))
      setRequirements(rs => rs.map(r => counts[r.id] ? { ...r, linked_test_case_count: counts[r.id] } : r))
    } catch (err) {
      addToast(err.message, 'error')
    } finally {
      setBulkGenerating(false)
    }
  }

  return (
    <>
      <div className="topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Link to={isClient ? `/projects/${id}/reports` : `/projects/${id}`} className="back-btn" title="Back" aria-label="Back"><Icon name="arrowLeft" size={14} /></Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
            {!isClient && (
              <>
                <Link to="/projects" style={{ color: 'var(--muted)', textDecoration: 'none' }}>Projects</Link>
                <span style={{ color: 'var(--muted)' }}>/</span>
              </>
            )}
            <Link to={`/projects/${id}`} style={{ color: 'var(--muted)', textDecoration: 'none' }}>{project?.name || 'Project'}</Link>
            <span style={{ color: 'var(--muted)' }}>/</span>
            <span className="topbar-title">Requirements</span>
          </div>
        </div>
        {!isClient && (
          <div className="topbar-actions">
            <button className="btn btn-ghost btn-sm" onClick={() => setShowUpload(true)}>Upload document</button>
            <button className="btn btn-primary btn-sm" onClick={generateAll} disabled={bulkGenerating || uncoveredCount === 0}>
              {bulkGenerating ? 'Generating...' : `Generate all test cases${uncoveredCount > 0 ? ` (${uncoveredCount})` : ''}`}
            </button>
            <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>+ New requirement</button>
          </div>
        )}
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
            <p>{isClient ? 'No requirements have been added for this project yet.' : 'Upload a requirements document or add one manually to track which test cases actually cover them.'}</p>
            {!isClient && (
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                <button className="btn btn-ghost" onClick={() => setShowUpload(true)}>Upload document</button>
                <button className="btn btn-primary" onClick={() => setShowCreate(true)}>+ New requirement</button>
              </div>
            )}
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
                        {r.linked_test_case_count > 0 ? (
                          <span style={{ fontSize: '0.82rem', color: 'var(--light)' }}>{r.linked_test_case_count}</span>
                        ) : isClient ? (
                          <span style={{ fontSize: '0.78rem', color: 'var(--danger)' }}>No coverage</span>
                        ) : (
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={e => generateOne(r.id, e)}
                            disabled={generatingIds.has(r.id)}
                          >
                            {generatingIds.has(r.id) ? 'Generating...' : 'Generate'}
                          </button>
                        )}
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

      {showUpload && (
        <UploadRequirementsModal
          projectId={id}
          onClose={() => setShowUpload(false)}
          onUploaded={newReqs => setRequirements(rs => [...newReqs, ...rs])}
          onDiff={(document, diff) => setPendingDiff({ documentId: document.id, diff })}
        />
      )}

      {pendingDiff && (
        <DiffReviewModal
          projectId={id}
          documentId={pendingDiff.documentId}
          diff={pendingDiff.diff}
          onClose={() => setPendingDiff(null)}
          onApplied={({ updated, removedIds, inserted }) => {
            setRequirements(rs => rs
              .map(r => {
                const match = updated.find(u => u.id === r.id)
                return match ? { ...r, ...match } : r
              })
              .filter(r => !removedIds.includes(r.id))
            )
            if (inserted.length > 0) setRequirements(rs => [...inserted, ...rs])
          }}
        />
      )}

      {selected && (
        <RequirementModal
          requirement={selected}
          projectId={id}
          isClient={isClient}
          onClose={() => setSelected(null)}
          onUpdated={(updated) => {
            setRequirements(rs => rs.map(r => r.id === updated.id ? { ...r, ...updated } : r))
            setSelected(prev => ({ ...prev, ...updated }))
          }}
          onDeleted={(reqId) => setRequirements(rs => rs.filter(r => r.id !== reqId))}
        />
      )}
    </>
  )
}
