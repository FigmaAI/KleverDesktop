import { useState, useCallback, useEffect } from 'react'
import { ModelConfig, TestStatus } from '@/types/setupWizard'

export function useModelConfig(currentStep: number) {
  const [modelConfig, setModelConfig] = useState<ModelConfig>({
    enableLocal: true,
    enableApi: false,
    apiBaseUrl: 'https://api.openai.com/v1/chat/completions',
    apiKey: '',
    apiModel: '',
    localBaseUrl: 'http://localhost:11434/v1/chat/completions',
    localModel: 'qwen3-vl:4b',
  })

  const [localTestStatus, setLocalTestStatus] = useState<TestStatus>('idle')
  const [localTestMessage, setLocalTestMessage] = useState<string>('')
  const [apiTestStatus, setApiTestStatus] = useState<TestStatus>('idle')
  const [apiTestMessage, setApiTestMessage] = useState<string>('')

  // Ollama models state
  const [ollamaModels, setOllamaModels] = useState<string[]>([])
  const [ollamaLoading, setOllamaLoading] = useState(false)
  const [ollamaError, setOllamaError] = useState<string>('')

  // API models state
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
      console.log('Ollama API result:', result)

      if (result.success && result.running && result.models) {
        const modelNames = result.models.map((model: { name?: string } | string) =>
          typeof model === 'string' ? model : (model.name || '')
        )
        console.log('Parsed model names:', modelNames)
        setOllamaModels(modelNames)

        // Auto-select first model if none selected
        if (modelNames.length > 0 && !modelConfig.localModel) {
          setModelConfig((prev) => ({ ...prev, localModel: modelNames[0] }))
        }
      } else {
        console.log('Ollama check failed:', result)
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
  }, [modelConfig.localModel])

  // Auto-fetch Ollama models when local model is enabled
  useEffect(() => {
    if (modelConfig.enableLocal && currentStep === 2) {
      fetchOllamaModels()
    }
  }, [modelConfig.enableLocal, currentStep, fetchOllamaModels])

  // Fetch API models from provider
  const fetchApiModels = useCallback(async () => {
    if (!modelConfig.apiBaseUrl) {
      setApiModelsError('Please enter API Base URL first')
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
        apiBaseUrl: modelConfig.apiBaseUrl,
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
  }, [modelConfig.apiBaseUrl, modelConfig.apiKey])

  // Auto-fetch API models when URL or key changes
  useEffect(() => {
    if (modelConfig.enableApi && modelConfig.apiBaseUrl && currentStep === 2) {
      const timeoutId = window.setTimeout(() => {
        fetchApiModels()
      }, 500) // Debounce API calls

      return () => window.clearTimeout(timeoutId)
    }
  }, [modelConfig.enableApi, modelConfig.apiBaseUrl, modelConfig.apiKey, currentStep, fetchApiModels])

  const handleTestLocalConnection = async () => {
    setLocalTestStatus('testing')
    setLocalTestMessage('')

    try {
      const result = await window.electronAPI.testModelConnection({
        enableLocal: true,
        enableApi: false,
        apiBaseUrl: '',
        apiKey: '',
        apiModel: '',
        localBaseUrl: modelConfig.localBaseUrl,
        localModel: modelConfig.localModel,
      })

      if (result.success) {
        setLocalTestStatus('success')
        setLocalTestMessage(result.message || 'Connection successful!')
      } else {
        setLocalTestStatus('error')
        setLocalTestMessage(result.message || 'Connection failed')
      }
    } catch (error) {
      setLocalTestStatus('error')
      setLocalTestMessage(error instanceof Error ? error.message : 'Unknown error occurred')
    }
  }

  const handleTestApiConnection = async () => {
    setApiTestStatus('testing')
    setApiTestMessage('')

    try {
      const result = await window.electronAPI.testModelConnection({
        enableLocal: false,
        enableApi: true,
        apiBaseUrl: modelConfig.apiBaseUrl,
        apiKey: modelConfig.apiKey,
        apiModel: modelConfig.apiModel,
        localBaseUrl: '',
        localModel: '',
      })

      if (result.success) {
        setApiTestStatus('success')
        setApiTestMessage(result.message || 'Connection successful!')
      } else {
        setApiTestStatus('error')
        setApiTestMessage(result.message || 'Connection failed')
      }
    } catch (error) {
      setApiTestStatus('error')
      setApiTestMessage(error instanceof Error ? error.message : 'Unknown error occurred')
    }
  }

  return {
    modelConfig,
    setModelConfig,
    localTestStatus,
    localTestMessage,
    apiTestStatus,
    apiTestMessage,
    ollamaModels,
    ollamaLoading,
    ollamaError,
    fetchOllamaModels,
    apiModels,
    apiModelsLoading,
    apiModelsError,
    detectedProvider,
    fetchApiModels,
    handleTestLocalConnection,
    handleTestApiConnection,
  }
}
