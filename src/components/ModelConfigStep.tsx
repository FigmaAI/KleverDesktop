import { BlurFade } from '@/components/magicui/blur-fade'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { LocalModelCard } from './LocalModelCard'
import { ApiModelCard } from './ApiModelCard'
import { ModelConfig } from '@/types/setupWizard'

interface ModelConfigStepProps {
  modelConfig: ModelConfig
  setModelConfig: (config: ModelConfig) => void
  ollamaModels: string[]
  ollamaLoading: boolean
  ollamaError: string
  fetchOllamaModels: () => void
  apiModels: string[]
  apiModelsLoading: boolean
  apiModelsError: string
  detectedProvider: string
  fetchApiModels: () => void
}

export function ModelConfigStep({
  modelConfig,
  setModelConfig,
  ollamaModels,
  ollamaLoading,
  ollamaError,
  fetchOllamaModels,
  apiModels,
  apiModelsLoading,
  apiModelsError,
  detectedProvider,
  fetchApiModels,
}: ModelConfigStepProps) {
  return (
    <BlurFade key="step-1" delay={0.1}>
      <Card>
        <CardHeader>
          <CardTitle>Model Configuration</CardTitle>
          <CardDescription>Choose and configure your AI model provider</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Helper text */}
            {!modelConfig.enableLocal && !modelConfig.enableApi && (
              <Alert variant="warning">
                <AlertDescription>Please select at least one model provider</AlertDescription>
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
            />
          </div>
        </CardContent>
      </Card>
    </BlurFade>
  )
}
