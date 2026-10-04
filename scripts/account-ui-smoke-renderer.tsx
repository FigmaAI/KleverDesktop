import { createRoot } from 'react-dom/client'
import { ChatGPTAccountCard } from '../src/components/ChatGPTAccountCard'
import App from '../src/App'
import { installBrowserPreview } from '../src/lib/browser-preview'
import { DEFAULT_CONFIG } from '../src/hooks/useSettings'
import i18n from '../src/i18n'
import '@siwc/react/styles.css'
import '../src/index.css'
import type { ChatGPTStatus } from '../src/types/electron'

let status: ChatGPTStatus = { authenticated: false, sdkSession: { status: 'disconnected', sharing: false } }
const listeners = new Set<(value: ChatGPTStatus) => void>()
const calls: Array<{ method: string; options?: unknown; url?: string }> = []
const update = (value: ChatGPTStatus) => { status = value; listeners.forEach(listener => listener(structuredClone(value))) }
const result = () => Promise.resolve({ success: true, data: structuredClone(status) })
const root = createRoot(document.getElementById('root')!)
const savedConfigs: Array<typeof DEFAULT_CONFIG> = []
const settingsCalls: string[] = []
let nextSave: Promise<void> | undefined
let finishSave: (() => void) | undefined
const deferNextSave = () => { nextSave = new Promise(resolve => { finishSave = resolve }) }
const mountSettingsApp = () => {
  const accountAPI = window.electronAPI
  installBrowserPreview()
  let config = structuredClone(DEFAULT_CONFIG)
  config.android.sdkPath = '/mock/sdk-original'
  Object.assign(window.electronAPI, {
    chatgptStatus: accountAPI.chatgptStatus,
    onChatGPTUpdated: accountAPI.onChatGPTUpdated,
    chatgptLogin: accountAPI.chatgptLogin,
    chatgptLogout: accountAPI.chatgptLogout,
    chatgptCancel: accountAPI.chatgptCancel,
    openExternal: accountAPI.openExternal,
    configLoad: async () => ({ success: true, config: structuredClone(config) }),
    configSave: async (updated: typeof DEFAULT_CONFIG) => { const pending = nextSave; nextSave = undefined; if (pending) await pending; config = structuredClone(updated); savedConfigs.push(config); return { success: true } },
    androidInstallTools: async () => { settingsCalls.push('sdk-guide'); return { success: true, needsManualInstall: true } },
  })
  update({ authenticated: true, sdkSession: { status: 'connected', sharing: true, identity: { name: 'Test User', email: 'qa@example.invalid' } } })
  root.render(<App />)
}
Object.assign(window, {
  accountUISmoke: { calls, update, mountSettingsApp, savedConfigs, settingsCalls, deferNextSave, finishSave: () => finishSave?.() },
  electronAPI: {
    chatgptStatus: result,
    onChatGPTUpdated: (callback: (value: ChatGPTStatus) => void) => { listeners.add(callback); return () => { listeners.delete(callback) } },
    chatgptLogin: (options?: { reconsent?: boolean }) => { calls.push({ method: 'login', options }); update({ authenticated: false, loginPending: true, sdkSession: { status: 'connecting', sharing: false } }); return result() },
    chatgptCancel: () => { calls.push({ method: 'cancel' }); update({ authenticated: false, sdkSession: { status: 'disconnected', sharing: false } }); return result() },
    chatgptLogout: () => { calls.push({ method: 'logout' }); update({ authenticated: false, sdkSession: { status: 'disconnected', sharing: false } }); return result() },
    openExternal: (url: string) => { calls.push({ method: 'openExternal', url }); return Promise.resolve({ success: true }) },
  },
})
void i18n.changeLanguage('en').then(() => root.render(<div className="p-6 max-w-3xl"><ChatGPTAccountCard /></div>))
