import { useState, useCallback, useEffect } from 'react'
import { ModelConfig } from '@/types/setupWizard'

export function useModelConfig(currentStep: number) {
  const [modelConfig, setModelConfig] = useState<ModelConfig>({
    provider: '',  // No default provider - user must select
    model: '',     // No default model - user must select
    apiKey: '',
    baseUrl: '',
  })

  // Ollama models state
  const [ollamaModels, setOllamaModels] = useState<string[]>([])
  const [ollamaLoading, setOllamaLoading] = useState(false)
  const [ollamaError, setOllamaError] = useState<string>('')

  // Fetch Ollama models
  const fetchOllamaModels = useCallback(async () => {
    setOllamaLoading(true)
    setOllamaError('')

    try {
      const result = await window.electronAPI.checkOllama()

      if (result.success && result.running && result.models) {
        const modelNames = result.models.map((model: { name?: string } | string) =>
          typeof model === 'string' ? model : (model.name || '')
        )
        setOllamaModels(modelNames)

        // Auto-select first model if provider is Ollama and no model selected
        if (modelNames.length > 0 && modelConfig.provider === 'ollama' && !modelConfig.model) {
          const firstModel = modelNames[0]
          setModelConfig((prev) => ({
            ...prev,
            model: firstModel.startsWith('ollama/') ? firstModel : `ollama/${firstModel}`,
          }))
        }
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
  }, [modelConfig.provider, modelConfig.model])

  // Auto-fetch Ollama models when provider is Ollama
  useEffect(() => {
    if (modelConfig.provider === 'ollama' && currentStep === 2) {
      fetchOllamaModels()
    }
  }, [modelConfig.provider, currentStep, fetchOllamaModels])

  // Set base URL when provider changes
  useEffect(() => {
    if (modelConfig.provider === 'ollama') {
      setModelConfig(prev => ({
        ...prev,
        baseUrl: 'http://localhost:11434',
        apiKey: '', // Ollama doesn't need API key
      }))
    }
  }, [modelConfig.provider])

  // Helper to update provider and reset model
  const setProvider = useCallback((provider: string) => {
    setModelConfig(prev => ({
      ...prev,
      provider,
      model: '', // Reset model when provider changes
      apiKey: provider === 'ollama' ? '' : prev.apiKey,
      baseUrl: provider === 'ollama' ? 'http://localhost:11434' : '',
    }))
  }, [])

  // Helper to update model (converts to LiteLLM format for Ollama)
  const setModel = useCallback((model: string) => {
    setModelConfig(prev => {
      // For Ollama, ensure model name has prefix
      if (prev.provider === 'ollama' && !model.startsWith('ollama/')) {
        model = `ollama/${model}`
      }
      return { ...prev, model }
    })
  }, [])

  return {
    modelConfig,
    setModelConfig,
    setProvider,
    setModel,
    ollamaModels,
    ollamaLoading,
    ollamaError,
    fetchOllamaModels,
  }
}
