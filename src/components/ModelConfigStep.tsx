import { BlurFade } from '@/components/magicui/blur-fade'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ExternalLink, RefreshCw, Eye, EyeOff } from 'lucide-react'
import { ModelSelector, ModelSelection } from './ModelSelector'
import { ModelConfig } from '@/types/setupWizard'
import { useLiteLLMProviders } from '@/hooks/useLiteLLMProviders'
import { useState } from 'react'

interface ModelConfigStepProps {
  modelConfig: ModelConfig
  setModelConfig: (config: ModelConfig) => void
  ollamaModels: string[]
  ollamaLoading: boolean
  ollamaError: string
  fetchOllamaModels: () => void
}

export function ModelConfigStep({
  modelConfig,
  setModelConfig,
  ollamaModels,
  ollamaLoading,
  fetchOllamaModels,
}: ModelConfigStepProps) {
  const { getProvider } = useLiteLLMProviders()
  const [showApiKey, setShowApiKey] = useState(false)

  // Get provider info for API key URL
  const providerInfo = getProvider(modelConfig.provider)
  const isOllama = modelConfig.provider === 'ollama'

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

  return (
    <BlurFade key="step-1" delay={0.1}>
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
              <div className="relative">
                <Input
                  type={showApiKey ? 'text' : 'password'}
                  placeholder="Enter your API key"
                  value={modelConfig.apiKey}
                  onChange={(e) => setModelConfig({ ...modelConfig, apiKey: e.target.value })}
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
    </BlurFade>
  )
}
