import { useState, useEffect, useMemo, useCallback } from 'react'
import { Select, Option, Stack, Autocomplete, AutocompleteOption, Box, Typography, Chip } from '@mui/joy'
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

  return (
    <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
      {/* Model Type Selection */}
      {(hasLocal || hasApi) && (
        <Select
          value={modelType}
          onChange={(_, value) => setModelType(value as 'local' | 'api')}
          size={size}
          disabled={disabled}
          sx={{ minWidth: 100 }}
        >
          {hasLocal && (
            <Option value="local">
              🖥️ Local
            </Option>
          )}
          {hasApi && (
            <Option value="api">
              ☁️ API
            </Option>
          )}
        </Select>
      )}

      {/* Local Model Selection */}
      {modelType === 'local' && localModels.length > 0 && (
        <Select
          value={localModel}
          onChange={(_, value) => setLocalModel(value || '')}
          placeholder="Select model"
          size={size}
          disabled={disabled}
          sx={{ minWidth: 180 }}
        >
          {localModels.map((m) => (
            <Option key={m} value={m}>
              {m}
            </Option>
          ))}
        </Select>
      )}

      {/* API Model Selection - Provider + Model */}
      {modelType === 'api' && hasApi && (
        <>
          {/* Provider Selection */}
          <Select
            value={apiProvider}
            onChange={(_, value) => {
              setApiProvider(value || '')
              setApiModel('') // Reset model when provider changes
            }}
            placeholder="Provider"
            size={size}
            disabled={disabled}
            sx={{ minWidth: 140 }}
          >
            {providers.map((provider) => (
              <Option key={provider.id} value={provider.id}>
                {provider.name}
              </Option>
            ))}
          </Select>

          {/* Model Selection with Vision tags */}
          {apiProvider && (
            <Autocomplete
              value={apiModel}
              onChange={(_, newValue) => setApiModel(newValue || '')}
              onInputChange={(_, newValue) => setApiModel(newValue)}
              options={apiModelOptions}
              placeholder="Model"
              size={size}
              disabled={disabled}
              freeSolo
              sx={{ minWidth: 200 }}
              renderOption={(props, option) => {
                const modelInfo = providerModels.find(m => m.id === option)
                return (
                  <AutocompleteOption {...props} key={option}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                      <Typography level="body-sm" sx={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {option}
                      </Typography>
                      {modelInfo && (
                        <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>
                          {modelInfo.supportsVision && (
                            <Chip size="sm" color="success" variant="soft">Vision</Chip>
                          )}
                          {modelInfo.maxInputTokens && (
                            <Chip size="sm" variant="soft">
                              {(modelInfo.maxInputTokens / 1000).toFixed(0)}K
                            </Chip>
                          )}
                        </Box>
                      )}
                    </Box>
                  </AutocompleteOption>
                )
              }}
            />
          )}
        </>
      )}
    </Stack>
  )
}