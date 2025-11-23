import { useState, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import {
  SetupWizard,
  ProjectList,
  ProjectDetail,
  Settings
} from './pages'
import { Layout } from './components'
import { ToastProvider } from '@/components/ui/toast'
import { LoadingScreen } from './components/LoadingScreen'
import { TerminalProvider } from './contexts/TerminalContext'

function App() {
  const [setupComplete, setSetupComplete] = useState<boolean | null>(null)
  const [isChecking, setIsChecking] = useState(true)
  const [showLoading, setShowLoading] = useState(true)
  const [minDurationComplete, setMinDurationComplete] = useState(false)

  // System dark/light mode detection
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

    const updateTheme = (e: MediaQueryList | MediaQueryListEvent) => {
      if (e.matches) {
        document.documentElement.classList.add('dark')
      } else {
        document.documentElement.classList.remove('dark')
      }
    }

    // Set initial theme
    updateTheme(mediaQuery)

    // Listen for system theme changes
    mediaQuery.addEventListener('change', updateTheme)

    return () => mediaQuery.removeEventListener('change', updateTheme)
  }, [])

  useEffect(() => {
    const checkSetup = async () => {
      // Add timeout protection to prevent hanging on IPC calls (Build 13+)
      // Prevents crash if IPC call triggers DNS resolution that fails
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Setup check timeout after 5 seconds')), 5000)
      );

      try {
        // Race between actual IPC call and timeout
        const result = await Promise.race([
          window.electronAPI.checkSetup(),
          timeoutPromise
        ]) as { success: boolean; setupComplete: boolean };

        console.log('[App] Setup check result:', result);
        // Always set setupComplete to a boolean value (never null)
        setSetupComplete(result.success ? result.setupComplete : false)
      } catch (error) {
        console.error('[App] Failed to check setup status:', error)
        // Default to showing setup wizard on error - safer than blocking
        setSetupComplete(false)
      } finally {
        setIsChecking(false)
      }
    }

    // Add 500ms delay to let Electron fully initialize before making IPC calls (Build 13+)
    // Prevents race conditions during app startup that can trigger crashes
    const timeoutId = setTimeout(checkSetup, 500);

    return () => clearTimeout(timeoutId);
  }, [])

  // Hide loading screen only when both conditions are met:
  // 1. Setup check is complete
  // 2. Minimum display duration has elapsed
  useEffect(() => {
    if (!isChecking && setupComplete !== null && minDurationComplete) {
      setShowLoading(false)
    }
  }, [isChecking, setupComplete, minDurationComplete])

  // Loading screen with morphing text animation
  // Display for minimum 3 seconds (3000ms) for smooth user experience
  // Also show loading screen if setup check is still in progress or result is null
  if (showLoading || isChecking || setupComplete === null) {
    return (
      <LoadingScreen
        minDuration={3000}
        onMinDurationComplete={() => setMinDurationComplete(true)}
      />
    )
  }

  return (
    <ToastProvider>
      <TerminalProvider>
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
      </TerminalProvider>
    </ToastProvider>
  )
}

export default App
