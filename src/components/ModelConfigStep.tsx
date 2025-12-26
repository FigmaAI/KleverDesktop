import { useState, useEffect } from 'react'
import { BlurFade } from '@/components/magicui/blur-fade'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ExternalLink, RefreshCw, Eye, EyeOff, Loader2, Zap, CheckCircle, XCircle } from 'lucide-react'
import { ModelSelector, ModelSelection } from './ModelSelector'
import { ModelConfig } from '@/types/setupWizard'
import { useLiteLLMProviders } from '@/hooks/useLiteLLMProviders'

interface ModelConfigStepProps {
  modelConfig: ModelConfig
  setModelConfig: (config: ModelConfig) => void
  ollamaModels: string[]
  ollamaLoading: boolean
  ollamaError: string
  fetchOllamaModels: () => void
  onVerified: (verified: boolean) => void
}

export function ModelConfigStep({
  modelConfig,
  setModelConfig,
  ollamaModels,
  ollamaLoading,
  fetchOllamaModels,
  onVerified,
}: ModelConfigStepProps) {
  const { getProvider } = useLiteLLMProviders()
  const [showApiKey, setShowApiKey] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)

  // Get provider info for API key URL
  const providerInfo = getProvider(modelConfig.provider)
  const isOllama = modelConfig.provider === 'ollama'

  // Reset verification when config changes
  useEffect(() => {
    onVerified(false)
    setTestResult(null)
  }, [modelConfig.provider, modelConfig.model, modelConfig.apiKey, modelConfig.baseUrl]) // eslint-disable-line react-hooks/exhaustive-deps

  // Test connection handler - similar to ModelSettingsCard
  const handleTestConnection = async () => {
    if (!modelConfig.provider || !modelConfig.model) return

    setTesting(true)
    setTestResult(null)

    try {
      const result = await window.electronAPI.testModelConnection({
        provider: modelConfig.provider,
        model: modelConfig.model,
        apiKey: modelConfig.apiKey,
        baseUrl: modelConfig.baseUrl,
      })

      const success = result.success
      setTestResult({
        success,
        message: result.message || (success ? 'Connection successful' : 'Connection failed')
      })

      if (success) {
        onVerified(true)
      }
    } catch (error) {
      setTestResult({
        success: false,
        message: error instanceof Error ? error.message : 'Connection failed'
      })
    } finally {
      setTesting(false)
    }
  }

  // Handle model selection change
  const handleModelChange = (selection: ModelSelection) => {
    const newProvider = selection.provider
    const newModel = selection.model

    // Update config based on provider
    if (newProvider === 'ollama') {
      setModelConfig({
        ...modelConfig,
        provider: newProvider,
        model: newModel.startsWith('ollama/') ? newModel : `ollama/${newModel}`,
        apiKey: '',
        baseUrl: 'http://localhost:11434',
      })
    } else {
      setModelConfig({
        ...modelConfig,
        provider: newProvider,
        model: newModel,
        baseUrl: providerInfo?.defaultBaseUrl || '',
      })
    }
  }

  const canTest = modelConfig.provider && modelConfig.model && (isOllama || modelConfig.apiKey)

  return (
    <BlurFade key="step-model-config" delay={0.1}>
      <Card>
        <CardHeader>
          <CardTitle>Model Configuration</CardTitle>
          <CardDescription>
            Choose your AI model provider. Ollama runs locally (free), or use cloud APIs.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Model Selector */}
          <div className="space-y-2">
            <Label>Model Provider & Model</Label>
            <div className="flex items-center gap-2">
              <ModelSelector
                value={{ provider: modelConfig.provider, model: modelConfig.model }}
                onChange={handleModelChange}
              />
              {isOllama && (
                <Button
                  variant="outline"
                  size="icon"
                  onClick={fetchOllamaModels}
                  disabled={ollamaLoading}
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
                    onChange={(e) => setModelConfig({ ...modelConfig, apiKey: e.target.value })}
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
                  disabled={!canTest || testing}
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
                <p className={`text-sm ${testResult.success ? 'text-green-600' : 'text-destructive'}`}>
                  {testResult.message}
                </p>
              )}
            </div>
          )}

          {/* Base URL & Test for Ollama or Custom Providers */}
          {(isOllama || providerInfo?.requiresBaseUrl) && (
            <div className="space-y-2">
              <Label>Base URL</Label>
              <div className="flex items-center gap-2">
                <Input
                  placeholder={providerInfo?.defaultBaseUrl || 'https://api.example.com/v1'}
                  value={modelConfig.baseUrl || (isOllama ? 'http://localhost:11434' : '')}
                  onChange={(e) => setModelConfig({ ...modelConfig, baseUrl: e.target.value })}
                  className="flex-1"
                />
                {isOllama && (
                  <Button
                    variant="outline"
                    size="default"
                    onClick={handleTestConnection}
                    disabled={!canTest || testing}
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
                )}
              </div>
              {isOllama && testResult && (
                <p className={`text-sm ${testResult.success ? 'text-green-600' : 'text-destructive'}`}>
                  {testResult.message}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </BlurFade>
  )
}
