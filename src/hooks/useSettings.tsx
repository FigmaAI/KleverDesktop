import { useState, useCallback, useEffect } from 'react'
import { ModelConfig } from '@/types/setupWizard'

export interface PlatformSettings {
  // Android settings
  androidScreenshotDir: string
  androidXmlDir: string
  androidSdkPath: string

  // Web settings
  webBrowserType: 'chromium' | 'firefox' | 'webkit'
  webHeadless: boolean
  webViewportWidth: number
  webViewportHeight: number
}

export interface AgentSettings {
  maxTokens: number
  temperature: number
  requestInterval: number
  maxRounds: number
  docRefine: boolean
  darkMode: boolean
  minDist: number
}

export interface ImageSettings {
  optimizeImages: boolean
  imageMaxWidth: number
  imageMaxHeight: number
  imageQuality: number
}

export function useSettings() {
  // Unified model configuration
  const [modelConfig, setModelConfig] = useState<ModelConfig>({
    provider: 'ollama',
    model: 'ollama/llama3.2-vision',
    apiKey: '',
    baseUrl: 'http://localhost:11434',
  })

  // Platform settings
  const [platformSettings, setPlatformSettings] = useState<PlatformSettings>({
    androidScreenshotDir: '/sdcard/Pictures',
    androidXmlDir: '/sdcard/Documents',
    androidSdkPath: '',
    webBrowserType: 'chromium',
    webHeadless: false,
    webViewportWidth: 1280,
    webViewportHeight: 720,
  })

  // Agent settings
  const [agentSettings, setAgentSettings] = useState<AgentSettings>({
    maxTokens: 4096,
    temperature: 0.0,
    requestInterval: 10,
    maxRounds: 20,
    docRefine: false,
    darkMode: false,
    minDist: 30,
  })

  // Image settings
  const [imageSettings, setImageSettings] = useState<ImageSettings>({
    optimizeImages: true,
    imageMaxWidth: 512,
    imageMaxHeight: 512,
    imageQuality: 85,
  })

  // Loading states
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)

  // Load all settings from config
  const loadSettings = useCallback(async () => {
    console.log('[useSettings] === LOADING SETTINGS ===')
    setLoading(true)
    try {
      const result = await window.electronAPI.configLoad()
      console.log('[useSettings] configLoad result:', result.success)

      if (result.success && result.config) {
        const config = result.config
        console.log('[useSettings] Loaded model config from file:', JSON.stringify(config.model, null, 2))

        // Load unified model config
        const loadedModelConfig = {
          provider: config.model?.provider || 'ollama',
          model: config.model?.model || 'ollama/llama3.2-vision',
          apiKey: config.model?.apiKey || '',
          baseUrl: config.model?.baseUrl || 'http://localhost:11434',
        }
        console.log('[useSettings] Setting modelConfig to:', JSON.stringify(loadedModelConfig, null, 2))
        setModelConfig(loadedModelConfig)

        // Load platform settings
        setPlatformSettings({
          androidScreenshotDir: config.android?.screenshotDir || '/sdcard/Pictures',
          androidXmlDir: config.android?.xmlDir || '/sdcard/Documents',
          androidSdkPath: config.android?.sdkPath || '',
          webBrowserType: config.web?.browserType || 'chromium',
          webHeadless: config.web?.headless ?? false,
          webViewportWidth: config.web?.viewportWidth || 1280,
          webViewportHeight: config.web?.viewportHeight || 720,
        })

        // Load agent settings
        setAgentSettings({
          maxTokens: config.execution?.maxTokens || 4096,
          temperature: config.execution?.temperature ?? 0.0,
          requestInterval: config.execution?.requestInterval || 10,
          maxRounds: config.execution?.maxRounds || 20,
          docRefine: config.preferences?.docRefine ?? false,
          darkMode: config.preferences?.darkMode ?? false,
          minDist: config.preferences?.minDist || 30,
        })

        // Load image settings
        setImageSettings({
          optimizeImages: config.image?.optimize ?? true,
          imageMaxWidth: config.image?.maxWidth || 512,
          imageMaxHeight: config.image?.maxHeight || 512,
          imageQuality: config.image?.quality || 85,
        })
      }
    } catch (error) {
      console.error('[useSettings] Error loading settings:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  // Save all settings to config
  const saveSettings = useCallback(async () => {
    console.log('[useSettings] === SAVING SETTINGS ===')
    console.log('[useSettings] Current modelConfig:', JSON.stringify(modelConfig, null, 2))
    setSaving(true)
    setSaveError(null)
    setSaveSuccess(false)

    try {
      // Build config with unified model format
      const config = {
        version: '2.0',
        model: {
          provider: modelConfig.provider,
          model: modelConfig.model,
          apiKey: modelConfig.apiKey,
          baseUrl: modelConfig.baseUrl,
        },
        execution: {
          maxTokens: agentSettings.maxTokens,
          temperature: agentSettings.temperature,
          requestInterval: agentSettings.requestInterval,
          maxRounds: agentSettings.maxRounds,
        },
        android: {
          screenshotDir: platformSettings.androidScreenshotDir,
          xmlDir: platformSettings.androidXmlDir,
          sdkPath: platformSettings.androidSdkPath,
        },
        web: {
          browserType: platformSettings.webBrowserType,
          headless: platformSettings.webHeadless,
          viewportWidth: platformSettings.webViewportWidth,
          viewportHeight: platformSettings.webViewportHeight,
        },
        image: {
          maxWidth: imageSettings.imageMaxWidth,
          maxHeight: imageSettings.imageMaxHeight,
          quality: imageSettings.imageQuality,
          optimize: imageSettings.optimizeImages,
        },
        preferences: {
          darkMode: agentSettings.darkMode,
          minDist: agentSettings.minDist,
          docRefine: agentSettings.docRefine,
        },
      }

      console.log('[useSettings] Calling configSave with model:', JSON.stringify(config.model, null, 2))
      const result = await window.electronAPI.configSave(config)
      console.log('[useSettings] configSave result:', result)

      if (result.success) {
        console.log('[useSettings] === SAVE SUCCESS ===')
        setSaveSuccess(true)
        setTimeout(() => setSaveSuccess(false), 3000) // Clear success message after 3s
      } else {
        console.error('[useSettings] === SAVE FAILED ===', result.error)
        setSaveError(result.error || 'Failed to save settings')
      }
    } catch (error) {
      console.error('[useSettings] Error saving settings:', error)
      setSaveError(error instanceof Error ? error.message : 'Failed to save settings')
    } finally {
      setSaving(false)
    }
  }, [modelConfig, platformSettings, agentSettings, imageSettings])

  // Auto-load settings on mount
  useEffect(() => {
    loadSettings()
  }, [loadSettings])

  return {
    modelConfig,
    setModelConfig,
    platformSettings,
    setPlatformSettings,
    agentSettings,
    setAgentSettings,
    imageSettings,
    setImageSettings,
    loading,
    saving,
    saveError,
    saveSuccess,
    saveSettings,
    loadSettings,
  }
}
