import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAuth } from '@clerk/clerk-react'
import { apiFetch } from '../lib/api.js'

export default function ProjectDetailPage() {
  const { id } = useParams()
  const { getToken } = useAuth()
  const [project, setProject] = useState(null)
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const [p, s] = await Promise.all([
          apiFetch(`/projects/${id}`, {}, getToken),
          apiFetch(`/projects/${id}/stats`, {}, getToken),
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
          <div className="stat-card">
            <div className="stat-num">{stats?.testCases ?? 0}</div>
            <div className="stat-label">Test cases</div>
          </div>
          <div className="stat-card">
            <div className="stat-num" style={{ color: 'var(--success)' }}>{stats?.passed ?? 0}</div>
            <div className="stat-label">Passed</div>
          </div>
          <div className="stat-card">
            <div className="stat-num" style={{ color: 'var(--danger)' }}>{stats?.failed ?? 0}</div>
            <div className="stat-label">Failed</div>
          </div>
          <div className="stat-card">
            <div className="stat-num" style={{ color: 'var(--warning)' }}>{stats?.openBugs ?? 0}</div>
            <div className="stat-label">Open bugs</div>
          </div>
          <div className="stat-card">
            <div className="stat-num">{passRate}%</div>
            <div className="stat-label">Pass rate</div>
          </div>
        </div>

        {stats?.testCases > 0 && (
          <div style={{ marginBottom: '2rem' }}>
            <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginBottom: '0.4rem' }}>Pass rate</div>
            <div className="progress-bar" style={{ height: 8 }}>
              <div className="progress-fill green" style={{ width: `${passRate}%` }} />
            </div>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <Link to={`/projects/${id}/tests`} style={{ textDecoration: 'none' }}>
            <div className="card" style={{ cursor: 'pointer', transition: 'border-color 0.2s', borderColor: 'var(--border)' }}
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
        </div>
      </div>
    </>
  )
}
