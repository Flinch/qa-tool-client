import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { apiFetch } from '../lib/api.js'
import Icon from '../components/Icon.jsx'

function NavIcon({ name }) {
  return (
    <div style={{ width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--accent)', background: 'var(--bg)', color: 'var(--accent)', marginBottom: '0.85rem' }}>
      <Icon name={name} size={18} />
    </div>
  )
}

export default function ProjectReportsPage() {
  const { id } = useParams()
  const [project, setProject] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiFetch(`/projects/${id}`).then(setProject).catch(console.error).finally(() => setLoading(false))
  }, [id])

  if (loading) return (
    <>
      <div className="topbar"><span className="topbar-title">Reports</span></div>
      <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}><div className="spinner" /></div>
    </>
  )

  if (!project) return (
    <>
      <div className="topbar"><span className="topbar-title">Reports</span></div>
      <div className="page-content"><div className="empty-state"><h3>Project not found</h3></div></div>
    </>
  )

  return (
    <>
      <div className="topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Link to={`/projects/${id}`} className="back-btn" title="Back to project" aria-label="Back to project"><Icon name="arrowLeft" size={14} /></Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
            <Link to={`/projects/${id}`} style={{ color: 'var(--muted)', textDecoration: 'none' }}>{project.name}</Link>
            <span style={{ color: 'var(--muted)' }}>/</span>
            <span className="topbar-title">Reports</span>
          </div>
        </div>
      </div>
      <div className="page-content fade-in">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
          <Link to={`/projects/${id}/requirements`} style={{ textDecoration: 'none', display: 'block', height: '100%' }}>
            <div className="card" style={{ cursor: 'pointer', transition: 'border-color 0.2s', height: '100%', display: 'flex', flexDirection: 'column' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(184,70,31,0.3)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
            >
              <NavIcon name="target" />
              <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 700, color: 'var(--white)', marginBottom: '0.3rem' }}>Requirements</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>See tracked requirements and which test cases cover them.</div>
            </div>
          </Link>
          <Link to={`/projects/${id}/tests`} style={{ textDecoration: 'none', display: 'block', height: '100%' }}>
            <div className="card" style={{ cursor: 'pointer', transition: 'border-color 0.2s', height: '100%', display: 'flex', flexDirection: 'column' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(184,70,31,0.3)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
            >
              <NavIcon name="check" />
              <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 700, color: 'var(--white)', marginBottom: '0.3rem' }}>Test cases</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>View test cases for this project.</div>
            </div>
          </Link>
          <Link to={`/projects/${id}/bugs`} style={{ textDecoration: 'none', display: 'block', height: '100%' }}>
            <div className="card" style={{ cursor: 'pointer', transition: 'border-color 0.2s', height: '100%', display: 'flex', flexDirection: 'column' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(184,70,31,0.3)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
            >
              <NavIcon name="bug" />
              <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 700, color: 'var(--white)', marginBottom: '0.3rem' }}>Bug reports</div>
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
        </div>
      </div>
    </>
  )
}
