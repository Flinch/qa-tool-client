import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom'
import { apiFetch } from '../lib/api.js'
import { useToastStore } from '../store/toastStore.jsx'
import { useAuth } from '../store/AuthContext.jsx'
import { handleImageFile } from '../lib/imageUpload.js'
import Icon from '../components/Icon.jsx'
import AssignFeatureModal from '../components/AssignFeatureModal.jsx'
import FilterPillGroup from '../components/FilterPillGroup.jsx'
import DateLoggedFilter from '../components/DateLoggedFilter.jsx'
import ApiTraceModal from '../components/ApiTraceModal.jsx'
import SaveViewModal from '../components/SaveViewModal.jsx'

const SEVERITIES = ['critical', 'high', 'medium', 'low']
const STATUSES = ['open', 'in_progress', 'resolved']
const STATUS_LABELS = { open: 'Open', in_progress: 'In progress', resolved: 'Resolved' }

// One filters object instead of five separate useState calls — this is also
// exactly what gets persisted verbatim into a saved view's `filters` JSONB
// column (see SaveViewModal), so its shape IS the view schema for type
// 'bugs'. Each top-level field (except dateLogged, which owns its own
// preset/from/to) is independently composable with every other field — see
// the `filtered` computation below, which ANDs them all together — while
// severity/status/source are each single-select WITHIN themselves via
// FilterPillGroup.
const DEFAULT_BUG_FILTERS = {
  severity: 'all',
  status: 'all',
  source: 'all',
  dateLogged: { preset: 'all', from: null, to: null },
  environmentalOnly: false,
  executionRunId: '',
  suiteId: '',
}

function matchesDateLogged(bug, dl) {
  if (dl.preset === 'all') return true
  const created = new Date(bug.created_at)
  if (dl.preset === '24h') return Date.now() - created.getTime() <= 24 * 60 * 60 * 1000
  if (dl.preset === '7d') return Date.now() - created.getTime() <= 7 * 24 * 60 * 60 * 1000
  if (dl.preset === 'custom') {
    if (dl.from && created < new Date(dl.from)) return false
    if (dl.to && created > new Date(`${dl.to}T23:59:59`)) return false
    return true
  }
  return true
}

// Pre-selects this JIRA project in the "post to JIRA" picker when it's
// present in the fetched list, since it's the one Malik files into most —
// still just a default, the dropdown stays fully overridable per bug.
const DEFAULT_JIRA_PROJECT_MATCH = 'medibank'

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

