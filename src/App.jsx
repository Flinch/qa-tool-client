import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import AppShell from './components/AppShell.jsx'
import SignInPage from './pages/SignInPage.jsx'
import DashboardPage from './pages/DashboardPage.jsx'
import ProjectsPage from './pages/ProjectsPage.jsx'
import ProjectDetailPage from './pages/ProjectDetailPage.jsx'
import TestCasesPage from './pages/TestCasesPage.jsx'
import BugsPage from './pages/BugsPage.jsx'

function ProtectedRoute({ children }) {
  const { isSignedIn, isLoaded } = useAuth()
  if (!isLoaded) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}><div className="spinner" /></div>
  if (!isSignedIn) return <Navigate to="/sign-in" replace />
  return children
}

export default function App() {
  const { isSignedIn } = useAuth()

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/sign-in" element={isSignedIn ? <Navigate to="/" replace /> : <SignInPage />} />
        <Route path="/" element={<ProtectedRoute><AppShell /></ProtectedRoute>}>
          <Route index element={<DashboardPage />} />
          <Route path="projects" element={<ProjectsPage />} />
          <Route path="projects/:id" element={<ProjectDetailPage />} />
          <Route path="projects/:id/tests" element={<TestCasesPage />} />
          <Route path="projects/:id/bugs" element={<BugsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
