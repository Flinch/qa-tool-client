import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiFetch } from '../lib/api.js'

export default function DashboardPage() {
  const [stats, setStats] = useState(null)
  const [recentProjects, setRecentProjects] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const [s, p] = await Promise.all([
          apiFetch('/stats'),
          apiFetch('/projects'),
        ])
        setStats(s)
        setRecentProjects(p.slice(0, 4))
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) return (
    <>
      <div className="topbar"><span className="topbar-title">Dashboard</span></div>
      <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}><div className="spinner" /></div>
    </>
  )

  return (
    <>
      <div className="topbar"><span className="topbar-title">Dashboard</span></div>
      <div className="page-content fade-in">
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: '1.5rem', fontWeight: 700, color: 'var(--white)', marginBottom: '0.25rem' }}>Hey, Malik</h1>
          <p style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>Here's a snapshot of your QA activity.</p>
        </div>
        <div className="stats-row">
          <div className="stat-card"><div className="stat-num">{stats?.projects ?? 0}</div><div className="stat-label">Projects</div></div>
          <div className="stat-card"><div className="stat-num">{stats?.testCases ?? 0}</div><div className="stat-label">Test cases</div></div>
          <div className="stat-card"><div className="stat-num" style={{ color: 'var(--success)' }}>{stats?.passed ?? 0}</div><div className="stat-label">Passed</div></div>
          <div className="stat-card"><div className="stat-num" style={{ color: 'var(--danger)' }}>{stats?.failed ?? 0}</div><div className="stat-label">Failed</div></div>
          <div className="stat-card"><div className="stat-num" style={{ color: 'var(--warning)' }}>{stats?.openBugs ?? 0}</div><div className="stat-label">Open bugs</div></div>
        </div>
        <div className="section-header">
          <div>
            <div className="section-title">Recent projects</div>
            <div className="section-sub">Your most recently updated projects</div>
          </div>
          <Link to="/projects" className="btn btn-ghost btn-sm">View all</Link>
        </div>
        {recentProjects.length === 0 ? (
          <div className="empty-state">
            <h3>No projects yet</h3>
            <p>Create your first project to get started.</p>
            <Link to="/projects" className="btn btn-primary">Create project</Link>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1rem' }}>
            {recentProjects.map(p => (
              <Link to={`/projects/${p.id}`} key={p.id} style={{ textDecoration: 'none' }}>
                <div className="card-sm" style={{ cursor: 'pointer' }}>
                  <div style={{ fontWeight: 600, color: 'var(--white)', marginBottom: '0.25rem', fontSize: '0.92rem' }}>{p.name}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginBottom: '0.85rem' }}>{p.client_name}</div>
                  <div style={{ display: 'flex', gap: '1rem', fontSize: '0.78rem', color: 'var(--muted)' }}>
                    <span><strong style={{ color: 'var(--light)' }}>{p.test_case_count ?? 0}</strong> tests</span>
                    <span><strong style={{ color: 'var(--danger)' }}>{p.open_bug_count ?? 0}</strong> open bugs</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  )
}