function BugModal({ projectId, features, onClose, onCreated }) {
  const { addToast } = useToastStore()
  const [form, setForm] = useState({ title: '', severity: 'high', steps_to_reproduce: '', expected: '', actual: '', notes: '' })
  const [executionRuns, setExecutionRuns] = useState([])
  const [linkedRunId, setLinkedRunId] = useState('')
  const [featureId, setFeatureId] = useState('')
  const [loading, setLoading] = useState(false)
  const [attachedImage, setAttachedImage] = useState(null)
  const [compressing, setCompressing] = useState(false)
  const fileInputRef = useRef(null)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const [postToJira, setPostToJira] = useState(false)
  const [jiraProjects, setJiraProjects] = useState([])
  const [jiraProjectsLoading, setJiraProjectsLoading] = useState(false)
  const [jiraProjectsError, setJiraProjectsError] = useState('')
  const [jiraProjectKey, setJiraProjectKey] = useState('')
  const [jiraOrganization, setJiraOrganization] = useState('')

  useEffect(() => {
    apiFetch(`/projects/${projectId}/execution-runs`).then(setExecutionRuns).catch(console.error)
  }, [projectId])

  const toggleJira = async () => {
    if (postToJira) { setPostToJira(false); return }
    setPostToJira(true)
    setJiraProjectsError('')
    if (jiraProjects.length > 0) return
    setJiraProjectsLoading(true)
    try {
      const projects = await apiFetch(`/projects/${projectId}/bugs/jira/projects`)
      if (!projects.length) {
        setJiraProjectsError('No JIRA projects found for this account.')
        setPostToJira(false)
      } else {
        setJiraProjects(projects)
        const preferred = projects.find(p => p.name.toLowerCase().includes(DEFAULT_JIRA_PROJECT_MATCH))
        setJiraProjectKey((preferred || projects[0]).key)
      }
    } catch (e) {
      setJiraProjectsError(e.message || "JIRA isn't connected yet.")
      setPostToJira(false)
    } finally {
      setJiraProjectsLoading(false)
    }
  }

  const handleFile = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setCompressing(true)
    try {
      setAttachedImage(await handleImageFile(file))
    } catch (err) {
      addToast(err.message, 'error')
    } finally {
      setCompressing(false)
    }
  }

  const submit = async () => {
    if (!form.title.trim() || !featureId) return
    setLoading(true)
    try {
      const bug = await apiFetch(`/projects/${projectId}/bugs`, {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          execution_run_id: linkedRunId || null,
          feature_id: featureId,
          post_to_jira: postToJira && !!jiraProjectKey,
          jira: postToJira && jiraProjectKey
            ? { projectKey: jiraProjectKey, organization: jiraOrganization.trim() || null, image: attachedImage || null }
            : undefined,
        }),
      })
      if (attachedImage) {
        await apiFetch(`/projects/${projectId}/bugs/${bug.id}/comments`, {
          method: 'POST',
          body: JSON.stringify({ body: null, image: attachedImage }),
        }).catch(err => addToast(`Bug logged, but the image failed to attach: ${err.message}`, 'error'))
      }
      if (bug.jira_issue_key) {
        addToast(`Bug logged and posted to JIRA (${bug.jira_issue_key})`)
      } else {
        addToast('Bug logged')
      }
      if (bug.jira_error) {
        addToast(`JIRA: ${bug.jira_error}`, 'error')
      }
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
          <label className="form-label">Feature *</label>
          <select className="form-select" value={featureId} onChange={e => setFeatureId(e.target.value)}>
            <option value="">Select a feature...</option>
            {features.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
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
          <textarea className="form-textarea" style={{ minHeight: 100 }} placeholder="What actually happens" value={form.actual} onChange={e => set('actual', e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Notes</label>
          <textarea className="form-textarea" placeholder="Additional context..." style={{ minHeight: 60 }} value={form.notes} onChange={e => set('notes', e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Attachment</label>
          {attachedImage ? (
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <img src={attachedImage} alt="Attachment preview" style={{ maxWidth: 160, maxHeight: 110, display: 'block', border: '1px solid var(--border)' }} />
              <button
                onClick={() => setAttachedImage(null)}
                style={{ position: 'absolute', top: -8, right: -8, width: 20, height: 20, borderRadius: '50%', background: 'var(--danger)', color: 'var(--white)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
                title="Remove image"
              >
                <Icon name="x" size={12} />
              </button>
            </div>
          ) : (
            <>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFile} style={{ display: 'none' }} />
              <button className="btn btn-ghost btn-sm" onClick={() => fileInputRef.current?.click()} disabled={compressing}>
                <Icon name="image" size={13} /> {compressing ? 'Processing...' : 'Attach image'}
              </button>
            </>
          )}
        </div>

        <div className="divider" />

        <div className="form-group">
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--light)' }}>
            <input type="checkbox" checked={postToJira} onChange={toggleJira} style={{ width: 16, height: 16, accentColor: 'var(--accent)', cursor: 'pointer' }} />
            Also post this to JIRA
          </label>
        </div>

        {postToJira && (
          <div className="fade-in">
            {jiraProjectsLoading ? (
              <div style={{ fontSize: '0.82rem', color: 'var(--muted)', marginBottom: '1rem' }}>Loading JIRA projects...</div>
            ) : (
              <>
                <div className="form-group">
                  <label className="form-label">JIRA project</label>
                  <select className="form-select" value={jiraProjectKey} onChange={e => setJiraProjectKey(e.target.value)}>
                    {jiraProjects.map(p => <option key={p.key} value={p.key}>{p.name} ({p.key})</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Organization</label>
                  <input className="form-input" placeholder="Optional" value={jiraOrganization} onChange={e => setJiraOrganization(e.target.value)} />
                  <div className="form-hint">Stored for reference — not automatically linked to your JIRA org yet.</div>
                </div>
                <div className="form-hint" style={{ marginBottom: '1.1rem' }}>Summary and description are filled in from the bug details above.</div>
              </>
            )}
          </div>
        )}
        {jiraProjectsError && !postToJira && (
          <div className="form-hint" style={{ color: 'var(--danger)', marginBottom: '1.1rem' }}>{jiraProjectsError}</div>
        )}

        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={submit} disabled={loading || !form.title.trim() || !featureId}>{loading ? 'Logging...' : 'Log bug'}</button>
        </div>
      </div>
    </div>
  )
}

export function BugDetailModal({ bug, projectId, isClient, features, hasPrev, hasNext, onNavigate, onClose, onUpdated }) {
  const { addToast } = useToastStore()
  const [isEditing, setIsEditing] = useState(false)
  const [showTrace, setShowTrace] = useState(false)
  const [editForm, setEditForm] = useState({
    title: bug.title,
    severity: bug.severity,
    steps_to_reproduce: bug.steps_to_reproduce || '',
    expected: bug.expected || '',
    actual: bug.actual || '',
    notes: bug.notes || '',
    feature_id: bug.feature_id || '',
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
      const updated = await apiFetch(`/projects/${projectId}/bugs/${bug.id}`, {
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
    setCompressing(true)
    try {
      setCommentImage(await handleImageFile(file))
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
            <label className="form-label">Feature</label>
            <select className="form-select" value={editForm.feature_id} onChange={e => setEditForm(f => ({ ...f, feature_id: e.target.value }))}>
              {features.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
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
      <div className="modal-nav-wrap">
        {onNavigate && (
          <button className="modal-nav-arrow left" disabled={!hasPrev} onClick={() => onNavigate('prev')} title="Previous bug">
            <Icon name="arrowLeft" size={16} />
          </button>
        )}
      <div className="modal" style={{ maxWidth: 640 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', marginBottom: '1.25rem' }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
              <span className={`badge badge-${bug.severity}`}>{bug.severity}</span>
              <span className={`badge badge-${bug.status.replace('_', '-')}`}>{STATUS_LABELS[bug.status]}</span>
              {bug.origin === 'automated' ? (
                <span className="badge badge-automated" title="Automatically filed from a failed automation run">
                  <Icon name="zap" size={11} /> Automated
                </span>
              ) : (
                <span className="badge" title="Logged by hand">Manual</span>
              )}
              {bug.is_environmental && (
                <span className="badge badge-environmental" title="The test didn't run to completion — a device/driver/connectivity problem, not a failed assertion">
                  <Icon name="alertTriangle" size={11} /> Environmental
                </span>
              )}
              {bug.is_regression && (
                <span className="badge badge-regression" title="This issue was previously marked resolved and has since resurfaced">
                  <Icon name="clock" size={11} /> Regressed
                </span>
              )}
              {bug.jira_issue_key && (
                <a href={bug.jira_issue_url} target="_blank" rel="noreferrer" className="badge badge-automation" style={{ textDecoration: 'none' }}>
                  {bug.jira_issue_key} ↗
                </a>
              )}
            </div>
            <h2 style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: '1rem', fontWeight: 700, color: 'var(--white)', lineHeight: 1.3 }}>{bug.title}</h2>
          </div>
          <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
            {!isClient && <button className="btn btn-ghost btn-sm" onClick={() => setIsEditing(true)}>Edit</button>}
            <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--muted)', cursor: 'pointer', display: 'flex' }}><Icon name="x" size={16} /></button>
          </div>
        </div>

        {bug.screenshot_data && (
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '0.35rem' }}>Screenshot at failure</div>
            <CommentImage src={bug.screenshot_data} />
          </div>
        )}
        {!bug.screenshot_data && bug.api_trace && (
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '0.35rem' }}>Evidence</div>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowTrace(true)}>
              <Icon name="link" size={13} /> View request/response
            </button>
          </div>
        )}
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
        <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          {bug.execution_run_id && (
            <Link
              to={`/projects/${projectId}/executions/${bug.execution_run_id}`}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.76rem', color: 'var(--accent)', textDecoration: 'none' }}
            >
              <Icon name="link" size={12} /> {bug.execution_run_name || 'Execution run'}
            </Link>
          )}
          {bug.suite_id && (
            <Link
              to={`/projects/${projectId}/automation`}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.76rem', color: 'var(--accent)', textDecoration: 'none' }}
            >
              <Icon name="target" size={12} /> {bug.suite_name || 'Automation suite'}
            </Link>
          )}
        </div>

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
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--light)' }}>{c.user_name || (c.user_id ? 'Someone' : 'Automated')}</span>
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
      {onNavigate && (
        <button className="modal-nav-arrow right" disabled={!hasNext} onClick={() => onNavigate('next')} title="Next bug">
          <Icon name="arrowRight" size={16} />
        </button>
      )}
      </div>
      {showTrace && bug.api_trace && (
        <ApiTraceModal trace={bug.api_trace} testTitle={bug.title} onClose={() => setShowTrace(false)} />
      )}
    </div>
  )
}

export default function BugsPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { addToast } = useToastStore()
  const { user } = useAuth()
  const isClient = user?.role === 'client'
  const [project, setProject] = useState(null)
  const [bugs, setBugs] = useState([])
  const [executionRuns, setExecutionRuns] = useState([])
  const [suites, setSuites] = useState([])
  const [features, setFeatures] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [filters, setFilters] = useState(DEFAULT_BUG_FILTERS)
  const [showSaveView, setShowSaveView] = useState(false)
  const [selectedBug, setSelectedBug] = useState(null)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [showAssignFeature, setShowAssignFeature] = useState(false)

  useEffect(() => { apiFetch(`/projects/${id}`).then(setProject).catch(console.error) }, [id])
  useEffect(() => { apiFetch(`/projects/${id}/execution-runs`).then(setExecutionRuns).catch(console.error) }, [id])
  useEffect(() => { apiFetch(`/projects/${id}/automation/suites`).then(setSuites).catch(console.error) }, [id])
  useEffect(() => { apiFetch(`/projects/${id}/features`).then(setFeatures).catch(console.error) }, [id])

  useEffect(() => {
    apiFetch(`/projects/${id}/bugs`)
      .then(setBugs)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [id])

  // Deep-link support: ?bugId=123 (from the dashboard/health activity feeds)
  // auto-opens that bug's detail modal once the list has loaded.
  useEffect(() => {
    const bugId = searchParams.get('bugId')
    if (!bugId || bugs.length === 0) return
    const match = bugs.find(b => b.id === Number(bugId))
    if (match) setSelectedBug(match)
  }, [bugs, searchParams])

  // Deep-link support: ?viewId=123 (Views tab card / copied link) applies
  // that saved view's filters once fetched. Left in the URL afterward
  // (unlike bugId, which gets stripped on modal close) — there's no
  // equivalent "done with this" moment, and keeping it means the page stays
  // trivially re-shareable/bookmarkable as-is.
  useEffect(() => {
    const viewId = searchParams.get('viewId')
    if (!viewId) return
    apiFetch(`/projects/${id}/saved-views/${viewId}`)
      .then(v => { if (v.type === 'bugs') setFilters(f => ({ ...DEFAULT_BUG_FILTERS, ...v.filters })) })
      .catch(() => addToast('Saved view not found', 'error'))
  }, [id, searchParams])

  const updateStatus = async (bugId, status) => {
    try {
      await apiFetch(`/projects/${id}/bugs/${bugId}`, { method: 'PATCH', body: JSON.stringify({ status }) })
      setBugs(bs => bs.map(b => b.id === bugId ? { ...b, status } : b))
      addToast('Status updated')
    } catch (e) {
      addToast(e.message, 'error')
    }
  }

  const toggleSelected = (bug) => setSelectedIds(ids => {
    const next = new Set(ids)
    next.has(bug.id) ? next.delete(bug.id) : next.add(bug.id)
    return next
  })

  const assignFeatureToSelected = async (featureId) => {
    const ids = [...selectedIds]
    await Promise.all(ids.map(bugId =>
      apiFetch(`/projects/${id}/bugs/${bugId}`, { method: 'PATCH', body: JSON.stringify({ feature_id: featureId }) })
    ))
    const feature = features.find(f => f.id === Number(featureId))
    setBugs(bs => bs.map(b => ids.includes(b.id) ? { ...b, feature_id: featureId, feature_name: feature?.name } : b))
    setSelectedIds(new Set())
    addToast(`Updated feature for ${ids.length} bug${ids.length === 1 ? '' : 's'}`)
  }

  const filtered = bugs
    .filter(b => filters.severity === 'all' || b.severity === filters.severity)
    .filter(b => filters.status === 'all' || b.status === filters.status)
    .filter(b => filters.source === 'all' || b.origin === filters.source)
    .filter(b => matchesDateLogged(b, filters.dateLogged))
    .filter(b => !filters.environmentalOnly || b.is_environmental)
    .filter(b => !filters.executionRunId || String(b.execution_run_id) === filters.executionRunId)
    .filter(b => !filters.suiteId || String(b.suite_id) === filters.suiteId)

  return (
    <>
      <div className="topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button className="back-btn" onClick={() => navigate(-1)} title="Back" aria-label="Back"><Icon name="arrowLeft" size={14} /></button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
            {!isClient && (
              <>
                <Link to="/projects" style={{ color: 'var(--muted)', textDecoration: 'none' }}>Projects</Link>
                <span style={{ color: 'var(--muted)' }}>/</span>
              </>
            )}
            <Link to={`/projects/${id}`} style={{ color: 'var(--muted)', textDecoration: 'none' }}>{project?.name || 'Project'}</Link>
            <span style={{ color: 'var(--muted)' }}>/</span>
            <span className="topbar-title">Bugs</span>
          </div>
        </div>
        <div className="topbar-actions">
          {!isClient && selectedIds.size >= 1 && (
            <button className="btn btn-ghost btn-sm" onClick={() => setShowAssignFeature(true)}>
              Assign feature ({selectedIds.size})
            </button>
          )}
          <button className="btn btn-ghost btn-sm" onClick={() => setShowSaveView(true)}>Save as view</button>
          {!isClient && <button className="btn btn-primary btn-sm" onClick={() => setShowModal(true)}>+ Log bug</button>}
        </div>
      </div>
      <div className="page-content fade-in">
        {bugs.length > 0 && (
          <div className="stats-row" style={{ marginBottom: '1.5rem' }}>
            <div className="stat-card"><div className="stat-num">{bugs.length}</div><div className="stat-label">Total bugs</div></div>
            <div className="stat-card"><div className="stat-num" style={{ color: 'var(--danger)' }}>{bugs.filter(b => b.status === 'open').length}</div><div className="stat-label">Open</div></div>
            <div className="stat-card"><div className="stat-num" style={{ color: 'var(--danger)' }}>{bugs.filter(b => b.severity === 'critical').length}</div><div className="stat-label">Critical</div></div>
            <div className="stat-card"><div className="stat-num" style={{ color: 'var(--success)' }}>{bugs.filter(b => b.status === 'resolved').length}</div><div className="stat-label">Resolved</div></div>
            <div className="stat-card"><div className="stat-num" style={{ color: 'var(--accent)' }}>{bugs.filter(b => b.origin === 'automated').length}</div><div className="stat-label">Caught by automation</div></div>
          </div>
        )}
        <div className="filters-row">
          <FilterPillGroup
            options={['all', ...SEVERITIES]}
            value={filters.severity}
            onChange={v => setFilters(f => ({ ...f, severity: v }))}
          />
          <FilterPillGroup
            options={['all', ...STATUSES]}
            value={filters.status}
            labels={STATUS_LABELS}
            onChange={v => setFilters(f => ({ ...f, status: v }))}
          />
          <FilterPillGroup
            options={['all', 'automated', 'manual']}
            value={filters.source}
            labels={{ all: 'Any source' }}
            onChange={v => setFilters(f => ({ ...f, source: v }))}
          />
          <DateLoggedFilter
            value={filters.dateLogged}
            onChange={v => setFilters(f => ({ ...f, dateLogged: v }))}
          />
          <button
            className={`filter-btn${filters.environmentalOnly ? ' active' : ''}`}
            onClick={() => setFilters(f => ({ ...f, environmentalOnly: !f.environmentalOnly }))}
            title="Only bugs where the test didn't run to completion (device/driver/connectivity), not a failed assertion"
          >
            Environmental only
          </button>
          {executionRuns.length > 0 && (
            <select
              className="form-select"
              style={{ width: 'auto', padding: '0.35rem 0.75rem', fontSize: '0.78rem' }}
              value={filters.executionRunId}
              onChange={e => setFilters(f => ({ ...f, executionRunId: e.target.value }))}
            >
              <option value="">All executions</option>
              {executionRuns.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          )}
          {suites.length > 0 && (
            <select
              className="form-select"
              style={{ width: 'auto', padding: '0.35rem 0.75rem', fontSize: '0.78rem' }}
              value={filters.suiteId}
              onChange={e => setFilters(f => ({ ...f, suiteId: e.target.value }))}
            >
              <option value="">All suites</option>
              {suites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
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
                  {!isClient && (
                    <input
                      type="checkbox"
                      checked={selectedIds.has(bug.id)}
                      onChange={() => toggleSelected(bug)}
                      style={{ marginTop: '0.3rem' }}
                    />
                  )}
                  <div onClick={() => setSelectedBug(bug)} style={{ flex: 1, cursor: 'pointer' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
                      <Icon name="chevronRight" size={12} style={{ color: 'var(--muted)' }} />
                      {bug.feature_name && (
                        <span className="badge" style={{ color: 'var(--accent2)', borderColor: 'var(--accent2)' }}>{bug.feature_name}</span>
                      )}
                      <span style={{ fontWeight: 600, color: 'var(--light)', fontSize: '0.92rem' }}>{bug.title}</span>
                      <span className={`badge badge-${bug.severity}`}>{bug.severity}</span>
                      <span className={`badge badge-${bug.status.replace('_', '-')}`}>{STATUS_LABELS[bug.status]}</span>
                      {bug.origin === 'automated' ? (
                        <span className="badge badge-automated" title="Automatically filed from a failed automation run">
                          <Icon name="zap" size={11} /> Automated
                        </span>
                      ) : (
                        <span className="badge" title="Logged by hand">Manual</span>
                      )}
                      {bug.is_environmental && (
                        <span className="badge badge-environmental" title="The test didn't run to completion — a device/driver/connectivity problem, not a failed assertion">
                          <Icon name="alertTriangle" size={11} /> Environmental
                        </span>
                      )}
                      {bug.is_regression && (
                        <span className="badge badge-regression" title="This issue was previously marked resolved and has since resurfaced">
                          <Icon name="clock" size={11} /> Regressed
                        </span>
                      )}
                      {bug.jira_issue_key && (
                        <a
                          href={bug.jira_issue_url} target="_blank" rel="noreferrer"
                          onClick={e => e.stopPropagation()}
                          className="badge badge-automation" style={{ textDecoration: 'none' }}
                        >
                          {bug.jira_issue_key} ↗
                        </a>
                      )}
                    </div>
                    {bug.steps_to_reproduce && (
                      <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginBottom: '0.3rem' }}>
                        <strong style={{ color: 'var(--light)' }}>Steps: </strong>
                        {bug.steps_to_reproduce.substring(0, 120)}{bug.steps_to_reproduce.length > 120 ? '...' : ''}
                      </div>
                    )}
                    {bug.expected && <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}><strong style={{ color: 'var(--light)' }}>Expected:</strong> {bug.expected}</div>}
                    {bug.actual && <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}><strong style={{ color: 'var(--danger)' }}>Actual:</strong> {bug.actual}</div>}
                    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                      {bug.execution_run_id && (
                        <Link
                          to={`/projects/${id}/executions/${bug.execution_run_id}`}
                          onClick={e => e.stopPropagation()}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.76rem', color: 'var(--accent)', textDecoration: 'none', marginTop: '0.3rem' }}
                        >
                          <Icon name="link" size={12} /> {bug.execution_run_name || 'Execution run'}
                        </Link>
                      )}
                      {bug.suite_id && (
                        <Link
                          to={`/projects/${id}/automation`}
                          onClick={e => e.stopPropagation()}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.76rem', color: 'var(--accent)', textDecoration: 'none', marginTop: '0.3rem' }}
                        >
                          <Icon name="target" size={12} /> {bug.suite_name || 'Automation suite'}
                        </Link>
                      )}
                    </div>
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
      {showModal && <BugModal projectId={id} features={features} onClose={() => setShowModal(false)} onCreated={b => setBugs(bs => [b, ...bs])} />}
      {showAssignFeature && (
        <AssignFeatureModal
          count={selectedIds.size}
          features={features}
          required
          onClose={() => setShowAssignFeature(false)}
          onAssign={assignFeatureToSelected}
        />
      )}
      {showSaveView && (
        <SaveViewModal projectId={id} type="bugs" filters={filters} onClose={() => setShowSaveView(false)} />
      )}
      {selectedBug && (() => {
        const navIndex = filtered.findIndex(b => b.id === selectedBug.id)
        return (
        <BugDetailModal
          key={selectedBug.id}
          bug={selectedBug}
          projectId={id}
          isClient={isClient}
          features={features}
          hasPrev={navIndex > 0}
          hasNext={navIndex >= 0 && navIndex < filtered.length - 1}
          onNavigate={dir => {
            const next = filtered[navIndex + (dir === 'next' ? 1 : -1)]
            if (next) setSelectedBug(next)
          }}
          onClose={() => {
            setSelectedBug(null)
            if (searchParams.has('bugId')) {
              const next = new URLSearchParams(searchParams)
              next.delete('bugId')
              setSearchParams(next, { replace: true })
            }
          }}
          onUpdated={(updated) => {
            // PATCH's RETURNING * doesn't carry feature_name — resolve it
            // client-side from the features list already in scope so the
            // card's badge doesn't go stale after a feature change.
            const feature = features.find(f => f.id === updated.feature_id)
            const merged = { ...updated, feature_name: feature?.name }
            setBugs(bs => bs.map(b => b.id === updated.id ? { ...b, ...merged } : b))
            setSelectedBug(prev => ({ ...prev, ...merged }))
          }}
        />
        )
      })()}
    </>
  )
}