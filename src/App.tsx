import { useState, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import {
  SetupWizard,
  ProjectList,
  ProjectDetail,
  ProjectCreate,
  Settings
} from './pages'
import { Layout } from './components'

function App() {
  const [setupComplete, setSetupComplete] = useState<boolean | null>(null)
  const [isChecking, setIsChecking] = useState(true)

  useEffect(() => {
    const checkSetup = async () => {
      console.log('[App.tsx] ========== Checking setup status ==========')
      console.log('[App.tsx] window.electronAPI:', window.electronAPI)
      console.log('[App.tsx] window.electronAPI.checkSetup:', window.electronAPI?.checkSetup)

      try {
        console.log('[App.tsx] Calling window.electronAPI.checkSetup()')
        const result = await window.electronAPI.checkSetup()
        console.log('[App.tsx] checkSetup result:', result)
        setSetupComplete(result.setupComplete)
        console.log('[App.tsx] Setup complete:', result.setupComplete)
      } catch (error) {
        console.error('[App.tsx] Failed to check setup status:', error)
        setSetupComplete(false)
      } finally {
        setIsChecking(false)
        console.log('[App.tsx] ========== Setup check complete ==========')
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
            <Route path="settings" element={<Settings />} />
          </Route>
          <Route path="*" element={<Navigate to="/projects" replace />} />
        </>
      )}
    </Routes>
  )
}

export default App
