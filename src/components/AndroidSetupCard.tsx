import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { CheckCircle2, ExternalLink, Loader2, Play, RefreshCw, Smartphone } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { AndroidDevice } from '@/types/electron'

export function AndroidSetupCard({ children }: { children?: ReactNode }) {
  const { t } = useTranslation()
  const [ready, setReady] = useState(false)
  const [loading, setLoading] = useState(true)
  const [operation, setOperation] = useState<'install' | 'launch'>()
  const [devices, setDevices] = useState<AndroidDevice[]>([])
  const [emulators, setEmulators] = useState<string[]>([])
  const [avdName, setAvdName] = useState('')
  const [error, setError] = useState<string>()
  const [manualInstall, setManualInstall] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const [status, listedDevices, listedEmulators] = await Promise.all([window.electronAPI.androidStatus(), window.electronAPI.androidListDevices(), window.electronAPI.androidListEmulators()])
      setReady(status.success && status.ready)
      setDevices(listedDevices.devices || [])
      setEmulators(listedEmulators.names || [])
      setAvdName((selected) => (listedEmulators.names || []).includes(selected) ? selected : listedEmulators.names?.[0] || '')
      const connected = (listedDevices.devices || []).some((device) => device.state === 'device')
      setError(!status.success ? status.error : !listedDevices.success ? listedDevices.error : !listedEmulators.success && !(status.ready && connected) ? listedEmulators.error : undefined)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t('native.androidSetupFailed'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => { void refresh() }, [refresh])

  const install = async () => {
    setOperation('install')
    setError(undefined)
    try {
      const result = await window.electronAPI.androidInstallTools()
      if (!result.success) throw new Error(result.error || t('native.androidInstallFailed'))
      setManualInstall(!!result.needsManualInstall)
      await refresh()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t('native.androidInstallFailed'))
    } finally {
      setOperation(undefined)
    }
  }
  const launch = async () => {
    if (!avdName) return
    setOperation('launch')
    setError(undefined)
    try {
      const result = await window.electronAPI.androidStartEmulator(avdName)
      if (!result.success) throw new Error(result.error || t('native.emulatorFailed'))
      await refresh()
      toast.success(t('native.emulatorReady'))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t('native.emulatorFailed'))
    } finally {
      setOperation(undefined)
    }
  }
  const officialPage = async (url: string) => {
    const result = await window.electronAPI.openExternal(url)
    if (!result.success) toast.error(result.error || t('native.androidSetupFailed'))
  }
  const busy = loading || !!operation

  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><Smartphone className="h-5 w-5" />{t('native.androidReady')}</CardTitle><CardDescription>{t('native.androidDescription')}</CardDescription></CardHeader>
      <CardContent className="space-y-5">
        {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
        <div className="flex flex-wrap items-center justify-between gap-3"><p className="flex items-center gap-2 text-sm">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : ready ? <CheckCircle2 className="h-4 w-4 text-primary" /> : null}{t(operation === 'install' ? 'native.installingAndroidTools' : ready ? 'native.androidToolsReady' : 'native.androidToolsNeeded')}</p><Button size="sm" variant="outline" disabled={busy} onClick={refresh}><RefreshCw className="mr-2 h-4 w-4" />{t('native.refresh')}</Button></div>
        {!ready && <div className="space-y-3"><Button disabled={busy} onClick={install}>{t('native.installAndroidTools')}<ExternalLink className="ml-2 h-4 w-4" /></Button>{manualInstall && <p className="text-sm text-muted-foreground">{t('native.manualSdk')}</p>}</div>}
        {children && <div className="border-t pt-4 space-y-2">{children}</div>}
        <div className="border-t pt-4 space-y-3"><h3 className="text-sm font-medium">{t('native.devices')}</h3>{devices.length ? <ul className="space-y-2">{devices.map((device) => <li key={device.id} className="flex flex-wrap items-center justify-between gap-2 text-sm"><span>{device.model && <span className="font-medium mr-2">{device.model}</span>}<span className="font-mono text-xs">{device.id}</span></span><span className="text-muted-foreground">{device.state === 'device' ? t('native.deviceReady') : device.state}</span></li>)}</ul> : <p className="text-sm text-muted-foreground">{t('native.connectDevice')}</p>}</div>
        <div className="border-t pt-4 space-y-3"><Label htmlFor="existing-avd">{t('native.emulators')}</Label>{emulators.length ? <div className="flex gap-2"><Select value={avdName} onValueChange={setAvdName} disabled={busy}><SelectTrigger id="existing-avd"><SelectValue placeholder={t('native.selectEmulator')} /></SelectTrigger><SelectContent>{emulators.map((name) => <SelectItem key={name} value={name}>{name}</SelectItem>)}</SelectContent></Select><Button disabled={busy || !avdName} onClick={launch}><Play className="mr-2 h-4 w-4" />{t(operation === 'launch' ? 'native.startingEmulator' : 'native.startEmulator')}</Button></div> : <div className="space-y-2"><p className="text-sm text-muted-foreground">{t('native.noEmulators')}</p><Button variant="link" className="h-auto p-0" onClick={() => officialPage('https://developer.android.com/studio/run/managing-avds')}>{t('native.createEmulator')}<ExternalLink className="ml-2 h-3 w-3" /></Button></div>}</div>
      </CardContent>
    </Card>
  )
}
