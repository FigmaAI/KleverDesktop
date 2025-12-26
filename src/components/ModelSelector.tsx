import { useState, useEffect, useMemo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
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
import { Monitor, Cloud } from 'lucide-react'

export interface ModelSelection {
  provider: string   // Provider ID (e.g., 'ollama', 'openai', 'anthropic')
  model: string      // Model name (e.g., 'llama3.2-vision', 'gpt-4o')
  baseUrl?: string   // Provider's default base URL (optional)
}

interface ModelSelectorProps {
  value?: ModelSelection
  onChange?: (value: ModelSelection) => void
  disabled?: boolean
  /**
   * If provided, only show these providers in the dropdown.
   * This is used in TaskCreateDialog to only show registered providers.
   */
  registeredProviders?: string[]
}

export function ModelSelector({
  value,
  onChange,
  disabled = false,
  registeredProviders,
}: ModelSelectorProps) {
  const { t } = useTranslation()
  const [provider, setProvider] = useState(value?.provider || '')
  const [model, setModel] = useState(value?.model || '')

  // Ollama-specific state
  const [ollamaModels, setOllamaModels] = useState<string[]>([])
  const [ollamaLoading, setOllamaLoading] = useState(false)

  // Use LiteLLM providers hook for API providers
  const { providers, loading: providersLoading, error: providersError, getProviderModels, fetchProviders } = useLiteLLMProviders()

  // Fetch providers on mount
  useEffect(() => {
    if (providers.length === 0 && !providersLoading) {
      fetchProviders()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Only run once on mount (intentional)

  // Add Ollama to providers list if not already present
  const allProviders = useMemo(() => {
    let providerList = providers
    const hasOllama = providers.some(p => p.id === 'ollama')

    if (!hasOllama) {
      // Add Ollama as first provider
      providerList = [
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
    }

    // Filter by registered providers if provided
    if (registeredProviders && registeredProviders.length > 0) {
      providerList = providerList.filter(p => registeredProviders.includes(p.id))
    }

    return providerList
  }, [providers, registeredProviders])

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
      // Get provider info to include baseUrl
      const providerInfo = allProviders.find(pr => pr.id === p);
      const baseUrl = providerInfo?.defaultBaseUrl;

      onChange({
        provider: p,
        model: m,
        baseUrl: baseUrl || undefined,
      });
    }
  }, [onChange, allProviders]);

  // Prepare combobox options for models with badges in dropdown
  const modelOptions: ComboboxOption[] = useMemo(() => {
    return currentModels.map((m) => {
      const modelInfo = getModelInfo(m);
      const hasBadges = modelInfo && (modelInfo.supportsVision || modelInfo.maxInputTokens);

      return {
        value: m,
        label: m, // Simple label for selected display
        itemLabel: hasBadges ? (
          <div className="flex items-center justify-between w-full gap-2">
            <span className="truncate">{m}</span>
            <div className="flex gap-1 shrink-0">
              {modelInfo?.supportsVision && (
                <Badge variant="default" className="text-xs px-1 py-0">{t('modelSelector.vision')}</Badge>
              )}
              {modelInfo?.maxInputTokens && (
                <Badge variant="secondary" className="text-xs px-1 py-0">
                  {(modelInfo.maxInputTokens / 1000).toFixed(0)}K
                </Badge>
              )}
            </div>
          </div>
        ) : m, // Just the model name if no badges
      };
    });
  }, [currentModels, getModelInfo, t]);

  // Handle provider change
  const handleProviderChange = (newProvider: string) => {
    setProvider(newProvider);
    setModel(''); // Reset model when provider changes
    // Don't notify yet - wait for model selection
  };

  // Handle model change
  const handleModelChange = (newModel: string) => {
    setModel(newModel);
    // Notify parent when model is selected
    if (provider && newModel) {
      notifyChange(provider, newModel);
    }
  };

  return (
    <div className="flex items-center gap-2 w-full">
      {/* Provider Selection */}
      <Select
        value={provider}
        onValueChange={handleProviderChange}
        disabled={disabled}
      >
        <SelectTrigger className="w-[120px] shrink-0">
          <SelectValue placeholder={t('modelSelector.selectProvider')} />
        </SelectTrigger>
        <SelectContent>
          {providersLoading ? (
            <SelectItem value="_loading" disabled>{t('modelSelector.loadingProviders')}</SelectItem>
          ) : providersError ? (
            <SelectItem value="_error" disabled>{t('modelSelector.error', { message: providersError })}</SelectItem>
          ) : allProviders.length === 0 ? (
            <SelectItem value="_empty" disabled>{t('modelSelector.noProviders')}</SelectItem>
          ) : (
            allProviders.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                <span className="flex items-center gap-1.5">
                  {p.id === 'ollama' ? (
                    <Monitor className="h-3.5 w-3.5 text-muted-foreground" />
                  ) : (
                    <Cloud className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                  {p.name}
                </span>
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>

      {/* Model Selection */}
      {provider && (
        <div className="min-w-[220px] max-w-[320px] flex-1">
          {ollamaLoading ? (
            <div className="flex items-center justify-center h-10 px-3 border rounded-md bg-muted/50">
              <span className="text-sm text-muted-foreground">{t('modelSelector.loadingModels')}</span>
            </div>
          ) : currentModels.length > 0 ? (
            <Combobox
              options={modelOptions}
              value={model}
              onValueChange={handleModelChange}
              placeholder={t('modelSelector.selectModel')}
              searchPlaceholder={t('modelSelector.searchModels')}
              emptyText={provider === 'ollama' ? t('modelSelector.ollamaNoModels') : t('modelSelector.noModelsFound')}
              disabled={disabled}
              className="w-full"
            />
          ) : (
            <div className="flex items-center justify-center h-10 px-3 border rounded-md bg-muted/50">
              <span className="text-sm text-muted-foreground">
                {provider === 'ollama' ? t('modelSelector.noModelsInstalled') : t('modelSelector.noModels')}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
