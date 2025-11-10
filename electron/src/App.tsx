import { Routes, Route, Navigate } from 'react-router-dom'
import { SetupWizard } from './pages/SetupWizard'
import { ProjectList } from './pages/ProjectList'
import { ProjectDetail } from './pages/ProjectDetail'
import { Settings } from './pages/Settings'
import { Layout } from './components/Layout'

function App() {
  // TODO: Check if setup is complete
  const setupComplete = false;

  return (
    <Routes>
      {!setupComplete ? (
        <>
          <Route path="/setup" element={<SetupWizard />} />
          <Route path="*" element={<Navigate to="/setup" replace />} />
        </>
      ) : (
        <>
          <Route path="/" element={<Layout />}>
            <Route index element={<Navigate to="/projects" replace />} />
            <Route path="projects" element={<ProjectList />} />
            <Route path="projects/:id" element={<ProjectDetail />} />
            <Route path="settings" element={<Settings />} />
          </Route>
          <Route path="*" element={<Navigate to="/projects" replace />} />
        </>
      )}
    </Routes>
  )
}

export default App
