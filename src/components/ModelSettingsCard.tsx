import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ExternalLink, RefreshCw, Eye, EyeOff, Brain, Zap, CheckCircle, XCircle, Loader2 } from 'lucide-react'
import { ModelSelector, ModelSelection } from './ModelSelector'
import { ModelConfig } from '@/types/setupWizard'
import { useLiteLLMProviders } from '@/hooks/useLiteLLMProviders'
import { useState, useEffect, useCallback } from 'react'

interface ModelSettingsCardProps {
  modelConfig: ModelConfig
  setModelConfig: (config: ModelConfig) => void
  onValidationChange?: (isValid: boolean) => void
}

export function ModelSettingsCard({ modelConfig, setModelConfig, onValidationChange }: ModelSettingsCardProps) {
  const { getProvider } = useLiteLLMProviders()
  const [showApiKey, setShowApiKey] = useState(false)
  const [ollamaModels, setOllamaModels] = useState<string[]>([])
  const [ollamaLoading, setOllamaLoading] = useState(false)
  
  // Connection test state
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const [apiKeyValidated, setApiKeyValidated] = useState(false)

  // Get provider info for API key URL
  const providerInfo = getProvider(modelConfig.provider)
  const isOllama = modelConfig.provider === 'ollama'

  // Determine if model config is valid for saving
  // Ollama: always valid if model is selected
  // Other providers: valid only after successful API test
  const isValidForSave = isOllama 
    ? Boolean(modelConfig.model) 
    : Boolean(modelConfig.model && modelConfig.apiKey && apiKeyValidated)

  // Notify parent of validation state changes
  useEffect(() => {
    onValidationChange?.(isValidForSave)
  }, [isValidForSave, onValidationChange])

  // Fetch Ollama models
  const fetchOllamaModels = useCallback(async () => {
    setOllamaLoading(true)
    try {
      const result = await window.electronAPI.ollamaList()
      if (result.success && result.models) {
        setOllamaModels(result.models)
      } else {
        setOllamaModels([])
      }
    } catch (error) {
      console.error('Failed to fetch Ollama models:', error)
      setOllamaModels([])
    } finally {
      setOllamaLoading(false)
    }
  }, [])

  // Fetch Ollama models when provider is Ollama
  useEffect(() => {
    if (isOllama) {
      fetchOllamaModels()
    }
  }, [isOllama, fetchOllamaModels])

  // Handle model selection change
  const handleModelChange = (selection: ModelSelection) => {
    const newProvider = selection.provider
    const newModel = selection.model

    // Clear test result and validation when model changes
    setTestResult(null)
    setApiKeyValidated(false)

    // Update config based on provider
    if (newProvider === 'ollama') {
      setModelConfig({
        ...modelConfig,
        provider: newProvider,
        model: newModel, // Already includes 'ollama/' prefix from ModelSelector
        apiKey: '',
        baseUrl: 'http://localhost:11434',
      })
    } else {
      const selectedProviderInfo = getProvider(newProvider)
      setModelConfig({
        ...modelConfig,
        provider: newProvider,
        model: newModel,
        baseUrl: selectedProviderInfo?.defaultBaseUrl || '',
      })
    }
  }

  // Test API connection
  const handleTestConnection = useCallback(async () => {
    if (!modelConfig.provider || !modelConfig.model) {
      setTestResult({ success: false, message: 'Please select a provider and model first' })
      return
    }

    if (!isOllama && !modelConfig.apiKey) {
      setTestResult({ success: false, message: 'Please enter an API key' })
      return
    }

    setTesting(true)
    setTestResult(null)

    try {
      const result = await window.electronAPI.testModelConnection(modelConfig)
      const success = result.success
      setTestResult({ 
        success, 
        message: result.message || (success ? 'Connection successful!' : 'Connection failed') 
      })
      // Mark API key as validated on success
      if (success) {
        setApiKeyValidated(true)
      }
    } catch (error) {
      setTestResult({ 
        success: false, 
        message: error instanceof Error ? error.message : 'Connection test failed' 
      })
    } finally {
      setTesting(false)
    }
  }, [modelConfig, isOllama])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-5 w-5" />
          Model Configuration
        </CardTitle>
        <CardDescription>
          Configure your AI model provider. Ollama runs locally (free), or use cloud APIs.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Model Selector */}
        <div className="space-y-2">
          <Label>Model Provider & Model</Label>
          <div className="flex items-center gap-2 w-full">
            <div className="flex-1">
              <ModelSelector
                value={{ provider: modelConfig.provider, model: modelConfig.model }}
                onChange={handleModelChange}
              />
            </div>
            {isOllama && (
              <Button
                variant="outline"
                size="icon"
                onClick={fetchOllamaModels}
                disabled={ollamaLoading}
                className="shrink-0"
              >
                <RefreshCw className={`h-4 w-4 ${ollamaLoading ? 'animate-spin' : ''}`} />
              </Button>
            )}
          </div>
          {isOllama && ollamaModels.length === 0 && !ollamaLoading && (
            <p className="text-sm text-muted-foreground">
              No Ollama models found. Run: <code className="bg-muted px-1 rounded">ollama pull llama3.2-vision</code>
            </p>
          )}
        </div>

        {/* API Key (only for non-Ollama providers) */}
        {!isOllama && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>API Key</Label>
              {providerInfo?.apiKeyUrl && (
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto p-0 text-xs"
                  onClick={() => window.electronAPI.openExternal(providerInfo.apiKeyUrl)}
                >
                  Get API Key <ExternalLink className="ml-1 h-3 w-3" />
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Input
                  type={showApiKey ? 'text' : 'password'}
                  placeholder="Enter your API key"
                  value={modelConfig.apiKey}
                  onChange={(e) => {
                    setModelConfig({ ...modelConfig, apiKey: e.target.value })
                    setTestResult(null) // Clear test result when API key changes
                    setApiKeyValidated(false) // Require re-validation
                  }}
                  className="pr-10"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowApiKey(!showApiKey)}
                >
                  {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <Button
                variant="outline"
                size="default"
                onClick={handleTestConnection}
                disabled={testing || !modelConfig.apiKey || !modelConfig.model}
                className="shrink-0"
              >
                {testing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : testResult?.success ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : testResult?.success === false ? (
                  <XCircle className="h-4 w-4 text-destructive" />
                ) : (
                  <Zap className="h-4 w-4" />
                )}
                <span className="ml-1">Test</span>
              </Button>
            </div>
            {testResult && (
              <p className={`text-sm ${testResult.success ? 'text-green-600 dark:text-green-400' : 'text-destructive'}`}>
                {testResult.message}
              </p>
            )}
          </div>
        )}

        {/* Custom Base URL (optional, for OpenRouter etc.) */}
        {providerInfo?.requiresBaseUrl && (
          <div className="space-y-2">
            <Label>Base URL</Label>
            <Input
              placeholder={providerInfo.defaultBaseUrl || 'https://api.example.com/v1'}
              value={modelConfig.baseUrl}
              onChange={(e) => setModelConfig({ ...modelConfig, baseUrl: e.target.value })}
            />
          </div>
        )}
      </CardContent>
    </Card>
  )
}

