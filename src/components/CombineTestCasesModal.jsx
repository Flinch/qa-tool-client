import { useState } from 'react'
import { apiFetch } from '../lib/api.js'
import { useToastStore } from '../store/toastStore.jsx'
import Icon from './Icon.jsx'
import { tcLabel } from '../lib/testCaseLabel.js'

export default function CombineTestCasesModal({ projectId, testCases, features, onClose, onCombined }) {
  const { addToast } = useToastStore()
  const [generating, setGenerating] = useState(false)
  const [draft, setDraft] = useState(null)
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setDraft(d => ({ ...d, [k]: v }))

  const platform = testCases[0]?.platform || 'web'

  const generate = async () => {
    setGenerating(true)
    try {
      const result = await apiFetch(`/projects/${projectId}/test-cases/combine`, {
        method: 'POST',
        body: JSON.stringify({ test_case_ids: testCases.map(tc => tc.id) }),
      })
      setDraft({
        title: result.draft.title || '',
        type: result.draft.type || 'e2e',
        steps: (result.draft.steps || []).join('\n'),
        expected: result.draft.expected || '',
        automationCandidate: !!result.draft.automationCandidate,
        automationReasoning: result.draft.automationReasoning || '',
        feature_id: testCases.find(tc => tc.feature_id)?.feature_id || '',
      })
    } catch (e) {
      addToast(e.message, 'error')
    } finally {
      setGenerating(false)
    }
  }

  const apply = async () => {
    if (!draft.title.trim()) return
    setSaving(true)
    try {
      const stepsArray = draft.steps.split('\n').map(s => s.trim()).filter(Boolean)
      const newTc = await apiFetch(`/projects/${projectId}/test-cases/combine/apply`, {
        method: 'POST',
        body: JSON.stringify({
          test_case_ids: testCases.map(tc => tc.id),
          combined: {
            title: draft.title,
            type: draft.type,
            steps: stepsArray,
            expected: draft.expected,
            platform,
            automation_candidate: draft.automationCandidate,
            automation_reasoning: draft.automationReasoning,
            feature_id: draft.feature_id || null,
          },
        }),
      })
      addToast(`Combined ${testCases.length} test cases into "${tcLabel(newTc.id, newTc.title)}"`)
      onCombined(newTc, testCases.map(tc => tc.id))
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
        <div className="modal-title">Combine {testCases.length} test cases</div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '1.25rem' }}>
          {testCases.map(tc => (
            <div key={tc.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.75rem', background: 'var(--bg2)', border: '1px solid var(--border)', fontSize: '0.85rem', color: 'var(--light)' }}>
              <span style={{ flex: 1 }}>{tcLabel(tc.id, tc.title)}</span>
              <span style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>{tc.steps?.length || 0} steps</span>
            </div>
          ))}
        </div>

        {!draft ? (
          <div className="modal-footer">
            <button className="btn btn-ghost" onClick={onClose} disabled={generating}>Cancel</button>
            <button className="btn btn-primary" onClick={generate} disabled={generating}>
              {generating ? 'Generating...' : 'Generate combined test case'}
            </button>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', fontSize: '0.85rem', color: 'var(--light)', marginBottom: '1.25rem', lineHeight: 1.6, background: 'rgba(193,68,58,0.08)', border: '1px solid rgba(193,68,58,0.25)', padding: '0.75rem 0.9rem' }}>
              <Icon name="alertTriangle" size={16} style={{ color: 'var(--danger)', marginTop: '0.1rem', flexShrink: 0 }} />
              <span>
                Applying this will delete the {testCases.length} original test cases (including their execution
                history, same as a normal delete) and create the combined test case below in their place. Any
                requirements or bugs linked to the originals will be re-linked to the new test case automatically.
                Any already-generated automation file tied to an original test case will lose its test-case link.
              </span>
            </div>

            <div className="form-group">
              <label className="form-label">Title</label>
              <input className="form-input" value={draft.title} onChange={e => set('title', e.target.value)} />
            </div>

            <div className="form-group">
              <label className="form-label">Type</label>
              <select className="form-select" value={draft.type} onChange={e => set('type', e.target.value)}>
                <option value="functional">Functional</option>
                <option value="integration">Integration</option>
                <option value="e2e">E2E</option>
                <option value="api">API</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Feature</label>
              <select className="form-select" value={draft.feature_id} onChange={e => set('feature_id', e.target.value)}>
                <option value="">None</option>
                {features.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Steps (one per line)</label>
              <textarea
                className="form-textarea"
                style={{ minHeight: 160 }}
                value={draft.steps}
                onChange={e => set('steps', e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Expected result</label>
              <textarea
                className="form-textarea"
                style={{ minHeight: 70 }}
                value={draft.expected}
                onChange={e => set('expected', e.target.value)}
              />
            </div>

            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--light)' }}>
                <input
                  type="checkbox"
                  checked={draft.automationCandidate}
                  onChange={e => set('automationCandidate', e.target.checked)}
                />
                Good candidate for automation
              </label>
              {draft.automationReasoning && (
                <div className="form-hint">{draft.automationReasoning}</div>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
              <button className="btn btn-primary" onClick={apply} disabled={saving || !draft.title.trim()}>
                {saving ? 'Applying...' : `Apply — replace ${testCases.length} test cases with this one`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
