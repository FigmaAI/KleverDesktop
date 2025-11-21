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

      // Add timeout protection to prevent hanging on IPC calls (Build 13+)
      // Prevents crash if IPC call triggers DNS resolution that fails
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Setup check timeout after 5 seconds')), 5000)
      );

      try {
        console.log('[App.tsx] Calling window.electronAPI.checkSetup()')

        // Race between actual IPC call and timeout
        const result = await Promise.race([
          window.electronAPI.checkSetup(),
          timeoutPromise
        ]) as { setupComplete: boolean };

        console.log('[App.tsx] checkSetup result:', result)
        setSetupComplete(result.setupComplete)
        console.log('[App.tsx] Setup complete:', result.setupComplete)
      } catch (error) {
        console.error('[App.tsx] Failed to check setup status:', error)
        // Default to showing setup wizard on error - safer than blocking
        setSetupComplete(false)
      } finally {
        setIsChecking(false)
        console.log('[App.tsx] ========== Setup check complete ==========')
      }
    }

    // Add 500ms delay to let Electron fully initialize before making IPC calls (Build 13+)
    // Prevents race conditions during app startup that can trigger crashes
    const timeoutId = setTimeout(checkSetup, 500);

    return () => clearTimeout(timeoutId);
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
