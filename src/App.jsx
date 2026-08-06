import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate, Outlet, Link, useParams } from 'react-router-dom'
import { AuthProvider, useAuth } from './store/AuthContext.jsx'
import { useToastStore } from './store/toastStore.jsx'
import { apiFetch } from './lib/api.js'
import AppShell from './components/AppShell.jsx'
import DashboardPage from './pages/DashboardPage.jsx'
import ProjectsPage from './pages/ProjectsPage.jsx'
import ProjectDetailPage from './pages/ProjectDetailPage.jsx'
import SavedViewsPage from './pages/SavedViewsPage.jsx'
import ViewRedirectPage from './pages/ViewRedirectPage.jsx'
import TestCasesPage from './pages/TestCasesPage.jsx'
import RequirementsPage from './pages/RequirementsPage.jsx'
import BugsPage from './pages/BugsPage.jsx'
import SignInPage from './pages/SignInPage.jsx'
import AutomationPage from './pages/AutomationPage.jsx'
import GenerationHistoryPage from './pages/GenerationHistoryPage.jsx'
import SuiteTestCasesPage from './pages/SuiteTestCasesPage.jsx'
import ExecutionRunsPage from './pages/ExecutionRunsPage.jsx'
import ExecutionRunDetailPage from './pages/ExecutionRunDetailPage.jsx'
import QualityTimelinePage from './pages/QualityTimelinePage.jsx'
import EngineeringDashboardPage from './pages/EngineeringDashboardPage.jsx'
import LabTestCasesPage from './pages/LabTestCasesPage.jsx'

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

// Wraps every /projects/:id/* route. Confirms the current user actually has
// access to THIS project before any child page renders, instead of leaving
// it to each page's own fetch to fail and (inconsistently — most of them
// don't even handle it) show a broken or blank state. This is what makes a
// stale URL safe: a client landing on a project they're not a member of (a
// leftover URL from a previous session, a bookmark, a typo) gets bounced
// back with a clear reason instead of a dead page. The server is the real
// security boundary (requireProjectAccess) — this is the client-side
// experience of that boundary being consistent everywhere instead of
// per-page guesswork.
function ProjectGate() {
  const { id } = useParams()
  const { user } = useAuth()
  const [status, setStatus] = useState('checking') // 'checking' | 'ok' | 'denied'

  useEffect(() => {
    let cancelled = false
    setStatus('checking')
    apiFetch(`/projects/${id}`)
      .then(() => { if (!cancelled) setStatus('ok') })
      .catch(() => { if (!cancelled) setStatus('denied') })
    return () => { cancelled = true }
  }, [id])

  useEffect(() => {
    if (status === 'denied') useToastStore.getState().addToast("You don't have access to that project.", 'error')
  }, [status])

  if (status === 'checking') {
    return (
      <>
        <div className="topbar"><span className="topbar-title">Project</span></div>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}><div className="spinner" /></div>
      </>
    )
  }

  if (status === 'denied') {
    return <Navigate to={user?.role === 'client' ? '/' : '/projects'} replace />
  }

  return <Outlet />
}

// Wraps routes that must never be reached by the client role (AI generation/
// healing internals — Generation History, Engineering) — same "redirect
// instead of letting the page mount and 403" idea as ProjectGate above, just
// synchronous since role is already known from useAuth.
function StaffOnlyRoute() {
  const { id } = useParams()
  const { user } = useAuth()
  if (user?.role === 'client') return <Navigate to={`/projects/${id}/automation`} replace />
  return <Outlet />
}

function NotFoundPage() {
  return (
    <>
      <div className="topbar"><span className="topbar-title">Not found</span></div>
      <div className="page-content">
        <div className="empty-state">
          <h3>Page not found</h3>
          <p>That page doesn't exist, or you no longer have access to it.</p>
          <Link to="/" className="btn btn-primary">Back to Dashboard</Link>
        </div>
      </div>
    </>
  )
}

function Gate() {
  const { user, loading } = useAuth()

  // Unified on the cooler "Slate Indigo" theme for every role — previously
  // split by user.role (clients got Slate Indigo, staff kept a warm orange
  // theme); see the data-theme override in index.css.
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'slate')
  }, [])

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
        {/* Every /projects/:id/* page sits behind ProjectGate — one access
            check per project, instead of relying on each page's own fetch
            to fail gracefully (most didn't). */}
        <Route path="projects/:id" element={<ProjectGate />}>
          <Route index element={<ProjectDetailPage />} />
          <Route path="views" element={<SavedViewsPage />} />
          <Route path="views/:viewId" element={<ViewRedirectPage />} />
          {/* Back-compat for any existing bookmarks/links to the old Reports tab. */}
          <Route path="reports" element={<Navigate to="../views" replace />} />
          <Route path="tests" element={<TestCasesPage />} />
          <Route path="requirements" element={<RequirementsPage />} />
          <Route path="bugs" element={<BugsPage />} />
          <Route path="automation" element={<AutomationPage />} />
          <Route path="automation/suites/:suiteId/test-cases" element={<SuiteTestCasesPage />} />
          <Route element={<StaffOnlyRoute />}>
            <Route path="automation/history" element={<GenerationHistoryPage />} />
            <Route path="automation/lab" element={<LabTestCasesPage />} />
            <Route path="engineering" element={<EngineeringDashboardPage />} />
          </Route>
          <Route path="executions" element={<ExecutionRunsPage />} />
          <Route path="executions/:runId" element={<ExecutionRunDetailPage />} />
          <Route path="timeline" element={<QualityTimelinePage />} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
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