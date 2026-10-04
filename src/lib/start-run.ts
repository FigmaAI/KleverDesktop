import { toast } from 'sonner'
import type { Task } from '@/types/project'

interface StartRunMessages { failed: string; saved: string; queued: string; queueDescription: string }

// Android preparation continues in main; the form can close as soon as the run is recorded.
export async function dispatchRun(projectId: string, run: Task, onChanged: () => void, messages: StartRunMessages): Promise<void> {
  const result = await window.electronAPI.projectList()
  if (!result.success || !result.projects) throw new Error(result.error || messages.failed)
  const hasRunning = result.projects.some((project) => project.tasks.some((task) => task.status === 'running'))
  if (hasRunning) {
    const queued = await window.electronAPI.scheduleAdd(projectId, run.id, new Date().toISOString())
    if (!queued.success) throw new Error(queued.error || messages.failed)
    toast.info(messages.queued, { description: messages.queueDescription })
    onChanged()
  } else {
    void window.electronAPI.taskStart(projectId, run.id).then((started) => {
      if (!started.success) toast.error(started.error || messages.failed, { description: messages.saved })
      onChanged()
    }).catch((reason) => { toast.error(reason instanceof Error ? reason.message : messages.failed, { description: messages.saved }); onChanged() })
  }
}
