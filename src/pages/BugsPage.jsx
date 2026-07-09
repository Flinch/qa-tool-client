import { useEffect, useRef, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { apiFetch } from '../lib/api.js'
import { useToastStore } from '../store/toastStore.jsx'
import { useAuth } from '../store/AuthContext.jsx'
import Icon from '../components/Icon.jsx'

const SEVERITIES = ['critical', 'high', 'medium', 'low']
const STATUSES = ['open', 'in_progress', 'resolved']
const STATUS_LABELS = { open: 'Open', in_progress: 'In progress', resolved: 'Resolved' }

// Downscales + re-encodes an image client-side before it rides along in a
// JSON comment payload (no object storage configured — see migrate.js).
function compressImage(file, maxDim = 1600, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Could not read file'))
    reader.onload = () => {
      const img = new window.Image()
      img.onerror = () => reject(new Error('Could not read image'))
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height))
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(img.width * scale)
        canvas.height = Math.round(img.height * scale)
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/jpeg', quality))
      }
      img.src = reader.result
    }
    reader.readAsDataURL(file)
  })
}

function CommentImage({ src }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <img
        src={src}
        alt="Comment attachment"
        onClick={() => setOpen(true)}
        style={{ maxWidth: 220, maxHeight: 160, marginTop: '0.4rem', border: '1px solid var(--border)', cursor: 'zoom-in', display: 'block' }}
      />
      {open && (
        <div className="modal-backdrop" onClick={() => setOpen(false)}>
          <img src={src} alt="Comment attachment" style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain' }} />
        </div>
      )}
    </>
  )
}

