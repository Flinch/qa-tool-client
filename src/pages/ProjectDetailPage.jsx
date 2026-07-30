import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { apiFetch } from '../lib/api.js'
import { useAuth } from '../store/AuthContext.jsx'
import { useToastStore } from '../store/toastStore.jsx'
import Icon from '../components/Icon.jsx'
import QualityHealth from '../components/QualityHealth.jsx'

function NavIcon({ name }) {
  return (
    <div style={{ width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--accent)', background: 'var(--bg)', color: 'var(--accent)', marginBottom: '0.85rem' }}>
      <Icon name={name} size={18} />
    </div>
  )
}

// Click the text, it becomes an input (or textarea), Save/Cancel appear.
// One field editable at a time (editingField/editValue live in the parent)
// rather than three independent draft states — simpler to reason about and
// matches how this app's other single-value inline edits work.
function EditableField({ field, value, editingField, editValue, onEditValueChange, onStart, onSave, onCancel, saving, multiline, placeholder, textStyle, canEdit, as: Tag = 'div' }) {
  const isEditing = editingField === field

  if (isEditing) {
    const InputTag = multiline ? 'textarea' : 'input'
    return (
      <div style={{ marginBottom: '0.5rem' }}>
        <InputTag
          className={multiline ? 'form-textarea' : 'form-input'}
          value={editValue}
          onChange={e => onEditValueChange(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !multiline) onSave()
            if (e.key === 'Escape') onCancel()
          }}
          style={multiline ? { maxWidth: 600, minHeight: 70 } : { maxWidth: 400 }}
          autoFocus
        />
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.4rem' }}>
          <button className="btn btn-primary btn-sm" onClick={onSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
          <button className="btn btn-ghost btn-sm" onClick={onCancel} disabled={saving}>Cancel</button>
        </div>
      </div>
    )
  }

  if (!value) {
    return canEdit ? (
      <div
        onClick={() => onStart(field)}
        style={{ cursor: 'pointer', color: 'var(--muted)', fontSize: '0.85rem', fontStyle: 'italic', marginBottom: '0.5rem' }}
      >
        + Add {placeholder}
      </div>
    ) : null
  }

  return (
    <Tag
      onClick={canEdit ? () => onStart(field) : undefined}
      title={canEdit ? 'Click to edit' : undefined}
      style={{ ...textStyle, cursor: canEdit ? 'pointer' : 'default' }}
    >
      {value}
    </Tag>
  )
}

export default function ProjectDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { addToast } = useToastStore()
  const [project, setProject] = useState(null)
  const [loading, setLoading] = useState(true)
  const [clientEmail, setClientEmail] = useState('')
  const [adding, setAdding] = useState(false)
  const [members, setMembers] = useState([])
  const [removingId, setRemovingId] = useState(null)
  const [editingField, setEditingField] = useState(null) // 'name' | 'client_name' | 'description' | null
  const [editValue, setEditValue] = useState('')
  const [savingField, setSavingField] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const p = await apiFetch(`/projects/${id}`)
        setProject(p)
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  const loadMembers = () => {
    if (user?.role !== 'admin') return
    apiFetch(`/projects/${id}/members`).then(setMembers).catch(console.error)
  }

  useEffect(loadMembers, [id, user?.role])

  const startEditField = (field) => {
    setEditingField(field)
    setEditValue(project[field] || '')
  }

  const cancelEditField = () => {
    setEditingField(null)
    setEditValue('')
  }

  const saveEditField = async () => {
    if (editingField === 'name' && !editValue.trim()) {
      addToast('Name cannot be empty', 'error')
      return
    }
    setSavingField(true)
    try {
      const updated = await apiFetch(`/projects/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ [editingField]: editValue }),
      })
      setProject(p => ({ ...p, ...updated }))
      setEditingField(null)
      setEditValue('')
    } catch (e) {
      addToast(e.message, 'error')
    } finally {
      setSavingField(false)
    }
  }

  const addClient = async () => {
    if (!clientEmail.trim()) return
    setAdding(true)
    try {
      await apiFetch(`/projects/${id}/members`, { method: 'POST', body: JSON.stringify({ email: clientEmail.trim() }) })
      addToast(`${clientEmail} can now view this project`)
      setClientEmail('')
      loadMembers()
    } catch (e) {
      addToast(e.message, 'error')
    } finally {
      setAdding(false)
    }
  }

  const removeClient = async (member) => {
    if (!window.confirm(`Revoke ${member.email}'s access to this project?`)) return
    setRemovingId(member.id)
    try {
      await apiFetch(`/projects/${id}/members/${member.id}`, { method: 'DELETE' })
      setMembers(ms => ms.filter(m => m.id !== member.id))
      addToast(`${member.email} no longer has access to this project`)
    } catch (e) {
      addToast(e.message, 'error')
    } finally {
      setRemovingId(null)
    }
  }

  if (loading) return (
    <>
      <div className="topbar"><span className="topbar-title">Project</span></div>
      <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}><div className="spinner" /></div>
    </>
  )

  if (!project) return (
    <>
      <div className="topbar"><span className="topbar-title">Project</span></div>
      <div className="page-content"><div className="empty-state"><h3>Project not found</h3></div></div>
    </>
  )

  const isClient = user?.role === 'client'
  const isAdmin = user?.role === 'admin'

  return (
    <>
      <div className="topbar">
        {isClient ? (
          <>
            <span className="topbar-title">{project.name}</span>
            {/* QualityHealth portals its NotificationBell into this node —
                keeps the bell in the actual page topbar (true "top of the
                page") without QualityHealth needing to duplicate the
                bugs/runs/requirements fetch it already owns. */}
            <div className="topbar-actions" id="client-topbar-bell" />
          </>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button className="back-btn" onClick={() => navigate(-1)} title="Back" aria-label="Back"><Icon name="arrowLeft" size={14} /></button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
              <Link to="/projects" style={{ color: 'var(--muted)', textDecoration: 'none' }}>Projects</Link>
              <span style={{ color: 'var(--muted)' }}>/</span>
              <span className="topbar-title">{project.name}</span>
            </div>
          </div>
        )}
      </div>
      <div className="page-content fade-in">
        <div style={{ marginBottom: '2rem' }}>
          <EditableField
            as="h1" field="name" value={project.name} canEdit={!isClient}
            editingField={editingField} editValue={editValue} onEditValueChange={setEditValue}
            onStart={startEditField} onSave={saveEditField} onCancel={cancelEditField} saving={savingField}
            textStyle={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: '1.5rem', fontWeight: 700, color: 'var(--white)', marginBottom: '0.25rem' }}
          />
          <EditableField
            field="client_name" value={project.client_name} canEdit={!isClient} placeholder="company name"
            editingField={editingField} editValue={editValue} onEditValueChange={setEditValue}
            onStart={startEditField} onSave={saveEditField} onCancel={cancelEditField} saving={savingField}
            textStyle={{ color: 'var(--accent)', fontSize: '0.88rem', marginBottom: '0.5rem' }}
          />
          <EditableField
            field="description" value={project.description} canEdit={!isClient} placeholder="description" multiline
            editingField={editingField} editValue={editValue} onEditValueChange={setEditValue}
            onStart={startEditField} onSave={saveEditField} onCancel={cancelEditField} saving={savingField}
            textStyle={{ color: 'var(--muted)', fontSize: '0.9rem', maxWidth: 600 }}
          />
        </div>

        {isClient ? (
          <QualityHealth projectId={id} projectName={project.name} />
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: isAdmin ? '2rem' : 0 }}>
                <Link to={`/projects/${id}/requirements`} style={{ textDecoration: 'none', display: 'block', height: '100%' }}>
                  <div className="card" style={{ cursor: 'pointer', transition: 'border-color 0.2s', height: '100%', display: 'flex', flexDirection: 'column' }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(184,70,31,0.3)'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                  >
                    <NavIcon name="target" />
                    <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 700, color: 'var(--white)', marginBottom: '0.3rem' }}>Requirements</div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>Track requirements and which test cases actually cover them.</div>
                  </div>
                </Link>
                <Link to={`/projects/${id}/tests`} style={{ textDecoration: 'none', display: 'block', height: '100%' }}>
                  <div className="card" style={{ cursor: 'pointer', transition: 'border-color 0.2s', height: '100%', display: 'flex', flexDirection: 'column' }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(184,70,31,0.3)'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                  >
                    <NavIcon name="check" />
                    <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 700, color: 'var(--white)', marginBottom: '0.3rem' }}>Test cases</div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>View, generate, and execute test cases against this project.</div>
                  </div>
                </Link>
                <Link to={`/projects/${id}/executions`} style={{ textDecoration: 'none', display: 'block', height: '100%' }}>
                  <div className="card" style={{ cursor: 'pointer', transition: 'border-color 0.2s', height: '100%', display: 'flex', flexDirection: 'column' }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(184,70,31,0.3)'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                  >
                    <NavIcon name="play" />
                    <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 700, color: 'var(--white)', marginBottom: '0.3rem' }}>Executions</div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>Run a session of manual and automated tests and export a report.</div>
                  </div>
                </Link>
                <Link to={`/projects/${id}/bugs`} style={{ textDecoration: 'none', display: 'block', height: '100%' }}>
                  <div className="card" style={{ cursor: 'pointer', transition: 'border-color 0.2s', height: '100%', display: 'flex', flexDirection: 'column' }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(184,70,31,0.3)'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                  >
                    <NavIcon name="bug" />
                    <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 700, color: 'var(--white)', marginBottom: '0.3rem' }}>Bugs</div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>Log, track, and resolve bugs found during testing.</div>
                  </div>
                </Link>
                <Link to={`/projects/${id}/automation`} style={{ textDecoration: 'none', display: 'block', height: '100%' }}>
                  <div className="card" style={{ cursor: 'pointer', transition: 'border-color 0.2s', height: '100%', display: 'flex', flexDirection: 'column' }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(184,70,31,0.3)'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                  >
                    <NavIcon name="gear" />
                    <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 700, color: 'var(--white)', marginBottom: '0.3rem' }}>Automation</div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>Run automated suites and view CI results, including nightly builds.</div>
                  </div>
                </Link>
            </div>
            {isAdmin && (
              <div className="card" style={{ maxWidth: 420 }}>
                <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 700, color: 'var(--white)', marginBottom: '0.5rem' }}>Share with a client</div>
                <div style={{ fontSize: '0.82rem', color: 'var(--muted)', marginBottom: '0.75rem' }}>
                  They need to have already signed up. This gives them read-only access to this project's stats.
                </div>
                {members.length > 0 && (
                  <div style={{ marginBottom: '0.9rem' }}>
                    {members.map(m => (
                      <div key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.4rem 0', borderBottom: '1px solid var(--border)' }}>
                        <div style={{ fontSize: '0.85rem', color: 'var(--light)' }}>{m.name || m.email}</div>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => removeClient(m)}
                          disabled={removingId === m.id}
                        >
                          {removingId === m.id ? 'Removing…' : 'Unshare'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    className="form-input"
                    placeholder="client@company.com"
                    value={clientEmail}
                    onChange={e => setClientEmail(e.target.value)}
                    style={{ flex: 1 }}
                  />
                  <button className="btn btn-primary btn-sm" onClick={addClient} disabled={adding || !clientEmail.trim()}>
                    {adding ? 'Adding…' : 'Add'}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </>
  )
}