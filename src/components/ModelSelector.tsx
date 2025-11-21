import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Combobox, ComboboxOption } from '@/components/ui/combobox'
import { Badge } from '@/components/ui/badge'
import { useLiteLLMProviders } from '@/hooks/useLiteLLMProviders'

interface ModelSelectorProps {
  value?: {
    type: 'local' | 'api'
    model: string
    provider?: string  // For API models, store provider ID
  }
  onChange?: (value: { type: 'local' | 'api'; model: string; provider?: string }) => void
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
}

export function ModelSelector({
  value,
  onChange,
  size = 'sm',
  disabled = false,
}: ModelSelectorProps) {
  const [modelType, setModelType] = useState<'local' | 'api'>(value?.type || 'local')
  const [localModel, setLocalModel] = useState(value?.type === 'local' ? value.model : '')
  const [apiModel, setApiModel] = useState(value?.type === 'api' ? value.model : '')
  const [apiProvider, setApiProvider] = useState(value?.provider || '')
  const [localModels, setLocalModels] = useState<string[]>([])
  const [hasLocal, setHasLocal] = useState(false)
  const [hasApi, setHasApi] = useState(false)
  
  // Use LiteLLM providers hook for API models
  const { providers, getProviderModels } = useLiteLLMProviders()

  // Get models for selected API provider
  const providerModels = useMemo(() => {
    if (!apiProvider) return []
    return getProviderModels(apiProvider)
  }, [apiProvider, getProviderModels])

  // Model options for API autocomplete
  const apiModelOptions = useMemo(() => {
    return providerModels.map(m => m.id).sort()
  }, [providerModels])

  // Helper to detect provider from model name
  const detectProviderFromModel = useCallback((modelName: string): string => {
    if (modelName.startsWith('gpt-')) return 'openai'
    if (modelName.startsWith('claude-') || modelName.startsWith('anthropic/')) return 'anthropic'
    if (modelName.startsWith('grok')) return 'xai'
    if (modelName.startsWith('gemini/')) return 'gemini'
    if (modelName.startsWith('openrouter/')) return 'openrouter'
    if (modelName.startsWith('mistral/')) return 'mistral'
    if (modelName.startsWith('deepseek/')) return 'deepseek'
    return 'openai' // Default to OpenAI
  }, [])

  const loadModels = useCallback(async () => {
    try {
      // Load config to see what's enabled
      const configResult = await window.electronAPI.configLoad()
      if (configResult.success && configResult.config) {
        const config = configResult.config

        // Check if local is enabled (config.json uses nested camelCase structure)
        if (config.model?.enableLocal && config.model?.local?.model) {
          setHasLocal(true)
          setLocalModel(config.model.local.model)

          // Try to fetch Ollama models
          const ollamaResult = await window.electronAPI.ollamaList()
          if (ollamaResult.success && ollamaResult.models) {
            setLocalModels(ollamaResult.models)
          } else {
            setLocalModels([config.model.local.model])
          }
        }

        // Check if API is enabled
        if (config.model?.enableApi && config.model?.api?.model) {
          setHasApi(true)
          setApiModel(config.model.api.model)
          
          // Try to detect provider from model name
          const modelName = config.model.api.model
          const detectedProvider = detectProviderFromModel(modelName)
          if (detectedProvider) {
            setApiProvider(detectedProvider)
          }
        }

        // Set default model type: API first if available, otherwise Local
        if (config.model?.enableApi && config.model?.api?.model) {
          setModelType('api')
        } else if (config.model?.enableLocal && config.model?.local?.model) {
          setModelType('local')
        }
      }
    } catch (error) {
      console.error('Failed to load models:', error)
    }
  }, [detectProviderFromModel])

  // Load available models from config
  useEffect(() => {
    // Initial data loading is a valid use case for setState in effect
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadModels()
  }, [loadModels])

  // Notify parent of changes
  useEffect(() => {
    if (onChange) {
      if (modelType === 'local' && localModel) {
        onChange({ type: 'local', model: localModel })
      } else if (modelType === 'api' && apiModel) {
        onChange({ type: 'api', model: apiModel, provider: apiProvider })
      }
    }
  }, [modelType, localModel, apiModel, apiProvider, onChange])

  // Prepare combobox options for API models with badges
  const apiComboboxOptions: ComboboxOption[] = useMemo(() => {
    return apiModelOptions.map((option) => ({
      value: option,
      label: option,
    }))
  }, [apiModelOptions])

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Model Type Selection */}
      {(hasLocal || hasApi) && (
        <Select
          value={modelType}
          onValueChange={(value) => setModelType(value as 'local' | 'api')}
          disabled={disabled}
        >
          <SelectTrigger className="w-[120px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {hasLocal && (
              <SelectItem value="local">🖥️ Local</SelectItem>
            )}
            {hasApi && (
              <SelectItem value="api">☁️ API</SelectItem>
            )}
          </SelectContent>
        </Select>
      )}

      {/* Local Model Selection */}
      {modelType === 'local' && localModels.length > 0 && (
        <Select
          value={localModel}
          onValueChange={(value) => setLocalModel(value || '')}
          disabled={disabled}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Select model" />
          </SelectTrigger>
          <SelectContent>
            {localModels.map((m) => (
              <SelectItem key={m} value={m}>
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* API Model Selection - Provider + Model */}
      {modelType === 'api' && hasApi && (
        <>
          {/* Provider Selection */}
          <Select
            value={apiProvider}
            onValueChange={(value) => {
              setApiProvider(value || '')
              setApiModel('') // Reset model when provider changes
            }}
            disabled={disabled}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Provider" />
            </SelectTrigger>
            <SelectContent>
              {providers.map((provider) => (
                <SelectItem key={provider.id} value={provider.id}>
                  {provider.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Model Selection with Combobox */}
          {apiProvider && (
            <div className="relative w-[240px]">
              <Combobox
                options={apiComboboxOptions}
                value={apiModel}
                onValueChange={(value) => setApiModel(value)}
                placeholder="Model"
                searchPlaceholder="Search models..."
                emptyText="No models found"
                disabled={disabled}
                className="w-full"
              />
              {/* Show badges for selected model */}
              {apiModel && (() => {
                const modelInfo = providerModels.find(m => m.id === apiModel)
                return modelInfo && (modelInfo.supportsVision || modelInfo.maxInputTokens) ? (
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1 pointer-events-none">
                    {modelInfo.supportsVision && (
                      <Badge variant="default" className="text-xs">
                        Vision
                      </Badge>
                    )}
                    {modelInfo.maxInputTokens && (
                      <Badge variant="secondary" className="text-xs">
                        {(modelInfo.maxInputTokens / 1000).toFixed(0)}K
                      </Badge>
                    )}
                  </div>
                ) : null
              })()}
            </div>
          )}
        </>
      )}
    </div>
  )
}