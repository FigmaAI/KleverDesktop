import {
  Box,
  Typography,
  Sheet,
  Stack,
  FormControl,
  FormLabel,
  FormHelperText,
  Alert,
  Input,
  Autocomplete,
  AutocompleteOption,
  IconButton,
  Select,
  Option,
  Link,
  Chip,
} from '@mui/joy'
import Checkbox from '@mui/joy/Checkbox'
import {
  Warning as WarningIcon,
  Refresh as RefreshIcon,
  OpenInNew as OpenInNewIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
} from '@mui/icons-material'
import { ModelConfig } from '@/types/setupWizard'
import { useLiteLLMProviders } from '@/hooks/useLiteLLMProviders'
import { useEffect, useMemo, useState } from 'react'

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
  const handleProviderChange = (_event: React.SyntheticEvent | null, newValue: string | null) => {
    const providerId = newValue || ''
    setModelConfig({ 
      ...modelConfig, 
      apiProvider: providerId,
      apiModel: '', // Reset model when provider changes
    })
  }

  // Card content (can be used standalone or wrapped in Sheet)
  const cardContent = (
    <>
      {showCheckbox && (
        <Box sx={{ mb: 2 }}>
          <Checkbox
            label={
              <Typography level="title-md" fontWeight="bold">
                API Model (Cloud Services)
              </Typography>
            }
            checked={modelConfig.enableApi}
            onChange={(e) =>
              setModelConfig({ ...modelConfig, enableApi: e.target.checked })
            }
            sx={{ mb: 0.5 }}
          />
          <Typography level="body-sm" textColor="text.secondary" sx={{ ml: 4 }}>
            100+ models from OpenAI, Anthropic, Google, and more
          </Typography>
        </Box>
      )}

      <Stack spacing={2}>
        {/* Provider Selection */}
        <FormControl>
          <FormLabel>AI Provider</FormLabel>
          <Select
            value={modelConfig.apiProvider || ''}
            onChange={handleProviderChange}
            placeholder="Select a provider..."
            disabled={!modelConfig.enableApi || providersLoading}
            sx={{ minWidth: 200 }}
          >
            {providers.map((provider) => (
              <Option key={provider.id} value={provider.id}>
                <Box>
                  <Typography level="body-md">{provider.name}</Typography>
                  {provider.description && (
                    <Typography level="body-xs" textColor="text.secondary">
                      {provider.description}
                    </Typography>
                  )}
                </Box>
              </Option>
            ))}
          </Select>
          <FormHelperText>
            {providersLoading ? (
              'Loading providers...'
            ) : providersError ? (
              <Typography textColor="danger.500">{providersError}</Typography>
            ) : providers.length > 0 ? (
              `${providers.length} providers available`
            ) : (
              'No providers found'
            )}
          </FormHelperText>
        </FormControl>

        {/* Provider Info (when selected) */}
        {selectedProvider && (
          <Alert variant="soft" color="primary">
            <Stack spacing={1}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography level="title-sm" fontWeight="bold">
                  {selectedProvider.name}
                </Typography>
                {selectedProvider.requiresBaseUrl && (
                  <Chip size="sm" color="warning">Custom URL Required</Chip>
                )}
              </Box>
              {selectedProvider.description && (
                <Typography level="body-sm">
                  {selectedProvider.description}
                </Typography>
              )}
              <Link
                href="#"
                onClick={(e) => {
                  e.preventDefault()
                  window.electronAPI.openExternal(selectedProvider.apiKeyUrl)
                }}
                level="body-sm"
                endDecorator={<OpenInNewIcon fontSize="small" />}
              >
                Get API Key
              </Link>
            </Stack>
          </Alert>
        )}

        {/* API Base URL (conditional - only for OpenRouter, Azure, etc.) */}
        {selectedProvider?.requiresBaseUrl && (
          <FormControl>
            <FormLabel>API Base URL</FormLabel>
            <Input
              value={modelConfig.apiBaseUrl}
              onChange={(e) => setModelConfig({ ...modelConfig, apiBaseUrl: e.target.value })}
              placeholder={selectedProvider.defaultBaseUrl || 'https://...'}
              disabled={!modelConfig.enableApi}
            />
            <FormHelperText>
              {selectedProvider.defaultBaseUrl 
                ? `Default: ${selectedProvider.defaultBaseUrl}`
                : 'Custom endpoint URL'
              }
            </FormHelperText>
          </FormControl>
        )}

        {/* API Key */}
        <FormControl>
          <FormLabel>API Key</FormLabel>
          <Input
            type={showApiKey ? 'text' : 'password'}
            value={modelConfig.apiKey}
            onChange={(e) => setModelConfig({ ...modelConfig, apiKey: e.target.value })}
            placeholder={selectedProvider ? 'Enter your API key...' : 'Select a provider first'}
            disabled={!modelConfig.enableApi || !selectedProvider}
            endDecorator={
              modelConfig.apiKey && (
                <IconButton
                  variant="plain"
                  color="neutral"
                  size="sm"
                  onClick={() => setShowApiKey(!showApiKey)}
                  disabled={!modelConfig.enableApi || !selectedProvider}
                  sx={{ mr: -1 }}
                >
                  {showApiKey ? <VisibilityOffIcon /> : <VisibilityIcon />}
                </IconButton>
              )
            }
          />
          <FormHelperText>
            {selectedProvider
              ? 'Your API key (stored securely on your device)'
              : 'Select a provider to continue'
            }
          </FormHelperText>
        </FormControl>

        {/* Model Selection */}
        <FormControl>
          <FormLabel>
            Model Name
            {selectedProvider && (
              <Typography level="body-xs" textColor="text.secondary" sx={{ ml: 1 }}>
                ({providerModels.length} models available)
              </Typography>
            )}
          </FormLabel>
          <Stack direction="row" spacing={1}>
            <Autocomplete
              placeholder={selectedProvider ? 'Select or search model...' : 'Select a provider first'}
              value={modelConfig.apiModel}
              onChange={(_, newValue) => {
                setModelConfig({ ...modelConfig, apiModel: newValue || '' })
              }}
              onInputChange={(_, newValue) => {
                setModelConfig({ ...modelConfig, apiModel: newValue })
              }}
              options={modelOptions}
              freeSolo
              disabled={!modelConfig.enableApi || !selectedProvider}
              loading={apiModelsLoading}
              sx={{ flex: 1 }}
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
            <IconButton
              onClick={fetchApiModels}
              disabled={
                !modelConfig.enableApi || 
                !selectedProvider || 
                !modelConfig.apiKey || 
                apiModelsLoading
              }
              variant="outlined"
              color="neutral"
              title="Fetch models from API"
            >
              <RefreshIcon />
            </IconButton>
          </Stack>
          <FormHelperText>
            {!selectedProvider ? (
              'Select a provider first'
            ) : apiModelsError ? (
              <Typography textColor="warning.500">
                Unable to fetch models from API - showing {providerModels.length} known models
              </Typography>
            ) : apiModels.length > 0 ? (
              `${apiModels.length} models fetched from API`
            ) : (
              `Showing ${providerModels.length} known models for ${selectedProvider.name}`
            )}
          </FormHelperText>
        </FormControl>

        {/* API Models Error (non-critical) */}
        {apiModelsError && (
          <Alert
            color="warning"
            startDecorator={<WarningIcon />}
            variant="soft"
          >
            <Box>
              <Typography level="title-sm" fontWeight="bold">Model Fetch Warning</Typography>
              <Typography level="body-sm">
                {apiModelsError}
              </Typography>
              <Typography level="body-sm" sx={{ mt: 0.5 }}>
                You can still enter a model name manually from the {providerModels.length} known models.
              </Typography>
            </Box>
          </Alert>
        )}
      </Stack>
    </>
  )

  // Return wrapped or unwrapped based on standalone prop
  if (standalone) {
    return (
      <Sheet
        variant="outlined"
        sx={{
          p: 3,
          borderRadius: 'md',
          border: modelConfig.enableApi ? '2px solid' : '1px solid',
          borderColor: modelConfig.enableApi ? 'primary.500' : 'neutral.outlinedBorder',
          bgcolor: modelConfig.enableApi ? 'primary.softBg' : 'background.surface',
          transition: 'all 0.2s ease',
          '&:hover': {
            borderColor: modelConfig.enableApi ? 'primary.600' : 'neutral.outlinedHoverBorder',
          },
        }}
      >
        {cardContent}
      </Sheet>
    )
  }

  return cardContent
}
