import { useEffect, useState, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { apiFetch } from '../lib/api.js'
import { useToastStore } from '../store/toastStore.jsx'
import { formatStep } from '../lib/steps.js'
import { handleImageFile } from '../lib/imageUpload.js'
import Icon from '../components/Icon.jsx'

const TYPE_LABELS = { functional: 'Functional', integration: 'Integration', e2e: 'E2E' }
const SEVERITIES = ['critical', 'high', 'medium', 'low']

function GenerateModal({ projectId, existingCount, onClose, onGenerated }) {
  const { addToast } = useToastStore()
  const [requirements, setRequirements] = useState('')
  const [mode, setMode] = useState('mvp')
  const [replace, setReplace] = useState(false)
  const [confirmingReplace, setConfirmingReplace] = useState(false)
  const [loading, setLoading] = useState(false)

  const generate = async () => {
    if (!requirements.trim()) return
    if (replace && !confirmingReplace) {
      setConfirmingReplace(true)
      return
    }
    setLoading(true)
    try {
      const cases = await apiFetch(`/projects/${projectId}/test-cases/generate`, {
        method: 'POST',
        body: JSON.stringify({ requirements, mode, replace }),
      })
      addToast(replace ? `Replaced with ${cases.length} test cases` : `${cases.length} test cases generated`)
      onGenerated(cases, replace)
      onClose()
    } catch (e) {
      addToast(e.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  if (confirmingReplace) {
    return (
      <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
        <div className="modal" style={{ maxWidth: 480 }}>
          <div className="modal-title">Replace all test cases?</div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', fontSize: '0.85rem', color: 'var(--light)', marginBottom: '1.25rem', lineHeight: 1.6, background: 'rgba(193,68,58,0.08)', border: '1px solid rgba(193,68,58,0.25)', borderRadius: 0, padding: '0.75rem 0.9rem' }}>
            <Icon name="alertTriangle" size={16} style={{ color: 'var(--danger)', marginTop: '0.1rem', flexShrink: 0 }} />
            <span>
              This permanently deletes all <strong>{existingCount}</strong> existing test case{existingCount === 1 ? '' : 's'} for this project
              and replaces them with the newly generated set — including their execution history (pass/fail records
              from past test runs are tied to the test case and are deleted with it, not just orphaned). This cannot be undone.
            </span>
          </div>
          <div className="modal-footer">
            <button className="btn btn-ghost" onClick={() => setConfirmingReplace(false)} disabled={loading}>Back</button>
            <button className="btn btn-danger" onClick={generate} disabled={loading}>
              {loading ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div className="spinner" style={{ width: 14, height: 14, borderWidth: 1.5 }} /> Replacing...
                </span>
              ) : 'Replace All & Generate'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 640 }}>
        <div className="modal-title">Generate test cases with AI</div>

        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
          {[
            { value: 'mvp', label: 'MVP', desc: '4–8 focused tests' },
            { value: 'comprehensive', label: 'Comprehensive', desc: '12–20 full suite' },
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

        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', fontSize: '0.82rem', color: 'var(--muted)', marginBottom: '1rem', lineHeight: 1.6, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 0, padding: '0.6rem 0.85rem' }}>
          <Icon name={mode === 'mvp' ? 'target' : 'search'} size={15} style={{ color: 'var(--accent)', marginTop: '0.15rem' }} />
          <span>
            {mode === 'mvp'
              ? 'MVP mode: core happy paths + 1–2 edge cases. Good for quick coverage without over-engineering.'
              : 'Comprehensive mode: full coverage including edge cases, boundaries, and integration points.'}
          </span>
        </div>

        <div className="form-group">
          <label className="form-label">Requirements</label>
          <textarea
            className="form-textarea"
            style={{ minHeight: 160 }}
            placeholder="e.g. Users should be able to create an account with email and password. The email must be unique. Password must be at least 8 characters..."
            value={requirements}
            onChange={e => setRequirements(e.target.value)}
          />
        </div>

        {existingCount > 0 && (
          <div className="form-group">
            <label className="form-label">If test cases already exist</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {[
                { value: false, label: 'Add to existing', desc: `Keep all ${existingCount} current test cases` },
                { value: true, label: 'Replace all existing', desc: `Delete all ${existingCount}, use only the new set` },
              ].map(opt => (
                <button
                  key={String(opt.value)}
                  onClick={() => setReplace(opt.value)}
                  style={{
                    flex: 1, padding: '0.6rem 1rem', borderRadius: 0, cursor: 'pointer',
                    border: replace === opt.value ? '1px solid var(--accent)' : '1px solid var(--border)',
                    background: replace === opt.value ? 'rgba(184,70,31,0.1)' : 'var(--bg2)',
                    color: replace === opt.value ? 'var(--accent)' : 'var(--muted)',
                    textAlign: 'left', transition: 'all 0.15s',
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.15rem' }}>{opt.label}</div>
                  <div style={{ fontSize: '0.72rem' }}>{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose} disabled={loading}>Cancel</button>
          <button className={replace ? 'btn btn-danger' : 'btn btn-primary'} onClick={generate} disabled={loading || !requirements.trim()}>
            {loading ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div className="spinner" style={{ width: 14, height: 14, borderWidth: 1.5 }} /> Generating...
              </span>
            ) : (
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Icon name="zap" size={14} /> {replace ? 'Replace All & Generate' : `Generate ${mode === 'mvp' ? 'MVP' : 'Full'} Suite`}
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

function CreateTestCaseModal({ projectId, onClose, onCreated }) {
  const { addToast } = useToastStore()
  const [form, setForm] = useState({ title: '', type: 'functional', steps: '', expected: '' })
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const submit = async () => {
    if (!form.title.trim()) return
    setSaving(true)
    try {
      const stepsArray = form.steps.split('\n').map(s => s.trim()).filter(Boolean)
      const created = await apiFetch(`/projects/${projectId}/test-cases`, {
        method: 'POST',
        body: JSON.stringify({ title: form.title, type: form.type, steps: stepsArray, expected: form.expected }),
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

export function LogBugModal({ projectId, testCase, executionRunId, onClose, onLogged }) {
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
    if (!form.title.trim()) return
    setLoading(true)
    try {
      const bug = await apiFetch(`/projects/${projectId}/bugs`, {
        method: 'POST',
        body: JSON.stringify({ ...form, test_case_id: testCase.id, execution_run_id: linkedRunId || null }),
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
          <button className="btn btn-primary" onClick={submit} disabled={loading || !form.title.trim()}>
            {loading ? 'Logging...' : 'Log bug'}
          </button>
        </div>
      </div>
    </div>
  )
}

function TestCaseModal({ tc, projectId, onClose, onBugLogged, onTestCaseUpdated }) {
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
  })
  const [saving, setSaving] = useState(false)

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
      const updated = await apiFetch(`/test-cases/${tc.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          title: editForm.title,
          type: editForm.type,
          steps: stepsArray,
          expected: editForm.expected,
          automationCandidate: editForm.automationCandidate,
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

  if (showLogBug) return (
    <LogBugModal
      projectId={projectId}
      testCase={tc}
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
              {tc.automation_candidate && (
                <span className="badge badge-automation" title={tc.automation_reasoning || undefined}>
                  <Icon name="gear" size={11} /> Automatable
                </span>
              )}
            </div>
            <h2 style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: '1rem', fontWeight: 700, color: 'var(--white)', lineHeight: 1.3 }}>{tc.title}</h2>
          </div>
          <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setIsEditing(true)}>Edit</button>
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
            <button className="btn btn-ghost btn-sm" onClick={() => setShowLogBug(true)}>+ Log bug</button>
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
  const [project, setProject] = useState(null)
  const [testCases, setTestCases] = useState([])
  const [loading, setLoading] = useState(true)
  const [showGenerate, setShowGenerate] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [selectedTc, setSelectedTc] = useState(null)
  const [filter, setFilter] = useState('all')

  useEffect(() => { apiFetch(`/projects/${id}`).then(setProject).catch(console.error) }, [id])

  useEffect(() => {
    apiFetch(`/projects/${id}/test-cases`)
      .then(setTestCases)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [id])

  const handleBugLogged = (bug) => {
    setTestCases(tcs => tcs.map(tc => tc.id === bug.test_case_id ? { ...tc, bug_count: (tc.bug_count || 0) + 1 } : tc))
  }

  const filtered = filter === 'all' ? testCases : filter === 'automation'
    ? testCases.filter(tc => tc.automation_candidate)
    : testCases.filter(tc => tc.type === filter)

  const automationCount = testCases.filter(t => t.automation_candidate).length

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
            <span className="topbar-title">Test cases</span>
          </div>
        </div>
        <div className="topbar-actions">
          <button className="btn btn-ghost btn-sm" onClick={() => setShowCreate(true)}>+ New test case</button>
          <button className="btn btn-primary btn-sm" onClick={() => setShowGenerate(true)}><Icon name="zap" size={13} /> Generate</button>
        </div>
      </div>

      <div className="page-content fade-in">
        {testCases.length > 0 && (
          <div className="stats-row" style={{ marginBottom: '1.5rem' }}>
            <div className="stat-card"><div className="stat-num">{testCases.length}</div><div className="stat-label">Total</div></div>
            <div className="stat-card"><div className="stat-num" style={{ color: 'var(--info)' }}>{automationCount}</div><div className="stat-label">Automation candidates</div></div>
            <div className="stat-card"><div className="stat-num" style={{ color: 'var(--muted)' }}>{testCases.length - automationCount}</div><div className="stat-label">Manual only</div></div>
          </div>
        )}

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
            <p>{testCases.length === 0 ? 'Generate test cases from requirements.' : 'Try a different filter.'}</p>
            {testCases.length === 0 && <button className="btn btn-primary" onClick={() => setShowGenerate(true)}><Icon name="zap" size={14} /> Generate test cases</button>}
          </div>
        ) : (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Test case</th>
                    <th>Type</th>
                    <th>Automation</th>
                    <th>Bugs</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(tc => (
                    <tr key={tc.id} onClick={() => setSelectedTc(tc)} style={{ cursor: 'pointer' }}>
                      <td style={{ maxWidth: 320 }}>
                        <div style={{ fontWeight: 500, color: 'var(--light)', marginBottom: '0.15rem' }}>{tc.title}</div>
                        {tc.steps?.length > 0 && <div style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>{tc.steps.length} steps</div>}
                      </td>
                      <td><span className={`badge badge-${tc.type}`}>{TYPE_LABELS[tc.type]}</span></td>
                      <td>
                        {tc.automation_candidate
                          ? <span className="badge badge-automation" title={tc.automation_reasoning || undefined}><Icon name="gear" size={11} /> Automatable</span>
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

      {showGenerate && (
        <GenerateModal
          projectId={id}
          existingCount={testCases.length}
          onClose={() => setShowGenerate(false)}
          onGenerated={(cases, replace) => setTestCases(tcs => replace ? cases : [...cases, ...tcs])}
        />
      )}

      {showCreate && (
        <CreateTestCaseModal
          projectId={id}
          onClose={() => setShowCreate(false)}
          onCreated={tc => setTestCases(tcs => [tc, ...tcs])}
        />
      )}

      {selectedTc && (
        <TestCaseModal
          tc={selectedTc}
          projectId={id}
          onClose={() => setSelectedTc(null)}
          onBugLogged={handleBugLogged}
          onTestCaseUpdated={(updated) => {
            setTestCases(tcs => tcs.map(t => t.id === updated.id ? { ...t, ...updated } : t))
            setSelectedTc(prev => ({ ...prev, ...updated }))
          }}
        />
      )}
    </>
  )
}