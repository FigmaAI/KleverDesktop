import { useState, useCallback, useEffect } from 'react'
import {
  Box,
  Typography,
  Sheet,
  Stack,
  Button,
  FormControl,
  FormLabel,
  FormHelperText,
  Alert,
  Input,
  Select,
  Option,
  Autocomplete,
  IconButton,
  CircularProgress,
  Divider,
} from '@mui/joy'
import Checkbox from '@mui/joy/Checkbox'
import {
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material'
import { ModelConfig, TestStatus } from '@/types/setupWizard'

interface ModelSettingsCardProps {
  modelConfig: ModelConfig
  setModelConfig: (config: ModelConfig) => void
}

export function ModelSettingsCard({ modelConfig, setModelConfig }: ModelSettingsCardProps) {
  // Ollama models state
  const [ollamaModels, setOllamaModels] = useState<string[]>([])
  const [ollamaLoading, setOllamaLoading] = useState(false)
  const [ollamaError, setOllamaError] = useState<string>('')

  // API models state
  const [apiModels, setApiModels] = useState<string[]>([])
  const [apiModelsLoading, setApiModelsLoading] = useState(false)
  const [apiModelsError, setApiModelsError] = useState<string>('')
  const [detectedProvider, setDetectedProvider] = useState<string>('')

  // Test status state
  const [localTestStatus, setLocalTestStatus] = useState<TestStatus>('idle')
  const [localTestMessage, setLocalTestMessage] = useState<string>('')
  const [apiTestStatus, setApiTestStatus] = useState<TestStatus>('idle')
  const [apiTestMessage, setApiTestMessage] = useState<string>('')

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

  // Test local connection
  const handleTestLocalConnection = useCallback(async () => {
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
  }, [modelConfig.localBaseUrl, modelConfig.localModel])

  // Test API connection
  const handleTestApiConnection = useCallback(async () => {
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
  }, [modelConfig.apiBaseUrl, modelConfig.apiKey, modelConfig.apiModel])

  // Auto-fetch Ollama models when enabled
  useEffect(() => {
    if (modelConfig.enableLocal) {
      fetchOllamaModels()
    }
  }, [modelConfig.enableLocal, fetchOllamaModels])

  // Auto-fetch API models when URL or key changes (with debounce)
  useEffect(() => {
    if (modelConfig.enableApi && modelConfig.apiBaseUrl) {
      const timeoutId = window.setTimeout(() => {
        fetchApiModels()
      }, 500) // Debounce API calls

      return () => window.clearTimeout(timeoutId)
    }
  }, [modelConfig.enableApi, modelConfig.apiBaseUrl, modelConfig.apiKey, fetchApiModels])

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

            <Button
              variant="outlined"
              color="primary"
              onClick={handleTestLocalConnection}
              loading={localTestStatus === 'testing'}
              disabled={!modelConfig.enableLocal}
              fullWidth
            >
              Test Connection
            </Button>

            {localTestStatus !== 'idle' && localTestStatus !== 'testing' && (
              <Alert
                color={localTestStatus === 'success' ? 'success' : 'danger'}
                startDecorator={localTestStatus === 'success' ? <CheckCircleIcon /> : <WarningIcon />}
              >
                {localTestMessage}
              </Alert>
            )}
          </Stack>
        </Box>

        <Divider />

        {/* API Model Section */}
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
                  API Model (OpenAI, OpenRouter, etc.)
                </Typography>
              }
              checked={modelConfig.enableApi}
              onChange={(e) =>
                setModelConfig({ ...modelConfig, enableApi: e.target.checked })
              }
              sx={{ mb: 0.5 }}
            />
            <Typography level="body-sm" textColor="text.secondary" sx={{ ml: 4 }}>
              Connect to cloud-based AI services for powerful performance
            </Typography>
          </Box>

          <Stack spacing={2}>
            <FormControl>
              <FormLabel>API Base URL</FormLabel>
              <Input
                value={modelConfig.apiBaseUrl}
                onChange={(e) => setModelConfig({ ...modelConfig, apiBaseUrl: e.target.value })}
                placeholder="https://api.openai.com/v1/chat/completions"
                disabled={!modelConfig.enableApi}
              />
              <FormHelperText>OpenAI-compatible API endpoint</FormHelperText>
            </FormControl>

            <FormControl>
              <FormLabel>API Key</FormLabel>
              <Input
                type="password"
                value={modelConfig.apiKey}
                onChange={(e) => setModelConfig({ ...modelConfig, apiKey: e.target.value })}
                placeholder="sk-..."
                disabled={!modelConfig.enableApi}
              />
              <FormHelperText>Your API key</FormHelperText>
            </FormControl>

            <FormControl>
              <FormLabel>
                Model Name
                {detectedProvider && ` (${detectedProvider})`}
              </FormLabel>
              <Stack direction="row" spacing={1}>
                <Autocomplete
                  placeholder="Enter or select model"
                  value={modelConfig.apiModel}
                  onChange={(_, newValue) => {
                    setModelConfig({ ...modelConfig, apiModel: newValue || '' })
                  }}
                  onInputChange={(_, newValue) => {
                    setModelConfig({ ...modelConfig, apiModel: newValue })
                  }}
                  options={apiModels}
                  freeSolo
                  disabled={!modelConfig.enableApi || !modelConfig.apiKey}
                  loading={apiModelsLoading}
                  sx={{ flex: 1 }}
                />
                <IconButton
                  onClick={fetchApiModels}
                  disabled={!modelConfig.enableApi || !modelConfig.apiBaseUrl || !modelConfig.apiKey || apiModelsLoading}
                  variant="outlined"
                  color="neutral"
                >
                  <RefreshIcon />
                </IconButton>
              </Stack>
              <FormHelperText>
                {apiModelsError
                  ? 'Unable to fetch models - please check details below'
                  : apiModels.length > 0
                    ? `${apiModels.length} models available`
                    : 'Enter model name or fetch from API'}
              </FormHelperText>
            </FormControl>

            <Button
              variant="outlined"
              color="primary"
              onClick={handleTestApiConnection}
              loading={apiTestStatus === 'testing'}
              disabled={!modelConfig.enableApi}
              fullWidth
            >
              Test Connection
            </Button>

            {apiModelsError && (
              <Alert
                color="warning"
                startDecorator={<WarningIcon />}
                variant="soft"
              >
                <Box>
                  <Typography level="title-sm" fontWeight="bold">Model Fetch Error</Typography>
                  <Typography level="body-sm">{apiModelsError}</Typography>
                </Box>
              </Alert>
            )}

            {apiTestStatus !== 'idle' && apiTestStatus !== 'testing' && (
              <Alert
                color={apiTestStatus === 'success' ? 'success' : 'danger'}
                startDecorator={apiTestStatus === 'success' ? <CheckCircleIcon /> : <WarningIcon />}
              >
                {apiTestMessage}
              </Alert>
            )}
          </Stack>
        </Box>
      </Stack>
    </Sheet>
  )
}
