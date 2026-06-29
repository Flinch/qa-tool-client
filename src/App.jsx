import { BrowserRouter, Routes, Route } from 'react-router-dom'
import AppShell from './components/AppShell.jsx'
import DashboardPage from './pages/DashboardPage.jsx'
import ProjectsPage from './pages/ProjectsPage.jsx'
import ProjectDetailPage from './pages/ProjectDetailPage.jsx'
import TestCasesPage from './pages/TestCasesPage.jsx'
import BugsPage from './pages/BugsPage.jsx'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AppShell />}>
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