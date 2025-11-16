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

    // Check Bundled Python and Virtual Environment
    console.log('[usePlatformTools] ========== Checking Python environment ==========')
    setToolsStatus((prev) => ({ ...prev, python: { ...prev.python, checking: true } }))
    try {
      console.log('[usePlatformTools] Calling window.electronAPI.envCheck()')
      const envCheck = await window.electronAPI.envCheck()
      console.log('[usePlatformTools] envCheck result:', JSON.stringify(envCheck, null, 2))

      // Check Python (bundled or system)
      const pythonInstalled = envCheck.success && envCheck.bundledPython?.exists
      const pythonVersion = envCheck.bundledPython?.version
      const isBundled = envCheck.bundledPython?.isBundled

      console.log('[usePlatformTools] Python analysis:')
      console.log('  - success:', envCheck.success)
      console.log('  - bundledPython.exists:', envCheck.bundledPython?.exists)
      console.log('  - pythonInstalled:', pythonInstalled)
      console.log('  - pythonVersion:', pythonVersion)
      console.log('  - isBundled:', isBundled)

      setToolsStatus((prev) => ({
        ...prev,
        python: {
          checking: false,
          installed: pythonInstalled || false,
          version: pythonVersion ? `Python ${pythonVersion}${isBundled ? ' (Bundled)' : ' (System)'}` : undefined,
          error: pythonInstalled ? undefined : 'Python 3.11+ not found. Please install Python.',
          installing: false,
        },
      }))

      // Check Python environment (venv + packages + playwright)
      const envInstalled = envCheck.success && envCheck.venv?.valid
      console.log('[usePlatformTools] Venv installed:', envInstalled)

      setToolsStatus((prev) => ({
        ...prev,
        pythonEnv: {
          checking: false,
          installed: envInstalled || false,
          error: envInstalled ? undefined : 'Environment not set up',
          installing: false,
        },
      }))

      console.log('[usePlatformTools] ========== Python environment check complete ==========')
    } catch (error) {
      console.error('[usePlatformTools] Error checking Python environment:', error)
      setToolsStatus((prev) => ({
        ...prev,
        python: { checking: false, installed: false, installing: false },
        pythonEnv: { checking: false, installed: false, installing: false },
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

  return {
    toolsStatus,
    setToolsStatus,
    checkPlatformTools,
    androidSdkPath,
  }
}
