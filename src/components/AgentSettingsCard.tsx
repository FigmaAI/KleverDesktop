import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { AgentSettings } from '@/hooks/useSettings'

interface AgentSettingsCardProps {
  agentSettings: AgentSettings
  setAgentSettings: (settings: AgentSettings) => void
}

export function AgentSettingsCard({ agentSettings, setAgentSettings }: AgentSettingsCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Agent Behavior</CardTitle>
        <CardDescription>Configure AI agent behavior and performance settings</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <TooltipProvider>
          {/* Max Tokens */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Label className="cursor-help">Max Tokens</Label>
                </TooltipTrigger>
                <TooltipContent>
                  Maximum number of tokens the model can generate per response
                </TooltipContent>
              </Tooltip>
              <span className="text-sm font-semibold">{agentSettings.maxTokens}</span>
            </div>
            <Slider
              value={[agentSettings.maxTokens]}
              onValueChange={(value) =>
                setAgentSettings({
                  ...agentSettings,
                  maxTokens: value[0],
                })
              }
              min={1024}
              max={8192}
              step={256}
              className="w-full"
            />
          </div>

          {/* Temperature */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Label className="cursor-help">Temperature</Label>
                </TooltipTrigger>
                <TooltipContent>
                  Controls randomness: 0 = more focused, 2 = more creative
                </TooltipContent>
              </Tooltip>
              <span className="text-sm font-semibold">
                {agentSettings.temperature.toFixed(1)}
              </span>
            </div>
            <Slider
              value={[agentSettings.temperature]}
              onValueChange={(value) =>
                setAgentSettings({
                  ...agentSettings,
                  temperature: value[0],
                })
              }
              min={0.0}
              max={2.0}
              step={0.1}
              className="w-full"
            />
          </div>

          {/* Request Interval */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Label className="cursor-help">Request Interval</Label>
                </TooltipTrigger>
                <TooltipContent>
                  Delay between consecutive model requests (to avoid rate limits)
                </TooltipContent>
              </Tooltip>
              <span className="text-sm font-semibold">{agentSettings.requestInterval}s</span>
            </div>
            <Slider
              value={[agentSettings.requestInterval]}
              onValueChange={(value) =>
                setAgentSettings({
                  ...agentSettings,
                  requestInterval: value[0],
                })
              }
              min={1}
              max={30}
              step={1}
              className="w-full"
            />
          </div>

          {/* Max Rounds */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Label className="cursor-help">Max Rounds</Label>
                </TooltipTrigger>
                <TooltipContent>
                  Maximum number of exploration rounds before stopping
                </TooltipContent>
              </Tooltip>
              <span className="text-sm font-semibold">{agentSettings.maxRounds}</span>
            </div>
            <Slider
              value={[agentSettings.maxRounds]}
              onValueChange={(value) =>
                setAgentSettings({
                  ...agentSettings,
                  maxRounds: value[0],
                })
              }
              min={5}
              max={50}
              step={1}
              className="w-full"
            />
          </div>

          {/* Min Distance */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Label className="cursor-help">Minimum Distance</Label>
                </TooltipTrigger>
                <TooltipContent>Minimum pixel distance for UI element detection</TooltipContent>
              </Tooltip>
              <span className="text-sm font-semibold">{agentSettings.minDist}px</span>
            </div>
            <Slider
              value={[agentSettings.minDist]}
              onValueChange={(value) =>
                setAgentSettings({
                  ...agentSettings,
                  minDist: value[0],
                })
              }
              min={10}
              max={100}
              step={5}
              className="w-full"
            />
          </div>

          {/* Toggle Options */}
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <Label>Document Refine</Label>
                <p className="text-sm text-muted-foreground">
                  Enable refinement of generated documentation
                </p>
              </div>
              <Switch
                checked={agentSettings.docRefine}
                onCheckedChange={(checked) =>
                  setAgentSettings({
                    ...agentSettings,
                    docRefine: checked,
                  })
                }
              />
            </div>

            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <Label>Dark Mode (Agent)</Label>
                <p className="text-sm text-muted-foreground">
                  Use dark theme for agent-generated outputs
                </p>
              </div>
              <Switch
                checked={agentSettings.darkMode}
                onCheckedChange={(checked) =>
                  setAgentSettings({
                    ...agentSettings,
                    darkMode: checked,
                  })
                }
              />
            </div>
          </div>
        </TooltipProvider>
      </CardContent>
    </Card>
  )
}
