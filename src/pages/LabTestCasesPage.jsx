import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { apiFetch } from '../lib/api.js'
import Icon from '../components/Icon.jsx'
import LabPanel from '../components/LabPanel.jsx'

// Full-page counterpart to EngineeringDashboardPage's inline "The Lab"
// panel — same data, same re-run/diagnose/heal actions (both go through
// LabPanel), just without the fixed 320px scroll box, for when the roster
// is too long to browse comfortably inline.
export default function LabTestCasesPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [project, setProject] = useState(null)

  useEffect(() => { apiFetch(`/projects/${id}`).then(setProject).catch(console.error) }, [id])

  return (
    <>
      <div className="topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button className="back-btn" onClick={() => navigate(-1)} title="Back" aria-label="Back"><Icon name="arrowLeft" size={14} /></button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
            <Link to="/projects" style={{ color: 'var(--muted)', textDecoration: 'none' }}>Projects</Link>
            <span style={{ color: 'var(--muted)' }}>/</span>
            <Link to={`/projects/${id}`} style={{ color: 'var(--muted)', textDecoration: 'none' }}>{project?.name || 'Project'}</Link>
            <span style={{ color: 'var(--muted)' }}>/</span>
            <Link to={`/projects/${id}/engineering`} style={{ color: 'var(--muted)', textDecoration: 'none' }}>Engineering</Link>
            <span style={{ color: 'var(--muted)' }}>/</span>
            <span className="topbar-title">The Lab</span>
          </div>
        </div>
      </div>
      <div className="page-content fade-in">
        <div className="card">
          <LabPanel projectId={id} fullPage />
        </div>
      </div>
    </>
  )
}
