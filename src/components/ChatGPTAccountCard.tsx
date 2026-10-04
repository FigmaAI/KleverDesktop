import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChatGPTConnectionCard, ChatGPTRecoveryNotice } from '@siwc/react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import type { ChatGPTStatus } from '@/types/electron'

const MANAGE_USAGE_URL = 'https://chatgpt.com/settings/usage'

// Official DevKit components provide branded UI; OAuth credentials stay in main.
export function ChatGPTAccountCard() {
  const { t } = useTranslation()
  const [status, setStatus] = useState<ChatGPTStatus>({ authenticated: false })
  const [loading, setLoading] = useState(true)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string>()

  useEffect(() => {
    let active = true
    const cleanup = window.electronAPI.onChatGPTUpdated((updated) => {
      if (active) { setStatus(updated); setError(updated.error) }
    })
    void window.electronAPI.chatgptStatus().then((result) => {
      if (!active) return
      if (!result.success || !result.data) throw new Error(result.error || t('native.accountFailed'))
      setStatus(result.data)
      setError(result.data.error)
    }).catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : t('native.accountFailed')) })
      .finally(() => { if (active) { setLoading(false); setLoaded(true) } })
    return () => { active = false; cleanup() }
  }, [t])

  const session = status.sdkSession
  const connectionStatus = status.loginPending ? 'connecting' : session?.status || (status.authenticated ? 'connected' : 'disconnected')
  const sharing = session?.sharing === true
  const usageLimited = session?.error?.code === 'usage_limit' || session?.error?.code === 'subscription_sharing_usage_limit_exceeded'

  const accountAction = async (action: 'login' | 'logout' | 'cancel') => {
    if (loading) return
    setLoading(true)
    setError(undefined)
    try {
      const result = await (action === 'login'
        ? window.electronAPI.chatgptLogin(connectionStatus === 'connected' && !sharing ? { reconsent: true } : undefined)
        : action === 'logout' ? window.electronAPI.chatgptLogout() : window.electronAPI.chatgptCancel())
      if (!result.success || !result.data) throw new Error(result.error || t('native.accountFailed'))
      setStatus(result.data)
      setError(result.data.error)
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : t('native.accountFailed')
      setError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }
  const manageUsage = async () => {
    try {
      const result = await window.electronAPI.openExternal(MANAGE_USAGE_URL)
      if (!result.success) throw new Error(result.error || t('native.accountFailed'))
    } catch (reason) { toast.error(reason instanceof Error ? reason.message : t('native.accountFailed')) }
  }

  if (!loaded) return <p className="text-sm text-muted-foreground" role="status">{t('common.loading')}</p>

  return (
    <div className="space-y-4">
      {!usageLimited && (error || session?.error?.message) && <Alert variant="destructive"><AlertDescription>{error || session?.error?.message}</AlertDescription></Alert>}
      <fieldset disabled={loading} className="min-w-0" aria-busy={loading || undefined}>
        <ChatGPTConnectionCard className="klever-chatgpt-connection" appName="Klever" status={connectionStatus} sharing={sharing} identity={session?.identity || (status.email ? { email: status.email } : undefined)} onConnect={() => void accountAction('login')} onDisconnect={() => void accountAction('logout')} onManageUsage={usageLimited ? undefined : () => void manageUsage()} />
      </fieldset>
      {connectionStatus === 'connecting' && <Button variant="outline" disabled={loading} onClick={() => void accountAction('cancel')}>{t('common.cancel')}</Button>}
      {usageLimited && <ChatGPTRecoveryNotice kind="usage_limit" appName="Klever" limitWindow="unknown" busy={loading} onPrimaryAction={() => void manageUsage()} />}
    </div>
  )
}
