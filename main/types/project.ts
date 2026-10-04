/** Native app tests and their persisted results. */
export type PlatformType = 'android';
export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
export type ApkSourceType = 'apk_file' | 'play_store_url' | 'installed_package';
export interface ApkSource {
  type: ApkSourceType;
  path?: string;
  url?: string;
  packageName?: string;
}
export interface Task {
  id: string;
  projectId: string;
  testCaseId?: string;
  caseSnapshot?: TestCaseSnapshot;
  caseRevision?: number;
  buildLabel?: string;
  deviceSerial?: string;
  referenceRunId?: string;
  manifestPath?: string;
  app?: AppBuildMetadata;
  device?: DeviceMetadata;
  recordingPath?: string;
  recordingError?: string;
  finalVerification?: FinalVerification;
  legacyMetadata?: Record<string, unknown>;
  name: string;
  description?: string;
  goal: string;
  status: TaskStatus;
  maxRounds?: number;
  output?: string;
  resultPath?: string;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
  apkSource?: ApkSource;
  metrics?: {
    startTime?: number;
    endTime?: number;
    durationMs?: number;
    tokens?: number;
    inputTokens?: number;
    outputTokens?: number;
    rounds?: number;
    maxRounds?: number;
  };
  error?: string;
  scheduledAt?: string;
  isScheduled?: boolean;
}
export type ProjectStatus = 'active' | 'archived';
export interface Project {
  id: string;
  name: string;
  platform: PlatformType;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
  tasks: Task[];
  testCases?: TestCase[];
  workspaceDir: string;
  lastApkSource?: ApkSource;
}
export interface ProjectsData {
  projects: Project[];
  /** Removed-platform records retained for recovery; never dispatched by the scheduler. */
  legacyProjects?: unknown[];
}
export interface CreateProjectInput {
  name: string;
  platform: PlatformType;
  workspaceDir?: string;
}
export interface UpdateProjectInput {
  name?: string;
  status?: ProjectStatus;
}
export interface CreateTaskInput {
  projectId: string;
  name: string;
  description?: string;
  goal: string;
  maxRounds?: number;
  apkSource?: ApkSource;
  scheduledAt?: string;
  isScheduled?: boolean;
  buildLabel?: string;
  deviceSerial?: string;
}
export interface UpdateTaskInput {
  name?: string;
  description?: string;
  goal?: string;
  status?: TaskStatus;
}

/** A reusable course. Editing it never changes a previously created run. */
export interface TestCase {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  goal: string;
  apkSource?: ApkSource;
  maxRounds?: number;
  revision: number;
  createdAt: string;
  updatedAt: string;
  archived?: boolean;
}
export interface TestCaseSnapshot {
  id: string;
  revision: number;
  name: string;
  description?: string;
  goal: string;
  apkSource?: ApkSource;
  maxRounds?: number;
}
export interface CreateTestCaseInput {
  projectId: string;
  name: string;
  description?: string;
  goal: string;
  apkSource?: ApkSource;
  maxRounds?: number;
}
export interface UpdateTestCaseInput {
  name?: string;
  description?: string;
  goal?: string;
  apkSource?: ApkSource;
  maxRounds?: number;
}
export interface CreateTestRunInput {
  apkSource?: ApkSource;
  buildLabel?: string;
  deviceSerial?: string;
  scheduledAt?: string;
  referenceRunId?: string;
}
export interface AppBuildMetadata {
  packageName?: string;
  versionName?: string;
  versionCode?: string;
}
export interface DeviceMetadata {
  serial?: string;
  manufacturer?: string;
  model?: string;
  androidVersion?: string;
  apiLevel?: string;
}
/** Stable run record independent of the project index. */
export interface RunManifest {
  schemaVersion: 1;
  project: { id: string; name: string; platform: PlatformType };
  run: Task;
  finalizedAt?: string;
}
export interface RecordedAction {
  type: 'tap' | 'long_press' | 'text' | 'swipe' | 'back' | 'enter' | 'wait';
  intent: string;
  x?: number;
  y?: number;
  endX?: number;
  endY?: number;
  durationMs?: number;
  target?: { resourceId?: string; text?: string; contentDescription?: string; className?: string };
  text?: string;
  direction?: string;
  distance?: string;
}
export interface RecordedStep {
  index: number;
  round: number;
  startedAt: string;
  finishedAt?: string;
  screen?: { width: number; height: number };
  action: RecordedAction;
  observationBefore: string;
  observationAfter?: string;
  result: 'executed' | 'failed';
  error?: string;
  evidence: { before: string; after?: string; xml?: string };
  verification?: { source: 'agent_visual'; decision: string; detail: string };
}
export interface FinalVerification {
  source: 'agent_visual';
  goal: string;
  outcome: 'passed' | 'failed' | 'unverified';
  evidence?: string;
  detail: string;
}
export interface RunRecording {
  schemaVersion: 1;
  model?: string;
  testCaseId?: string;
  testCaseRevision?: number;
  runId?: string;
  goal: string;
  startedAt: string;
  finishedAt?: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  reason?: string;
  context: { app: AppBuildMetadata; device: DeviceMetadata };
  steps: RecordedStep[];
  finalVerification?: FinalVerification;
}
