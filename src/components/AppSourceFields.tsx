import { useTranslation } from 'react-i18next'
import { FileBox } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { packageFromPlayStore } from '@/lib/test-case'
import type { ApkSource, ApkSourceType } from '@/types/project'

interface AppSourceFieldsProps {
  source: ApkSource
  onChange: (source: ApkSource) => void
  idPrefix: string
  disabled?: boolean
}

export function AppSourceFields({ source, onChange, idPrefix, disabled }: AppSourceFieldsProps) {
  const { t } = useTranslation()
  const value = source.type === 'apk_file' ? source.path || '' : source.type === 'play_store_url' ? source.url || '' : source.packageName || ''
  const updateValue = (next: string) => onChange(source.type === 'apk_file' ? { type: source.type, path: next } : source.type === 'play_store_url' ? { type: source.type, url: next, packageName: packageFromPlayStore(next) } : { type: source.type, packageName: next })
  return (
    <div className="space-y-2">
      <Label htmlFor={`${idPrefix}-source`}>{t('tasks.createDialog.appSource')}</Label>
      <Select value={source.type} disabled={disabled} onValueChange={(type) => onChange({ type: type as ApkSourceType })}>
        <SelectTrigger id={`${idPrefix}-source`}><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="installed_package">{t('native.installedApp')}</SelectItem>
          <SelectItem value="apk_file">{t('tasks.createDialog.apkFile')}</SelectItem>
          <SelectItem value="play_store_url">{t('tasks.createDialog.playStoreUrl')}</SelectItem>
        </SelectContent>
      </Select>
      <div className="flex gap-2">
        <Input id={`${idPrefix}-app`} aria-label={source.type === 'installed_package' ? t('native.packageName') : t('tasks.createDialog.appSource')} disabled={disabled} readOnly={source.type === 'apk_file'} value={value} onChange={(event) => updateValue(event.target.value)} placeholder={source.type === 'installed_package' ? 'com.example.app' : source.type === 'apk_file' ? t('tasks.createDialog.selectApkFile') : 'https://play.google.com/store/apps/details?id=com.example.app'} />
        {source.type === 'apk_file' && <Button variant="outline" disabled={disabled} aria-label={t('projects.createDialog.browse')} onClick={async () => {
          const result = await window.electronAPI.apkSelectFile()
          if (result.success && result.path) updateValue(result.path)
          else if (result.error) toast.error(result.error)
        }}><FileBox className="h-4 w-4" /></Button>}
      </div>
      <p className="text-xs text-muted-foreground">{t(source.type === 'installed_package' ? 'native.installedAppHelp' : 'tasks.createDialog.appSourceDesc')}</p>
    </div>
  )
}
