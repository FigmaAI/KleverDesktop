/**
 * Process management type definitions
 */

import { ChildProcess } from 'child_process';

export interface SpawnResult {
  success: boolean;
  message?: string;
  output?: string;
  error?: string;
  code?: number;
}

export interface ProcessManager {
  pythonProcess: ChildProcess | null;
  integrationTestProcess: ChildProcess | null;
  taskProcesses: Map<string, ChildProcess>;
}

export interface ToolStatus {
  checking: boolean;
  installed: boolean;
  installing: boolean;
  version?: string;
  error?: string;
}

export interface SystemInfo {
  platform: string;
  arch: string;
  cpuCount: number;
  totalMemory: number;
  freeMemory: number;
}
