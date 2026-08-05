import { useRef, useState } from 'react'
import { apiFetch } from '../lib/api.js'
import { useToastStore } from '../store/toastStore.jsx'
import { compressImage } from '../lib/imageUpload.js'
import Icon from './Icon.jsx'

// Displays the project's logo once one's been uploaded, otherwise the
// empty-state placeholder. `inline` is the compact variant that sits
// directly beside the hero greeting text (QualityHealth's client hero) —
// always read-only there, a client never edits it. `editable` is the
// staff-only upload control (see the "Share with a client" card in
// ProjectDetailPage.jsx) — small and square on purpose, not `inline`-sized,
// so it doesn't expand that card.
export function ProjectLogoPlaceholder({ inline, logo, editable, projectId, onLogoChange }) {
  const { addToast } = useToastStore()
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef(null)

  const patchLogo = async (value) => {
    setUploading(true)
    try {
      const updated = await apiFetch(`/projects/${projectId}`, {
        method: 'PATCH',
        body: JSON.stringify({ logo: value }),
      })
      onLogoChange(updated.logo)
    } catch (e) {
      addToast(e.message, 'error')
    } finally {
      setUploading(false)
    }
  }

  const onFileChange = async (e) => {
    const file = e.target.files[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) return addToast('Please choose an image file', 'error')
    if (file.size > 15 * 1024 * 1024) return addToast('Image is too large (max 15MB)', 'error')
    // Compressed small (320px) rather than imageUpload.js's usual 1600px —
    // this is a small square avatar, not a full-size attachment, and it
    // rides along in every GET /projects list response.
    await patchLogo(await compressImage(file, 320, 0.85))
  }

  if (editable) {
    return (
      <div>
        <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onFileChange} />
        <button
          type="button"
          className="project-logo-placeholder project-logo-placeholder-editable"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          {logo ? <img src={logo} alt="" className="project-logo-img" /> : <Icon name="image" size={20} />}
        </button>
        <div className="project-logo-edit-row">
          <button type="button" className="project-brand-add-link" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            {uploading ? 'Uploading…' : logo ? 'Change' : 'Upload'}
          </button>
          {logo && (
            <button type="button" className="project-brand-link-remove" onClick={() => patchLogo(null)} disabled={uploading} aria-label="Remove logo">
              <Icon name="x" size={10} />
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className={`project-logo-placeholder${inline ? ' project-logo-placeholder-inline' : ''}`}>
      {logo ? (
        <img src={logo} alt="" className="project-logo-img" />
      ) : (
        <>
          <Icon name="image" size={inline ? 38 : 22} />
          {!inline && <span>Project logo</span>}
        </>
      )}
    </div>
  )
}

// The links list + add/remove logic, extracted so it can be positioned
// independently of the logo placeholder. The client hero puts this under
// the status pill (align="right", always canEdit=false — links are
// staff-managed, a client never edits them); the staff hero stacks it
// under the logo placeholder instead (see the default export below).
export function ProjectLinksList({ projectId, links = [], canEdit, onLinksChange, align = 'left' }) {
  const { addToast } = useToastStore()
  const [adding, setAdding] = useState(false)
  const [label, setLabel] = useState('')
  const [url, setUrl] = useState('')
  const [saving, setSaving] = useState(false)

  const save = async (nextLinks) => {
    setSaving(true)
    try {
      const updated = await apiFetch(`/projects/${projectId}`, {
        method: 'PATCH',
        body: JSON.stringify({ links: nextLinks }),
      })
      onLinksChange(updated.links)
    } catch (e) {
      addToast(e.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const addLink = async () => {
    if (!label.trim() || !url.trim()) return
    // Staff shouldn't have to remember the https:// prefix for a quick
    // reference link — same idea as a browser address bar.
    let normalizedUrl = url.trim()
    if (!/^https?:\/\//i.test(normalizedUrl)) normalizedUrl = `https://${normalizedUrl}`
    await save([...links, { label: label.trim(), url: normalizedUrl }])
    setLabel('')
    setUrl('')
    setAdding(false)
  }

  const removeLink = (index) => save(links.filter((_, i) => i !== index))

  return (
    <div className={`project-links-list${align === 'right' ? ' project-links-list-right' : ''}`}>
      {links.map((link, i) => (
        <div key={i} className="project-brand-link-row">
          <a href={link.url} target="_blank" rel="noreferrer" className="project-brand-link" title={link.url}>
            <Icon name="link" size={12} /> {link.label}
          </a>
          {canEdit && (
            <button
              type="button"
              onClick={() => removeLink(i)}
              className="project-brand-link-remove"
              aria-label={`Remove ${link.label}`}
              disabled={saving}
            >
              <Icon name="x" size={10} />
            </button>
          )}
        </div>
      ))}
      {links.length === 0 && !canEdit && (
        <div className="project-brand-links-empty">No links added yet.</div>
      )}
      {canEdit && (
        adding ? (
          <div className="project-brand-add-form">
            <input
              className="form-input"
              placeholder="Label (e.g. Website)"
              value={label}
              onChange={e => setLabel(e.target.value)}
              autoFocus
            />
            <input
              className="form-input"
              placeholder="URL"
              value={url}
              onChange={e => setUrl(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addLink()}
            />
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              <button className="btn btn-primary btn-sm" onClick={addLink} disabled={saving || !label.trim() || !url.trim()}>
                {saving ? 'Saving…' : 'Add'}
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => { setAdding(false); setLabel(''); setUrl('') }} disabled={saving}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className="project-brand-add-link" onClick={() => setAdding(true)}>
            + Add link
          </button>
        )
      )}
    </div>
  )
}

// Combined box (logo stacked above its links) — used in the "Share with a
// client" card on the staff/engineering side (`compact`, small footprint so
// it doesn't expand that card) to upload the logo a client then sees. The
// client hero (QualityHealth.jsx) instead uses ProjectLogoPlaceholder and
// ProjectLinksList separately, split across the hero-top row (logo beside
// the heading, links under the status pill).
export default function ProjectBrandBox({ projectId, logo, onLogoChange, links = [], canEdit, onLinksChange, tall, compact }) {
  return (
    <div className={`project-brand-box${tall ? ' project-brand-box-tall' : ''}${compact ? ' project-brand-box-compact' : ''}`}>
      <ProjectLogoPlaceholder logo={logo} editable={canEdit} projectId={projectId} onLogoChange={onLogoChange} />
      <ProjectLinksList projectId={projectId} links={links} canEdit={canEdit} onLinksChange={onLinksChange} />
    </div>
  )
}
