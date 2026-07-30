import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom'
import { apiFetch } from '../lib/api.js'
import { useAuth } from '../store/AuthContext.jsx'
import { useToastStore } from '../store/toastStore.jsx'
import { formatStep } from '../lib/steps.js'
import { handleImageFile } from '../lib/imageUpload.js'
import Icon from '../components/Icon.jsx'
import ManageFeaturesModal from '../components/ManageFeaturesModal.jsx'
import CombineTestCasesModal from '../components/CombineTestCasesModal.jsx'

const TYPE_LABELS = { functional: 'Functional', integration: 'Integration', e2e: 'E2E' }
const SEVERITIES = ['critical', 'high', 'medium', 'low']

function CreateTestCaseModal({ projectId, features, onClose, onCreated }) {
  const { addToast } = useToastStore()
  const [form, setForm] = useState({ title: '', type: 'functional', steps: '', expected: '', platform: 'web', feature_id: '' })
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const submit = async () => {
    if (!form.title.trim()) return
    setSaving(true)
    try {
      const stepsArray = form.steps.split('\n').map(s => s.trim()).filter(Boolean)
      const created = await apiFetch(`/projects/${projectId}/test-cases`, {
        method: 'POST',
        body: JSON.stringify({ title: form.title, type: form.type, steps: stepsArray, expected: form.expected, platform: form.platform, feature_id: form.feature_id || null }),
      })
      addToast('Test case created')
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
      <div className="modal" style={{ maxWidth: 620 }}>
        <div className="modal-title">New test case</div>

        <div className="form-group">
          <label className="form-label">Title</label>
          <input className="form-input" value={form.title} onChange={e => set('title', e.target.value)} />
        </div>

        <div className="form-group">
          <label className="form-label">Type</label>
          <select className="form-select" value={form.type} onChange={e => set('type', e.target.value)}>
            <option value="functional">Functional</option>
            <option value="integration">Integration</option>
            <option value="e2e">E2E</option>
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">Platform</label>
          <select className="form-select" value={form.platform} onChange={e => set('platform', e.target.value)}>
            <option value="web">Web</option>
            <option value="mobile">Mobile</option>
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">Feature</label>
          <select className="form-select" value={form.feature_id} onChange={e => set('feature_id', e.target.value)}>
            <option value="">None</option>
            {features.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">Steps (one per line)</label>
          <textarea
            className="form-textarea"
            style={{ minHeight: 140 }}
            placeholder={'e.g.\nNavigate to the login page\nEnter valid credentials\nClick Sign in'}
            value={form.steps}
            onChange={e => set('steps', e.target.value)}
          />
        </div>

        <div className="form-group">
          <label className="form-label">Expected result</label>
          <textarea
            className="form-textarea"
            style={{ minHeight: 70 }}
            value={form.expected}
            onChange={e => set('expected', e.target.value)}
          />
        </div>

        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn btn-primary" onClick={submit} disabled={saving || !form.title.trim()}>
            {saving ? 'Creating...' : 'Create test case'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function LogBugModal({ projectId, testCase, executionRunId, features, onClose, onLogged }) {
  const { addToast } = useToastStore()
  const [form, setForm] = useState({
    title: `Bug in: ${testCase.title}`,
    severity: 'high',
    steps_to_reproduce: testCase.steps?.join('\n') || '',
    expected: testCase.expected || '',
    actual: '',
    notes: '',
  })
  const [executionRuns, setExecutionRuns] = useState([])
  const [linkedRunId, setLinkedRunId] = useState(executionRunId || '')
  // Pre-fill from the source test case's own feature when it has one —
  // still editable, still required, same as test_case_id being implicitly
  // set here but not locked.
  const [featureId, setFeatureId] = useState(testCase.feature_id || '')
  const [loading, setLoading] = useState(false)
  const [attachedImage, setAttachedImage] = useState(null)
  const [compressing, setCompressing] = useState(false)
  const fileInputRef = useRef(null)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    apiFetch(`/projects/${projectId}/execution-runs`).then(setExecutionRuns).catch(console.error)
  }, [projectId])

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
        body: JSON.stringify({ ...form, test_case_id: testCase.id, execution_run_id: linkedRunId || null, feature_id: featureId }),
      })
      if (attachedImage) {
        await apiFetch(`/projects/${projectId}/bugs/${bug.id}/comments`, {
          method: 'POST',
          body: JSON.stringify({ body: null, image: attachedImage }),
        }).catch(err => addToast(`Bug logged, but the image failed to attach: ${err.message}`, 'error'))
      }
      addToast('Bug logged and linked to test case')
      onLogged(bug)
      onClose()
    } catch (e) {
      addToast(e.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 580 }}>
        <div className="modal-title">Log a bug</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.78rem', color: 'var(--accent)', marginBottom: '1rem', background: 'rgba(184,70,31,0.08)', border: '1px solid rgba(184,70,31,0.2)', borderRadius: 0, padding: '0.5rem 0.75rem' }}>
          <Icon name="link" size={13} />
          <span>Will be linked to: <strong>{testCase.title}</strong></span>
        </div>
        <div className="form-group">
          <label className="form-label">Title *</label>
          <input className="form-input" value={form.title} onChange={e => set('title', e.target.value)} />
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
          <textarea className="form-textarea" value={form.steps_to_reproduce} onChange={e => set('steps_to_reproduce', e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Expected result</label>
          <input className="form-input" value={form.expected} onChange={e => set('expected', e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Actual result</label>
          <textarea className="form-textarea" style={{ minHeight: 100 }} placeholder="What actually happens" value={form.actual} onChange={e => set('actual', e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Notes</label>
          <textarea className="form-textarea" style={{ minHeight: 60 }} placeholder="Additional context..." value={form.notes} onChange={e => set('notes', e.target.value)} />
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
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={submit} disabled={loading || !form.title.trim() || !featureId}>
            {loading ? 'Logging...' : 'Log bug'}
          </button>
        </div>
      </div>
    </div>
  )
}

function TestCaseModal({ tc, projectId, isClient, features, onClose, onBugLogged, onTestCaseUpdated, onDeleted }) {
  const { addToast } = useToastStore()
  const [linkedBugs, setLinkedBugs] = useState([])
  const [loadingBugs, setLoadingBugs] = useState(true)
  const [showLogBug, setShowLogBug] = useState(false)

  const [isEditing, setIsEditing] = useState(false)
  const [editForm, setEditForm] = useState({
    title: tc.title,
    type: tc.type,
    steps: tc.steps?.join('\n') || '',
    expected: tc.expected || '',
    automationCandidate: !!tc.automation_candidate,
    platform: tc.platform || 'web',
    feature_id: tc.feature_id || '',
  })
  const [saving, setSaving] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const deleteTC = async () => {
    setDeleting(true)
    try {
      await apiFetch(`/projects/${projectId}/test-cases/${tc.id}`, { method: 'DELETE' })
      addToast('Test case deleted')
      onDeleted(tc.id)
      onClose()
    } catch (e) {
      addToast(e.message, 'error')
      setDeleting(false)
    }
  }

  useEffect(() => {
    apiFetch(`/projects/${projectId}/test-cases/${tc.id}/bugs`)
      .then(setLinkedBugs)
      .catch(console.error)
      .finally(() => setLoadingBugs(false))
  }, [tc.id])

  const saveEdit = async () => {
    if (!editForm.title.trim()) return
    setSaving(true)
    try {
      const stepsArray = editForm.steps.split('\n').map(s => s.trim()).filter(Boolean)
      const updated = await apiFetch(`/projects/${projectId}/test-cases/${tc.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          title: editForm.title,
          type: editForm.type,
          steps: stepsArray,
          expected: editForm.expected,
          automationCandidate: editForm.automationCandidate,
          platform: editForm.platform,
          feature_id: editForm.feature_id || null,
        }),
      })
      onTestCaseUpdated(updated)
      setIsEditing(false)
      addToast('Test case updated')
    } catch (e) {
      addToast(e.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  if (confirmingDelete) {
    return (
      <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
        <div className="modal" style={{ maxWidth: 480 }}>
          <div className="modal-title">Delete this test case?</div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', fontSize: '0.85rem', color: 'var(--light)', marginBottom: '1.25rem', lineHeight: 1.6, background: 'rgba(193,68,58,0.08)', border: '1px solid rgba(193,68,58,0.25)', borderRadius: 0, padding: '0.75rem 0.9rem' }}>
            <Icon name="alertTriangle" size={16} style={{ color: 'var(--danger)', marginTop: '0.1rem', flexShrink: 0 }} />
            <span>
              This permanently deletes <strong>{tc.title}</strong>, including its execution history (pass/fail
              records from past test runs are tied to the test case and are deleted with it, not just orphaned).
              This cannot be undone.
            </span>
          </div>
          <div className="modal-footer">
            <button className="btn btn-ghost" onClick={() => setConfirmingDelete(false)} disabled={deleting}>Back</button>
            <button className="btn btn-danger" onClick={deleteTC} disabled={deleting}>
              {deleting ? 'Deleting...' : 'Delete test case'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (showLogBug) return (
    <LogBugModal
      projectId={projectId}
      testCase={tc}
      features={features}
      onClose={() => setShowLogBug(false)}
      onLogged={(bug) => {
        setLinkedBugs(bs => [bug, ...bs])
        onBugLogged(bug)
      }}
    />
  )

  if (isEditing) {
    return (
      <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
        <div className="modal" style={{ maxWidth: 620 }}>
          <div className="modal-title">Edit test case</div>

          <div className="form-group">
            <label className="form-label">Title</label>
            <input className="form-input" value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} />
          </div>

          <div className="form-group">
            <label className="form-label">Type</label>
            <select className="form-select" value={editForm.type} onChange={e => setEditForm(f => ({ ...f, type: e.target.value }))}>
              <option value="functional">Functional</option>
              <option value="integration">Integration</option>
              <option value="e2e">E2E</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Platform</label>
            <select className="form-select" value={editForm.platform} onChange={e => setEditForm(f => ({ ...f, platform: e.target.value }))}>
              <option value="web">Web</option>
              <option value="mobile">Mobile</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Feature</label>
            <select className="form-select" value={editForm.feature_id} onChange={e => setEditForm(f => ({ ...f, feature_id: e.target.value }))}>
              <option value="">None</option>
              {features.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Steps (one per line)</label>
            <textarea
              className="form-textarea"
              style={{ minHeight: 140 }}
              value={editForm.steps}
              onChange={e => setEditForm(f => ({ ...f, steps: e.target.value }))}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Expected result</label>
            <textarea
              className="form-textarea"
              style={{ minHeight: 70 }}
              value={editForm.expected}
              onChange={e => setEditForm(f => ({ ...f, expected: e.target.value }))}
            />
          </div>

          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--light)' }}>
              <input
                type="checkbox"
                checked={editForm.automationCandidate}
                onChange={e => setEditForm(f => ({ ...f, automationCandidate: e.target.checked }))}
              />
              Good candidate for automation
            </label>
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
      <div className="modal" style={{ maxWidth: 620 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', marginBottom: '1.25rem' }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
              <span className={`badge badge-${tc.type}`}>{TYPE_LABELS[tc.type]}</span>
              <span className={`badge badge-${tc.platform || 'web'}`}>{tc.platform === 'mobile' ? 'Mobile' : 'Web'}</span>
              {tc.is_automated ? (
                <span className="badge badge-tc-automated" title="Has real generated automation">
                  <Icon name="check" size={11} /> Automated
                </span>
              ) : tc.automation_candidate ? (
                <span className="badge badge-automation" title={tc.automation_reasoning || 'Part of the curated critical-flow set'}>
                  <Icon name="zap" size={11} /> Critical Flow
                </span>
              ) : null}
            </div>
            <h2 style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: '1rem', fontWeight: 700, color: 'var(--white)', lineHeight: 1.3 }}>{tc.title}</h2>
          </div>
          <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
            {!isClient && <button className="btn btn-ghost btn-sm" onClick={() => setIsEditing(true)}>Edit</button>}
            {!isClient && <button className="btn btn-danger btn-sm" onClick={() => setConfirmingDelete(true)}>Delete</button>}
            <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--muted)', cursor: 'pointer', display: 'flex' }}><Icon name="x" size={16} /></button>
          </div>
        </div>

        {tc.steps?.length > 0 && (
          <div style={{ marginBottom: '1.25rem' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '0.6rem' }}>Steps</div>
            <ol style={{ paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {tc.steps.map((step, i) => (
                <li key={i} style={{ fontSize: '0.88rem', color: 'var(--light)', lineHeight: 1.55 }}>{formatStep(step)}</li>
              ))}
            </ol>
          </div>
        )}

        {tc.expected && (
          <div style={{ marginBottom: '1.25rem', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 0, padding: '0.75rem 1rem' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '0.35rem' }}>Expected result</div>
            <div style={{ fontSize: '0.88rem', color: 'var(--light)', lineHeight: 1.55 }}>{tc.expected}</div>
          </div>
        )}

        <div style={{ marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)' }}>
              Linked bugs {linkedBugs.length > 0 && `(${linkedBugs.length})`}
            </div>
            {!isClient && <button className="btn btn-ghost btn-sm" onClick={() => setShowLogBug(true)}>+ Log bug</button>}
          </div>
          {loadingBugs ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '1rem' }}><div className="spinner" /></div>
          ) : linkedBugs.length === 0 ? (
            <div style={{ fontSize: '0.82rem', color: 'var(--muted)', padding: '0.75rem', background: 'var(--bg2)', borderRadius: 0, border: '1px solid var(--border)', textAlign: 'center' }}>
              No bugs linked to this test case
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {linkedBugs.map(bug => (
                <div key={bug.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.55rem 0.75rem', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 0 }}>
                  <span className={`badge badge-${bug.severity}`}>{bug.severity}</span>
                  <span style={{ fontSize: '0.82rem', color: 'var(--light)', flex: 1 }}>{bug.title}</span>
                  <span className={`badge badge-${bug.status}`}>{bug.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function TestCasesPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { user } = useAuth()
  const isClient = user?.role === 'client'
  const [project, setProject] = useState(null)
  const [testCases, setTestCases] = useState([])
  const [features, setFeatures] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [showManageFeatures, setShowManageFeatures] = useState(false)
  const [selectedTc, setSelectedTc] = useState(null)
  const [filter, setFilter] = useState('all')
  const [platform, setPlatform] = useState('all')
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [showCombine, setShowCombine] = useState(false)

  useEffect(() => { apiFetch(`/projects/${id}`).then(setProject).catch(console.error) }, [id])

  const fetchFeatures = () => apiFetch(`/projects/${id}/features`).then(setFeatures).catch(console.error)
  useEffect(() => { fetchFeatures() }, [id])

  // Deep-link support: ?tcId=123 (from the dashboard/health activity feeds)
  // auto-opens that test case's detail modal once the list has loaded.
  useEffect(() => {
    const tcId = searchParams.get('tcId')
    if (!tcId || testCases.length === 0) return
    const match = testCases.find(tc => tc.id === Number(tcId))
    if (match) setSelectedTc(match)
  }, [testCases, searchParams])

  useEffect(() => {
    apiFetch(`/projects/${id}/test-cases`)
      .then(setTestCases)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [id])

  const handleBugLogged = (bug) => {
    setTestCases(tcs => tcs.map(tc => tc.id === bug.test_case_id ? { ...tc, bug_count: (tc.bug_count || 0) + 1 } : tc))
  }

  const platformFiltered = platform === 'all' ? testCases : testCases.filter(tc => tc.platform === platform)
  const filtered = filter === 'all' ? platformFiltered : filter === 'automation'
    ? platformFiltered.filter(tc => tc.automation_candidate)
    : platformFiltered.filter(tc => tc.type === filter)

  const automationCount = platformFiltered.filter(t => t.automation_candidate).length

  // Combining across platforms isn't meaningful (a web flow and a mobile
  // flow have nothing to merge) — once one row is selected, only rows of
  // that same platform can join the selection.
  const selectedPlatform = selectedIds.size > 0
    ? testCases.find(tc => selectedIds.has(tc.id))?.platform
    : null

  const toggleSelected = (tc) => setSelectedIds(ids => {
    const next = new Set(ids)
    if (next.has(tc.id)) next.delete(tc.id)
    else next.add(tc.id)
    return next
  })

  const selectedTestCases = testCases.filter(tc => selectedIds.has(tc.id))

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
            <span className="topbar-title">Test cases</span>
          </div>
        </div>
        <div className="topbar-actions">
          <Link to={`/projects/${id}/executions`} className="btn btn-ghost btn-sm">
            See executions <Icon name="arrowRight" size={12} />
          </Link>
          {!isClient && <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>+ New test case</button>}
        </div>
      </div>

      <div className="page-content fade-in">
        {testCases.length > 0 && (
          <div className="stats-row" style={{ marginBottom: '1.5rem' }}>
            <div className="stat-card"><div className="stat-num">{platformFiltered.length}</div><div className="stat-label">Total</div></div>
            <div className="stat-card"><div className="stat-num" style={{ color: 'var(--info)' }}>{automationCount}</div><div className="stat-label">Automation candidates</div></div>
            <div className="stat-card"><div className="stat-num" style={{ color: 'var(--muted)' }}>{platformFiltered.length - automationCount}</div><div className="stat-label">Manual only</div></div>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
          <div className="platform-tabs">
            {['all', 'web', 'mobile'].map(p => (
              <button key={p} className="platform-tab" aria-selected={platform === p} onClick={() => setPlatform(p)}>
                {p === 'all' ? 'All' : p === 'web' ? 'Web' : 'Mobile'}
              </button>
            ))}
          </div>
          {!isClient && (
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {selectedIds.size >= 2 && (
                <button className="btn btn-primary btn-sm" onClick={() => setShowCombine(true)}>
                  Combine ({selectedIds.size})
                </button>
              )}
              <button className="btn btn-ghost btn-sm" onClick={() => setShowManageFeatures(true)}>Manage features</button>
            </div>
          )}
        </div>

        <div className="filters-row">
          {['all', 'functional', 'integration', 'e2e', 'automation'].map(f => (
            <button key={f} className={`filter-btn${filter === f ? ' active' : ''}`} onClick={() => setFilter(f)}>
              {f === 'all' ? 'All' : f === 'automation' ? 'Automation candidates' : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}><div className="spinner" /></div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <h3>{testCases.length === 0 ? 'No test cases yet' : 'No results for this filter'}</h3>
            <p>
              {testCases.length === 0
                ? isClient
                  ? 'No test cases have been added for this project yet.'
                  : <>Generate test cases from the <Link to={`/projects/${id}/requirements`} style={{ color: 'var(--accent)' }}>Requirements</Link> page, or add one manually here.</>
                : 'Try a different filter.'}
            </p>
            {testCases.length === 0 && !isClient && <button className="btn btn-primary" onClick={() => setShowCreate(true)}>+ New test case</button>}
          </div>
        ) : (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    {!isClient && <th style={{ width: 32 }}></th>}
                    <th>Test case</th>
                    <th>Type</th>
                    <th>Platform</th>
                    <th>Automation</th>
                    <th>Bugs</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(tc => (
                    <tr key={tc.id} onClick={() => setSelectedTc(tc)} style={{ cursor: 'pointer' }}>
                      {!isClient && (
                        <td onClick={e => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedIds.has(tc.id)}
                            disabled={selectedPlatform !== null && tc.platform !== selectedPlatform && !selectedIds.has(tc.id)}
                            onChange={() => toggleSelected(tc)}
                          />
                        </td>
                      )}
                      <td style={{ maxWidth: 320 }}>
                        <div style={{ fontWeight: 500, color: 'var(--light)', marginBottom: '0.15rem' }}>{tc.title}</div>
                        {tc.steps?.length > 0 && <div style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>{tc.steps.length} steps</div>}
                      </td>
                      <td><span className={`badge badge-${tc.type}`}>{TYPE_LABELS[tc.type]}</span></td>
                      <td><span className={`badge badge-${tc.platform || 'web'}`}>{tc.platform === 'mobile' ? 'Mobile' : 'Web'}</span></td>
                      <td>
                        {tc.is_automated
                          ? <span className="badge badge-tc-automated" title="Has real generated automation"><Icon name="check" size={11} /> Automated</span>
                          : tc.automation_candidate
                          ? <span className="badge badge-automation" title={tc.automation_reasoning || 'Part of the curated critical-flow set'}><Icon name="zap" size={11} /> Critical Flow</span>
                          : <span style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>—</span>}
                      </td>
                      <td>
                        {tc.bug_count > 0
                          ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.78rem', color: 'var(--danger)', fontWeight: 600 }}><Icon name="bug" size={12} /> {tc.bug_count}</span>
                          : <span style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>—</span>}
                      </td>
                      <td style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>{new Date(tc.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {showCreate && (
        <CreateTestCaseModal
          projectId={id}
          features={features}
          onClose={() => setShowCreate(false)}
          onCreated={tc => setTestCases(tcs => [tc, ...tcs])}
        />
      )}

      {showManageFeatures && (
        <ManageFeaturesModal
          projectId={id}
          features={features}
          onClose={() => setShowManageFeatures(false)}
          onChanged={fetchFeatures}
        />
      )}

      {showCombine && (
        <CombineTestCasesModal
          projectId={id}
          testCases={selectedTestCases}
          features={features}
          onClose={() => setShowCombine(false)}
          onCombined={(newTc, oldIds) => {
            setTestCases(tcs => [newTc, ...tcs.filter(tc => !oldIds.includes(tc.id))])
            setSelectedIds(new Set())
          }}
        />
      )}

      {selectedTc && (
        <TestCaseModal
          tc={selectedTc}
          projectId={id}
          isClient={isClient}
          features={features}
          onClose={() => {
            setSelectedTc(null)
            if (searchParams.has('tcId')) {
              const next = new URLSearchParams(searchParams)
              next.delete('tcId')
              setSearchParams(next, { replace: true })
            }
          }}
          onBugLogged={handleBugLogged}
          onTestCaseUpdated={(updated) => {
            setTestCases(tcs => tcs.map(t => t.id === updated.id ? { ...t, ...updated } : t))
            setSelectedTc(prev => ({ ...prev, ...updated }))
          }}
          onDeleted={(tcId) => setTestCases(tcs => tcs.filter(t => t.id !== tcId))}
        />
      )}
    </>
  )
}