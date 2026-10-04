import type { Task } from '../../main/types/project'

// The desktop bridge and renderer share the same persisted course/run contracts.
export type {
  PlatformType as Platform, TaskStatus, ApkSourceType, ApkSource, Task, ProjectStatus,
  Project, CreateProjectInput as ProjectCreateInput, CreateTaskInput as TaskCreateInput,
  TestCase, TestCaseSnapshot, CreateTestCaseInput, UpdateTestCaseInput, CreateTestRunInput,
  AppBuildMetadata, DeviceMetadata, RunManifest, FinalVerification,
} from '../../main/types/project'

export type TaskMetrics = NonNullable<Task['metrics']>
export interface TaskStartInput { projectId: string; taskId: string }
