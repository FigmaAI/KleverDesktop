import { useCallback, useEffect, useState } from 'react'
import type { AppConfig } from '@/types/electron'

export const DEFAULT_CONFIG: AppConfig = {
  version: '4.0',
  execution: { maxRounds: 20 },
  android: { sdkPath: '' },
  preferences: { darkMode: false, systemLanguage: 'en' },
}

export function useSettings() {
  const [config, setConfig] = useState<AppConfig>(DEFAULT_CONFIG)
  const [savedSnapshot, setSavedSnapshot] = useState(() => JSON.stringify(DEFAULT_CONFIG))
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  const loadSettings = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const result = await window.electronAPI.configLoad()
      if (!result.success || !result.config) throw new Error(result.error || 'Failed to load settings')
      setConfig(result.config)
      setSavedSnapshot(JSON.stringify(result.config))
    } catch (reason) {
      setLoadError(reason instanceof Error ? reason.message : 'Failed to load settings')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void loadSettings() }, [loadSettings])

  const saveSettings = useCallback(async () => {
    if (loadError) throw new Error(loadError)
    setSaving(true)
    try {
      const snapshot = JSON.stringify(config)
      const result = await window.electronAPI.configSave(config)
      if (!result.success) throw new Error(result.error || 'Failed to save settings')
      setSavedSnapshot(snapshot)
    } finally {
      setSaving(false)
    }
  }, [config, loadError])

  return { config, setConfig, hasChanges: JSON.stringify(config) !== savedSnapshot, loading, loadError, saving, saveSettings, loadSettings }
}
