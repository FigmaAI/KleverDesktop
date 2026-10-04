import type { SessionState } from '@siwc/local';
/** Public account state. OAuth credentials stay in the Electron main process. */
export interface ChatGPTStatus {
  authenticated: boolean;
  email?: string;
  planType?: string;
  loginPending?: boolean;
  error?: string;
  sdkSession?: SessionState;
}

export interface ScreenInferenceRequest {
  prompt: string;
  /** PNG/JPEG/WebP data URLs or base64-encoded PNG screenshots. */
  images: string[];
  signal?: AbortSignal;
  /** Main-process diagnostic hook; contains no credentials, image data, or response content. */
  onResponseDiagnostics?: (details: ChatGPTResponseDiagnostics) => void;
}

export interface ChatGPTResponseDiagnostics {
  status: number;
  contentType: string;
  requestId?: string;
  bodyKind: string;
  keys?: string[];
  responseStatus?: string;
  eventTypes?: string[];
  hasOutputTextDelta?: boolean;
  hasOutputTextDone?: boolean;
  hasOutputItemDone?: boolean;
  completeTextParts?: number;
  outputItemTypes?: string[];
  contentTypes?: string[];
  completePartLengths?: number[];
  completePartsEqual?: boolean;
  finalTextEqualsDoneText?: boolean;
  functionCallCount?: number;
  functionCalls?: Array<{ name?: string; namespace?: string; completeArguments: boolean }>;
}

/** Fixed field names and machine-readable reasons; never model output content. */
export interface ChatGPTValidationDiagnostics {
  field: string;
  reason: string;
}

export interface ChatGPTPayloadDiagnostics {
  characterCount: number;
  startsFence: boolean;
  firstCharacter: string;
  jsonParsePosition?: number;
}

export interface ScreenInferenceResult {
  response: string;
  usage?: {
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
  };
  model?: string;
}

/** One schema-constrained decision; coordinates use the original screenshot pixels. */
export interface AndroidStepAction {
  type: 'tap' | 'swipe' | 'text' | 'back' | 'enter' | 'wait' | 'finish';
  x: number | null;
  y: number | null;
  endX: number | null;
  endY: number | null;
  durationMs: number | null;
  text: string | null;
}

export interface AndroidStep {
  observation: string;
  intent: string;
  action: AndroidStepAction;
  assessment: 'continue' | 'passed' | 'failed' | 'unverified';
  reason: string;
}

export interface AndroidStepInferenceResult {
  step: AndroidStep;
  usage?: ScreenInferenceResult['usage'];
  model?: string;
}
