import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
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

export default function ProjectDetailPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const { addToast } = useToastStore()
  const [project, setProject] = useState(null)
  const [loading, setLoading] = useState(true)
  const [clientEmail, setClientEmail] = useState('')
  const [adding, setAdding] = useState(false)
  const [members, setMembers] = useState([])
  const [removingId, setRemovingId] = useState(null)

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
          <span className="topbar-title">{project.name}</span>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Link to="/projects" className="back-btn" title="Back to projects" aria-label="Back to projects"><Icon name="arrowLeft" size={14} /></Link>
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
          <h1 style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: '1.5rem', fontWeight: 700, color: 'var(--white)', marginBottom: '0.25rem' }}>{project.name}</h1>
          {project.client_name && <div style={{ color: 'var(--accent)', fontSize: '0.88rem', marginBottom: '0.5rem' }}>{project.client_name}</div>}
          {project.description && <div style={{ color: 'var(--muted)', fontSize: '0.9rem', maxWidth: 600 }}>{project.description}</div>}
        </div>

        {isClient ? (
          <QualityHealth projectId={id} projectName={project.name} />
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: isAdmin ? '2rem' : 0 }}>
                <Link to={`/projects/${id}/requirements`} style={{ textDecoration: 'none' }}>
                  <div className="card" style={{ cursor: 'pointer', transition: 'border-color 0.2s' }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(184,70,31,0.3)'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                  >
                    <NavIcon name="target" />
                    <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 700, color: 'var(--white)', marginBottom: '0.3rem' }}>Requirements</div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>Track requirements and which test cases actually cover them.</div>
                  </div>
                </Link>
                <Link to={`/projects/${id}/tests`} style={{ textDecoration: 'none' }}>
                  <div className="card" style={{ cursor: 'pointer', transition: 'border-color 0.2s' }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(184,70,31,0.3)'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                  >
                    <NavIcon name="check" />
                    <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 700, color: 'var(--white)', marginBottom: '0.3rem' }}>Test cases</div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>View, generate, and execute test cases against this project.</div>
                  </div>
                </Link>
                <Link to={`/projects/${id}/bugs`} style={{ textDecoration: 'none' }}>
                  <div className="card" style={{ cursor: 'pointer', transition: 'border-color 0.2s' }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(184,70,31,0.3)'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                  >
                    <NavIcon name="bug" />
                    <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 700, color: 'var(--white)', marginBottom: '0.3rem' }}>Bug reports</div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>Log, track, and resolve bugs found during testing.</div>
                  </div>
                </Link>
                <Link to={`/projects/${id}/automation`} style={{ textDecoration: 'none' }}>
                  <div className="card" style={{ cursor: 'pointer', transition: 'border-color 0.2s' }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(184,70,31,0.3)'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                  >
                    <NavIcon name="gear" />
                    <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 700, color: 'var(--white)', marginBottom: '0.3rem' }}>Automation</div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>Run automated suites and view CI results, including nightly builds.</div>
                  </div>
                </Link>
                <Link to={`/projects/${id}/executions`} style={{ textDecoration: 'none' }}>
                  <div className="card" style={{ cursor: 'pointer', transition: 'border-color 0.2s' }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(184,70,31,0.3)'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                  >
                    <NavIcon name="play" />
                    <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 700, color: 'var(--white)', marginBottom: '0.3rem' }}>Executions</div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>Run a session of manual and automated tests and export a report.</div>
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