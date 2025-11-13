import { useState, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import {
  SetupWizard,
  ProjectList,
  ProjectDetail,
  ProjectCreate,
  TaskCreate,
  TaskDetail,
  Settings
} from './pages'
import { Layout } from './components'

function App() {
  const [setupComplete, setSetupComplete] = useState<boolean | null>(null)
  const [isChecking, setIsChecking] = useState(true)

  useEffect(() => {
    const checkSetup = async () => {
      try {
        const result = await window.electronAPI.checkSetup()
        setSetupComplete(result.setupComplete)
      } catch (error) {
        console.error('Failed to check setup status:', error)
        setSetupComplete(false)
      } finally {
        setIsChecking(false)
      }
    }

    checkSetup()
  }, [])

  // Show loading state while checking
  if (isChecking || setupComplete === null) {
    return null // or a loading spinner
  }

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
            <Route path="projects/new" element={<ProjectCreate />} />
            <Route path="projects/:id" element={<ProjectDetail />} />
            <Route path="projects/:projectId/tasks/new" element={<TaskCreate />} />
            <Route path="projects/:projectId/tasks/:taskId" element={<TaskDetail />} />
            <Route path="settings" element={<Settings />} />
          </Route>
          <Route path="*" element={<Navigate to="/projects" replace />} />
        </>
      )}
    </Routes>
  )
}

export default App
