import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './store/AuthContext.jsx'
import AppShell from './components/AppShell.jsx'
import DashboardPage from './pages/DashboardPage.jsx'
import ProjectsPage from './pages/ProjectsPage.jsx'
import ProjectDetailPage from './pages/ProjectDetailPage.jsx'
import TestCasesPage from './pages/TestCasesPage.jsx'
import BugsPage from './pages/BugsPage.jsx'
import SignInPage from './pages/SignInPage.jsx'

function StaffOnly({ children }) {
  const { user } = useAuth()
  if (user.role === 'client') return <Navigate to="/projects" replace />
  return children
}

function Gate() {
  const { user, loading } = useAuth()

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
        <Route index element={user.role === 'client' ? <Navigate to="/projects" replace /> : <DashboardPage />} />
        <Route path="projects" element={<ProjectsPage />} />
        <Route path="projects/:id" element={<ProjectDetailPage />} />
        <Route path="projects/:id/tests" element={<StaffOnly><TestCasesPage /></StaffOnly>} />
        <Route path="projects/:id/bugs" element={<StaffOnly><BugsPage /></StaffOnly>} />
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