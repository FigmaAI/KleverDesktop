import {
  Box,
  Typography,
  Sheet,
  Stack,
  FormControl,
  FormLabel,
  Slider,
  Switch,
  Tooltip,
} from '@mui/joy'
import { AgentSettings } from '@/hooks/useSettings'

interface AgentSettingsCardProps {
  agentSettings: AgentSettings
  setAgentSettings: (settings: AgentSettings) => void
}

export function AgentSettingsCard({ agentSettings, setAgentSettings }: AgentSettingsCardProps) {
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
        Agent Behavior
      </Typography>
      <Typography level="body-sm" textColor="text.secondary" sx={{ mb: 3 }}>
        Configure AI agent behavior and performance settings
      </Typography>

      <Stack spacing={3}>
        {/* Max Tokens */}
        <FormControl>
          <Box sx={{ display: 'flex', gap: 3, alignItems: 'center' }}>
            <Tooltip title="Maximum number of tokens the model can generate per response" arrow>
              <FormLabel sx={{ minWidth: 150 }}>Max Tokens</FormLabel>
            </Tooltip>
            <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', gap: 2 }}>
              <Slider
                value={agentSettings.maxTokens}
                onChange={(_, value) =>
                  setAgentSettings({
                    ...agentSettings,
                    maxTokens: value as number,
                  })
                }
                min={1024}
                max={8192}
                step={256}
                marks={false}
                valueLabelDisplay="on"
                sx={{ flex: 1 }}
              />
              <Typography level="body-sm" fontWeight="bold" sx={{ minWidth: 60, textAlign: 'right' }}>
                {agentSettings.maxTokens}
              </Typography>
            </Box>
          </Box>
        </FormControl>

        {/* Temperature */}
        <FormControl>
          <Box sx={{ display: 'flex', gap: 3, alignItems: 'center' }}>
            <Tooltip title="Controls randomness: 0 = more focused, 2 = more creative" arrow>
              <FormLabel sx={{ minWidth: 150 }}>Temperature</FormLabel>
            </Tooltip>
            <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', gap: 2 }}>
              <Slider
                value={agentSettings.temperature}
                onChange={(_, value) =>
                  setAgentSettings({
                    ...agentSettings,
                    temperature: value as number,
                  })
                }
                min={0.0}
                max={2.0}
                step={0.1}
                marks={false}
                valueLabelDisplay="on"
                sx={{ flex: 1 }}
              />
              <Typography level="body-sm" fontWeight="bold" sx={{ minWidth: 60, textAlign: 'right' }}>
                {agentSettings.temperature.toFixed(1)}
              </Typography>
            </Box>
          </Box>
        </FormControl>

        {/* Request Interval */}
        <FormControl>
          <Box sx={{ display: 'flex', gap: 3, alignItems: 'center' }}>
            <Tooltip title="Delay between consecutive model requests (to avoid rate limits)" arrow>
              <FormLabel sx={{ minWidth: 150 }}>Request Interval</FormLabel>
            </Tooltip>
            <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', gap: 2 }}>
              <Slider
                value={agentSettings.requestInterval}
                onChange={(_, value) =>
                  setAgentSettings({
                    ...agentSettings,
                    requestInterval: value as number,
                  })
                }
                min={1}
                max={30}
                step={1}
                marks={false}
                valueLabelDisplay="on"
                sx={{ flex: 1 }}
              />
              <Typography level="body-sm" fontWeight="bold" sx={{ minWidth: 60, textAlign: 'right' }}>
                {agentSettings.requestInterval}s
              </Typography>
            </Box>
          </Box>
        </FormControl>

        {/* Max Rounds */}
        <FormControl>
          <Box sx={{ display: 'flex', gap: 3, alignItems: 'center' }}>
            <Tooltip title="Maximum number of exploration rounds before stopping" arrow>
              <FormLabel sx={{ minWidth: 150 }}>Max Rounds</FormLabel>
            </Tooltip>
            <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', gap: 2 }}>
              <Slider
                value={agentSettings.maxRounds}
                onChange={(_, value) =>
                  setAgentSettings({
                    ...agentSettings,
                    maxRounds: value as number,
                  })
                }
                min={5}
                max={50}
                step={1}
                marks={false}
                valueLabelDisplay="on"
                sx={{ flex: 1 }}
              />
              <Typography level="body-sm" fontWeight="bold" sx={{ minWidth: 60, textAlign: 'right' }}>
                {agentSettings.maxRounds}
              </Typography>
            </Box>
          </Box>
        </FormControl>

        {/* Min Distance */}
        <FormControl>
          <Box sx={{ display: 'flex', gap: 3, alignItems: 'center' }}>
            <Tooltip title="Minimum pixel distance for UI element detection" arrow>
              <FormLabel sx={{ minWidth: 150 }}>Minimum Distance</FormLabel>
            </Tooltip>
            <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', gap: 2 }}>
              <Slider
                value={agentSettings.minDist}
                onChange={(_, value) =>
                  setAgentSettings({
                    ...agentSettings,
                    minDist: value as number,
                  })
                }
                min={10}
                max={100}
                step={5}
                marks={false}
                valueLabelDisplay="on"
                sx={{ flex: 1 }}
              />
              <Typography level="body-sm" fontWeight="bold" sx={{ minWidth: 60, textAlign: 'right' }}>
                {agentSettings.minDist}px
              </Typography>
            </Box>
          </Box>
        </FormControl>

        {/* Toggle Options */}
        <Box sx={{ display: 'grid', gap: 2 }}>
          <FormControl orientation="horizontal" sx={{ justifyContent: 'space-between' }}>
            <Box>
              <FormLabel>Document Refine</FormLabel>
              <Typography level="body-sm" textColor="text.secondary">
                Enable refinement of generated documentation
              </Typography>
            </Box>
            <Switch
              checked={agentSettings.docRefine}
              onChange={(e) =>
                setAgentSettings({
                  ...agentSettings,
                  docRefine: e.target.checked,
                })
              }
            />
          </FormControl>

          <FormControl orientation="horizontal" sx={{ justifyContent: 'space-between' }}>
            <Box>
              <FormLabel>Dark Mode (Agent)</FormLabel>
              <Typography level="body-sm" textColor="text.secondary">
                Use dark theme for agent-generated outputs
              </Typography>
            </Box>
            <Switch
              checked={agentSettings.darkMode}
              onChange={(e) =>
                setAgentSettings({
                  ...agentSettings,
                  darkMode: e.target.checked,
                })
              }
            />
          </FormControl>
        </Box>
      </Stack>
    </Sheet>
  )
}
