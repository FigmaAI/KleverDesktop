import { X, Trash2, Copy } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

interface TerminalHeaderProps { hasOutput: boolean; onCopy: () => void; onClear: () => void; onClose: () => void }
export function TerminalHeader({ hasOutput, onCopy, onClear, onClose }: TerminalHeaderProps) {
  const { t } = useTranslation()
  return <div className="flex items-center gap-2 border-b border-border bg-muted/30 px-3 py-2">
    <h3 className="flex-1 text-sm font-semibold">{t('terminal.title')}</h3>
    <TooltipProvider delayDuration={300}><div className="flex gap-1">
      <Tooltip><TooltipTrigger asChild><Button size="sm" variant="ghost" aria-label={t('terminal.copy')} onClick={onCopy} disabled={!hasOutput}><Copy className="h-3.5 w-3.5" /></Button></TooltipTrigger><TooltipContent>{t('terminal.copy')}</TooltipContent></Tooltip>
      <Tooltip><TooltipTrigger asChild><Button size="sm" variant="ghost" aria-label={t('terminal.clear')} onClick={onClear} disabled={!hasOutput}><Trash2 className="h-3.5 w-3.5" /></Button></TooltipTrigger><TooltipContent>{t('terminal.clear')}</TooltipContent></Tooltip>
      <Tooltip><TooltipTrigger asChild><Button size="sm" variant="ghost" aria-label={t('common.close')} onClick={onClose}><X className="h-3.5 w-3.5" /></Button></TooltipTrigger><TooltipContent>{t('common.close')}</TooltipContent></Tooltip>
    </div></TooltipProvider>
  </div>
}
