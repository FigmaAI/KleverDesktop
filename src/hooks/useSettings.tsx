import { useState, useCallback, useEffect } from 'react'
import { MultiProviderModelSettings } from '@/types/setupWizard'

export interface PlatformSettings {
  // Android settings
  androidScreenshotDir: string
  androidXmlDir: string
  androidSdkPath: string

  // Web settings
  // Browser channel options supported by Browser-Use/Playwright
  webBrowserType: 
    | 'chromium'  // Playwright's isolated Chromium (default)
    | 'chrome'    // Google Chrome
    | 'chrome-beta' | 'chrome-dev' | 'chrome-canary'
    | 'msedge'    // Microsoft Edge
    | 'msedge-beta' | 'msedge-dev' | 'msedge-canary'
    | 'firefox'   // Mozilla Firefox
    | 'webkit'    // WebKit (Safari engine)
  webHeadless: boolean
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

export interface PreferencesSettings {
  systemLanguage: 'en' | 'ko'
}

export interface ImageSettings {
  optimizeImages: boolean
  imageMaxWidth: number
  imageMaxHeight: number
  imageQuality: number
}

export function useSettings() {
  // Multi-provider model configuration
  const [modelConfig, setModelConfig] = useState<MultiProviderModelSettings>({
    providers: [
      {
        id: 'ollama',
        apiKey: '',
        preferredModel: 'ollama/llama3.2-vision',
        baseUrl: 'http://localhost:11434',
      },
    ],
    lastUsed: {
      provider: 'ollama',
      model: 'ollama/llama3.2-vision',
    },
  })

  // Platform settings
  const [platformSettings, setPlatformSettings] = useState<PlatformSettings>({
    androidScreenshotDir: '/sdcard',
    androidXmlDir: '/sdcard',
    androidSdkPath: '',
    webBrowserType: 'chromium',
    webHeadless: false,
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

  // Preferences settings (including system language)
  const [preferencesSettings, setPreferencesSettings] = useState<PreferencesSettings>({
    systemLanguage: 'en',
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

        // Load multi-provider model config
        const loadedModelConfig: MultiProviderModelSettings = {
          providers: config.model?.providers || [
            {
              id: 'ollama',
              apiKey: '',
              preferredModel: 'ollama/llama3.2-vision',
              baseUrl: 'http://localhost:11434',
            },
          ],
          lastUsed: config.model?.lastUsed || {
            provider: 'ollama',
            model: 'ollama/llama3.2-vision',
          },
        }
        console.log('[useSettings] Setting modelConfig to:', JSON.stringify(loadedModelConfig, null, 2))
        setModelConfig(loadedModelConfig)

        // Load platform settings
        setPlatformSettings({
          androidScreenshotDir: config.android?.screenshotDir || '/sdcard',
          androidXmlDir: config.android?.xmlDir || '/sdcard',
          androidSdkPath: config.android?.sdkPath || '',
          webBrowserType: config.web?.browserType || 'chromium',
          webHeadless: config.web?.headless ?? false,
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

        // Load preferences settings (including system language)
        setPreferencesSettings({
          systemLanguage: config.preferences?.systemLanguage || 'en',
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
      // Build config with multi-provider model format
      const config = {
        version: '3.0',
        model: {
          providers: modelConfig.providers,
          lastUsed: modelConfig.lastUsed,
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
          systemLanguage: preferencesSettings.systemLanguage,
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
  }, [modelConfig, platformSettings, agentSettings, imageSettings, preferencesSettings])

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
    preferencesSettings,
    setPreferencesSettings,
    loading,
    saving,
    saveError,
    saveSuccess,
    saveSettings,
    loadSettings,
  }
}
