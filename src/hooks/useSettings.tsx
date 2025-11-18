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

export interface SystemInfo {
  platform: string
  arch: string
  cpus: number
  totalMemory: number
  freeMemory: number
  pythonVersion?: string
  envStatus?: 'ready' | 'not_ready' | 'checking'
}

export function useSettings() {
  // Model configuration
  const [modelConfig, setModelConfig] = useState<ModelConfig>({
    enableLocal: true,
    enableApi: false,
    apiBaseUrl: 'https://api.openai.com/v1/chat/completions',
    apiKey: '',
    apiModel: '',
    localBaseUrl: 'http://localhost:11434/v1/chat/completions',
    localModel: 'qwen3-vl:4b',
  })

  // Platform settings
  const [platformSettings, setPlatformSettings] = useState<PlatformSettings>({
    androidScreenshotDir: '/sdcard/Pictures',
    androidXmlDir: '/sdcard/Documents',
    androidSdkPath: '/Volumes/Backup/Android-SDK',
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

  // System information
  const [systemInfo, setSystemInfo] = useState<SystemInfo>({
    platform: '',
    arch: '',
    cpus: 0,
    totalMemory: 0,
    freeMemory: 0,
    envStatus: 'checking',
  })

  // Loading states
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)

  // Load all settings from config
  const loadSettings = useCallback(async () => {
    setLoading(true)
    try {
      const result = await window.electronAPI.configLoad()

      if (result.success && result.config) {
        const config = result.config

        // Load model config
        setModelConfig({
          enableLocal: config.model?.enableLocal ?? true,
          enableApi: config.model?.enableApi ?? false,
          apiBaseUrl: config.model?.api?.baseUrl || 'https://api.openai.com/v1/chat/completions',
          apiKey: config.model?.api?.key || '',
          apiModel: config.model?.api?.model || '',
          localBaseUrl: config.model?.local?.baseUrl || 'http://localhost:11434/v1/chat/completions',
          localModel: config.model?.local?.model || 'qwen3-vl:4b',
        })

        // Load platform settings
        setPlatformSettings({
          androidScreenshotDir: config.android?.screenshotDir || '/sdcard/Pictures',
          androidXmlDir: config.android?.xmlDir || '/sdcard/Documents',
          androidSdkPath: config.android?.sdkPath || '/Volumes/Backup/Android-SDK',
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

  // Load system information
  const loadSystemInfo = useCallback(async () => {
    try {
      const info = await window.electronAPI.getSystemInfo()
      if (info) {
        setSystemInfo(prev => ({
          ...prev,
          platform: info.platform || '',
          arch: info.arch || '',
          cpus: info.cpus || 0,
          totalMemory: info.totalMemory || 0,
          freeMemory: info.freeMemory || 0,
        }))
      }

      // Check Python environment
      const envCheck = await window.electronAPI.envCheck()
      if (envCheck.success && envCheck.bundledPython) {
        setSystemInfo(prev => ({
          ...prev,
          pythonVersion: envCheck.bundledPython?.version,
          envStatus: envCheck.venv?.valid ? 'ready' : 'not_ready',
        }))
      }
    } catch (error) {
      console.error('[useSettings] Error loading system info:', error)
    }
  }, [])

  // Save all settings to config
  const saveSettings = useCallback(async () => {
    setSaving(true)
    setSaveError(null)
    setSaveSuccess(false)

    try {
      // IMPORTANT: Load current config first to preserve all existing fields
      // This prevents overwriting fields that aren't in our React state
      const currentResult = await window.electronAPI.configLoad()
      const currentConfig = currentResult.success && currentResult.config
        ? currentResult.config
        : { version: '1.0' }

      // Build updated config by merging with current config
      const config = {
        ...currentConfig, // Preserve any existing fields
        version: '1.0',
        model: {
          enableLocal: modelConfig.enableLocal,
          enableApi: modelConfig.enableApi,
          api: {
            baseUrl: modelConfig.apiBaseUrl,
            key: modelConfig.apiKey,
            model: modelConfig.apiModel,
          },
          local: {
            baseUrl: modelConfig.localBaseUrl,
            model: modelConfig.localModel,
          },
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

      const result = await window.electronAPI.configSave(config)

      if (result.success) {
        setSaveSuccess(true)
        setTimeout(() => setSaveSuccess(false), 3000) // Clear success message after 3s
      } else {
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
    loadSystemInfo()
  }, [loadSettings, loadSystemInfo])

  return {
    modelConfig,
    setModelConfig,
    platformSettings,
    setPlatformSettings,
    agentSettings,
    setAgentSettings,
    imageSettings,
    setImageSettings,
    systemInfo,
    loading,
    saving,
    saveError,
    saveSuccess,
    saveSettings,
    loadSettings,
    loadSystemInfo,
  }
}
