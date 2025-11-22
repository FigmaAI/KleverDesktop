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
        ]) as { setupComplete: boolean };

        console.log('[App] Setup check result:', result);
        setSetupComplete(result.setupComplete)
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

  // Skeleton UI for loading state
  if (isChecking || setupComplete === null) {
    return (
      <div className="flex h-screen bg-gray-900 text-white overflow-hidden">
        {/* Sidebar Skeleton */}
        <div className="w-64 bg-gray-800 border-r border-gray-700 p-4 flex flex-col gap-6">
          <div className="h-8 bg-gray-700 rounded w-3/4 animate-pulse"></div>
          <div className="space-y-4">
            <div className="h-10 bg-gray-700 rounded w-full animate-pulse"></div>
            <div className="h-10 bg-gray-700 rounded w-full animate-pulse"></div>
            <div className="h-10 bg-gray-700 rounded w-full animate-pulse"></div>
          </div>
          <div className="mt-auto space-y-4">
            <div className="h-10 bg-gray-700 rounded w-full animate-pulse"></div>
          </div>
        </div>

        {/* Main Content Skeleton */}
        <div className="flex-1 flex flex-col">
          {/* Header Skeleton */}
          <div className="h-16 bg-gray-800 border-b border-gray-700 flex items-center px-6">
            <div className="h-6 bg-gray-700 rounded w-1/4 animate-pulse"></div>
          </div>

          {/* Body Skeleton */}
          <div className="flex-1 p-6 space-y-6 overflow-y-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-gray-800 rounded-lg p-6 border border-gray-700 h-48 flex flex-col gap-4">
                  <div className="h-6 bg-gray-700 rounded w-1/2 animate-pulse"></div>
                  <div className="h-4 bg-gray-700 rounded w-full animate-pulse"></div>
                  <div className="h-4 bg-gray-700 rounded w-3/4 animate-pulse"></div>
                  <div className="mt-auto h-8 bg-gray-700 rounded w-1/3 animate-pulse"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
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
