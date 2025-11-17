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
} from '@mui/joy'
import Checkbox from '@mui/joy/Checkbox'
import {
  Refresh as RefreshIcon,
} from '@mui/icons-material'
import { ModelConfig } from '@/types/setupWizard'

interface LocalModelCardProps {
  modelConfig: ModelConfig
  setModelConfig: (config: ModelConfig) => void
  ollamaModels: string[]
  ollamaLoading: boolean
  ollamaError: string
  fetchOllamaModels: () => void
}

export function LocalModelCard({
  modelConfig,
  setModelConfig,
  ollamaModels,
  ollamaLoading,
  ollamaError,
  fetchOllamaModels,
}: LocalModelCardProps) {
  return (
    <Sheet
      variant="outlined"
      sx={{
        p: 3,
        borderRadius: 'md',
        border: modelConfig.enableLocal ? '2px solid' : '1px solid',
        borderColor: modelConfig.enableLocal ? 'primary.500' : 'neutral.outlinedBorder',
        bgcolor: modelConfig.enableLocal ? 'primary.softBg' : 'background.surface',
        transition: 'all 0.2s ease',
        '&:hover': {
          borderColor: modelConfig.enableLocal ? 'primary.600' : 'neutral.outlinedHoverBorder',
        },
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
    </Sheet>
  )
}
