import { motion } from 'framer-motion'
import { Typography, Sheet, Stack, Alert } from '@mui/joy'
import { LocalModelCard } from './LocalModelCard'
import { ApiModelCard } from './ApiModelCard'
import { ModelConfig, TestStatus } from '../../types'

interface ModelConfigStepProps {
  modelConfig: ModelConfig
  setModelConfig: (config: ModelConfig) => void
  ollamaModels: string[]
  ollamaLoading: boolean
  ollamaError: string
  fetchOllamaModels: () => void
  localTestStatus: TestStatus
  localTestMessage: string
  onTestLocalConnection: () => void
  apiModels: string[]
  apiModelsLoading: boolean
  apiModelsError: string
  detectedProvider: string
  fetchApiModels: () => void
  apiTestStatus: TestStatus
  apiTestMessage: string
  onTestApiConnection: () => void
}

export function ModelConfigStep({
  modelConfig,
  setModelConfig,
  ollamaModels,
  ollamaLoading,
  ollamaError,
  fetchOllamaModels,
  localTestStatus,
  localTestMessage,
  onTestLocalConnection,
  apiModels,
  apiModelsLoading,
  apiModelsError,
  detectedProvider,
  fetchApiModels,
  apiTestStatus,
  apiTestMessage,
  onTestApiConnection,
}: ModelConfigStepProps) {
  return (
    <motion.div
      key="step-1"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
    >
      <Sheet
        variant="outlined"
        sx={{
          p: 3,
          borderRadius: 'md',
          bgcolor: 'background.surface',
        }}
      >
        <Typography level="h4" fontWeight="bold" sx={{ mb: 1 }}>
          Model Configuration
        </Typography>
        <Typography level="body-sm" textColor="text.secondary" sx={{ mb: 3 }}>
          Choose and configure your AI model provider
        </Typography>

        <Stack spacing={3}>
          {/* Helper text */}
          {!modelConfig.enableLocal && !modelConfig.enableApi && (
            <Alert color="warning" variant="soft">
              Please select at least one model provider
            </Alert>
          )}

          {/* Local Model Card */}
          <LocalModelCard
            modelConfig={modelConfig}
            setModelConfig={setModelConfig}
            ollamaModels={ollamaModels}
            ollamaLoading={ollamaLoading}
            ollamaError={ollamaError}
            fetchOllamaModels={fetchOllamaModels}
            testStatus={localTestStatus}
            testMessage={localTestMessage}
            onTestConnection={onTestLocalConnection}
          />

          {/* API Model Card */}
          <ApiModelCard
            modelConfig={modelConfig}
            setModelConfig={setModelConfig}
            apiModels={apiModels}
            apiModelsLoading={apiModelsLoading}
            apiModelsError={apiModelsError}
            detectedProvider={detectedProvider}
            fetchApiModels={fetchApiModels}
            testStatus={apiTestStatus}
            testMessage={apiTestMessage}
            onTestConnection={onTestApiConnection}
          />
        </Stack>
      </Sheet>
    </motion.div>
  )
}
