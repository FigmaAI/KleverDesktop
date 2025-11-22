import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, RefreshCw, ExternalLink, Eye, EyeOff } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { Combobox, ComboboxOption } from '@/components/ui/combobox'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import { ModelConfig } from '@/types/setupWizard'
import { useLiteLLMProviders } from '@/hooks/useLiteLLMProviders'

interface ApiModelCardProps {
  modelConfig: ModelConfig
  setModelConfig: (config: ModelConfig) => void
  apiModels: string[]
  apiModelsLoading: boolean
  apiModelsError: string
  detectedProvider?: string   // Unused but kept for backward compatibility
  fetchApiModels: () => void
  showCheckbox?: boolean      // Show enable/disable checkbox (default: true)
  standalone?: boolean        // Wrap in Sheet with border (default: true)
}

export function ApiModelCard({
  modelConfig,
  setModelConfig,
  apiModels,
  apiModelsLoading,
  apiModelsError,
  detectedProvider: _detectedProvider,
  fetchApiModels,
  showCheckbox = true,
  standalone = true,
}: ApiModelCardProps) {
  const { providers, loading: providersLoading, error: providersError, getProvider, getProviderModels } = useLiteLLMProviders()
  const [showApiKey, setShowApiKey] = useState(false)

  // Get selected provider details
  const selectedProvider = useMemo(() => {
    if (!modelConfig.apiProvider) return null
    return getProvider(modelConfig.apiProvider)
  }, [modelConfig.apiProvider, getProvider])

  // Get models for selected provider
  const providerModels = useMemo(() => {
    if (!modelConfig.apiProvider) return []
    return getProviderModels(modelConfig.apiProvider)
  }, [modelConfig.apiProvider, getProviderModels])

  // Model options for autocomplete (combine LiteLLM models and fetched API models)
  const modelOptions = useMemo(() => {
    const litellmModels = providerModels.map(m => m.id)
    const combined = [...new Set([...litellmModels, ...apiModels])]
    return combined.sort()
  }, [providerModels, apiModels])

  // Auto-set base URL when provider is selected
  useEffect(() => {
    if (selectedProvider) {
      if (selectedProvider.requiresBaseUrl && selectedProvider.defaultBaseUrl) {
        // OpenRouter, Azure, etc. - set default base URL
        setModelConfig({ 
          ...modelConfig, 
          apiBaseUrl: selectedProvider.defaultBaseUrl 
        })
      } else if (!selectedProvider.requiresBaseUrl) {
        // OpenAI, Anthropic, etc. - clear base URL (liteLLM handles it)
        setModelConfig({ 
          ...modelConfig, 
          apiBaseUrl: '' 
        })
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProvider?.id])

  // Handle provider selection
  const handleProviderChange = (value: string) => {
    setModelConfig({
      ...modelConfig,
      apiProvider: value,
      apiModel: '', // Reset model when provider changes
    })
  }

  // Prepare combobox options for model selection
  const modelComboboxOptions: ComboboxOption[] = useMemo(() => {
    return modelOptions.map((option) => ({
      value: option,
      label: option,
    }))
  }, [modelOptions])

  // Card content (can be used standalone or wrapped in Card)
  const cardContent = (
    <div className="space-y-4">
      {showCheckbox && (
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="enable-api-model"
              checked={modelConfig.enableApi}
              onCheckedChange={(checked) =>
                setModelConfig({ ...modelConfig, enableApi: checked as boolean })
              }
            />
            <Label htmlFor="enable-api-model" className="text-base font-semibold">
              API Model (Cloud Services)
            </Label>
          </div>
          <p className="ml-6 text-sm text-muted-foreground">
            100+ models from OpenAI, Anthropic, Google, and more
          </p>
        </div>
      )}

      <div className="space-y-4">
        {/* Provider Selection */}
        <div className="space-y-2">
          <Label>AI Provider</Label>
          <Select
            value={modelConfig.apiProvider || ''}
            onValueChange={handleProviderChange}
            disabled={!modelConfig.enableApi || providersLoading}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a provider...">
                {selectedProvider?.name}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {providers.map((provider) => (
                <SelectItem key={provider.id} value={provider.id}>
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium">{provider.name}</span>
                    {provider.description && (
                      <span className="text-xs text-muted-foreground">
                        {provider.description}
                      </span>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-sm text-muted-foreground">
            {providersLoading
              ? 'Loading providers...'
              : providersError
                ? <span className="text-destructive">{providersError}</span>
                : providers.length > 0
                  ? `${providers.length} providers available`
                  : 'No providers found'}
          </p>
        </div>

        {/* Provider Info (when selected) */}
        {selectedProvider && (
          <Alert>
            <AlertDescription>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{selectedProvider.name}</span>
                  {selectedProvider.requiresBaseUrl && (
                    <Badge variant="outline" className="text-yellow-600 border-yellow-600">
                      Custom URL Required
                    </Badge>
                  )}
                </div>
                {selectedProvider.description && (
                  <p className="text-sm">{selectedProvider.description}</p>
                )}
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault()
                    window.electronAPI.openExternal(selectedProvider.apiKeyUrl)
                  }}
                  className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                >
                  Get API Key
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* API Base URL (conditional - only for OpenRouter, Azure, etc.) */}
        {selectedProvider?.requiresBaseUrl && (
          <div className="space-y-2">
            <Label>API Base URL</Label>
            <Input
              value={modelConfig.apiBaseUrl}
              onChange={(e) => setModelConfig({ ...modelConfig, apiBaseUrl: e.target.value })}
              placeholder={selectedProvider.defaultBaseUrl || 'https://...'}
              disabled={!modelConfig.enableApi}
            />
            <p className="text-sm text-muted-foreground">
              {selectedProvider.defaultBaseUrl
                ? `Default: ${selectedProvider.defaultBaseUrl}`
                : 'Custom endpoint URL'}
            </p>
          </div>
        )}

        {/* API Key */}
        <div className="space-y-2">
          <Label>API Key</Label>
          <div className="relative">
            <Input
              type={showApiKey ? 'text' : 'password'}
              value={modelConfig.apiKey}
              onChange={(e) => setModelConfig({ ...modelConfig, apiKey: e.target.value })}
              placeholder={
                selectedProvider ? 'Enter your API key...' : 'Select a provider first'
              }
              disabled={!modelConfig.enableApi || !selectedProvider}
              className="pr-10"
            />
            {modelConfig.apiKey && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                onClick={() => setShowApiKey(!showApiKey)}
                disabled={!modelConfig.enableApi || !selectedProvider}
              >
                {showApiKey ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
                <span className="sr-only">
                  {showApiKey ? 'Hide' : 'Show'} API key
                </span>
              </Button>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {selectedProvider
              ? 'Your API key (stored securely on your device)'
              : 'Select a provider to continue'}
          </p>
        </div>

        {/* Model Selection */}
        <div className="space-y-2">
          <Label>
            Model Name
            {selectedProvider && (
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                ({providerModels.length} models available)
              </span>
            )}
          </Label>
          <div className="flex gap-2">
            <div className="flex-1">
              <Combobox
                options={modelComboboxOptions}
                value={modelConfig.apiModel}
                onValueChange={(value) => setModelConfig({ ...modelConfig, apiModel: value })}
                placeholder={
                  selectedProvider
                    ? 'Select or search model...'
                    : 'Select a provider first'
                }
                searchPlaceholder="Search models..."
                emptyText="No models found"
                disabled={!modelConfig.enableApi || !selectedProvider}
                className="w-full"
              />
            </div>
            <Button
              onClick={fetchApiModels}
              disabled={
                !modelConfig.enableApi ||
                !selectedProvider ||
                !modelConfig.apiKey ||
                apiModelsLoading
              }
              variant="outline"
              size="icon"
              title="Fetch models from API"
            >
              <RefreshCw className={cn('h-4 w-4', apiModelsLoading && 'animate-spin')} />
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            {!selectedProvider
              ? 'Select a provider first'
              : apiModelsError
                ? `Unable to fetch models from API - showing ${providerModels.length} known models`
                : apiModels.length > 0
                  ? `${apiModels.length} models fetched from API`
                  : `Showing ${providerModels.length} known models for ${selectedProvider.name}`}
          </p>
        </div>

        {/* API Models Error (non-critical) */}
        {apiModelsError && (
          <Alert variant="warning">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-1">
                <p className="font-semibold">Model Fetch Warning</p>
                <p className="text-sm">{apiModelsError}</p>
                <p className="text-sm">
                  You can still enter a model name manually from the {providerModels.length}{' '}
                  known models.
                </p>
              </div>
            </AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  )

  // Return wrapped or unwrapped based on standalone prop
  if (standalone) {
    return (
      <Card
        className={cn(
          'transition-all',
          modelConfig.enableApi
            ? 'border-2 border-primary bg-primary/5'
            : 'border hover:border-primary/50'
        )}
      >
        <CardContent className="pt-6">{cardContent}</CardContent>
      </Card>
    )
  }

  return cardContent
}
