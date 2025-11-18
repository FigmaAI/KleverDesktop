import { useState, useCallback } from 'react'
import { ToolStatus } from '@/types/setupWizard'

interface PlatformToolsState {
  python: ToolStatus
  pythonEnv: ToolStatus
  androidStudio: ToolStatus
  homebrew: ToolStatus
}

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
    console.log('[usePlatformTools] ========== Checking Python installation ==========')
    setToolsStatus((prev) => ({ ...prev, python: { ...prev.python, checking: true } }))
    try {
      console.log('[usePlatformTools] Calling window.electronAPI.pythonCheckInstalled()')
      const pythonCheck = await window.electronAPI.pythonCheckInstalled()
      console.log('[usePlatformTools] pythonCheck result:', JSON.stringify(pythonCheck, null, 2))

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

      console.log('[usePlatformTools] Python check complete')
    } catch (error) {
      console.error('[usePlatformTools] Error checking Python:', error)
      setToolsStatus((prev) => ({
        ...prev,
        python: { checking: false, installed: false, error: 'Failed to check Python', installing: false },
      }))
    }

    // Check Playwright browsers (only if Python is installed)
    console.log('[usePlatformTools] ========== Checking Playwright browsers ==========')
    setToolsStatus((prev) => ({ ...prev, pythonEnv: { ...prev.pythonEnv, checking: true } }))
    try {
      const envCheck = await window.electronAPI.envCheck()
      console.log('[usePlatformTools] envCheck result:', JSON.stringify(envCheck, null, 2))

      const playwrightInstalled = envCheck.success && envCheck.playwright?.installed
      console.log('[usePlatformTools] Playwright installed:', playwrightInstalled)

      setToolsStatus((prev) => ({
        ...prev,
        pythonEnv: {
          checking: false,
          installed: playwrightInstalled || false,
          error: playwrightInstalled ? undefined : 'Playwright browsers not installed',
          installing: false,
        },
      }))

      console.log('[usePlatformTools] ========== Playwright check complete ==========')
    } catch (error) {
      console.error('[usePlatformTools] Error checking Playwright:', error)
      setToolsStatus((prev) => ({
        ...prev,
        pythonEnv: { checking: false, installed: false, error: 'Failed to check Playwright', installing: false },
      }))
    }

    // Check Android Studio
    setToolsStatus((prev) => ({ ...prev, androidStudio: { ...prev.androidStudio, checking: true } }))
    try {
      const result = await window.electronAPI.checkAndroidStudio()
      console.log('[usePlatformTools] Android Studio Check Result:', result)
      setToolsStatus((prev) => ({
        ...prev,
        androidStudio: { checking: false, installed: result.success, error: result.error, installing: false },
      }))

      // Save Android SDK path if detected
      if (result.success && result.path) {
        console.log('[usePlatformTools] Android SDK path detected:', result.path)
        setAndroidSdkPath(result.path)
      }
    } catch {
      setToolsStatus((prev) => ({ ...prev, androidStudio: { checking: false, installed: false, installing: false } }))
    }
  }, [])

  const downloadPython = useCallback(async () => {
    console.log('[usePlatformTools] ========== Starting Python download ==========')
    setToolsStatus((prev) => ({ ...prev, python: { ...prev.python, installing: true } }))

    try {
      const result = await window.electronAPI.pythonDownload()

      if (result.success) {
        console.log('[usePlatformTools] ✓ Python download complete')
        // Recheck Python status
        await checkPlatformTools()
      } else {
        console.error('[usePlatformTools] ✗ Python download failed:', result.error)
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

    console.log('[usePlatformTools] ========== Python download complete ==========')
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
