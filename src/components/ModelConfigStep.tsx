import { useState, useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { BlurFade } from '@/components/magicui/blur-fade'
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
  Zap,
  CheckCircle,
  XCircle,
  Loader2,
  Plus,
  Pencil,
  Trash2,
  Monitor,
  Cloud,
  RefreshCw,
} from 'lucide-react'
import { ModelSelector, ModelSelection } from './ModelSelector'
import { ProviderConfig, MultiProviderModelSettings } from '@/types/setupWizard'
import { useLiteLLMProviders } from '@/hooks/useLiteLLMProviders'

interface ModelConfigStepProps {
  modelConfig: MultiProviderModelSettings
  setModelConfig: (config: MultiProviderModelSettings) => void
  ollamaModels: string[]
  ollamaLoading: boolean
  ollamaError: string
  fetchOllamaModels: () => void
  onVerified: (verified: boolean) => void
}

export function ModelConfigStep({
  modelConfig,
  setModelConfig,
  fetchOllamaModels,
  onVerified,
}: ModelConfigStepProps) {
  const { t } = useTranslation()
  const { getProvider, fetchProviders, loading: providersRefreshing } = useLiteLLMProviders()

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

  // Notify parent of validation state changes
  useEffect(() => {
    onVerified(isValid)
  }, [isValid, onVerified])

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

    if (!providersRefreshing) {
      fetchProviders()
    }
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

    if (!providersRefreshing) {
      fetchProviders()
    }
  }

  // Handle model selection change in dialog
  const handleModelChange = (selection: ModelSelection) => {
    setFormProvider(selection.provider)
    setFormModel(selection.model)
    setTestResult(null)
    setApiKeyValidated(selection.provider === 'ollama')

    if (selection.provider === 'ollama') {
      setFormBaseUrl('http://localhost:11434')
      setFormApiKey('')
      // Fetch Ollama models when selecting Ollama
      fetchOllamaModels()
    } else {
      const providerInfo = getProvider(selection.provider)
      setFormBaseUrl(providerInfo?.defaultBaseUrl || '')
    }
  }

  // Test API connection
  const handleTestConnection = useCallback(async () => {
    if (!formProvider || !formModel) {
      setTestResult({ success: false, message: t('settings.modelConfig.selectProviderFirst') })
      return
    }

    if (formProvider !== 'ollama' && !formApiKey) {
      setTestResult({ success: false, message: t('settings.modelConfig.enterApiKeyFirst') })
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
        message: result.message || (success ? t('settings.modelConfig.connectionSuccess') : t('settings.modelConfig.connectionFailed'))
      })
      if (success) {
        setApiKeyValidated(true)
      }
    } catch (error) {
      setTestResult({
        success: false,
        message: error instanceof Error ? error.message : t('settings.modelConfig.connectionFailed')
      })
    } finally {
      setTesting(false)
    }
  }, [formProvider, formModel, formApiKey, formBaseUrl, t])

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
      newProviders = modelConfig.providers.filter(p => p.id !== editingProvider.id)
      const existingIndex = newProviders.findIndex(p => p.id === formProvider)
      if (existingIndex >= 0) {
        newProviders[existingIndex] = newProvider
      } else {
        newProviders.push(newProvider)
      }
    } else {
      const existingIndex = modelConfig.providers.findIndex(p => p.id === formProvider)
      if (existingIndex >= 0) {
        newProviders = [...modelConfig.providers]
        newProviders[existingIndex] = newProvider
      } else {
        newProviders = [...modelConfig.providers, newProvider]
      }
    }

    setModelConfig({
      ...modelConfig,
      providers: newProviders,
      lastUsed: newProviders.length > 0
        ? { provider: newProviders[0].id, model: newProviders[0].preferredModel }
        : undefined,
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
      <BlurFade key="step-model-config" delay={0.1}>
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  {t('settings.modelConfig.title')}
                </CardTitle>
                <CardDescription>
                  {t('settings.modelConfig.description')}
                </CardDescription>
              </div>
              <Button size="sm" onClick={handleAddProvider}>
                <Plus className="h-4 w-4 mr-1" />
                {t('settings.modelConfig.addProvider')}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {modelConfig.providers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>{t('settings.modelConfig.noProviders')}</p>
                <p className="text-sm">{t('settings.modelConfig.noProvidersHint')}</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('settings.modelConfig.provider')}</TableHead>
                    <TableHead>{t('settings.modelConfig.apiKey')}</TableHead>
                    <TableHead>{t('settings.modelConfig.preferredModel')}</TableHead>
                    <TableHead className="w-[100px]">{t('settings.modelConfig.actions')}</TableHead>
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
                        {provider.id === 'ollama' ? t('settings.modelConfig.notRequired') : maskApiKey(provider.apiKey)}
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
      </BlurFade>

      {/* Add/Edit Provider Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {editingProvider ? t('settings.modelConfig.editProvider') : t('settings.modelConfig.addProvider')}
            </DialogTitle>
            <DialogDescription>
              {editingProvider
                ? t('settings.modelConfig.editProviderDesc')
                : t('settings.modelConfig.addProviderDesc')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Model Selector */}
            <div className="space-y-2">
              <Label>{t('settings.modelConfig.providerAndModel')}</Label>
              <ModelSelector
                value={formProvider && formModel ? { provider: formProvider, model: formModel } : undefined}
                onChange={handleModelChange}
              />
            </div>

            {/* API Key (non-Ollama only) */}
            {formProvider && !isOllama && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>{t('settings.modelConfig.apiKey')}</Label>
                  {providerInfo?.apiKeyUrl && (
                    <Button
                      variant="link"
                      size="sm"
                      className="h-auto p-0 text-xs"
                      onClick={() => window.electronAPI.openExternal(providerInfo.apiKeyUrl)}
                    >
                      {t('settings.modelConfig.getApiKey')} <ExternalLink className="ml-1 h-3 w-3" />
                    </Button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Input
                      type={showApiKey ? 'text' : 'password'}
                      placeholder={t('settings.modelConfig.enterApiKey')}
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
                    <span className="ml-1">{t('settings.modelConfig.test')}</span>
                  </Button>
                </div>
                {testResult && (
                  <p className={`text-sm ${testResult.success ? 'text-green-600 dark:text-green-400' : 'text-destructive'}`}>
                    {testResult.message}
                  </p>
                )}
              </div>
            )}

            {/* Base URL for Ollama */}
            {formProvider && isOllama && (
              <div className="space-y-2">
                <Label>{t('settings.modelConfig.baseUrl')}</Label>
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="http://localhost:11434"
                    value={formBaseUrl}
                    onChange={(e) => setFormBaseUrl(e.target.value)}
                    className="flex-1"
                  />
                  <Button
                    variant="outline"
                    size="default"
                    onClick={handleTestConnection}
                    disabled={testing || !formModel}
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
                    <span className="ml-1">{t('settings.modelConfig.test')}</span>
                  </Button>
                </div>
                {testResult && (
                  <p className={`text-sm ${testResult.success ? 'text-green-600 dark:text-green-400' : 'text-destructive'}`}>
                    {testResult.message}
                  </p>
                )}
              </div>
            )}

            {/* Custom Base URL (if required by provider) */}
            {formProvider && !isOllama && providerInfo?.requiresBaseUrl && (
              <div className="space-y-2">
                <Label>{t('settings.modelConfig.baseUrl')}</Label>
                <Input
                  placeholder={providerInfo.defaultBaseUrl || 'https://api.example.com/v1'}
                  value={formBaseUrl}
                  onChange={(e) => setFormBaseUrl(e.target.value)}
                />
              </div>
            )}
          </div>

          <DialogFooter className="flex justify-between sm:justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => fetchProviders(true)}
              disabled={providersRefreshing}
              title={t('settings.modelConfig.refreshProviders')}
              className="gap-1.5"
            >
              <RefreshCw className={`h-4 w-4 ${providersRefreshing ? 'animate-spin' : ''}`} />
              {t('settings.modelConfig.refreshProviders')}
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button onClick={handleSaveProvider} disabled={!canSave}>
                {editingProvider ? t('settings.modelConfig.update') : t('settings.modelConfig.add')}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('settings.modelConfig.deleteProvider')}</DialogTitle>
            <DialogDescription>
              {t('settings.modelConfig.deleteProviderConfirm')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button variant="destructive" onClick={handleDeleteProvider}>
              {t('common.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
