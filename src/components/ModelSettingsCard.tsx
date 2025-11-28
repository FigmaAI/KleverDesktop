import { useState, useCallback, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  ExternalLink,
  Eye,
  EyeOff,
  Brain,
  Zap,
  CheckCircle,
  XCircle,
  Loader2,
  Plus,
  Pencil,
  Trash2,
  Monitor,
  Cloud,
} from 'lucide-react'
import { ModelSelector, ModelSelection } from './ModelSelector'
import { ProviderConfig, MultiProviderModelSettings } from '@/types/setupWizard'
import { useLiteLLMProviders } from '@/hooks/useLiteLLMProviders'

interface ModelSettingsCardProps {
  modelConfig: MultiProviderModelSettings
  setModelConfig: (config: MultiProviderModelSettings) => void
  onValidationChange?: (isValid: boolean) => void
}

export function ModelSettingsCard({ modelConfig, setModelConfig, onValidationChange }: ModelSettingsCardProps) {
  const { getProvider } = useLiteLLMProviders()
  
  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingProvider, setEditingProvider] = useState<ProviderConfig | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [providerToDelete, setProviderToDelete] = useState<string | null>(null)
  
  // Form state for add/edit dialog
  const [formProvider, setFormProvider] = useState('')
  const [formModel, setFormModel] = useState('')
  const [formApiKey, setFormApiKey] = useState('')
  const [formBaseUrl, setFormBaseUrl] = useState('')
  const [showApiKey, setShowApiKey] = useState(false)
  
  // Connection test state
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const [apiKeyValidated, setApiKeyValidated] = useState(false)

  // Validation - at least one provider must be configured
  const isValid = modelConfig.providers.length > 0 && modelConfig.providers.some(p => {
    if (p.id === 'ollama') return !!p.preferredModel
    return !!p.apiKey && !!p.preferredModel
  })
  
  // Notify parent of validation state changes (must be in useEffect to avoid setState during render)
  useEffect(() => {
    onValidationChange?.(isValid)
  }, [isValid, onValidationChange])

  // Get provider display name
  const getProviderDisplayName = (providerId: string) => {
    const providerInfo = getProvider(providerId)
    return providerInfo?.name || providerId
  }

  // Mask API key for display
  const maskApiKey = (key: string) => {
    if (!key) return '-'
    if (key.length <= 8) return '••••••••'
    return key.slice(0, 4) + '••••••••' + key.slice(-4)
  }

  // Open add provider dialog
  const handleAddProvider = () => {
    setEditingProvider(null)
    setFormProvider('')
    setFormModel('')
    setFormApiKey('')
    setFormBaseUrl('')
    setTestResult(null)
    setApiKeyValidated(false)
    setDialogOpen(true)
  }

  // Open edit provider dialog
  const handleEditProvider = (provider: ProviderConfig) => {
    setEditingProvider(provider)
    setFormProvider(provider.id)
    setFormModel(provider.preferredModel)
    setFormApiKey(provider.apiKey)
    setFormBaseUrl(provider.baseUrl || '')
    setTestResult(null)
    setApiKeyValidated(provider.id === 'ollama' || !!provider.apiKey)
    setDialogOpen(true)
  }

  // Handle model selection change in dialog
  const handleModelChange = (selection: ModelSelection) => {
    setFormProvider(selection.provider)
    setFormModel(selection.model)
    setTestResult(null)
    setApiKeyValidated(selection.provider === 'ollama')
    
    // Set default base URL for provider
    if (selection.provider === 'ollama') {
      setFormBaseUrl('http://localhost:11434')
      setFormApiKey('')
    } else {
      const providerInfo = getProvider(selection.provider)
      setFormBaseUrl(providerInfo?.defaultBaseUrl || '')
    }
  }

  // Test API connection
  const handleTestConnection = useCallback(async () => {
    if (!formProvider || !formModel) {
      setTestResult({ success: false, message: 'Please select a provider and model first' })
      return
    }

    if (formProvider !== 'ollama' && !formApiKey) {
      setTestResult({ success: false, message: 'Please enter an API key' })
      return
    }

    setTesting(true)
    setTestResult(null)

    try {
      const result = await window.electronAPI.testModelConnection({
        provider: formProvider,
        model: formModel,
        apiKey: formApiKey,
        baseUrl: formBaseUrl,
      })
      const success = result.success
      setTestResult({ 
        success, 
        message: result.message || (success ? 'Connection successful!' : 'Connection failed') 
      })
      if (success) {
        setApiKeyValidated(true)
      }
    } catch (error) {
      setTestResult({ 
        success: false, 
        message: error instanceof Error ? error.message : 'Connection test failed' 
      })
    } finally {
      setTesting(false)
    }
  }, [formProvider, formModel, formApiKey, formBaseUrl])

  // Save provider (add or update)
  const handleSaveProvider = () => {
    if (!formProvider || !formModel) return
    if (formProvider !== 'ollama' && !apiKeyValidated) return

    const newProvider: ProviderConfig = {
      id: formProvider,
      apiKey: formApiKey,
      preferredModel: formModel,
      baseUrl: formBaseUrl || undefined,
    }

    let newProviders: ProviderConfig[]

    if (editingProvider) {
      // Update existing provider
      // Remove the original provider first
      newProviders = modelConfig.providers.filter(p => p.id !== editingProvider.id)

      // Check if the new provider ID already exists (in case user changed the provider)
      const existingIndex = newProviders.findIndex(p => p.id === formProvider)
      if (existingIndex >= 0) {
        // Replace existing provider with same ID
        newProviders[existingIndex] = newProvider
      } else {
        // Add as new provider
        newProviders.push(newProvider)
      }
    } else {
      // Check if provider already exists
      const existingIndex = modelConfig.providers.findIndex(p => p.id === formProvider)
      if (existingIndex >= 0) {
        // Replace existing
        newProviders = [...modelConfig.providers]
        newProviders[existingIndex] = newProvider
      } else {
        // Add new
        newProviders = [...modelConfig.providers, newProvider]
      }
    }

    setModelConfig({
      ...modelConfig,
      providers: newProviders,
    })
    
    setDialogOpen(false)
  }

  // Confirm delete provider
  const handleConfirmDelete = (providerId: string) => {
    setProviderToDelete(providerId)
    setDeleteDialogOpen(true)
  }

  // Delete provider
  const handleDeleteProvider = () => {
    if (!providerToDelete) return
    
    const newProviders = modelConfig.providers.filter(p => p.id !== providerToDelete)
    
    // Update lastUsed if we're deleting the last used provider
    let newLastUsed = modelConfig.lastUsed
    if (modelConfig.lastUsed?.provider === providerToDelete) {
      newLastUsed = newProviders.length > 0 
        ? { provider: newProviders[0].id, model: newProviders[0].preferredModel }
        : undefined
    }
    
    setModelConfig({
      ...modelConfig,
      providers: newProviders,
      lastUsed: newLastUsed,
    })
    
    setDeleteDialogOpen(false)
    setProviderToDelete(null)
  }

  const isOllama = formProvider === 'ollama'
  const providerInfo = getProvider(formProvider)
  const canSave = formProvider && formModel && (isOllama || apiKeyValidated)

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5" />
                Model Configuration
              </CardTitle>
              <CardDescription>
                Manage your AI model providers.
              </CardDescription>
            </div>
            <Button size="sm" onClick={handleAddProvider}>
              <Plus className="h-4 w-4 mr-1" />
              Add Provider
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {modelConfig.providers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No providers configured yet.</p>
              <p className="text-sm">Click &ldquo;Add Provider&rdquo; to get started.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Provider</TableHead>
                  <TableHead>API Key</TableHead>
                  <TableHead>Preferred Model</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {modelConfig.providers.map((provider) => (
                  <TableRow key={provider.id}>
                    <TableCell className="font-medium">
                      <span className="flex items-center gap-1.5">
                        {provider.id === 'ollama' ? (
                          <Monitor className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <Cloud className="h-4 w-4 text-muted-foreground" />
                        )}
                        {getProviderDisplayName(provider.id)}
                      </span>
                    </TableCell>
                    <TableCell className="font-mono text-sm text-muted-foreground">
                      {provider.id === 'ollama' ? '(Not required)' : maskApiKey(provider.apiKey)}
                    </TableCell>
                    <TableCell className="text-sm">{provider.preferredModel}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleEditProvider(provider)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => handleConfirmDelete(provider.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Provider Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {editingProvider ? 'Edit Provider' : 'Add Provider'}
            </DialogTitle>
            <DialogDescription>
              {editingProvider 
                ? 'Update the configuration for this provider.'
                : 'Configure a new AI model provider.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Model Selector */}
            <div className="space-y-2">
              <Label>Provider & Model</Label>
              <ModelSelector
                value={formProvider && formModel ? { provider: formProvider, model: formModel } : undefined}
                onChange={handleModelChange}
              />
            </div>

            {/* API Key (non-Ollama only) */}
            {formProvider && !isOllama && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>API Key</Label>
                  {providerInfo?.apiKeyUrl && (
                    <Button
                      variant="link"
                      size="sm"
                      className="h-auto p-0 text-xs"
                      onClick={() => window.electronAPI.openExternal(providerInfo.apiKeyUrl)}
                    >
                      Get API Key <ExternalLink className="ml-1 h-3 w-3" />
                    </Button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Input
                      type={showApiKey ? 'text' : 'password'}
                      placeholder="Enter your API key"
                      value={formApiKey}
                      onChange={(e) => {
                        setFormApiKey(e.target.value)
                        setTestResult(null)
                        setApiKeyValidated(false)
                      }}
                      className="pr-10"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => setShowApiKey(!showApiKey)}
                    >
                      {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  <Button
                    variant="outline"
                    size="default"
                    onClick={handleTestConnection}
                    disabled={testing || !formApiKey || !formModel}
                    className="shrink-0"
                  >
                    {testing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : testResult?.success ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : testResult?.success === false ? (
                      <XCircle className="h-4 w-4 text-destructive" />
                    ) : (
                      <Zap className="h-4 w-4" />
                    )}
                    <span className="ml-1">Test</span>
                  </Button>
                </div>
                {testResult && (
                  <p className={`text-sm ${testResult.success ? 'text-green-600 dark:text-green-400' : 'text-destructive'}`}>
                    {testResult.message}
                  </p>
                )}
              </div>
            )}

            {/* Custom Base URL (if required) */}
            {formProvider && providerInfo?.requiresBaseUrl && (
              <div className="space-y-2">
                <Label>Base URL</Label>
                <Input
                  placeholder={providerInfo.defaultBaseUrl || 'https://api.example.com/v1'}
                  value={formBaseUrl}
                  onChange={(e) => setFormBaseUrl(e.target.value)}
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveProvider} disabled={!canSave}>
              {editingProvider ? 'Update' : 'Add'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Provider</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this provider? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteProvider}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
