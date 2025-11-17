import { useState, useCallback, useEffect } from 'react'
import {
  Box,
  Typography,
  Sheet,
  Stack,
  FormControl,
  FormLabel,
  FormHelperText,
  Alert,
  Select,
  Option,
  IconButton,
  CircularProgress,
  Divider,
} from '@mui/joy'
import Checkbox from '@mui/joy/Checkbox'
import {
  Refresh as RefreshIcon,
} from '@mui/icons-material'
import { ModelConfig } from '@/types/setupWizard'
import { ApiModelCard } from './ApiModelCard'

interface ModelSettingsCardProps {
  modelConfig: ModelConfig
  setModelConfig: (config: ModelConfig) => void
}

export function ModelSettingsCard({ modelConfig, setModelConfig }: ModelSettingsCardProps) {
  // Ollama models state
  const [ollamaModels, setOllamaModels] = useState<string[]>([])
  const [ollamaLoading, setOllamaLoading] = useState(false)
  const [ollamaError, setOllamaError] = useState<string>('')

  // API models state (for ApiModelCard)
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

      if (result.success && result.running && result.models) {
        const modelNames = result.models.map((model: { name?: string } | string) =>
          typeof model === 'string' ? model : (model.name || '')
        )
        setOllamaModels(modelNames)

        // Auto-select first model if none selected
        if (modelNames.length > 0 && !modelConfig.localModel) {
          setModelConfig({ ...modelConfig, localModel: modelNames[0] })
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
  }, [modelConfig, setModelConfig])

  // Fetch API models from provider (legacy support)
  const fetchApiModels = useCallback(async () => {
    if (!modelConfig.apiBaseUrl && !modelConfig.apiProvider) {
      setApiModelsError('Please select a provider first')
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
        apiBaseUrl: modelConfig.apiBaseUrl || '',
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
  }, [modelConfig.apiBaseUrl, modelConfig.apiKey, modelConfig.apiProvider])

  // Auto-fetch Ollama models when enabled
  useEffect(() => {
    if (modelConfig.enableLocal) {
      fetchOllamaModels()
    }
  }, [modelConfig.enableLocal, fetchOllamaModels])

  return (
    <Sheet
      variant="outlined"
      sx={{
        p: 3,
        borderRadius: 'md',
        bgcolor: 'background.surface',
      }}
    >
      <Typography level="title-lg" sx={{ mb: 1 }}>
        Model Configuration
      </Typography>
      <Typography level="body-sm" textColor="text.secondary" sx={{ mb: 3 }}>
        Configure AI model providers for automation tasks
      </Typography>

      <Stack spacing={3}>
        {/* Local Model (Ollama) Section */}
        <Box
          sx={{
            p: 2.5,
            borderRadius: 'md',
            border: '2px solid',
            borderColor: modelConfig.enableLocal ? 'primary.500' : 'neutral.outlinedBorder',
            bgcolor: modelConfig.enableLocal ? 'primary.softBg' : 'background.surface',
            transition: 'all 0.2s ease',
          }}
        >
          <Box sx={{ mb: 2 }}>
            <Checkbox
              label={
                <Typography level="title-md" fontWeight="bold">
                  Local Model (Ollama)
                </Typography>
              }
              checked={modelConfig.enableLocal}
              onChange={(e) =>
                setModelConfig({ ...modelConfig, enableLocal: e.target.checked })
              }
              sx={{ mb: 0.5 }}
            />
            <Typography level="body-sm" textColor="text.secondary" sx={{ ml: 4 }}>
              Use locally hosted Ollama models for privacy and offline access
            </Typography>
          </Box>

          <Stack spacing={2}>
            <FormControl>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                <FormLabel>Select Model</FormLabel>
                <IconButton
                  size="sm"
                  variant="plain"
                  color="primary"
                  onClick={fetchOllamaModels}
                  disabled={!modelConfig.enableLocal || ollamaLoading}
                >
                  <RefreshIcon />
                </IconButton>
              </Box>
              {ollamaLoading ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1.5 }}>
                  <CircularProgress size="sm" />
                  <Typography level="body-sm">Loading models...</Typography>
                </Box>
              ) : ollamaError ? (
                <Alert color="warning" variant="soft" size="sm">
                  {ollamaError}
                </Alert>
              ) : (
                <Select
                  value={modelConfig.localModel}
                  onChange={(_, value) => setModelConfig({ ...modelConfig, localModel: value || '' })}
                  disabled={!modelConfig.enableLocal || ollamaModels.length === 0}
                  placeholder={ollamaModels.length === 0 ? 'No models found' : 'Select a model'}
                >
                  {ollamaModels.map((model) => (
                    <Option key={model} value={model}>
                      {model}
                    </Option>
                  ))}
                </Select>
              )}
              <FormHelperText>
                {ollamaModels.length > 0
                  ? `${ollamaModels.length} model(s) available`
                  : 'Install models using: ollama pull <model-name>'}
              </FormHelperText>
            </FormControl>
          </Stack>
        </Box>

        <Divider />

        {/* API Model Section - Use ApiModelCard with custom styling */}
        <Box
          sx={{
            p: 2.5,
            borderRadius: 'md',
            border: '2px solid',
            borderColor: modelConfig.enableApi ? 'primary.500' : 'neutral.outlinedBorder',
            bgcolor: modelConfig.enableApi ? 'primary.softBg' : 'background.surface',
            transition: 'all 0.2s ease',
          }}
        >
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

          <ApiModelCard
            modelConfig={modelConfig}
            setModelConfig={setModelConfig}
            apiModels={apiModels}
            apiModelsLoading={apiModelsLoading}
            apiModelsError={apiModelsError}
            detectedProvider={detectedProvider}
            fetchApiModels={fetchApiModels}
            showCheckbox={false}
            standalone={false}
          />
        </Box>
      </Stack>
    </Sheet>
  )
}
