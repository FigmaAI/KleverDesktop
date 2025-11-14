import {
  Box,
  Typography,
  Sheet,
  Stack,
  FormControl,
  FormLabel,
  FormHelperText,
  Slider,
  Switch,
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
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <FormLabel>Max Tokens</FormLabel>
            <Typography level="body-sm" fontWeight="bold">
              {agentSettings.maxTokens}
            </Typography>
          </Box>
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
            marks={[
              { value: 1024, label: '1K' },
              { value: 4096, label: '4K' },
              { value: 8192, label: '8K' },
            ]}
          />
          <FormHelperText>
            Maximum number of tokens the model can generate per response
          </FormHelperText>
        </FormControl>

        {/* Temperature */}
        <FormControl>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <FormLabel>Temperature</FormLabel>
            <Typography level="body-sm" fontWeight="bold">
              {agentSettings.temperature.toFixed(1)}
            </Typography>
          </Box>
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
            marks={[
              { value: 0.0, label: '0.0 (Deterministic)' },
              { value: 1.0, label: '1.0' },
              { value: 2.0, label: '2.0 (Creative)' },
            ]}
          />
          <FormHelperText>
            Controls randomness: 0 = more focused, 2 = more creative
          </FormHelperText>
        </FormControl>

        {/* Request Interval */}
        <FormControl>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <FormLabel>Request Interval</FormLabel>
            <Typography level="body-sm" fontWeight="bold">
              {agentSettings.requestInterval}s
            </Typography>
          </Box>
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
            marks={[
              { value: 1, label: '1s' },
              { value: 10, label: '10s' },
              { value: 30, label: '30s' },
            ]}
          />
          <FormHelperText>
            Delay between consecutive model requests (to avoid rate limits)
          </FormHelperText>
        </FormControl>

        {/* Max Rounds */}
        <FormControl>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <FormLabel>Max Rounds</FormLabel>
            <Typography level="body-sm" fontWeight="bold">
              {agentSettings.maxRounds}
            </Typography>
          </Box>
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
            marks={[
              { value: 5, label: '5' },
              { value: 20, label: '20' },
              { value: 50, label: '50' },
            ]}
          />
          <FormHelperText>
            Maximum number of exploration rounds before stopping
          </FormHelperText>
        </FormControl>

        {/* Min Distance */}
        <FormControl>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <FormLabel>Minimum Distance</FormLabel>
            <Typography level="body-sm" fontWeight="bold">
              {agentSettings.minDist}px
            </Typography>
          </Box>
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
            marks={[
              { value: 10, label: '10px' },
              { value: 30, label: '30px' },
              { value: 100, label: '100px' },
            ]}
          />
          <FormHelperText>
            Minimum pixel distance for UI element detection
          </FormHelperText>
        </FormControl>

        {/* Toggle Options */}
        <Box sx={{ display: 'grid', gap: 2 }}>
          <FormControl orientation="horizontal" sx={{ justifyContent: 'space-between' }}>
            <Box>
              <FormLabel>Document Refine</FormLabel>
              <FormHelperText>
                Enable refinement of generated documentation
              </FormHelperText>
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
              <FormHelperText>
                Use dark theme for agent-generated outputs
              </FormHelperText>
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