function BugModal({ projectId, onClose, onCreated }) {
  const { addToast } = useToastStore()
  const [form, setForm] = useState({ title: '', severity: 'high', steps_to_reproduce: '', expected: '', actual: '', notes: '' })
  const [executionRuns, setExecutionRuns] = useState([])
  const [linkedRunId, setLinkedRunId] = useState('')
  const [loading, setLoading] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    apiFetch(`/projects/${projectId}/execution-runs`).then(setExecutionRuns).catch(console.error)
  }, [projectId])

  const submit = async () => {
    if (!form.title.trim()) return
    setLoading(true)
    try {
      const bug = await apiFetch(`/projects/${projectId}/bugs`, {
        method: 'POST',
        body: JSON.stringify({ ...form, execution_run_id: linkedRunId || null }),
      })
      addToast('Bug logged')
      onCreated(bug)
      onClose()
    } catch (e) {
      addToast(e.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 600 }}>
        <div className="modal-title">Log a bug</div>
        <div className="form-group">
          <label className="form-label">Title *</label>
          <input className="form-input" placeholder="Short description of the bug" value={form.title} onChange={e => set('title', e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Execution run</label>
          <select className="form-select" value={linkedRunId} onChange={e => setLinkedRunId(e.target.value)}>
            <option value="">None</option>
            {executionRuns.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Severity</label>
          <select className="form-select" value={form.severity} onChange={e => set('severity', e.target.value)}>
            {SEVERITIES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Steps to reproduce</label>
          <textarea className="form-textarea" placeholder="1. Go to...&#10;2. Click on...&#10;3. Observe..." value={form.steps_to_reproduce} onChange={e => set('steps_to_reproduce', e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Expected result</label>
          <input className="form-input" placeholder="What should happen" value={form.expected} onChange={e => set('expected', e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Actual result</label>
          <input className="form-input" placeholder="What actually happens" value={form.actual} onChange={e => set('actual', e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Notes</label>
          <textarea className="form-textarea" placeholder="Additional context..." style={{ minHeight: 60 }} value={form.notes} onChange={e => set('notes', e.target.value)} />
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={submit} disabled={loading || !form.title.trim()}>{loading ? 'Logging...' : 'Log bug'}</button>
        </div>
      </div>
    </div>
  )
}

function BugDetailModal({ bug, projectId, isClient, onClose, onUpdated }) {
  const { addToast } = useToastStore()
  const [isEditing, setIsEditing] = useState(false)
  const [editForm, setEditForm] = useState({
    title: bug.title,
    severity: bug.severity,
    steps_to_reproduce: bug.steps_to_reproduce || '',
    expected: bug.expected || '',
    actual: bug.actual || '',
    notes: bug.notes || '',
  })
  const [saving, setSaving] = useState(false)

  const [comments, setComments] = useState([])
  const [loadingComments, setLoadingComments] = useState(true)
  const [commentBody, setCommentBody] = useState('')
  const [commentImage, setCommentImage] = useState(null)
  const [compressing, setCompressing] = useState(false)
  const [posting, setPosting] = useState(false)
  const fileInputRef = useRef(null)

  useEffect(() => {
    apiFetch(`/projects/${projectId}/bugs/${bug.id}/comments`)
      .then(setComments)
      .catch(console.error)
      .finally(() => setLoadingComments(false))
  }, [bug.id])

  const saveEdit = async () => {
    if (!editForm.title.trim()) return
    setSaving(true)
    try {
      const updated = await apiFetch(`/bugs/${bug.id}`, {
        method: 'PATCH',
        body: JSON.stringify(editForm),
      })
      onUpdated(updated)
      setIsEditing(false)
      addToast('Bug updated')
    } catch (e) {
      addToast(e.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleFile = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) return addToast('Please choose an image file', 'error')
    if (file.size > 15 * 1024 * 1024) return addToast('Image is too large (max 15MB)', 'error')
    setCompressing(true)
    try {
      setCommentImage(await compressImage(file))
    } catch (err) {
      addToast(err.message, 'error')
    } finally {
      setCompressing(false)
    }
  }

  const postComment = async () => {
    if (!commentBody.trim() && !commentImage) return
    setPosting(true)
    try {
      const comment = await apiFetch(`/projects/${projectId}/bugs/${bug.id}/comments`, {
        method: 'POST',
        body: JSON.stringify({ body: commentBody.trim() || null, image: commentImage }),
      })
      setComments(cs => [...cs, comment])
      setCommentBody('')
      setCommentImage(null)
    } catch (e) {
      addToast(e.message, 'error')
    } finally {
      setPosting(false)
    }
  }

  if (isEditing) {
    return (
      <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
        <div className="modal" style={{ maxWidth: 600 }}>
          <div className="modal-title">Edit bug</div>
          <div className="form-group">
            <label className="form-label">Title</label>
            <input className="form-input" value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Severity</label>
            <select className="form-select" value={editForm.severity} onChange={e => setEditForm(f => ({ ...f, severity: e.target.value }))}>
              {SEVERITIES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Steps to reproduce</label>
            <textarea className="form-textarea" value={editForm.steps_to_reproduce} onChange={e => setEditForm(f => ({ ...f, steps_to_reproduce: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Expected result</label>
            <input className="form-input" value={editForm.expected} onChange={e => setEditForm(f => ({ ...f, expected: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Actual result</label>
            <input className="form-input" value={editForm.actual} onChange={e => setEditForm(f => ({ ...f, actual: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Notes</label>
            <textarea className="form-textarea" style={{ minHeight: 60 }} value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
          <div className="modal-footer">
            <button className="btn btn-ghost" onClick={() => setIsEditing(false)} disabled={saving}>Cancel</button>
            <button className="btn btn-primary" onClick={saveEdit} disabled={saving || !editForm.title.trim()}>{saving ? 'Saving...' : 'Save changes'}</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 640 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', marginBottom: '1.25rem' }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
              <span className={`badge badge-${bug.severity}`}>{bug.severity}</span>
              <span className={`badge badge-${bug.status.replace('_', '-')}`}>{STATUS_LABELS[bug.status]}</span>
            </div>
            <h2 style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: '1rem', fontWeight: 700, color: 'var(--white)', lineHeight: 1.3 }}>{bug.title}</h2>
          </div>
          <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
            {!isClient && <button className="btn btn-ghost btn-sm" onClick={() => setIsEditing(true)}>Edit</button>}
            <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--muted)', cursor: 'pointer', display: 'flex' }}><Icon name="x" size={16} /></button>
          </div>
        </div>

        {bug.steps_to_reproduce && (
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '0.35rem' }}>Steps to reproduce</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--light)', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{bug.steps_to_reproduce}</div>
          </div>
        )}
        {bug.expected && (
          <div style={{ marginBottom: '0.6rem' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--muted)' }}>Expected: </span>
            <span style={{ fontSize: '0.82rem', color: 'var(--light)' }}>{bug.expected}</span>
          </div>
        )}
        {bug.actual && (
          <div style={{ marginBottom: '0.6rem' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--danger)' }}>Actual: </span>
            <span style={{ fontSize: '0.82rem', color: 'var(--light)' }}>{bug.actual}</span>
          </div>
        )}
        {bug.notes && (
          <div style={{ marginBottom: '1rem' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--muted)' }}>Notes: </span>
            <span style={{ fontSize: '0.82rem', color: 'var(--light)' }}>{bug.notes}</span>
          </div>
        )}
        {bug.execution_run_id && (
          <Link
            to={`/projects/${projectId}/executions/${bug.execution_run_id}`}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.76rem', color: 'var(--accent)', textDecoration: 'none', marginBottom: '1rem' }}
          >
            <Icon name="link" size={12} /> {bug.execution_run_name || 'Execution run'}
          </Link>
        )}

        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem', marginTop: '0.5rem' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '0.6rem' }}>
            Comments {comments.length > 0 && `(${comments.length})`}
          </div>

          {loadingComments ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '1rem' }}><div className="spinner" /></div>
          ) : comments.length === 0 ? (
            <div style={{ fontSize: '0.82rem', color: 'var(--muted)', padding: '0.75rem', background: 'var(--bg2)', border: '1px solid var(--border)', textAlign: 'center', marginBottom: '0.75rem' }}>
              No comments yet
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '0.75rem', maxHeight: 280, overflowY: 'auto' }}>
              {comments.map(c => (
                <div key={c.id} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', padding: '0.6rem 0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--light)' }}>{c.user_name || 'Someone'}</span>
                    {c.user_role && (
                      <span style={{ fontSize: '0.68rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        {c.user_role === 'client' ? 'Client' : c.user_role.replace('_', ' ')}
                      </span>
                    )}
                    <span style={{ fontSize: '0.72rem', color: 'var(--faint)', marginLeft: 'auto' }}>{new Date(c.created_at).toLocaleString()}</span>
                  </div>
                  {c.body && <div style={{ fontSize: '0.85rem', color: 'var(--light)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{c.body}</div>}
                  {c.image_data && <CommentImage src={c.image_data} />}
                </div>
              ))}
            </div>
          )}

          <div>
            <textarea
              className="form-textarea"
              style={{ minHeight: 60 }}
              placeholder="Leave a comment..."
              value={commentBody}
              onChange={e => setCommentBody(e.target.value)}
            />
            {commentImage && (
              <div style={{ position: 'relative', display: 'inline-block', marginTop: '0.5rem' }}>
                <img src={commentImage} alt="Attachment preview" style={{ maxWidth: 140, maxHeight: 100, display: 'block', border: '1px solid var(--border)' }} />
                <button
                  onClick={() => setCommentImage(null)}
                  style={{ position: 'absolute', top: -8, right: -8, width: 20, height: 20, borderRadius: '50%', background: 'var(--danger)', color: 'var(--white)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
                  title="Remove image"
                >
                  <Icon name="x" size={12} />
                </button>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.6rem' }}>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFile} style={{ display: 'none' }} />
              <button className="btn btn-ghost btn-sm" onClick={() => fileInputRef.current?.click()} disabled={compressing}>
                <Icon name="image" size={13} /> {compressing ? 'Processing...' : 'Attach image'}
              </button>
              <button className="btn btn-primary btn-sm" onClick={postComment} disabled={posting || compressing || (!commentBody.trim() && !commentImage)}>
                {posting ? 'Posting...' : 'Post comment'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function BugsPage() {
  const { id } = useParams()
  const { addToast } = useToastStore()
  const { user } = useAuth()
  const isClient = user?.role === 'client'
  const [project, setProject] = useState(null)
  const [bugs, setBugs] = useState([])
  const [executionRuns, setExecutionRuns] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [filter, setFilter] = useState('all')
  const [executionRunFilter, setExecutionRunFilter] = useState('')
  const [selectedBug, setSelectedBug] = useState(null)

  useEffect(() => { apiFetch(`/projects/${id}`).then(setProject).catch(console.error) }, [id])
  useEffect(() => { apiFetch(`/projects/${id}/execution-runs`).then(setExecutionRuns).catch(console.error) }, [id])

  useEffect(() => {
    apiFetch(`/projects/${id}/bugs`)
      .then(setBugs)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [id])

  const updateStatus = async (bugId, status) => {
    try {
      await apiFetch(`/bugs/${bugId}`, { method: 'PATCH', body: JSON.stringify({ status }) })
      setBugs(bs => bs.map(b => b.id === bugId ? { ...b, status } : b))
      addToast('Status updated')
    } catch (e) {
      addToast(e.message, 'error')
    }
  }

  const filtered = bugs
    .filter(b => filter === 'all' ? true : SEVERITIES.includes(filter) ? b.severity === filter : b.status === filter)
    .filter(b => executionRunFilter ? String(b.execution_run_id) === executionRunFilter : true)

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
            <span className="topbar-title">Bugs</span>
          </div>
        </div>
        {!isClient && (
          <div className="topbar-actions">
            <button className="btn btn-primary btn-sm" onClick={() => setShowModal(true)}>+ Log bug</button>
          </div>
        )}
      </div>
      <div className="page-content fade-in">
        {bugs.length > 0 && (
          <div className="stats-row" style={{ marginBottom: '1.5rem' }}>
            <div className="stat-card"><div className="stat-num">{bugs.length}</div><div className="stat-label">Total bugs</div></div>
            <div className="stat-card"><div className="stat-num" style={{ color: 'var(--danger)' }}>{bugs.filter(b => b.status === 'open').length}</div><div className="stat-label">Open</div></div>
            <div className="stat-card"><div className="stat-num" style={{ color: 'var(--danger)' }}>{bugs.filter(b => b.severity === 'critical').length}</div><div className="stat-label">Critical</div></div>
            <div className="stat-card"><div className="stat-num" style={{ color: 'var(--success)' }}>{bugs.filter(b => b.status === 'resolved').length}</div><div className="stat-label">Resolved</div></div>
          </div>
        )}
        <div className="filters-row">
          {['all', 'open', 'in_progress', 'resolved', 'critical', 'high', 'medium', 'low'].map(f => (
            <button key={f} className={`filter-btn${filter === f ? ' active' : ''}`} onClick={() => setFilter(f)}>
              {f === 'all' ? 'All' : f === 'in_progress' ? 'In progress' : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
          {executionRuns.length > 0 && (
            <select
              className="form-select"
              style={{ width: 'auto', padding: '0.35rem 0.75rem', fontSize: '0.78rem' }}
              value={executionRunFilter}
              onChange={e => setExecutionRunFilter(e.target.value)}
            >
              <option value="">All executions</option>
              {executionRuns.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          )}
        </div>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}><div className="spinner" /></div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <h3>{bugs.length === 0 ? 'No bugs logged yet' : 'No results for this filter'}</h3>
            <p>{bugs.length === 0 ? (isClient ? 'No bugs have been logged for this project yet.' : 'Found something broken? Log it here.') : 'Try a different filter.'}</p>
            {bugs.length === 0 && !isClient && <button className="btn btn-primary" onClick={() => setShowModal(true)}>Log a bug</button>}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {filtered.map(bug => (
              <div key={bug.id} className="card-sm">
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                  <div onClick={() => setSelectedBug(bug)} style={{ flex: 1, cursor: 'pointer' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
                      <Icon name="chevronRight" size={12} style={{ color: 'var(--muted)' }} />
                      <span style={{ fontWeight: 600, color: 'var(--light)', fontSize: '0.92rem' }}>{bug.title}</span>
                      <span className={`badge badge-${bug.severity}`}>{bug.severity}</span>
                      <span className={`badge badge-${bug.status.replace('_', '-')}`}>{STATUS_LABELS[bug.status]}</span>
                    </div>
                    {bug.steps_to_reproduce && (
                      <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginBottom: '0.3rem' }}>
                        <strong style={{ color: 'var(--light)' }}>Steps: </strong>
                        {bug.steps_to_reproduce.substring(0, 120)}{bug.steps_to_reproduce.length > 120 ? '...' : ''}
                      </div>
                    )}
                    {bug.expected && <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}><strong style={{ color: 'var(--light)' }}>Expected:</strong> {bug.expected}</div>}
                    {bug.actual && <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}><strong style={{ color: 'var(--danger)' }}>Actual:</strong> {bug.actual}</div>}
                    {bug.execution_run_id && (
                      <Link
                        to={`/projects/${id}/executions/${bug.execution_run_id}`}
                        onClick={e => e.stopPropagation()}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.76rem', color: 'var(--accent)', textDecoration: 'none', marginTop: '0.3rem' }}
                      >
                        <Icon name="link" size={12} /> {bug.execution_run_name || 'Execution run'}
                      </Link>
                    )}
                  </div>
                  {isClient ? (
                    <span className={`badge badge-${bug.status.replace('_', '-')}`}>{STATUS_LABELS[bug.status]}</span>
                  ) : (
                    <select className="form-select" style={{ width: 'auto', padding: '0.3rem 0.6rem', fontSize: '0.78rem' }} value={bug.status} onChange={e => updateStatus(bug.id, e.target.value)}>
                      {STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                    </select>
                  )}
                </div>
                <div style={{ fontSize: '0.73rem', color: 'var(--muted)', marginTop: '0.6rem' }}>Logged {new Date(bug.created_at).toLocaleDateString()}</div>
              </div>
            ))}
          </div>
        )}
      </div>
      {showModal && <BugModal projectId={id} onClose={() => setShowModal(false)} onCreated={b => setBugs(bs => [b, ...bs])} />}
      {selectedBug && (
        <BugDetailModal
          bug={selectedBug}
          projectId={id}
          isClient={isClient}
          onClose={() => setSelectedBug(null)}
          onUpdated={(updated) => {
            setBugs(bs => bs.map(b => b.id === updated.id ? { ...b, ...updated } : b))
            setSelectedBug(prev => ({ ...prev, ...updated }))
          }}
        />
      )}
    </>
  )
}