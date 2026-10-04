import type { ChatGPTStatus } from '../../main/types/chatgpt'
export type { ChatGPTStatus } from '../../main/types/chatgpt'
import type { RunRecording } from '../../main/types/project'
import type { Project, ProjectCreateInput, Task, TaskCreateInput, TaskMetrics, TestCase, CreateTestCaseInput, UpdateTestCaseInput, CreateTestRunInput, RunManifest } from './project'

export interface AppConfig {
  version: string
  execution: { maxRounds: number }
  android: { sdkPath: string }
  preferences: { darkMode: boolean; systemLanguage: 'en' | 'ko' | 'zh_CN' }
}


interface Result { success: boolean; error?: string }
interface AccountResult extends Result { data?: ChatGPTStatus }
export interface AndroidStatus extends Result {
  ready: boolean
  sdkPath: string
  adbPath?: string
}
export interface AndroidDevice { id: string; state: string; model?: string }

declare global {
  interface Window {
    electronAPI: {
      chatgptStatus: () => Promise<AccountResult>
      chatgptLogin: (options?: { reconsent?: boolean }) => Promise<AccountResult>
      chatgptCancel: () => Promise<AccountResult>
      chatgptLogout: () => Promise<AccountResult>
      onChatGPTUpdated: (callback: (status: ChatGPTStatus) => void) => () => void
      androidStatus: () => Promise<AndroidStatus>
      androidListDevices: () => Promise<Result & { devices: AndroidDevice[] }>
      androidListEmulators: () => Promise<Result & { names: string[] }>
      androidStartEmulator: (avdName?: string) => Promise<Result & { serial?: string }>
      androidInstallTools: () => Promise<Result & { needsManualInstall?: boolean }>
      configLoad: () => Promise<Result & { config?: AppConfig }>
      configSave: (config: AppConfig) => Promise<Result>
      openExternal: (url: string) => Promise<Result>
      openPath: (path: string) => Promise<Result>
      openFolder: (path: string) => Promise<Result>
      showFolderSelectDialog: () => Promise<string | null>
      clipboardWriteText: (text: string) => Promise<Result>
      fileRead: (path: string) => Promise<Result & { content?: string }>
      fileExists: (path: string) => Promise<Result & { exists?: boolean }>
      fileReadImage: (path: string, baseDir?: string) => Promise<Result & { dataUrl?: string }>
      projectList: () => Promise<Result & { projects?: Project[] }>
      projectGet: (id: string) => Promise<Result & { project?: Project }>
      projectCreate: (input: ProjectCreateInput) => Promise<Result & { project?: Project; message?: string }>
      projectUpdate: (id: string, updates: Partial<Project>) => Promise<Result & { project?: Project }>
      projectDelete: (id: string) => Promise<Result>
      testCaseCreate: (input: CreateTestCaseInput) => Promise<Result & { testCase?: TestCase }>
      testCaseUpdate: (projectId: string, caseId: string, input: UpdateTestCaseInput) => Promise<Result & { testCase?: TestCase }>
      testCaseArchive: (projectId: string, caseId: string) => Promise<Result>
      testCaseRun: (projectId: string, caseId: string, input: CreateTestRunInput) => Promise<Result & { task?: Task }>
      taskRecordingGet: (projectId: string, taskId: string) => Promise<Result & { recording?: RunRecording; manifest?: RunManifest }>
      taskCreate: (input: TaskCreateInput) => Promise<Result & { task?: Task }>
      taskDelete: (projectId: string, taskId: string) => Promise<Result>
      taskStart: (projectId: string, taskId: string) => Promise<Result & { pid?: number }>
      taskStop: (projectId: string, taskId: string) => Promise<Result>
      onTaskRecorded: (callback: (data: { projectId: string; taskId: string }) => void) => () => void
      onTaskStarted: (callback: (data: { projectId: string; taskId: string }) => void) => () => void
      onTaskOutput: (callback: (data: { projectId: string; taskId: string; output: string }) => void) => () => void
      onTaskError: (callback: (data: { projectId: string; taskId: string; error: string }) => void) => () => void
      onTaskComplete: (callback: (data: { projectId: string; taskId: string; code: number }) => void) => () => void
      onTaskProgress: (callback: (data: { projectId: string; taskId: string; metrics: TaskMetrics }) => void) => () => void
      scheduleList: () => Promise<Result & { scheduledTasks?: Array<{ projectId: string; projectName: string; task: Task }> }>
      scheduleAdd: (projectId: string, taskId: string, scheduledAt: string) => Promise<Result>
      scheduleCancel: (projectId: string, taskId: string) => Promise<Result>
      onScheduleAdded: (callback: (data: { projectId: string; taskId: string; scheduledAt: string }) => void) => () => void
      onScheduleStarted: (callback: (data: { projectId: string; taskId: string }) => void) => () => void
      onScheduleCancelled: (callback: (data: { projectId: string; taskId: string }) => void) => () => void
      onScheduleFailed: (callback: (data: { projectId: string; taskId: string; error: string }) => void) => () => void
      apkSelectFile: () => Promise<Result & { path?: string; canceled?: boolean }>
    }
  }
}
