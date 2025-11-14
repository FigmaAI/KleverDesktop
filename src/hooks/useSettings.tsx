import { useState, useCallback, useEffect } from 'react'
import { ModelConfig } from '@/types/setupWizard'

export interface PlatformSettings {
  // Android settings
  androidScreenshotDir: string
  androidXmlDir: string

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
  cpuCount: number
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
    androidScreenshotDir: '/sdcard',
    androidXmlDir: '/sdcard',
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
    cpuCount: 0,
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
          enableLocal: config.ENABLE_LOCAL !== false,
          enableApi: config.ENABLE_API === true,
          apiBaseUrl: config.API_BASE_URL || 'https://api.openai.com/v1/chat/completions',
          apiKey: config.API_KEY || '',
          apiModel: config.API_MODEL || '',
          localBaseUrl: config.LOCAL_BASE_URL || 'http://localhost:11434/v1/chat/completions',
          localModel: config.LOCAL_MODEL || 'qwen3-vl:4b',
        })

        // Load platform settings
        setPlatformSettings({
          androidScreenshotDir: config.ANDROID_SCREENSHOT_DIR || '/sdcard',
          androidXmlDir: config.ANDROID_XML_DIR || '/sdcard',
          webBrowserType: config.WEB_BROWSER_TYPE || 'chromium',
          webHeadless: config.WEB_HEADLESS === true,
          webViewportWidth: config.WEB_VIEWPORT_WIDTH || 1280,
          webViewportHeight: config.WEB_VIEWPORT_HEIGHT || 720,
        })

        // Load agent settings
        setAgentSettings({
          maxTokens: config.MAX_TOKENS || 4096,
          temperature: config.TEMPERATURE ?? 0.0,
          requestInterval: config.REQUEST_INTERVAL || 10,
          maxRounds: config.MAX_ROUNDS || 20,
          docRefine: config.DOC_REFINE === true,
          darkMode: config.DARK_MODE === true,
          minDist: config.MIN_DIST || 30,
        })

        // Load image settings
        setImageSettings({
          optimizeImages: config.OPTIMIZE_IMAGES !== false,
          imageMaxWidth: config.IMAGE_MAX_WIDTH || 512,
          imageMaxHeight: config.IMAGE_MAX_HEIGHT || 512,
          imageQuality: config.IMAGE_QUALITY || 85,
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
          cpuCount: info.cpuCount || 0,
          totalMemory: info.totalMemory || 0,
          freeMemory: info.freeMemory || 0,
        }))
      }

      // Check Python environment
      const envCheck = await window.electronAPI.envCheck()
      if (envCheck.success && envCheck.python) {
        setSystemInfo(prev => ({
          ...prev,
          pythonVersion: envCheck.python.version,
          envStatus: envCheck.venv.ready ? 'ready' : 'not_ready',
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
      // Build config object
      const config = {
        // Model settings
        MODEL: modelConfig.enableApi ? 'api' : 'local',
        ENABLE_LOCAL: modelConfig.enableLocal,
        ENABLE_API: modelConfig.enableApi,
        LOCAL_BASE_URL: modelConfig.localBaseUrl,
        LOCAL_MODEL: modelConfig.localModel,
        API_BASE_URL: modelConfig.apiBaseUrl,
        API_KEY: modelConfig.apiKey,
        API_MODEL: modelConfig.apiModel,

        // Agent settings
        MAX_TOKENS: agentSettings.maxTokens,
        TEMPERATURE: agentSettings.temperature,
        REQUEST_INTERVAL: agentSettings.requestInterval,
        MAX_ROUNDS: agentSettings.maxRounds,
        DOC_REFINE: agentSettings.docRefine,
        DARK_MODE: agentSettings.darkMode,
        MIN_DIST: agentSettings.minDist,

        // Platform settings
        ANDROID_SCREENSHOT_DIR: platformSettings.androidScreenshotDir,
        ANDROID_XML_DIR: platformSettings.androidXmlDir,
        WEB_BROWSER_TYPE: platformSettings.webBrowserType,
        WEB_HEADLESS: platformSettings.webHeadless,
        WEB_VIEWPORT_WIDTH: platformSettings.webViewportWidth,
        WEB_VIEWPORT_HEIGHT: platformSettings.webViewportHeight,

        // Image settings
        OPTIMIZE_IMAGES: imageSettings.optimizeImages,
        IMAGE_MAX_WIDTH: imageSettings.imageMaxWidth,
        IMAGE_MAX_HEIGHT: imageSettings.imageMaxHeight,
        IMAGE_QUALITY: imageSettings.imageQuality,
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
