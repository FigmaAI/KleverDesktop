import { useState, useCallback } from 'react'
import { ToolStatus, PlatformToolsState } from '@/types/setupWizard'

export function usePlatformTools() {
  const [toolsStatus, setToolsStatus] = useState<PlatformToolsState>({
    python: { checking: true, installed: false, installing: false },
    pythonEnv: { checking: false, installed: false, installing: false },
    androidStudio: { checking: true, installed: false, installing: false },
    homebrew: { checking: true, installed: false, installing: false },
  })

  const [androidSdkPath, setAndroidSdkPath] = useState<string>('')

  const checkPlatformTools = useCallback(async () => {
    // Check Homebrew (macOS only)
    const isMac = window.navigator.platform.toLowerCase().includes('mac')
    if (isMac) {
      setToolsStatus((prev) => ({ ...prev, homebrew: { ...prev.homebrew, checking: true } }))
      try {
        const result = await window.electronAPI.checkHomebrew()
        setToolsStatus((prev) => ({
          ...prev,
          homebrew: { checking: false, installed: result.success, version: result.version, installing: false },
        }))
      } catch {
        setToolsStatus((prev) => ({ ...prev, homebrew: { checking: false, installed: false, installing: false } }))
      }
    } else {
      // Not macOS, skip Homebrew check
      setToolsStatus((prev) => ({ ...prev, homebrew: { checking: false, installed: true, installing: false } }))
    }

    // Check Python (post-install download to user data directory)
    setToolsStatus((prev) => ({ ...prev, python: { ...prev.python, checking: true } }))
    try {
      const pythonCheck = await window.electronAPI.pythonCheckInstalled()

      setToolsStatus((prev) => ({
        ...prev,
        python: {
          checking: false,
          installed: pythonCheck.installed || false,
          version: pythonCheck.installed ? 'Python 3.11.9' : undefined,
          error: pythonCheck.installed ? undefined : 'Python not installed',
          installing: false,
        },
      }))
    } catch (error) {
      console.error('[usePlatformTools] Error checking Python:', error)
      setToolsStatus((prev) => ({
        ...prev,
        python: { checking: false, installed: false, error: 'Failed to check Python', installing: false },
      }))
    }

    // Check Python environment (venv + packages + Playwright)
    setToolsStatus((prev) => ({ ...prev, pythonEnv: { ...prev.pythonEnv, checking: true } }))
    try {
      const envCheck = await window.electronAPI.envCheck()

      // Environment is ready if venv is valid AND Playwright is installed
      const envReady = envCheck.success && envCheck.venv?.valid && envCheck.playwright?.installed

      setToolsStatus((prev) => ({
        ...prev,
        pythonEnv: {
          checking: false,
          installed: envReady || false,
          error: envReady ? undefined : 'Python env is not set up',
          installing: false,
        },
      }))
    } catch (error) {
      console.error('[usePlatformTools] Error checking Python environment:', error)
      setToolsStatus((prev) => ({
        ...prev,
        pythonEnv: { checking: false, installed: false, error: 'Failed to check Python environment', installing: false },
      }))
    }

    // Check Android Studio
    setToolsStatus((prev) => ({ ...prev, androidStudio: { ...prev.androidStudio, checking: true } }))
    try {
      const result = await window.electronAPI.checkAndroidStudio()
      setToolsStatus((prev) => ({
        ...prev,
        androidStudio: { checking: false, installed: result.success, error: result.error, installing: false },
      }))

      // Save Android SDK path if detected
      if (result.success && result.path) {
        setAndroidSdkPath(result.path)
      }
    } catch {
      setToolsStatus((prev) => ({ ...prev, androidStudio: { checking: false, installed: false, installing: false } }))
    }
  }, [])

  const downloadPython = useCallback(async () => {
    setToolsStatus((prev) => ({ ...prev, python: { ...prev.python, installing: true } }))

    try {
      const result = await window.electronAPI.pythonDownload()

      if (result.success) {
        // Recheck Python status
        await checkPlatformTools()
      } else {
        console.error('[usePlatformTools] Python download failed:', result.error)
        setToolsStatus((prev) => ({
          ...prev,
          python: {
            ...prev.python,
            installing: false,
            error: result.error || 'Download failed',
          },
        }))
      }
    } catch (error) {
      console.error('[usePlatformTools] Error downloading Python:', error)
      setToolsStatus((prev) => ({
        ...prev,
        python: {
          ...prev.python,
          installing: false,
          error: error instanceof Error ? error.message : 'Download failed',
        },
      }))
    }
  }, [checkPlatformTools])

  return {
    toolsStatus,
    setToolsStatus,
    checkPlatformTools,
    downloadPython,
    androidSdkPath,
    setAndroidSdkPath,
  }
}
