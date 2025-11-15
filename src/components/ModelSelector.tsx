import { useState, useEffect } from 'react'
import { Select, Option, Stack, Skeleton } from '@mui/joy'

interface ModelSelectorProps {
  value?: {
    type: 'local' | 'api'
    model: string
  }
  onChange?: (value: { type: 'local' | 'api'; model: string }) => void
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
  const [localModels, setLocalModels] = useState<string[]>([])
  const [apiModels, setApiModels] = useState<string[]>([])
  const [hasLocal, setHasLocal] = useState(false)
  const [hasApi, setHasApi] = useState(false)
  const [loading, setLoading] = useState(true)

  // Load available models from config
  useEffect(() => {
    loadModels()
  }, [])

  // Notify parent of changes
  useEffect(() => {
    if (onChange) {
      const selectedModel = modelType === 'local' ? localModel : apiModel
      if (selectedModel) {
        onChange({ type: modelType, model: selectedModel })
      }
    }
  }, [modelType, localModel, apiModel, onChange])

  const loadModels = async () => {
    setLoading(true)
    try {
      // Load config to see what's enabled
      const configResult = await window.electronAPI.configLoad()
      if (configResult.success && configResult.config) {
        const config = configResult.config

        // Check if local is enabled (config uses UPPERCASE_SNAKE_CASE)
        if (config.ENABLE_LOCAL && config.LOCAL_MODEL) {
          setHasLocal(true)
          setLocalModel(config.LOCAL_MODEL as string)
          setModelType('local')

          // Try to fetch Ollama models
          const ollamaResult = await window.electronAPI.ollamaList()
          if (ollamaResult.success && ollamaResult.models) {
            setLocalModels(ollamaResult.models)
          } else {
            setLocalModels([config.LOCAL_MODEL as string])
          }
        }

        // Check if API is enabled
        if (config.ENABLE_API && config.API_MODEL) {
          setHasApi(true)
          setApiModel(config.API_MODEL as string)
          if (!config.ENABLE_LOCAL) {
            setModelType('api')
          }

          // Try to fetch API models
          if (config.API_BASE_URL && config.API_KEY) {
            const apiModelsResult = await window.electronAPI.fetchApiModels({
              apiBaseUrl: config.API_BASE_URL as string,
              apiKey: config.API_KEY as string,
            })
            if (apiModelsResult.success && apiModelsResult.models) {
              setApiModels(apiModelsResult.models)
            } else {
              setApiModels([config.API_MODEL as string])
            }
          } else {
            setApiModels([config.API_MODEL as string])
          }
        }
      }
    } catch (error) {
      console.error('Failed to load models:', error)
    } finally {
      setLoading(false)
    }
  }

  // Show skeleton loading state
  if (loading) {
    return (
      <Stack direction="row" spacing={1}>
        <Skeleton variant="rectangular" width={100} height={size === 'sm' ? 32 : size === 'md' ? 40 : 48} sx={{ borderRadius: 'sm' }} />
        <Skeleton variant="rectangular" width={180} height={size === 'sm' ? 32 : size === 'md' ? 40 : 48} sx={{ borderRadius: 'sm' }} />
      </Stack>
    )
  }

  return (
    <Stack direction="row" spacing={1}>
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

      {/* Model Selection */}
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

      {modelType === 'api' && apiModels.length > 0 && (
        <Select
          value={apiModel}
          onChange={(_, value) => setApiModel(value || '')}
          placeholder="Select model"
          size={size}
          disabled={disabled}
          sx={{ minWidth: 180 }}
        >
          {apiModels.map((m) => (
            <Option key={m} value={m}>
              {m}
            </Option>
          ))}
        </Select>
      )}
    </Stack>
  )
}