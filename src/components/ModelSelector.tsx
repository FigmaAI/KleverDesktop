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

export interface ModelSelection {
  provider: string   // Provider ID (e.g., 'ollama', 'openai', 'anthropic')
  model: string      // Model name (e.g., 'llama3.2-vision', 'gpt-4o')
}

interface ModelSelectorProps {
  value?: ModelSelection
  onChange?: (value: ModelSelection) => void
  disabled?: boolean
}

export function ModelSelector({
  value,
  onChange,
  disabled = false,
}: ModelSelectorProps) {
  const [provider, setProvider] = useState(value?.provider || '')
  const [model, setModel] = useState(value?.model || '')
  
  // Ollama-specific state
  const [ollamaModels, setOllamaModels] = useState<string[]>([])
  const [ollamaLoading, setOllamaLoading] = useState(false)

  // Use LiteLLM providers hook for API providers
  const { providers, loading: providersLoading, error: providersError, getProviderModels } = useLiteLLMProviders()

  // Add Ollama to providers list if not already present
  const allProviders = useMemo(() => {
    const hasOllama = providers.some(p => p.id === 'ollama')
    if (hasOllama) return providers
    
    // Add Ollama as first provider
    return [
      {
        id: 'ollama',
        name: 'Ollama (Local)',
        requiresBaseUrl: false,
        apiKeyUrl: 'https://ollama.ai/',
        models: [],
        description: 'Run models locally via Ollama - no API key required',
      },
      ...providers,
    ]
  }, [providers])

  // Fetch Ollama models when Ollama provider is selected
  const fetchOllamaModels = useCallback(async () => {
    setOllamaLoading(true)
    try {
      const result = await window.electronAPI.ollamaList()
      if (result.success && result.models) {
        // Add 'ollama/' prefix to match LiteLLM format
        setOllamaModels(result.models.map(m => `ollama/${m}`))
      } else {
        setOllamaModels([])
      }
    } catch {
      setOllamaModels([])
    } finally {
      setOllamaLoading(false)
    }
  }, [])

  // Fetch Ollama models when provider changes to 'ollama'
  useEffect(() => {
    if (provider === 'ollama') {
      fetchOllamaModels()
    }
  }, [provider, fetchOllamaModels])

  // Sync with external value changes
  useEffect(() => {
    if (value?.provider !== undefined && value.provider !== provider) {
      setProvider(value.provider)
    }
    if (value?.model !== undefined && value.model !== model) {
      setModel(value.model)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value?.provider, value?.model]) // Only depend on value properties, not internal state (intentional)

  // Get models for current provider
  const currentModels = useMemo(() => {
    if (!provider) return []
    if (provider === 'ollama') {
      return ollamaModels
    }
    return getProviderModels(provider).map(m => m.id)
  }, [provider, ollamaModels, getProviderModels])

  // Get model info for badges (API providers only)
  const getModelInfo = useCallback((modelId: string) => {
    if (provider === 'ollama') return null
    const models = getProviderModels(provider)
    return models.find(m => m.id === modelId)
  }, [provider, getProviderModels])

  // Notify parent of changes - only when user makes a selection (not on sync)
  const notifyChange = useCallback((p: string, m: string) => {
    if (onChange && p && m) {
      onChange({ provider: p, model: m })
    }
  }, [onChange])

  // Prepare combobox options for models with badges in dropdown
  const modelOptions: ComboboxOption[] = useMemo(() => {
    return currentModels.map((m) => {
      const modelInfo = getModelInfo(m)
      const hasBadges = modelInfo && (modelInfo.supportsVision || modelInfo.maxInputTokens)
      
      return {
        value: m,
        label: m, // Simple label for selected display
        itemLabel: hasBadges ? (
          <div className="flex items-center justify-between w-full gap-2">
            <span className="truncate">{m}</span>
            <div className="flex gap-1 shrink-0">
              {modelInfo?.supportsVision && (
                <Badge variant="default" className="text-xs px-1 py-0">Vision</Badge>
              )}
              {modelInfo?.maxInputTokens && (
                <Badge variant="secondary" className="text-xs px-1 py-0">
                  {(modelInfo.maxInputTokens / 1000).toFixed(0)}K
                </Badge>
              )}
            </div>
          </div>
        ) : m, // Just the model name if no badges
      }
    })
  }, [currentModels, getModelInfo])

  // Handle provider change
  const handleProviderChange = (newProvider: string) => {
    setProvider(newProvider)
    setModel('') // Reset model when provider changes
    // Don't notify yet - wait for model selection
  }

  // Handle model change
  const handleModelChange = (newModel: string) => {
    setModel(newModel)
    // Notify parent when model is selected
    if (provider && newModel) {
      notifyChange(provider, newModel)
    }
  }

  return (
    <div className="flex items-center gap-2 w-full">
      {/* Provider Selection */}
      <Select
        value={provider}
        onValueChange={handleProviderChange}
        disabled={disabled}
      >
        <SelectTrigger className="w-[120px] shrink-0">
          <SelectValue placeholder="Select provider" />
        </SelectTrigger>
        <SelectContent>
          {providersLoading ? (
            <SelectItem value="_loading" disabled>Loading providers...</SelectItem>
          ) : providersError ? (
            <SelectItem value="_error" disabled>Error: {providersError}</SelectItem>
          ) : allProviders.length === 0 ? (
            <SelectItem value="_empty" disabled>No providers available</SelectItem>
          ) : (
            allProviders.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.id === 'ollama' ? '🖥️ ' : '☁️ '}{p.name}
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>

      {/* Model Selection */}
      {provider && (
        <div className="min-w-[220px]">
          {ollamaLoading ? (
            <div className="flex items-center justify-center h-10 px-3 border rounded-md bg-muted/50">
              <span className="text-sm text-muted-foreground">Loading models...</span>
            </div>
          ) : currentModels.length > 0 ? (
            <Combobox
              options={modelOptions}
              value={model}
              onValueChange={handleModelChange}
              placeholder="Select model"
              searchPlaceholder="Search models..."
              emptyText={provider === 'ollama' ? 'No Ollama models found. Run: ollama pull llama3.2-vision' : 'No models found'}
              disabled={disabled}
              className="w-full"
            />
          ) : (
            <div className="flex items-center justify-center h-10 px-3 border rounded-md bg-muted/50">
              <span className="text-sm text-muted-foreground">
                {provider === 'ollama' ? 'No models installed' : 'No models available'}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
