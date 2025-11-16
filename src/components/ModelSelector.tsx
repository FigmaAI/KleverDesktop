import { useState, useEffect } from 'react'
import { Select, Option, Stack } from '@mui/joy'

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

  const loadModels = async () => {
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

          // Try to fetch API models
          if (config.model?.api?.baseUrl && config.model?.api?.key) {
            const apiModelsResult = await window.electronAPI.fetchApiModels({
              apiBaseUrl: config.model.api.baseUrl,
              apiKey: config.model.api.key,
            })
            if (apiModelsResult.success && apiModelsResult.models) {
              setApiModels(apiModelsResult.models)
            } else {
              setApiModels([config.model.api.model])
            }
          } else {
            setApiModels([config.model.api.model])
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
  }

  // Load available models from config
  useEffect(() => {
    // Initial data loading is a valid use case for setState in effect
    // eslint-disable-next-line
    void loadModels()
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