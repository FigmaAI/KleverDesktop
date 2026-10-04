import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { TerminalHeader } from '@/components/UniversalTerminal/TerminalHeader'
import { renderAnsi } from '@/utils/ansiParser'
import type { Task } from '@/types/project'

function appendUnseen(snapshot: string, tail: string): string {
  if (!tail || snapshot.endsWith(tail)) return snapshot
  if (tail.startsWith(snapshot)) return tail
  const maximum = Math.min(snapshot.length, tail.length)
  for (let size = maximum; size > 0; size--) {
    if (snapshot.endsWith(tail.slice(0, size))) return snapshot + tail.slice(size)
  }
  return snapshot + tail
}

interface TaskLogProps { task: Task; projectId: string; onClose: () => void }
export function TaskLog({ task, projectId, onClose }: TaskLogProps) {
  const { t } = useTranslation()
  const [output, setOutput] = useState(task.output || '')
  const [hiddenPrefix, setHiddenPrefix] = useState(0)
  const [loading, setLoading] = useState(true)
  const pane = useRef<HTMLPreElement>(null)
  const atBottom = useRef(true)

  useEffect(() => {
    let active = true, fetching = true
    const buffered: string[] = []
    const append = (message: string) => {
      if (fetching) buffered.push(message)
      else setOutput((current) => current + message)
    }
    const cleanups = [
      window.electronAPI.onTaskOutput((data) => { if (data.projectId === projectId && data.taskId === task.id) append(data.output) }),
      window.electronAPI.onTaskError((data) => { if (data.projectId === projectId && data.taskId === task.id) append(`${data.error}\n`) }),
    ]
    void window.electronAPI.projectGet(projectId).then((result) => {
      if (!active) return
      const saved = result.project?.tasks.find((run) => run.id === task.id)
      setOutput(appendUnseen(saved?.output || task.output || saved?.error || task.error || '', buffered.join('')))
    }).catch(() => { if (active) setOutput((current) => appendUnseen(current, buffered.join(''))) }).finally(() => {
      fetching = false
      if (active) setLoading(false)
    })
    return () => { active = false; cleanups.forEach((cleanup) => cleanup()) }
  }, [projectId, task.id, task.output, task.error])

  useEffect(() => {
    if (atBottom.current && pane.current) pane.current.scrollTop = pane.current.scrollHeight
  }, [output])
  const visible = output.slice(hiddenPrefix)
  const copy = async () => {
    try { const result = await window.electronAPI.clipboardWriteText(visible); if (!result.success) throw new Error(result.error) }
    catch (reason) { toast.error(reason instanceof Error ? reason.message : t('terminal.copyFailed')) }
  }
  return <div className="flex h-full min-h-0 flex-col">
    <TerminalHeader hasOutput={!!visible} onCopy={copy} onClear={() => setHiddenPrefix(output.length)} onClose={onClose} />
    <pre ref={pane} onScroll={() => { if (pane.current) atBottom.current = pane.current.scrollHeight - pane.current.scrollTop - pane.current.clientHeight < 40 }} className="flex-1 overflow-auto whitespace-pre-wrap break-words bg-muted/20 p-4 font-mono text-xs leading-relaxed" data-testid="task-log">{visible ? renderAnsi(visible) : loading ? t('common.loading') : t('terminal.noOutput')}</pre>
  </div>
}
