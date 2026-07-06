import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { apiFetch } from '../lib/api.js'
import { useAuth } from '../store/AuthContext.jsx'
import { useToastStore } from '../store/toastStore.jsx'

export default function ProjectDetailPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const { addToast } = useToastStore()
  const [project, setProject] = useState(null)
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [clientEmail, setClientEmail] = useState('')
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const [p, s] = await Promise.all([
          apiFetch(`/projects/${id}`),
          apiFetch(`/projects/${id}/stats`),
        ])
        setProject(p)
        setStats(s)
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  const addClient = async () => {
    if (!clientEmail.trim()) return
    setAdding(true)
    try {
      await apiFetch(`/projects/${id}/members`, { method: 'POST', body: JSON.stringify({ email: clientEmail.trim() }) })
      addToast(`${clientEmail} can now view this project`)
      setClientEmail('')
    } catch (e) {
      addToast(e.message, 'error')
    } finally {
      setAdding(false)
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

  const passRate = stats?.testCases > 0 ? Math.round((stats.passed / stats.testCases) * 100) : 0
  const isClient = user?.role === 'client'
  const isAdmin = user?.role === 'admin'

  return (
    <>
      <div className="topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
          <Link to="/projects" style={{ color: 'var(--muted)', textDecoration: 'none' }}>Projects</Link>
          <span style={{ color: 'var(--muted)' }}>/</span>
          <span className="topbar-title">{project.name}</span>
        </div>
      </div>
      <div className="page-content fade-in">
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '1.5rem', fontWeight: 700, color: 'var(--white)', marginBottom: '0.25rem' }}>{project.name}</h1>
          {project.client_name && <div style={{ color: 'var(--accent)', fontSize: '0.88rem', marginBottom: '0.5rem' }}>{project.client_name}</div>}
          {project.description && <div style={{ color: 'var(--muted)', fontSize: '0.9rem', maxWidth: 600 }}>{project.description}</div>}
        </div>
        <div className="stats-row" style={{ marginBottom: '2rem' }}>
          <div className="stat-card"><div className="stat-num">{stats?.testCases ?? 0}</div><div className="stat-label">Test cases</div></div>
          <div className="stat-card"><div className="stat-num" style={{ color: 'var(--success)' }}>{stats?.passed ?? 0}</div><div className="stat-label">Passed</div></div>
          <div className="stat-card"><div className="stat-num" style={{ color: 'var(--danger)' }}>{stats?.failed ?? 0}</div><div className="stat-label">Failed</div></div>
          <div className="stat-card"><div className="stat-num" style={{ color: 'var(--warning)' }}>{stats?.openBugs ?? 0}</div><div className="stat-label">Open bugs</div></div>
          <div className="stat-card"><div className="stat-num">{passRate}%</div><div className="stat-label">Pass rate</div></div>
        </div>
        {stats?.testCases > 0 && (
          <div style={{ marginBottom: '2rem' }}>
            <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginBottom: '0.4rem' }}>Pass rate</div>
            <div className="progress-bar" style={{ height: 8 }}>
              <div className="progress-fill green" style={{ width: `${passRate}%` }} />
            </div>
          </div>
        )}
        {!isClient && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: isAdmin ? '2rem' : 0 }}>
            <Link to={`/projects/${id}/tests`} style={{ textDecoration: 'none' }}>
              <div className="card" style={{ cursor: 'pointer', transition: 'border-color 0.2s' }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(224,125,60,0.3)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
              >
                <div style={{ fontSize: '1.5rem', marginBottom: '0.75rem' }}>✓</div>
                <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, color: 'var(--white)', marginBottom: '0.3rem' }}>Test cases</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>View, generate, and execute test cases against this project.</div>
              </div>
            </Link>
            <Link to={`/projects/${id}/bugs`} style={{ textDecoration: 'none' }}>
              <div className="card" style={{ cursor: 'pointer', transition: 'border-color 0.2s' }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(224,125,60,0.3)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
              >
                <div style={{ fontSize: '1.5rem', marginBottom: '0.75rem' }}>🐛</div>
                <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, color: 'var(--white)', marginBottom: '0.3rem' }}>Bug reports</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>Log, track, and resolve bugs found during testing.</div>
              </div>
            </Link>
            <Link to={`/projects/${id}/automation`} style={{ textDecoration: 'none' }}>
              <div className="card" style={{ cursor: 'pointer', transition: 'border-color 0.2s' }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(224,125,60,0.3)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
              >
                <div style={{ fontSize: '1.5rem', marginBottom: '0.75rem' }}>⚙️</div>
                <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, color: 'var(--white)', marginBottom: '0.3rem' }}>Automation</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>Run automated suites and view CI results, including nightly builds.</div>
              </div>
            </Link>
          </div>
        )}
        {isAdmin && (
          <div className="card" style={{ maxWidth: 420 }}>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, color: 'var(--white)', marginBottom: '0.5rem' }}>Share with a client</div>
            <div style={{ fontSize: '0.82rem', color: 'var(--muted)', marginBottom: '0.75rem' }}>
              They need to have already signed up. This gives them read-only access to this project's stats.
            </div>
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
      </div>
    </>
  )
}