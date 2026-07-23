import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './store/AuthContext.jsx'
import { apiFetch } from './lib/api.js'
import AppShell from './components/AppShell.jsx'
import DashboardPage from './pages/DashboardPage.jsx'
import ProjectsPage from './pages/ProjectsPage.jsx'
import ProjectDetailPage from './pages/ProjectDetailPage.jsx'
import ProjectReportsPage from './pages/ProjectReportsPage.jsx'
import TestCasesPage from './pages/TestCasesPage.jsx'
import RequirementsPage from './pages/RequirementsPage.jsx'
import BugsPage from './pages/BugsPage.jsx'
import SignInPage from './pages/SignInPage.jsx'
import AutomationPage from './pages/AutomationPage.jsx'
import ExecutionRunsPage from './pages/ExecutionRunsPage.jsx'
import ExecutionRunDetailPage from './pages/ExecutionRunDetailPage.jsx'

// Clients only ever have one project (a QA agency's single client account, one
// engagement) — there's no real list to browse, so skip straight to it instead
// of making them click through an intermediate "Projects" page with one card.
function ClientHome() {
  const [projectId, setProjectId] = useState(undefined)

  useEffect(() => {
    apiFetch('/projects')
      .then(ps => setProjectId(ps[0]?.id ?? null))
      .catch(() => setProjectId(null))
  }, [])

  if (projectId === undefined) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}><div className="spinner" /></div>
    )
  }

  if (projectId === null) {
    return (
      <>
        <div className="topbar"><span className="topbar-title">Blueprint</span></div>
        <div className="page-content">
          <div className="empty-state">
            <h3>No project shared with you yet</h3>
            <p>Ask your QA contact to share a project with your account.</p>
          </div>
        </div>
      </>
    )
  }

  return <Navigate to={`/projects/${projectId}`} replace />
}

function Gate() {
  const { user, loading } = useAuth()

  // Client accounts get the cooler "Slate Indigo" theme; QA engineers/admins
  // keep the warm orange theme. See the data-theme overrides in index.css.
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', user?.role === 'client' ? 'client' : 'qa')
  }, [user])

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', color: 'var(--muted)' }}>
        Loading…
      </div>
    )
  }

  if (!user) {
    return <SignInPage />
  }

  return (
    <Routes>
      <Route path="/" element={<AppShell />}>
        <Route index element={user.role === 'client' ? <ClientHome /> : <DashboardPage />} />
        <Route path="projects" element={user.role === 'client' ? <ClientHome /> : <ProjectsPage />} />
        <Route path="projects/:id" element={<ProjectDetailPage />} />
        <Route path="projects/:id/reports" element={<ProjectReportsPage />} />
        <Route path="projects/:id/tests" element={<TestCasesPage />} />
        <Route path="projects/:id/requirements" element={<RequirementsPage />} />
        <Route path="projects/:id/bugs" element={<BugsPage />} />
        <Route path="projects/:id/automation" element={<AutomationPage />} />
        <Route path="projects/:id/executions" element={<ExecutionRunsPage />} />
        <Route path="projects/:id/executions/:runId" element={<ExecutionRunDetailPage />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Gate />
      </AuthProvider>
    </BrowserRouter>
  )
}