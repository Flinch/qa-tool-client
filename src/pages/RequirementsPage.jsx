import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom'
import { apiFetch } from '../lib/api.js'
import { useAuth } from '../store/AuthContext.jsx'
import { useToastStore } from '../store/toastStore.jsx'
import { readDocumentFile } from '../lib/documentUpload.js'
import Icon from '../components/Icon.jsx'
import ManageFeaturesModal from '../components/ManageFeaturesModal.jsx'
import AssignFeatureModal from '../components/AssignFeatureModal.jsx'
import { tcLabel } from '../lib/testCaseLabel.js'

function UploadRequirementsModal({ projectId, onClose, onDiff }) {
  const { addToast } = useToastStore()
  const [mode, setMode] = useState('file')
  const [file, setFile] = useState(null)
  const [text, setText] = useState('')
  const [platform, setPlatform] = useState('web')
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
        body: JSON.stringify({ ...body, platform }),
      })
      // Both modes now return the same diff-shaped payload without writing
      // anything — nothing commits until DiffReviewModal's Apply.
      onDiff(result.mode, result.document, result.diff, platform)
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

        <div className="form-group">
          <label className="form-label">Platform</label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {[
              { value: 'web', label: 'Web' },
              { value: 'mobile', label: 'Mobile' },
            ].map(p => (
              <button
                key={p.value}
                onClick={() => setPlatform(p.value)}
                style={{
                  flex: 1, padding: '0.5rem 1rem', borderRadius: 0, cursor: 'pointer',
                  border: platform === p.value ? '1px solid var(--accent)' : '1px solid var(--border)',
                  background: platform === p.value ? 'rgba(184,70,31,0.1)' : 'var(--bg2)',
                  color: platform === p.value ? 'var(--accent)' : 'var(--muted)',
                  fontWeight: 600, fontSize: '0.85rem', transition: 'all 0.15s',
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="form-hint">Applies to every requirement parsed from this document.</div>
        </div>

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

const EFFORT_LABEL = { S: 'Small effort', M: 'Medium effort', L: 'Large effort' }

// Requirements Intelligence output (Phase 2.2) — display-only in the review
// modal, since the primary edit surface here is title/description; a false
// positive just gets ignored rather than needing a dedicated dismiss UI.
function AmbiguityEffortBadges({ ambiguityFlag, estimatedEffort }) {
  if (!ambiguityFlag && !estimatedEffort) return null
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.4rem' }}>
      {ambiguityFlag && (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.72rem', color: 'var(--warning)', border: '1px solid var(--warning)', borderRadius: 0, padding: '0.1rem 0.5rem' }} title={ambiguityFlag}>
          <Icon name="alertTriangle" size={11} /> Ambiguous
        </span>
      )}
      {estimatedEffort && (
        <span style={{ fontSize: '0.72rem', color: 'var(--muted)', border: '1px solid var(--border2)', borderRadius: 0, padding: '0.1rem 0.5rem' }} title={EFFORT_LABEL[estimatedEffort]}>
          {estimatedEffort}
        </span>
      )}
    </div>
  )
}

function DiffReviewModal({ projectId, documentId, diff, platform, features, mode, onClose, onApplied }) {
  const { addToast } = useToastStore()
  const [approvedModified, setApprovedModified] = useState(() => new Set(diff.modified.map(m => m.id)))
  const [approvedRemoved, setApprovedRemoved] = useState(() => new Set(diff.removed.map(r => r.id)))
  const [approvedNew, setApprovedNew] = useState(() => new Set(diff.new.map((_, i) => i)))
  // AI-suggested feature per new requirement, editable before Apply — the
  // actual "edit the name before accepting" surface.
  const [featureNames, setFeatureNames] = useState(() => diff.new.map(n => n.feature_name || ''))
  // Title/description are editable too, before anything is written —
  // seeded from the AI's proposal, indexed the same way featureNames
  // already is.
  const [editedModified, setEditedModified] = useState(() => diff.modified.map(m => ({ ...m })))
  const [editedNew, setEditedNew] = useState(() => diff.new.map(n => ({ ...n })))
  const [saving, setSaving] = useState(false)

  const toggle = (setFn, key) => setFn(s => {
    const next = new Set(s)
    next.has(key) ? next.delete(key) : next.add(key)
    return next
  })

  const updateModified = (idx, field, value) => setEditedModified(items => items.map((it, i) => i === idx ? { ...it, [field]: value } : it))
  const updateNew = (idx, field, value) => setEditedNew(items => items.map((it, i) => i === idx ? { ...it, [field]: value } : it))

  const totalSelected = approvedModified.size + approvedRemoved.size + approvedNew.size

  const apply = async () => {
    setSaving(true)
    try {
      const result = await apiFetch(`/projects/${projectId}/requirements/apply-diff`, {
        method: 'POST',
        body: JSON.stringify({
          documentId,
          modified: editedModified.filter(m => approvedModified.has(m.id)).map(m => ({ id: m.id, title: m.title, description: m.description, ambiguity_flag: m.ambiguity_flag, estimated_effort: m.estimated_effort })),
          removed: diff.removed.filter(r => approvedRemoved.has(r.id)).map(r => r.id),
          // flatMap (not filter().map()) so featureNames[i]/editedNew[i]
          // stay aligned to the original index — filter() alone would
          // reindex and misalign them whenever an item is unchecked.
          added: editedNew.flatMap((n, i) => approvedNew.has(i) ? [{ ...n, feature_name: featureNames[i] }] : []),
          platform,
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
        <div className="modal-title">{mode === 'created' ? 'Review parsed requirements' : 'Review requirement changes'}</div>
        <div style={{ fontSize: '0.82rem', color: 'var(--muted)', marginBottom: '1.25rem' }}>
          {mode === 'created'
            ? <>{diff.new.length} requirement{diff.new.length === 1 ? '' : 's'} parsed, each with a suggested feature — edit any of them before applying.</>
            : <>{diff.unchangedCount} unchanged · {diff.modified.length} modified · {diff.removed.length} removed · {diff.new.length} new. Uncheck anything you don't want applied.</>}
        </div>
        <datalist id="feature-suggestions">
          {features.map(f => <option key={f.id} value={f.name} />)}
        </datalist>

        <div style={{ maxHeight: 420, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {diff.modified.length > 0 && (
            <div>
              <div style={{ fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--warning)', marginBottom: '0.6rem' }}>Modified</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {editedModified.map((m, idx) => (
                  <label key={m.id} style={{ display: 'flex', gap: '0.6rem', padding: '0.65rem 0.85rem', background: 'var(--bg2)', border: '1px solid var(--border)' }}>
                    <input type="checkbox" checked={approvedModified.has(m.id)} onChange={() => toggle(setApprovedModified, m.id)} style={{ marginTop: '0.2rem' }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.78rem', color: 'var(--muted)', textDecoration: 'line-through', marginBottom: '0.3rem' }}>{m.old.title}</div>
                      <input className="form-input" style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem' }} value={m.title} onChange={e => updateModified(idx, 'title', e.target.value)} />
                      <textarea className="form-textarea" style={{ fontSize: '0.78rem', minHeight: 55 }} value={m.description} onChange={e => updateModified(idx, 'description', e.target.value)} />
                      <AmbiguityEffortBadges ambiguityFlag={m.ambiguity_flag} estimatedEffort={m.estimated_effort} />
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
                {editedNew.map((n, i) => (
                  <label key={i} style={{ display: 'flex', gap: '0.6rem', padding: '0.65rem 0.85rem', background: 'var(--bg2)', border: '1px solid var(--border)' }}>
                    <input type="checkbox" checked={approvedNew.has(i)} onChange={() => toggle(setApprovedNew, i)} style={{ marginTop: '0.2rem' }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <input className="form-input" style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem' }} value={n.title} onChange={e => updateNew(i, 'title', e.target.value)} />
                      <textarea className="form-textarea" style={{ fontSize: '0.78rem', minHeight: 55, marginBottom: '0.4rem' }} value={n.description} onChange={e => updateNew(i, 'description', e.target.value)} />
                      <AmbiguityEffortBadges ambiguityFlag={n.ambiguity_flag} estimatedEffort={n.estimated_effort} />
                      <input
                        className="form-input"
                        style={{ fontSize: '0.78rem', padding: '0.35rem 0.6rem' }}
                        list="feature-suggestions"
                        placeholder="Feature (optional)"
                        value={featureNames[i]}
                        onChange={e => setFeatureNames(names => names.map((name, idx) => idx === i ? e.target.value : name))}
                      />
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

// Reviews the diff from POST /critical-flows/review before anything commits
// — same checkbox-approve-per-item shape as DiffReviewModal above, extended
// with the extra fields a flow needs (steps, expected, which requirements
// it covers) since a flow carries more than a requirement's title+description.
function CriticalFlowsReviewModal({ projectId, diff, unchangedCount, requirements, onClose, onApplied }) {
  const { addToast } = useToastStore()
  const [approvedModified, setApprovedModified] = useState(() => new Set((diff.modified || []).map(m => m.id)))
  const [approvedRemoved, setApprovedRemoved] = useState(() => new Set((diff.removed || []).map(r => r.id)))
  const [approvedNew, setApprovedNew] = useState(() => new Set((diff.new || []).map((_, i) => i)))
  // Editable drafts, seeded from the AI's proposal — steps kept as a
  // newline-joined string while editing (textarea), split back into an
  // array on apply, same convention TestCasesPage's own edit form uses.
  const [editedModified, setEditedModified] = useState(() =>
    (diff.modified || []).map(m => ({ ...m, stepsText: (m.steps || []).join('\n'), requirementIds: m.requirementIds || [] }))
  )
  const [editedNew, setEditedNew] = useState(() =>
    (diff.new || []).map(n => ({ ...n, stepsText: (n.steps || []).join('\n'), requirementIds: n.requirementIds || [] }))
  )
  const [saving, setSaving] = useState(false)

  const toggle = (setFn, key) => setFn(s => {
    const next = new Set(s)
    next.has(key) ? next.delete(key) : next.add(key)
    return next
  })

  const updateModified = (idx, field, value) => setEditedModified(items => items.map((it, i) => i === idx ? { ...it, [field]: value } : it))
  const updateNew = (idx, field, value) => setEditedNew(items => items.map((it, i) => i === idx ? { ...it, [field]: value } : it))
  const toggleRequirement = (items, setItems, idx, reqId) => setItems(list => list.map((it, i) => {
    if (i !== idx) return it
    const has = it.requirementIds.includes(reqId)
    return { ...it, requirementIds: has ? it.requirementIds.filter(x => x !== reqId) : [...it.requirementIds, reqId] }
  }))

  const totalSelected = approvedModified.size + approvedRemoved.size + approvedNew.size

  const requirementPicker = (item, onToggle) => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.4rem' }}>
      {requirements.map(r => (
        <label
          key={r.id}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.72rem', padding: '0.2rem 0.5rem',
            border: `1px solid ${item.requirementIds.includes(r.id) ? 'var(--accent)' : 'var(--border)'}`,
            color: item.requirementIds.includes(r.id) ? 'var(--white)' : 'var(--muted)', cursor: 'pointer',
          }}
        >
          <input type="checkbox" checked={item.requirementIds.includes(r.id)} onChange={() => onToggle(r.id)} style={{ margin: 0 }} />
          {r.title.length > 40 ? `${r.title.slice(0, 40)}...` : r.title}
        </label>
      ))}
    </div>
  )

  const apply = async () => {
    setSaving(true)
    try {
      const result = await apiFetch(`/projects/${projectId}/critical-flows/apply`, {
        method: 'POST',
        body: JSON.stringify({
          modified: editedModified.filter(m => approvedModified.has(m.id)).map(m => ({
            id: m.id, title: m.title, expected: m.expected, platform: m.platform, reasoning: m.reasoning,
            steps: m.stepsText.split('\n').map(s => s.trim()).filter(Boolean),
            requirementIds: m.requirementIds,
          })),
          removed: diff.removed.filter(r => approvedRemoved.has(r.id)).map(r => r.id),
          new: editedNew.filter((_, i) => approvedNew.has(i)).map(n => ({
            title: n.title, expected: n.expected, platform: n.platform, reasoning: n.reasoning,
            steps: n.stepsText.split('\n').map(s => s.trim()).filter(Boolean),
            requirementIds: n.requirementIds,
          })),
        }),
      })
      addToast(`Applied: ${result.modifiedIds.length} updated, ${result.removedIds.length} demoted, ${result.inserted.length} added`)
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
      <div className="modal" style={{ maxWidth: 700 }}>
        <div className="modal-title">Review critical flows</div>
        <div style={{ fontSize: '0.82rem', color: 'var(--muted)', marginBottom: '1.25rem' }}>
          {unchangedCount} unchanged · {diff.modified.length} modified · {diff.removed.length} demoted · {diff.new.length} new. Uncheck anything you don't want applied, edit steps/coverage inline.
        </div>

        <div style={{ maxHeight: 460, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {diff.modified.length > 0 && (
            <div>
              <div style={{ fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--warning)', marginBottom: '0.6rem' }}>Modified</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {editedModified.map((m, idx) => (
                  <label key={m.id} style={{ display: 'flex', gap: '0.6rem', padding: '0.65rem 0.85rem', background: 'var(--bg2)', border: '1px solid var(--border)' }}>
                    <input type="checkbox" checked={approvedModified.has(m.id)} onChange={() => toggle(setApprovedModified, m.id)} style={{ marginTop: '0.2rem' }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <input className="form-input" style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }} value={m.title} onChange={e => updateModified(idx, 'title', e.target.value)} />
                      <textarea className="form-textarea" style={{ fontSize: '0.78rem', minHeight: 70, marginBottom: '0.4rem' }} value={m.stepsText} onChange={e => updateModified(idx, 'stepsText', e.target.value)} placeholder="One step per line" />
                      <input className="form-input" style={{ fontSize: '0.78rem' }} value={m.expected} onChange={e => updateModified(idx, 'expected', e.target.value)} placeholder="Expected outcome" />
                      {requirementPicker(m, reqId => toggleRequirement(editedModified, setEditedModified, idx, reqId))}
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {diff.removed.length > 0 && (
            <div>
              <div style={{ fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--danger)', marginBottom: '0.6rem' }}>No longer critical (demoted, not deleted)</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {diff.removed.map(flow => (
                  <label key={flow.id} style={{ display: 'flex', gap: '0.6rem', padding: '0.65rem 0.85rem', background: 'var(--bg2)', border: '1px solid var(--border)', cursor: 'pointer' }}>
                    <input type="checkbox" checked={approvedRemoved.has(flow.id)} onChange={() => toggle(setApprovedRemoved, flow.id)} style={{ marginTop: '0.2rem' }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.85rem', color: 'var(--light)', fontWeight: 600, marginBottom: '0.2rem' }}>{tcLabel(flow.id, flow.title)}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>Currently covers {flow.requirementIds?.length || 0} requirement{flow.requirementIds?.length === 1 ? '' : 's'}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {diff.new.length > 0 && (
            <div>
              <div style={{ fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--success)', marginBottom: '0.6rem' }}>New</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {editedNew.map((n, idx) => (
                  <label key={idx} style={{ display: 'flex', gap: '0.6rem', padding: '0.65rem 0.85rem', background: 'var(--bg2)', border: '1px solid var(--border)' }}>
                    <input type="checkbox" checked={approvedNew.has(idx)} onChange={() => toggle(setApprovedNew, idx)} style={{ marginTop: '0.2rem' }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <input className="form-input" style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }} value={n.title} onChange={e => updateNew(idx, 'title', e.target.value)} />
                      <textarea className="form-textarea" style={{ fontSize: '0.78rem', minHeight: 70, marginBottom: '0.4rem' }} value={n.stepsText} onChange={e => updateNew(idx, 'stepsText', e.target.value)} placeholder="One step per line" />
                      <input className="form-input" style={{ fontSize: '0.78rem', marginBottom: '0.3rem' }} value={n.expected} onChange={e => updateNew(idx, 'expected', e.target.value)} placeholder="Expected outcome" />
                      {n.reasoning && <div style={{ fontSize: '0.72rem', color: 'var(--info)', marginBottom: '0.2rem' }}>{n.reasoning}</div>}
                      {requirementPicker(n, reqId => toggleRequirement(editedNew, setEditedNew, idx, reqId))}
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

// Reviews a diff from POST /generate-test-cases/review before it's applied
// — modeled closely on CriticalFlowsReviewModal above, but each item here
// belongs to exactly one requirement (no multi-select coverage picker
// needed) and "removed" means archived, not demoted.
function TestCaseDiffReviewModal({ projectId, diff, unchangedCount, requirementTitleById, onClose, onApplied }) {
  const { addToast } = useToastStore()
  const [approvedModified, setApprovedModified] = useState(() => new Set((diff.modified || []).map(m => m.id)))
  const [approvedRemoved, setApprovedRemoved] = useState(() => new Set((diff.removed || []).map(r => r.id)))
  const [approvedNew, setApprovedNew] = useState(() => new Set((diff.new || []).map((_, i) => i)))
  const [editedModified, setEditedModified] = useState(() =>
    (diff.modified || []).map(m => ({ ...m, stepsText: (m.steps || []).join('\n') }))
  )
  const [editedNew, setEditedNew] = useState(() =>
    (diff.new || []).map(n => ({ ...n, stepsText: (n.steps || []).join('\n') }))
  )
  const [saving, setSaving] = useState(false)

  const toggle = (setFn, key) => setFn(s => {
    const next = new Set(s)
    next.has(key) ? next.delete(key) : next.add(key)
    return next
  })

  const updateModified = (idx, field, value) => setEditedModified(items => items.map((it, i) => i === idx ? { ...it, [field]: value } : it))
  const updateNew = (idx, field, value) => setEditedNew(items => items.map((it, i) => i === idx ? { ...it, [field]: value } : it))

  const totalSelected = approvedModified.size + approvedRemoved.size + approvedNew.size

  const typeSelect = (value, onChange) => (
    <select className="form-select" style={{ fontSize: '0.78rem', marginBottom: '0.4rem' }} value={value} onChange={onChange}>
      <option value="functional">Functional</option>
      <option value="integration">Integration</option>
      <option value="e2e">E2E</option>
      <option value="api">API</option>
    </select>
  )

  const apply = async () => {
    setSaving(true)
    try {
      const result = await apiFetch(`/projects/${projectId}/requirements/generate-test-cases/apply`, {
        method: 'POST',
        body: JSON.stringify({
          modified: editedModified.filter(m => approvedModified.has(m.id)).map(m => ({
            id: m.id, title: m.title, type: m.type, expected: m.expected,
            automationCandidate: m.automationCandidate, automationReasoning: m.automationReasoning,
            steps: m.stepsText.split('\n').map(s => s.trim()).filter(Boolean),
          })),
          removed: (diff.removed || []).filter(r => approvedRemoved.has(r.id)).map(r => ({ id: r.id, requirementId: r.requirementId })),
          new: editedNew.filter((_, i) => approvedNew.has(i)).map(n => ({
            title: n.title, type: n.type, expected: n.expected, requirementId: n.requirementId,
            platform: n.platform, feature_id: n.feature_id,
            automationCandidate: n.automationCandidate, automationReasoning: n.automationReasoning,
            steps: n.stepsText.split('\n').map(s => s.trim()).filter(Boolean),
          })),
        }),
      })
      addToast(`Applied: ${result.modifiedIds.length} updated, ${result.archivedIds.length} archived, ${result.inserted.length} added`)
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
      <div className="modal" style={{ maxWidth: 700 }}>
        <div className="modal-title">Review test cases</div>
        <div style={{ fontSize: '0.82rem', color: 'var(--muted)', marginBottom: '1.25rem' }}>
          {unchangedCount} requirement{unchangedCount === 1 ? '' : 's'} unchanged · {diff.modified.length} modified · {diff.removed.length} archived · {diff.new.length} new. Uncheck anything you don't want applied, edit inline.
        </div>

        <div style={{ maxHeight: 460, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {diff.modified.length > 0 && (
            <div>
              <div style={{ fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--warning)', marginBottom: '0.6rem' }}>Modified</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {editedModified.map((m, idx) => (
                  <label key={m.id} style={{ display: 'flex', gap: '0.6rem', padding: '0.65rem 0.85rem', background: 'var(--bg2)', border: '1px solid var(--border)' }}>
                    <input type="checkbox" checked={approvedModified.has(m.id)} onChange={() => toggle(setApprovedModified, m.id)} style={{ marginTop: '0.2rem' }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.7rem', color: 'var(--info)', marginBottom: '0.3rem' }}>For: {requirementTitleById[m.requirementId]}</div>
                      <input className="form-input" style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }} value={m.title} onChange={e => updateModified(idx, 'title', e.target.value)} />
                      {typeSelect(m.type, e => updateModified(idx, 'type', e.target.value))}
                      <textarea className="form-textarea" style={{ fontSize: '0.78rem', minHeight: 70, marginBottom: '0.4rem' }} value={m.stepsText} onChange={e => updateModified(idx, 'stepsText', e.target.value)} placeholder="One step per line" />
                      <input className="form-input" style={{ fontSize: '0.78rem' }} value={m.expected} onChange={e => updateModified(idx, 'expected', e.target.value)} placeholder="Expected outcome" />
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {diff.removed.length > 0 && (
            <div>
              <div style={{ fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--danger)', marginBottom: '0.6rem' }}>No longer needed (archived, not deleted)</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {diff.removed.map(tc => (
                  <label key={tc.id} style={{ display: 'flex', gap: '0.6rem', padding: '0.65rem 0.85rem', background: 'var(--bg2)', border: '1px solid var(--border)', cursor: 'pointer' }}>
                    <input type="checkbox" checked={approvedRemoved.has(tc.id)} onChange={() => toggle(setApprovedRemoved, tc.id)} style={{ marginTop: '0.2rem' }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.85rem', color: 'var(--light)', fontWeight: 600, marginBottom: '0.2rem' }}>{tcLabel(tc.id, tc.title)}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>
                        For: {requirementTitleById[tc.requirementId]}
                        {tc.bug_count > 0 && <span style={{ color: 'var(--danger)' }}> · has {tc.bug_count} linked bug{tc.bug_count === 1 ? '' : 's'} — review before archiving</span>}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {diff.new.length > 0 && (
            <div>
              <div style={{ fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--success)', marginBottom: '0.6rem' }}>New</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {editedNew.map((n, idx) => (
                  <label key={idx} style={{ display: 'flex', gap: '0.6rem', padding: '0.65rem 0.85rem', background: 'var(--bg2)', border: '1px solid var(--border)' }}>
                    <input type="checkbox" checked={approvedNew.has(idx)} onChange={() => toggle(setApprovedNew, idx)} style={{ marginTop: '0.2rem' }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.7rem', color: 'var(--info)', marginBottom: '0.3rem' }}>For: {requirementTitleById[n.requirementId]}</div>
                      <input className="form-input" style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }} value={n.title} onChange={e => updateNew(idx, 'title', e.target.value)} />
                      {typeSelect(n.type, e => updateNew(idx, 'type', e.target.value))}
                      <textarea className="form-textarea" style={{ fontSize: '0.78rem', minHeight: 70, marginBottom: '0.4rem' }} value={n.stepsText} onChange={e => updateNew(idx, 'stepsText', e.target.value)} placeholder="One step per line" />
                      <input className="form-input" style={{ fontSize: '0.78rem' }} value={n.expected} onChange={e => updateNew(idx, 'expected', e.target.value)} placeholder="Expected outcome" />
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

function CreateRequirementModal({ projectId, features, onClose, onCreated }) {
  const { addToast } = useToastStore()
  const [form, setForm] = useState({ title: '', description: '', platform: 'web', feature_id: '' })
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

  const available = testCases.filter(tc => !linkedIds.has(tc.id) && tc.platform === requirement.platform)

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
                {tcLabel(tc.id, tc.title)}
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

export function RequirementModal({ requirement, projectId, isClient, features, onClose, onUpdated, onDeleted }) {
  const { addToast } = useToastStore()
  const [linkedTestCases, setLinkedTestCases] = useState([])
  const [loadingLinked, setLoadingLinked] = useState(true)
  const [showLinkModal, setShowLinkModal] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editForm, setEditForm] = useState({ title: requirement.title, description: requirement.description || '', platform: requirement.platform || 'web', feature_id: requirement.feature_id || '' })
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [pendingTcDiff, setPendingTcDiff] = useState(null)

  const loadLinked = () => {
    setLoadingLinked(true)
    apiFetch(`/projects/${projectId}/requirements/${requirement.id}/test-cases`)
      .then(tcs => {
        setLinkedTestCases(tcs)
        // Always resync the count from the actual current list rather than
        // trusting a stale prop or a hand-computed delta — cheap and keeps
        // this correct after any of unlink/generate/apply.
        onUpdated({ ...requirement, linked_test_case_count: tcs.length })
      })
      .catch(console.error)
      .finally(() => setLoadingLinked(false))
  }

  useEffect(loadLinked, [requirement.id])

  const unlink = async (tcId) => {
    try {
      await apiFetch(`/projects/${projectId}/requirements/${requirement.id}/test-cases/${tcId}`, { method: 'DELETE' })
      loadLinked()
    } catch (e) {
      addToast(e.message, 'error')
    }
  }

  const generateTestCase = async () => {
    setGenerating(true)
    try {
      const result = await apiFetch(`/projects/${projectId}/requirements/generate-test-cases/review`, {
        method: 'POST',
        body: JSON.stringify({ requirementIds: [requirement.id] }),
      })
      const { diff } = result
      if (diff.modified.length === 0 && diff.removed.length === 0 && diff.new.length === 0) {
        addToast('Test cases already up to date')
      } else if (diff.modified.length === 0 && diff.removed.length === 0) {
        // Pure net-new — nothing existing touched, safe to apply instantly.
        const applied = await apiFetch(`/projects/${projectId}/requirements/generate-test-cases/apply`, {
          method: 'POST',
          body: JSON.stringify({ modified: [], removed: [], new: diff.new }),
        })
        addToast(`Generated ${applied.inserted.length} test case${applied.inserted.length === 1 ? '' : 's'}`)
        loadLinked()
      } else {
        setPendingTcDiff(result)
      }
    } catch (e) {
      addToast(e.message, 'error')
    } finally {
      setGenerating(false)
    }
  }

  const deleteRequirement = async () => {
    if (!window.confirm(`Delete "${requirement.title}"? This can be undone by re-adding it, but it will disappear from the active list.`)) return
    try {
      await apiFetch(`/projects/${projectId}/requirements/${requirement.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'removed' }) })
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
      const updated = await apiFetch(`/projects/${projectId}/requirements/${requirement.id}`, {
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

  if (pendingTcDiff) return (
    <TestCaseDiffReviewModal
      projectId={projectId}
      diff={pendingTcDiff.diff}
      unchangedCount={pendingTcDiff.unchangedCount}
      requirementTitleById={pendingTcDiff.requirementTitleById}
      onClose={() => setPendingTcDiff(null)}
      onApplied={() => { setPendingTcDiff(null); loadLinked() }}
    />
  )

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 560 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', marginBottom: '1.25rem' }}>
          <div>
            <span className={`badge badge-${requirement.platform || 'web'}`} style={{ marginBottom: '0.4rem', display: 'inline-block' }}>
              {requirement.platform === 'mobile' ? 'Mobile' : 'Web'}
            </span>
            <h2 style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: '1rem', fontWeight: 700, color: 'var(--white)', lineHeight: 1.3 }}>{requirement.title}</h2>
          </div>
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
                <button className="btn btn-primary btn-sm" onClick={generateTestCase} disabled={generating}>
                  {generating ? 'Generating...' : 'Generate test case'}
                </button>
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
                  <span style={{ fontSize: '0.82rem', color: 'var(--light)', flex: 1 }}>{tcLabel(tc.id, tc.title)}</span>
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
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { user } = useAuth()
  const isClient = user?.role === 'client'
  const { addToast } = useToastStore()
  const [project, setProject] = useState(null)
  const [requirements, setRequirements] = useState([])
  const [features, setFeatures] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [showUpload, setShowUpload] = useState(false)
  const [showManageFeatures, setShowManageFeatures] = useState(false)
  const [pendingDiff, setPendingDiff] = useState(null)
  const [selected, setSelected] = useState(null)
  const [generatingIds, setGeneratingIds] = useState(new Set())
  const [bulkGenerating, setBulkGenerating] = useState(false)
  const [pendingTcDiff, setPendingTcDiff] = useState(null)
  const [platform, setPlatform] = useState('all')
  const [reviewingFlows, setReviewingFlows] = useState(false)
  const [pendingFlowsDiff, setPendingFlowsDiff] = useState(null)
  const [confirmingFlows, setConfirmingFlows] = useState(false)
  const [collapsedFeatures, setCollapsedFeatures] = useState(new Set())
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [showAssignFeature, setShowAssignFeature] = useState(false)
  const [downloadingSource, setDownloadingSource] = useState(false)

  useEffect(() => { apiFetch(`/projects/${id}`).then(setProject).catch(console.error) }, [id])

  const fetchFeatures = () => apiFetch(`/projects/${id}/features`).then(setFeatures).catch(console.error)
  useEffect(() => { fetchFeatures() }, [id])

  // Deep-link support: ?reqId=123 (e.g. from the Test Cases page's
  // Requirement column) auto-opens that requirement's detail modal once the
  // list has loaded — same pattern as TestCasesPage's ?tcId=.
  useEffect(() => {
    const reqId = searchParams.get('reqId')
    if (!reqId || requirements.length === 0) return
    const match = requirements.find(r => r.id === Number(reqId))
    if (match) setSelected(match)
  }, [requirements, searchParams])

  useEffect(() => {
    apiFetch(`/projects/${id}/requirements`)
      .then(setRequirements)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [id])

  const uncoveredCount = requirements.filter(r => r.linked_test_case_count === 0).length
  // Deliberately unscoped by the platform tab: "Generate all test cases"
  // acts project-wide (the backend endpoint has no platform filter), so its
  // count would mismatch what it actually does if scoped to the active tab.
  // The tab only filters which rows the table below shows.
  const filtered = platform === 'all' ? requirements : requirements.filter(r => r.platform === platform)

  // Groups by feature_id, real features sorted by name, "No feature" last —
  // a group key is the feature id, or the string 'none' for uncategorized.
  const featureNameById = Object.fromEntries(features.map(f => [f.id, f.name]))
  const groupedByFeature = (() => {
    const map = new Map()
    for (const r of filtered) {
      const key = r.feature_id || 'none'
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(r)
    }
    const entries = [...map.entries()]
    entries.sort((a, b) => {
      if (a[0] === 'none') return 1
      if (b[0] === 'none') return -1
      return (featureNameById[a[0]] || '').localeCompare(featureNameById[b[0]] || '')
    })
    return entries
  })()
  const allFeatureKeys = groupedByFeature.map(([key]) => key)
  const allCollapsed = allFeatureKeys.length > 0 && allFeatureKeys.every(k => collapsedFeatures.has(k))
  const toggleFeatureCollapse = (key) => setCollapsedFeatures(s => {
    const next = new Set(s)
    next.has(key) ? next.delete(key) : next.add(key)
    return next
  })
  const toggleCollapseAll = () => setCollapsedFeatures(allCollapsed ? new Set() : new Set(allFeatureKeys))

  const toggleSelected = (r) => setSelectedIds(ids => {
    const next = new Set(ids)
    next.has(r.id) ? next.delete(r.id) : next.add(r.id)
    return next
  })

  const assignFeatureToSelected = async (featureId) => {
    const ids = [...selectedIds]
    await Promise.all(ids.map(reqId =>
      apiFetch(`/projects/${id}/requirements/${reqId}`, { method: 'PATCH', body: JSON.stringify({ feature_id: featureId }) })
    ))
    setRequirements(rs => rs.map(r => ids.includes(r.id) ? { ...r, feature_id: featureId } : r))
    setSelectedIds(new Set())
    addToast(`Updated feature for ${ids.length} requirement${ids.length === 1 ? '' : 's'}`)
  }

  // Shared by generateOne/generateAll below: reviews, and either applies
  // immediately (pure net-new — nothing existing touched, safe to skip the
  // review step, preserving today's fast one-click UX for the common "first
  // time covering this requirement" case) or opens the review modal (a
  // diff that would modify or archive something existing always needs a
  // human look first, same principle as critical flows/requirements upload).
  const reviewTestCases = async (requirementIds) => {
    const result = await apiFetch(`/projects/${id}/requirements/generate-test-cases/review`, {
      method: 'POST',
      body: JSON.stringify(requirementIds ? { requirementIds } : {}),
    })
    const { diff } = result
    if (diff.modified.length === 0 && diff.removed.length === 0 && diff.new.length === 0) {
      addToast('Test cases already up to date')
      return
    }
    if (diff.modified.length === 0 && diff.removed.length === 0) {
      const applied = await apiFetch(`/projects/${id}/requirements/generate-test-cases/apply`, {
        method: 'POST',
        body: JSON.stringify({ modified: [], removed: [], new: diff.new }),
      })
      addToast(`Generated ${applied.inserted.length} test case${applied.inserted.length === 1 ? '' : 's'}`)
      apiFetch(`/projects/${id}/requirements`).then(setRequirements).catch(console.error)
      return
    }
    setPendingTcDiff(result)
  }

  const generateOne = async (reqId, e) => {
    e?.stopPropagation()
    setGeneratingIds(s => new Set(s).add(reqId))
    try {
      await reviewTestCases([reqId])
    } catch (err) {
      addToast(err.message, 'error')
    } finally {
      setGeneratingIds(s => { const next = new Set(s); next.delete(reqId); return next })
    }
  }

  const generateAll = async () => {
    setBulkGenerating(true)
    try {
      await reviewTestCases(null)
    } catch (err) {
      addToast(err.message, 'error')
    } finally {
      setBulkGenerating(false)
    }
  }

  const generateCriticalFlows = async () => {
    setReviewingFlows(true)
    try {
      const result = await apiFetch(`/projects/${id}/critical-flows/review`, { method: 'POST' })
      if (result.diff.modified.length === 0 && result.diff.removed.length === 0 && result.diff.new.length === 0) {
        addToast('Critical flows are already up to date')
      } else {
        setPendingFlowsDiff(result)
      }
    } catch (err) {
      addToast(err.message, 'error')
    } finally {
      setReviewingFlows(false)
      setConfirmingFlows(false)
    }
  }

  // The raw text of whatever was last uploaded/pasted (POST /upload) —
  // verbatim, not the current (possibly since-edited) requirements list.
  // Always a .txt regardless of the original upload's format, since only
  // extracted text is ever stored server-side (see requirements.js's
  // GET /source), never the original PDF/DOCX binary.
  const downloadSource = async () => {
    setDownloadingSource(true)
    try {
      const doc = await apiFetch(`/projects/${id}/requirements/source`)
      const blob = new Blob([doc.raw_text], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = doc.filename ? `${doc.filename.replace(/\.[^.]+$/, '')}-source.txt` : 'requirements-source.txt'
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      addToast(err.status === 404 ? 'No requirements document has been uploaded yet' : err.message, 'error')
    } finally {
      setDownloadingSource(false)
    }
  }

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
            <span className="topbar-title">Requirements</span>
          </div>
        </div>
        <div className="topbar-actions">
          <Link to={`/projects/${id}/tests`} className="btn btn-ghost btn-sm">
            See test cases <Icon name="arrowRight" size={12} />
          </Link>
          <button className="btn btn-ghost btn-sm" onClick={downloadSource} disabled={downloadingSource} title="Download the exact requirements document or pasted text that was last uploaded">
            {downloadingSource ? 'Downloading…' : 'Download original document'}
          </button>
          {!isClient && (
            <>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowUpload(true)}>Upload document</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setConfirmingFlows(true)} disabled={reviewingFlows || requirements.length === 0} title="Identify the small set of critical end-to-end flows worth automating first">
                {reviewingFlows ? 'Generating...' : 'Generate critical flows'}
              </button>
              <button className="btn btn-primary btn-sm" onClick={generateAll} disabled={bulkGenerating || requirements.length === 0}>
                {bulkGenerating ? 'Generating...' : 'Generate test cases'}
              </button>
              <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>+ New requirement</button>
            </>
          )}
        </div>
      </div>

      <div className="page-content fade-in">
        {requirements.length > 0 && (
          <div className="stats-row" style={{ marginBottom: '1.5rem' }}>
            <div className="stat-card"><div className="stat-num">{requirements.length}</div><div className="stat-label">Total</div></div>
            <div className="stat-card"><div className="stat-num" style={{ color: uncoveredCount > 0 ? 'var(--danger)' : 'var(--success)' }}>{uncoveredCount}</div><div className="stat-label">Uncovered requirements</div></div>
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
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {allFeatureKeys.length > 1 && (
              <button className="btn btn-ghost btn-sm" onClick={toggleCollapseAll}>
                {allCollapsed ? 'Expand all' : 'Collapse all'}
              </button>
            )}
            {!isClient && selectedIds.size >= 1 && (
              <button className="btn btn-primary btn-sm" onClick={() => setShowAssignFeature(true)}>
                Assign feature ({selectedIds.size})
              </button>
            )}
            {!isClient && requirements.length > 0 && <button className="btn btn-ghost btn-sm" onClick={() => setShowManageFeatures(true)}>Manage features</button>}
          </div>
        </div>

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
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <h3>No results for this filter</h3>
            <p>Try a different platform tab.</p>
          </div>
        ) : (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    {!isClient && <th style={{ width: 32 }}></th>}
                    <th>Requirement</th>
                    <th>Platform</th>
                    <th>Test cases</th>
                    <th>Created</th>
                  </tr>
                </thead>
                {groupedByFeature.map(([key, reqs]) => {
                  const isCollapsed = collapsedFeatures.has(key)
                  const label = key === 'none' ? 'No feature' : (featureNameById[key] || 'Unknown feature')
                  return (
                    <tbody key={key}>
                      <tr
                        onClick={() => toggleFeatureCollapse(key)}
                        style={{ cursor: 'pointer', background: 'var(--bg2)' }}
                      >
                        <td colSpan={isClient ? 4 : 5} style={{ padding: '0.55rem 1rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Icon name="chevronRight" size={12} style={{ transform: isCollapsed ? 'rotate(0deg)' : 'rotate(90deg)', transition: 'transform 0.15s', color: 'var(--muted)' }} />
                            <span style={{ fontWeight: 600, fontSize: '0.82rem', color: 'var(--light)' }}>{label}</span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>({reqs.length})</span>
                          </div>
                        </td>
                      </tr>
                      {!isCollapsed && reqs.map(r => (
                        <tr key={r.id} onClick={() => setSelected(r)} style={{ cursor: 'pointer' }}>
                          {!isClient && (
                            <td onClick={e => e.stopPropagation()}>
                              <input type="checkbox" checked={selectedIds.has(r.id)} onChange={() => toggleSelected(r)} />
                            </td>
                          )}
                          <td style={{ maxWidth: 420, paddingLeft: '2rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.15rem' }}>
                              <div style={{ fontWeight: 500, color: 'var(--light)' }}>{r.title}</div>
                              {!isClient && r.ambiguity_flag && (
                                <Icon name="alertTriangle" size={12} style={{ color: 'var(--warning)', flexShrink: 0 }} />
                              )}
                              {!isClient && r.estimated_effort && (
                                <span style={{ fontSize: '0.68rem', color: 'var(--muted)', border: '1px solid var(--border2)', borderRadius: 0, padding: '0 0.35rem', flexShrink: 0 }}>
                                  {r.estimated_effort}
                                </span>
                              )}
                            </div>
                            {r.description && <div style={{ fontSize: '0.72rem', color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.description}</div>}
                          </td>
                          <td><span className={`badge badge-${r.platform || 'web'}`}>{r.platform === 'mobile' ? 'Mobile' : 'Web'}</span></td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              {r.linked_test_case_count > 0 ? (
                                <span style={{ fontSize: '0.82rem', color: 'var(--light)' }}>{r.linked_test_case_count}</span>
                              ) : (
                                <span style={{ fontSize: '0.78rem', color: 'var(--danger)' }}>No coverage</span>
                              )}
                              {!isClient && (
                                <button
                                  className="btn btn-ghost btn-sm"
                                  onClick={e => generateOne(r.id, e)}
                                  disabled={generatingIds.has(r.id)}
                                >
                                  {generatingIds.has(r.id) ? 'Generating...' : 'Generate'}
                                </button>
                              )}
                            </div>
                          </td>
                          <td style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>{new Date(r.created_at).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  )
                })}
              </table>
            </div>
          </div>
        )}
      </div>

      {showCreate && (
        <CreateRequirementModal
          projectId={id}
          features={features}
          onClose={() => setShowCreate(false)}
          onCreated={r => setRequirements(rs => [r, ...rs])}
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

      {showAssignFeature && (
        <AssignFeatureModal
          count={selectedIds.size}
          features={features}
          onClose={() => setShowAssignFeature(false)}
          onAssign={assignFeatureToSelected}
        />
      )}

      {showUpload && (
        <UploadRequirementsModal
          projectId={id}
          onClose={() => setShowUpload(false)}
          onDiff={(mode, document, diff, uploadPlatform) => setPendingDiff({ mode, documentId: document.id, diff, platform: uploadPlatform })}
        />
      )}

      {pendingDiff && (
        <DiffReviewModal
          projectId={id}
          documentId={pendingDiff.documentId}
          diff={pendingDiff.diff}
          platform={pendingDiff.platform}
          mode={pendingDiff.mode}
          features={features}
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
            if (inserted.some(r => r.feature_id)) fetchFeatures()
          }}
        />
      )}

      {confirmingFlows && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && !reviewingFlows && setConfirmingFlows(false)}>
          <div className="modal" style={{ maxWidth: 520 }}>
            <div className="modal-title">Confirm generate critical flows</div>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', fontSize: '0.8rem', color: 'var(--muted)', marginBottom: '1rem', lineHeight: 1.6, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 0, padding: '0.6rem 0.85rem' }}>
              <Icon name="zap" size={14} style={{ color: 'var(--accent)', marginTop: '0.1rem', flexShrink: 0 }} />
              <span>
                This reasons over every active requirement with AI to identify the small set of critical, top-to-bottom
                flows worth automating first, and diffs them against what's already tracked — a real AI call, not a
                simulation. Nothing is written until you review and apply the result.
              </span>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setConfirmingFlows(false)} disabled={reviewingFlows}>Cancel</button>
              <button className="btn btn-primary" onClick={generateCriticalFlows} disabled={reviewingFlows}>
                {reviewingFlows ? 'Generating...' : 'Confirm & Generate'}
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingFlowsDiff && (
        <CriticalFlowsReviewModal
          projectId={id}
          diff={pendingFlowsDiff.diff}
          unchangedCount={pendingFlowsDiff.unchangedCount}
          requirements={requirements}
          onClose={() => setPendingFlowsDiff(null)}
          onApplied={() => {
            // A flow's requirement_test_cases links change on apply, which
            // shifts linked_test_case_count on the affected requirements —
            // simplest correct thing is a refetch rather than trying to
            // recompute counts client-side from a diff response.
            apiFetch(`/projects/${id}/requirements`).then(setRequirements).catch(console.error)
          }}
        />
      )}

      {pendingTcDiff && (
        <TestCaseDiffReviewModal
          projectId={id}
          diff={pendingTcDiff.diff}
          unchangedCount={pendingTcDiff.unchangedCount}
          requirementTitleById={pendingTcDiff.requirementTitleById}
          onClose={() => setPendingTcDiff(null)}
          onApplied={() => {
            apiFetch(`/projects/${id}/requirements`).then(setRequirements).catch(console.error)
          }}
        />
      )}

      {selected && (
        <RequirementModal
          requirement={selected}
          projectId={id}
          isClient={isClient}
          features={features}
          onClose={() => {
            setSelected(null)
            if (searchParams.has('reqId')) {
              const next = new URLSearchParams(searchParams)
              next.delete('reqId')
              setSearchParams(next, { replace: true })
            }
          }}
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
