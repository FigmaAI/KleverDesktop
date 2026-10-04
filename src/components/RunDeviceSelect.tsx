import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface RunDeviceSelectProps {
  open: boolean
  value: string
  onChange: (value: string) => void
  onRequiredChange: (required: boolean) => void
  id: string
  disabled?: boolean
}

export function RunDeviceSelect({ open, value, onChange, onRequiredChange, id, disabled }: RunDeviceSelectProps) {
  const { t } = useTranslation()
  const [devices, setDevices] = useState<Array<{ id: string; state: string }>>([])
  useEffect(() => {
    let active = true
    if (!open) return
    void window.electronAPI.androidListDevices().then((result) => {
      if (!active) return
      const ready = (result.devices || []).filter((device) => device.state === 'device')
      setDevices(ready)
      onRequiredChange(ready.length > 1)
      if (ready.length <= 1) onChange('')
    }).catch(() => { if (active) onRequiredChange(false) })
    return () => { active = false }
  }, [open, onChange, onRequiredChange])
  if (devices.length <= 1) return null
  return <div className="space-y-2"><Label htmlFor={id}>{t('history.device')}</Label><Select value={value} onValueChange={onChange} disabled={disabled}><SelectTrigger id={id}><SelectValue placeholder={t('history.selectDevice')} /></SelectTrigger><SelectContent>{devices.map((device) => <SelectItem key={device.id} value={device.id}>{device.id}</SelectItem>)}</SelectContent></Select><p className="text-xs text-muted-foreground">{t('history.multipleDevices')}</p></div>
}
