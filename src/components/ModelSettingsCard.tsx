import { useState, useCallback, useEffect } from 'react'
import { RefreshCw } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { ModelConfig } from '@/types/setupWizard'
import { ApiModelCard } from './ApiModelCard'

interface ModelSettingsCardProps {
  modelConfig: ModelConfig
  setModelConfig: (config: ModelConfig) => void
}

export function ModelSettingsCard({ modelConfig, setModelConfig }: ModelSettingsCardProps) {
  // Ollama models state
  const [ollamaModels, setOllamaModels] = useState<string[]>([])
  const [ollamaLoading, setOllamaLoading] = useState(false)
  const [ollamaError, setOllamaError] = useState<string>('')

  // API models state (for ApiModelCard)
  const [apiModels, setApiModels] = useState<string[]>([])
  const [apiModelsLoading, setApiModelsLoading] = useState(false)
  const [apiModelsError, setApiModelsError] = useState<string>('')
  const [detectedProvider, setDetectedProvider] = useState<string>('')

  // Fetch Ollama models
  const fetchOllamaModels = useCallback(async () => {
    setOllamaLoading(true)
    setOllamaError('')

    try {
      const result = await window.electronAPI.checkOllama()

      if (result.success && result.running && result.models) {
        const modelNames = result.models.map((model: { name?: string } | string) =>
          typeof model === 'string' ? model : model.name || ''
        )
        setOllamaModels(modelNames)
      } else {
        setOllamaError('Ollama is not running or no models found')
        setOllamaModels([])
      }
    } catch (error) {
      console.error('Error fetching Ollama models:', error)
      setOllamaError(error instanceof Error ? error.message : 'Failed to fetch models')
      setOllamaModels([])
    } finally {
      setOllamaLoading(false)
    }
  }, [])

  // Fetch API models from provider
  const fetchApiModels = useCallback(async () => {
    if (!modelConfig.apiBaseUrl && !modelConfig.apiProvider) {
      setApiModelsError('Please select a provider first')
      return
    }

    if (!modelConfig.apiKey) {
      setApiModelsError('Please enter API Key first')
      return
    }

    setApiModelsLoading(true)
    setApiModelsError('')
    setApiModels([])

    try {
      const result = await window.electronAPI.fetchApiModels({
        apiBaseUrl: modelConfig.apiBaseUrl || '',
        apiKey: modelConfig.apiKey,
      })

      if (result.success && result.models) {
        setApiModels(result.models)
        setDetectedProvider(result.provider || 'unknown')
      } else {
        setApiModelsError(result.error || 'Failed to fetch models')
        setDetectedProvider(result.provider || 'unknown')
      }
    } catch (error) {
      console.error('Error fetching API models:', error)
      setApiModelsError(error instanceof Error ? error.message : 'Failed to fetch models')
    } finally {
      setApiModelsLoading(false)
    }
  }, [modelConfig.apiBaseUrl, modelConfig.apiKey, modelConfig.apiProvider])

  // Auto-fetch Ollama models when enabled
  useEffect(() => {
    if (modelConfig.enableLocal) {
      fetchOllamaModels()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelConfig.enableLocal])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Model Configuration</CardTitle>
        <CardDescription>Configure AI model providers for automation tasks</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Local Model (Ollama) Section */}
        <div
          className={cn(
            'rounded-lg border-2 p-4 transition-all',
            modelConfig.enableLocal
              ? 'border-primary bg-primary/5'
              : 'border-border bg-background'
          )}
        >
          <div className="mb-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="enable-local"
                checked={modelConfig.enableLocal}
                onCheckedChange={(checked) =>
                  setModelConfig({ ...modelConfig, enableLocal: checked as boolean })
                }
              />
              <Label htmlFor="enable-local" className="text-base font-semibold">
                Local Model (Ollama)
              </Label>
            </div>
            <p className="ml-6 mt-1 text-sm text-muted-foreground">
              Use locally hosted Ollama models for privacy and offline access
            </p>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Select Model</Label>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={fetchOllamaModels}
                  disabled={!modelConfig.enableLocal || ollamaLoading}
                >
                  <RefreshCw className={cn('h-4 w-4', ollamaLoading && 'animate-spin')} />
                </Button>
              </div>

              {ollamaLoading ? (
                <div className="flex items-center gap-2 rounded-md bg-muted p-3">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  <span className="text-sm">Loading models...</span>
                </div>
              ) : ollamaError ? (
                <Alert variant="warning">
                  <AlertDescription>{ollamaError}</AlertDescription>
                </Alert>
              ) : (
                <Select
                  value={modelConfig.localModel}
                  onValueChange={(value) => setModelConfig({ ...modelConfig, localModel: value })}
                  disabled={!modelConfig.enableLocal || ollamaModels.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        ollamaModels.length === 0 ? 'No models found' : 'Select a model'
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {ollamaModels.map((model) => (
                      <SelectItem key={model} value={model}>
                        {model}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              <p className="text-sm text-muted-foreground">
                {ollamaModels.length > 0
                  ? `${ollamaModels.length} model(s) available`
                  : 'Install models using: ollama pull <model-name>'}
              </p>
            </div>
          </div>
        </div>

        <Separator />

        {/* API Model Section */}
        <div
          className={cn(
            'rounded-lg border-2 p-4 transition-all',
            modelConfig.enableApi
              ? 'border-primary bg-primary/5'
              : 'border-border bg-background'
          )}
        >
          <div className="mb-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="enable-api"
                checked={modelConfig.enableApi}
                onCheckedChange={(checked) =>
                  setModelConfig({ ...modelConfig, enableApi: checked as boolean })
                }
              />
              <Label htmlFor="enable-api" className="text-base font-semibold">
                API Model (Cloud Services)
              </Label>
            </div>
            <p className="ml-6 mt-1 text-sm text-muted-foreground">
              100+ models from OpenAI, Anthropic, Google, and more
            </p>
          </div>

          <ApiModelCard
            modelConfig={modelConfig}
            setModelConfig={setModelConfig}
            apiModels={apiModels}
            apiModelsLoading={apiModelsLoading}
            apiModelsError={apiModelsError}
            detectedProvider={detectedProvider}
            fetchApiModels={fetchApiModels}
            showCheckbox={false}
            standalone={false}
          />
        </div>
      </CardContent>
    </Card>
  )
}
