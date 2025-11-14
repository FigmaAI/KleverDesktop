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
  Autocomplete,
  IconButton,
} from '@mui/joy'
import Checkbox from '@mui/joy/Checkbox'
import {
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material'
import { ModelConfig, TestStatus } from '@/types/setupWizard'

interface ApiModelCardProps {
  modelConfig: ModelConfig
  setModelConfig: (config: ModelConfig) => void
  apiModels: string[]
  apiModelsLoading: boolean
  apiModelsError: string
  detectedProvider: string
  fetchApiModels: () => void
  testStatus: TestStatus
  testMessage: string
  onTestConnection: () => void
}

export function ApiModelCard({
  modelConfig,
  setModelConfig,
  apiModels,
  apiModelsLoading,
  apiModelsError,
  detectedProvider,
  fetchApiModels,
  testStatus,
  testMessage,
  onTestConnection,
}: ApiModelCardProps) {
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
          onClick={onTestConnection}
          loading={testStatus === 'testing'}
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

        {testStatus !== 'idle' && testStatus !== 'testing' && (
          <Alert
            color={testStatus === 'success' ? 'success' : 'danger'}
            startDecorator={testStatus === 'success' ? <CheckCircleIcon /> : <WarningIcon />}
          >
            {testMessage}
          </Alert>
        )}
      </Stack>
    </Sheet>
  )
}
