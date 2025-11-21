import { RefreshCw } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { cn } from '@/lib/utils'
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
    <Card
      className={cn(
        'transition-all',
        modelConfig.enableLocal
          ? 'border-2 border-primary bg-primary/5'
          : 'border hover:border-primary/50'
      )}
    >
      <CardContent className="pt-6">
        <div className="mb-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="enable-local-model"
              checked={modelConfig.enableLocal}
              onCheckedChange={(checked) =>
                setModelConfig({ ...modelConfig, enableLocal: checked as boolean })
              }
            />
            <Label htmlFor="enable-local-model" className="text-base font-semibold">
              Local Model (Ollama)
            </Label>
          </div>
          <p className="ml-6 mt-1 text-sm text-muted-foreground">
            Use locally hosted Ollama models for privacy and offline access
          </p>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Select Model</Label>
              <Button
                size="sm"
                variant="ghost"
                onClick={fetchOllamaModels}
                disabled={!modelConfig.enableLocal || ollamaLoading}
              >
                <RefreshCw className={cn('h-4 w-4', ollamaLoading && 'animate-spin')} />
              </Button>
            </div>

            {ollamaLoading ? (
              <div className="flex items-center gap-2 rounded-md bg-muted p-3">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                <span className="text-sm">Loading models...</span>
              </div>
            ) : ollamaError ? (
              <Alert variant="warning">
                <AlertDescription>{ollamaError}</AlertDescription>
              </Alert>
            ) : (
              <Select
                value={modelConfig.localModel}
                onValueChange={(value) => setModelConfig({ ...modelConfig, localModel: value })}
                disabled={!modelConfig.enableLocal || ollamaModels.length === 0}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={ollamaModels.length === 0 ? 'No models found' : 'Select a model'}
                  />
                </SelectTrigger>
                <SelectContent>
                  {ollamaModels.map((model) => (
                    <SelectItem key={model} value={model}>
                      {model}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <p className="text-sm text-muted-foreground">
              {ollamaModels.length > 0
                ? `${ollamaModels.length} model(s) available`
                : 'Install models using: ollama pull <model-name>'}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
