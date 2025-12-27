import { useState, useCallback, useEffect } from 'react'
import { MultiProviderModelSettings } from '@/types/setupWizard'

export function useModelConfig(currentStep: number) {
  const [modelConfig, setModelConfig] = useState<MultiProviderModelSettings>({
    providers: [],
    lastUsed: undefined,
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

  // Auto-fetch Ollama models when on model config step
  useEffect(() => {
    if (currentStep === 3) {
      fetchOllamaModels()
    }
  }, [currentStep, fetchOllamaModels])

  return {
    modelConfig,
    setModelConfig,
    ollamaModels,
    ollamaLoading,
    ollamaError,
    fetchOllamaModels,
  }
}
