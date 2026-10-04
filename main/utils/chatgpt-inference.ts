/** Official OpenAI SDK transport for the main process's ChatGPT-plan credential. */
import OpenAI from 'openai';
import { ReadableStream } from 'node:stream/web';
import type { AndroidStep, AndroidStepInferenceResult, ChatGPTResponseDiagnostics, ChatGPTValidationDiagnostics, ChatGPTPayloadDiagnostics } from '../types/chatgpt';

export interface ChatGPTInferenceRequest {
  prompt: string;
  images: string[];
  signal?: AbortSignal;
  onResponseDiagnostics?: (details: ChatGPTResponseDiagnostics) => void;
}

export interface ChatGPTInferenceResult {
  response: string;
  usage?: { input_tokens: number; output_tokens: number; total_tokens: number };
  model?: string;
  diagnostics?: ChatGPTResponseDiagnostics;
}

interface RequestErrorDetails {
  status?: number;
  code?: string;
  param?: string;
  requestId?: string;
  responseBody?: unknown;
  diagnostics?: ChatGPTResponseDiagnostics;
  validation?: ChatGPTValidationDiagnostics;
  payloadDiagnostics?: ChatGPTPayloadDiagnostics;
}

export class ChatGPTRequestError extends Error {
  readonly status?: number;
  readonly code?: string;
  readonly param?: string;
  readonly requestId?: string;
  readonly responseBody?: unknown;
  readonly diagnostics?: ChatGPTResponseDiagnostics;
  readonly validation?: ChatGPTValidationDiagnostics;
  readonly payloadDiagnostics?: ChatGPTPayloadDiagnostics;

  constructor(message: string, details: RequestErrorDetails = {}) {
    super(message);
    this.name = 'ChatGPTRequestError';
    Object.assign(this, details);
  }
}

type JsonObject = Record<string, unknown>;
const API_URL = 'https://api.openai.com/v1';
const REQUEST_TIMEOUT_MS = 180_000;
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const MAX_INPUT_BYTES = 40 * 1024 * 1024;
const MAX_EVENT_CHARACTERS = 4 * 1024 * 1024;
const MAX_STREAM_BYTES = 32 * 1024 * 1024;

const actionKeys = ['type', 'x', 'y', 'endX', 'endY', 'durationMs', 'text'];
const stepKeys = ['observation', 'intent', 'action', 'assessment', 'reason'];
const actionTypes = ['tap', 'swipe', 'text', 'back', 'enter', 'wait', 'finish'];
const assessments = ['continue', 'passed', 'failed', 'unverified'];
const ANDROID_TOOL_NAMESPACE = 'native_android';
const ANDROID_TOOL_NAME = 'emit_android_step';

function actionParameters(type: string): string[] {
  return type === 'tap' ? ['x', 'y'] : type === 'swipe' ? ['x', 'y', 'endX', 'endY', 'durationMs'] :
    type === 'text' ? ['text'] : type === 'wait' ? ['durationMs'] : [];
}

function actionSchema(type: string): JsonObject {
  const used = actionParameters(type);
  return {
    type: 'object', additionalProperties: false, required: actionKeys,
    properties: {
      type: { type: 'string', enum: [type] },
      ...Object.fromEntries(actionKeys.slice(1).map(key => [key,
        { type: used.includes(key) ? key === 'text' ? 'string' : 'number' : 'null' }])),
    },
  };
}

/** Strict function parameters retain the public, flat Android step shape. */
const ANDROID_STEP_FORMAT = {
  type: 'json_schema', name: 'android_test_step', strict: true,
  schema: {
    type: 'object', additionalProperties: false, required: stepKeys,
    properties: {
      observation: { type: 'string' },
      intent: { type: 'string' },
      action: {
        description: 'tap uses x/y; swipe uses x/y/endX/endY/durationMs; text uses text; wait uses durationMs. All unused fields must be null.',
        anyOf: actionTypes.map(actionSchema),
      },
      assessment: { type: 'string', enum: assessments, description: 'Use continue for actions. With finish: passed for visible success, failed only for visible app failure, unverified for execution/input limitations.' },
      reason: { type: 'string' },
    },
  },
};

const ANDROID_STEP_TOOLS: OpenAI.Responses.Tool[] = [{
  type: 'namespace', name: ANDROID_TOOL_NAMESPACE, description: 'Native Android test decisions.',
  tools: [{ type: 'function', name: ANDROID_TOOL_NAME,
    description: 'Report exactly one next Android test action or terminal assessment.',
    strict: true, parameters: ANDROID_STEP_FORMAT.schema }],
}];

function object(value: unknown): JsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as JsonObject
    : {};
}

function nonemptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function errorFromBody(body: unknown, fallback: string, details: RequestErrorDetails): ChatGPTRequestError {
  const root = object(body);
  const error = object(root.error);
  const message = nonemptyString(error.message) ?? nonemptyString(root.message)
    ?? nonemptyString(root.detail) ?? fallback;
  return new ChatGPTRequestError(message.slice(0, 2000), {
    ...details,
    code: nonemptyString(error.code) ?? nonemptyString(root.code) ?? details.code,
    param: nonemptyString(error.param) ?? nonemptyString(root.param),
    responseBody: body,
  });
}

/** Explicit account catalog capabilities take priority over known model defaults. */
function acceptsImages(model: JsonObject): boolean {
  for (const source of [model, object(model.capabilities)]) {
    for (const key of ['input_modalities', 'inputModalities', 'supported_input_modalities']) {
      const modalities = source[key];
      if (Array.isArray(modalities)) return modalities.includes('image');
    }
    const modalities = object(source.modalities);
    if (Array.isArray(modalities.input)) return modalities.input.includes('image');
    for (const key of ['supports_image_input', 'supportsImageInput', 'image_input', 'vision']) {
      if (typeof source[key] === 'boolean') return source[key] as boolean;
    }
  }
  // The current SIWC catalog can omit modality metadata. These documented
  // general-purpose model families accept images; unknown models need metadata.
  return /^gpt-(?:6(?:\.1)?|5\.6)-(?:luna|sol)(?:$|-)/.test(String(model.slug));
}

function acceptsStructuredOutputs(model: JsonObject): boolean {
  for (const source of [model, object(model.capabilities)]) {
    for (const key of ['structured_outputs', 'supports_structured_outputs', 'structuredOutputs']) {
      if (typeof source[key] === 'boolean') return source[key] as boolean;
    }
    for (const key of ['supported_features', 'features']) {
      if (Array.isArray(source[key])) return (source[key] as unknown[]).includes('structured_outputs');
    }
  }
  // These documented general-purpose families support Structured Outputs. The
  // account catalog remains the authority on whether a slug is available.
  return /^gpt-(?:6(?:\.1)?|5\.6)-(?:luna|sol)(?:$|-)/.test(String(model.slug));
}

function imageDataUrl(image: string): { url: string; bytes: number } {
  if (typeof image !== 'string' || !image) {
    throw new ChatGPTRequestError('Screenshot data is missing.', { code: 'invalid_image' });
  }
  if (image.length > Math.ceil(MAX_IMAGE_BYTES * 4 / 3) + 64) {
    throw new ChatGPTRequestError('A screenshot exceeds the 20 MB limit.', { code: 'input_too_large' });
  }
  let mime = 'image/png';
  let base64 = image;
  if (image.startsWith('data:')) {
    const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]*={0,2})$/.exec(image);
    if (!match) throw new ChatGPTRequestError('Screenshots must use PNG, JPEG, or WebP base64 data URLs.', { code: 'invalid_image' });
    [, mime, base64] = match;
  }
  if (!base64 || base64.length % 4 === 1 || !/^[A-Za-z0-9+/]*={0,2}$/.test(base64)) {
    throw new ChatGPTRequestError('Screenshot data is not valid base64.', { code: 'invalid_image' });
  }
  const bytes = Buffer.from(base64, 'base64');
  if (bytes.toString('base64').replace(/=+$/, '') !== base64.replace(/=+$/, '')) {
    throw new ChatGPTRequestError('Screenshot data is not valid base64.', { code: 'invalid_image' });
  }
  const validFormat = mime === 'image/png'
    ? bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    : mime === 'image/jpeg'
      ? bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
      : bytes.length >= 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
  if (!validFormat) throw new ChatGPTRequestError('Screenshot format does not match its image type.', { code: 'invalid_image' });
  if (bytes.length > MAX_IMAGE_BYTES) {
    throw new ChatGPTRequestError('A screenshot exceeds the 20 MB limit.', { code: 'input_too_large' });
  }
  return { url: `data:${mime};base64,${base64}`, bytes: bytes.length };
}

function responseUsage(response: JsonObject): ChatGPTInferenceResult['usage'] {
  const usage = object(response.usage);
  const count = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
  if (!count(usage.input_tokens) || !count(usage.output_tokens)) return undefined;
  return {
    input_tokens: usage.input_tokens,
    output_tokens: usage.output_tokens,
    total_tokens: count(usage.total_tokens) ? usage.total_tokens : usage.input_tokens + usage.output_tokens,
  };
}


/** Pass bytes unchanged to the SDK; enforce this app's endpoint and memory boundary. */
function planFetch(onHeaders: (response: Response) => void): typeof fetch {
  return async (input, init) => {
    const url = new URL(typeof input === 'string' || input instanceof URL ? String(input) : input.url);
    if (url.origin !== 'https://api.openai.com' || !['/v1/models', '/v1/responses'].includes(url.pathname)) {
      throw new ChatGPTRequestError('Invalid ChatGPT plan endpoint.', { code: 'invalid_endpoint' });
    }
    const response = await fetch(input, { ...init, redirect: 'error' });
    if (url.pathname === '/v1/responses') onHeaders(response);
    if (!response.body) return response;
    const reader = response.body.getReader();
    const limit = !response.ok ? 64 * 1024 : url.pathname === '/v1/models' ? 1024 * 1024 : MAX_STREAM_BYTES;
    let bytes = 0;
    const body = new ReadableStream<Uint8Array>({
      async pull(controller) {
        try {
          const chunk = await reader.read();
          if (chunk.done) { controller.close(); return; }
          bytes += chunk.value.byteLength;
          if (bytes > limit) throw new ChatGPTRequestError('ChatGPT response exceeded the size limit.', { code: 'response_too_large' });
          controller.enqueue(chunk.value);
        } catch (error) { controller.error(error); await reader.cancel().catch(() => undefined); }
      },
      async cancel(reason) { await reader.cancel(reason).catch(() => undefined); },
    });
    return new Response(body as unknown as ConstructorParameters<typeof Response>[0], {
      status: response.status, statusText: response.statusText, headers: response.headers,
    });
  };
}

function sdkError(error: unknown): ChatGPTRequestError {
  if (error instanceof ChatGPTRequestError) return error;
  if (error instanceof OpenAI.APIError) {
    const body = object(error.error);
    return new ChatGPTRequestError((nonemptyString(body.message) ?? nonemptyString(body.detail) ??
      (error.status ? `ChatGPT request failed (HTTP ${error.status}).` : 'Could not reach ChatGPT. Try again.')).slice(0, 2000), {
      status: error.status, code: error.code ?? nonemptyString(body.code), param: error.param ?? nonemptyString(body.param),
      requestId: error.requestID ?? undefined,
    });
  }
  return new ChatGPTRequestError('ChatGPT returned an invalid response stream. The result is unverified.', { code: 'invalid_response_stream' });
}

async function chooseModel(client: OpenAI, signal: AbortSignal): Promise<string> {
  // SIWC returns {models:[{slug,...}]}, rather than the API's normal paginated {data}.
  const catalog = object(await client.get<unknown>('/models', { signal, headers: { Accept: 'application/json' } }));
  if (!Array.isArray(catalog.models)) throw new ChatGPTRequestError('ChatGPT returned an invalid model catalog.', { code: 'invalid_model_catalog' });
  const models = catalog.models.map(object).filter(model => model.visibility === 'list' && nonemptyString(model.slug) &&
    acceptsImages(model) && acceptsStructuredOutputs(model));
  for (const slug of ['gpt-6-luna', 'gpt-5.6-luna', 'gpt-6.1-sol', 'gpt-6-sol', 'gpt-5.6-sol']) {
    if (models.some(model => model.slug === slug)) return slug;
  }
  const selected = models.find(model => String(model.slug).includes('luna')) ?? models[0];
  if (!selected) throw new ChatGPTRequestError('No image-capable model with structured function calls is available for this ChatGPT account.', { code: 'model_unavailable' });
  return selected.slug as string;
}

function validateCall(call: JsonObject): void {
  if (typeof call.id !== 'string' || !call.id) {
    throw new ChatGPTRequestError('ChatGPT returned an invalid function identity.', { code: 'invalid_response_stream' });
  }
  for (const [field, expected] of [['namespace', ANDROID_TOOL_NAMESPACE], ['name', ANDROID_TOOL_NAME]]) {
    if (call[field] !== expected) throw new ChatGPTRequestError('ChatGPT called an undeclared Android function. The result is unverified.', {
      code: 'undeclared_tool_call', validation: { field: `function_call.${field}`, reason: 'undeclared_tool' },
    });
  }
  if (typeof call.call_id !== 'string' || !call.call_id || typeof call.arguments !== 'string' || !call.arguments ||
    (call.status !== undefined && call.status !== 'completed')) {
    throw new ChatGPTRequestError('ChatGPT did not complete the Android function arguments. The result is unverified.', { code: 'incomplete_tool_call' });
  }
  if (call.arguments.length > MAX_EVENT_CHARACTERS) throw new ChatGPTRequestError('ChatGPT function arguments exceeded the size limit.', { code: 'response_too_large' });
}

/** The SDK owns HTTP/SSE decoding. This adapter retains only fully finalized items. */
async function sdkDecision(request: ChatGPTInferenceRequest, accessToken: string): Promise<ChatGPTInferenceResult> {
  if (!accessToken || /\s/.test(accessToken)) throw new ChatGPTRequestError('Sign in with ChatGPT before starting a test.', { code: 'not_signed_in' });
  if (typeof request.prompt !== 'string' || !request.prompt.trim()) throw new ChatGPTRequestError('A test instruction is required.', { code: 'invalid_prompt' });
  if (request.prompt.length > 256 * 1024 || !Array.isArray(request.images) || request.images.length > 8) throw new ChatGPTRequestError('The request exceeds the prompt or screenshot limit.', { code: 'input_too_large' });
  const images = request.images.map(imageDataUrl);
  if (images.reduce((total, image) => total + image.bytes, Buffer.byteLength(request.prompt)) > MAX_INPUT_BYTES) throw new ChatGPTRequestError('The request exceeds the 40 MB input limit.', { code: 'input_too_large' });
  const controller = new AbortController();
  const cancel = () => controller.abort(new ChatGPTRequestError('ChatGPT request was cancelled.', { code: 'request_cancelled' }));
  if (request.signal?.aborted) cancel();
  else request.signal?.addEventListener('abort', cancel, { once: true });
  const timer = setTimeout(() => controller.abort(new ChatGPTRequestError('ChatGPT request timed out.', { code: 'request_timeout' })), REQUEST_TIMEOUT_MS);
  timer.unref();
  let diagnostics: ChatGPTResponseDiagnostics = { status: 0, contentType: '', bodyKind: 'stream' };
  try {
    controller.signal.throwIfAborted();
    const client = new OpenAI({ apiKey: accessToken, baseURL: API_URL, organization: null, project: null,
      maxRetries: 0, timeout: REQUEST_TIMEOUT_MS, logLevel: 'off', fetchOptions: { redirect: 'error' },
      fetch: planFetch(response => {
        diagnostics = { status: response.status, contentType: response.headers.get('content-type') || '', bodyKind: 'stream',
          requestId: response.headers.get('x-request-id') ?? response.headers.get('openai-request-id') ?? undefined };
      }),
    });
    const model = await chooseModel(client, controller.signal);
    const { data: stream } = await client.responses.create({ model, store: false, stream: true,
      tools: ANDROID_STEP_TOOLS, tool_choice: 'required', parallel_tool_calls: false,
      input: [{ role: 'user', content: [{ type: 'input_text', text: request.prompt },
        ...images.map(image => ({ type: 'input_image' as const, image_url: image.url, detail: 'auto' as const }))] }],
    }, { signal: controller.signal, headers: { Accept: 'text/event-stream' } }).withResponse();
    const finalized = new Map<string, JsonObject>();
    const seen = new Map<string, JsonObject>();
    const eventTypes = new Set<string>();
    let terminal: JsonObject | undefined;
    let refusal = false;
    let eventCount = 0;
    for await (const event of stream) {
      if (++eventCount > 10000) throw new ChatGPTRequestError('ChatGPT exceeded the response event limit.', { code: 'response_too_large' });
      eventTypes.add(event.type);
      if (event.type === 'response.output_item.added' || event.type === 'response.output_item.done') {
        const item = object(event.item);
        if (item.type === 'function_call') {
          if (typeof item.id !== 'string' || !item.id) throw new ChatGPTRequestError('ChatGPT returned an invalid function identity.', { code: 'invalid_response_stream' });
          const before = seen.get(item.id);
          if (before && ['call_id', 'name', 'namespace'].some(field => before[field] !== item[field])) throw new ChatGPTRequestError('ChatGPT changed the function-call identity.', { code: 'invalid_response_stream' });
          seen.set(item.id, item);
          if (event.type === 'response.output_item.done') {
            validateCall(item);
            const prior = finalized.get(item.id);
            if (prior && prior.arguments !== item.arguments) throw new ChatGPTRequestError('ChatGPT returned conflicting finalized function calls.', { code: 'invalid_response_stream' });
            finalized.set(item.id, structuredClone(item));
          }
        }
        if (item.type === 'message' && Array.isArray(item.content) && item.content.some(part => object(part).type === 'refusal')) refusal = true;
      }
      if (event.type === 'response.refusal.delta' || event.type === 'response.refusal.done') refusal = true;
      if (event.type === 'response.content_part.done' && object(event.part).type === 'refusal') refusal = true;
      if (event.type === 'response.failed') throw errorFromBody(event.response, 'ChatGPT inference failed.', {
        code: 'response_failed', requestId: diagnostics.requestId, diagnostics,
      });
      if (event.type === 'response.incomplete') throw new ChatGPTRequestError('ChatGPT inference was incomplete. The result is unverified.', { code: 'response_incomplete' });
      if (event.type === 'response.completed') { terminal = object(event.response); break; }
    }
    controller.signal.throwIfAborted();
    if (!terminal) throw new ChatGPTRequestError('ChatGPT stream ended without response.completed.', { code: 'interrupted_response' });
    if (terminal.status !== 'completed') throw new ChatGPTRequestError('ChatGPT did not complete inference.', { code: 'response_incomplete' });
    const output = Array.isArray(terminal.output) ? terminal.output.map(object) : [];
    if (output.some(item => item.type === 'message' && Array.isArray(item.content) && item.content.some(part => object(part).type === 'refusal'))) refusal = true;
    if (refusal) throw new ChatGPTRequestError('ChatGPT declined this test step. The result is unverified.', { code: 'model_refusal' });
    const terminalCalls = output.filter(item => item.type === 'function_call');
    // SIWC currently sends terminal output:[] after output_item.done. Preserve those
    // committed items; never substitute partial argument deltas or text messages.
    const calls = terminalCalls.length ? terminalCalls : [...finalized.values()];
    if (calls.length !== 1 || seen.size > 1) throw new ChatGPTRequestError('ChatGPT must complete exactly one declared Android function call.', {
      code: calls.length > 1 || seen.size > 1 ? 'multiple_tool_calls' : seen.size ? 'incomplete_tool_call' : 'missing_tool_call',
    });
    const call = calls[0];
    validateCall(call);
    const introduced = seen.get(call.id as string);
    if (seen.size && (!introduced || ['call_id', 'namespace', 'name'].some(field => introduced[field] !== call[field]))) {
      throw new ChatGPTRequestError('ChatGPT changed the terminal function-call identity.', { code: 'invalid_response_stream' });
    }
    const committed = typeof call.id === 'string' ? finalized.get(call.id) : undefined;
    if (terminalCalls.length && finalized.size && (!committed || ['call_id', 'namespace', 'name', 'arguments'].some(field => committed[field] !== call[field]))) throw new ChatGPTRequestError('ChatGPT returned conflicting terminal function identity or arguments.', { code: 'invalid_response_stream' });
    diagnostics = { ...diagnostics, bodyKind: 'sse', responseStatus: 'completed', eventTypes: [...eventTypes].slice(0, 50),
      keys: Object.keys(terminal).slice(0, 40), functionCallCount: calls.length,
      functionCalls: [{ name: ANDROID_TOOL_NAME, namespace: ANDROID_TOOL_NAMESPACE, completeArguments: true }],
      outputItemTypes: output.map(item => String(item.type || '')).slice(0, 40) };
    request.onResponseDiagnostics?.(diagnostics);
    controller.signal.throwIfAborted();
    return { response: call.arguments as string, usage: responseUsage(terminal), model: nonemptyString(terminal.model) ?? model, diagnostics };
  } catch (error) {
    if (controller.signal.aborted) throw controller.signal.reason;
    throw sdkError(error);
  } finally {
    clearTimeout(timer);
    request.signal?.removeEventListener('abort', cancel);
  }
}

function validateAndroidStep(value: unknown): AndroidStep {
  const invalid = (field: string, reason: string): never => {
    throw new ChatGPTRequestError(`ChatGPT returned an invalid structured Android step (${field}: ${reason}).`, {
      code: 'invalid_structured_step', validation: { field, reason },
    });
  };
  const keys = (record: JsonObject, required: string[], field: string) => {
    for (const key of required) {
      if (!Object.prototype.hasOwnProperty.call(record, key)) invalid(field === 'step' ? key : `${field}.${key}`, 'missing_field');
    }
    if (Object.keys(record).some(key => !required.includes(key))) invalid(field, 'unexpected_field');
  };
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid('step', 'invalid_object');
  const step = object(value);
  keys(step, stepKeys, 'step');
  if (!step.action || typeof step.action !== 'object' || Array.isArray(step.action)) invalid('action', 'invalid_object');
  const action = object(step.action);
  keys(action, actionKeys, 'action');
  for (const key of ['observation', 'intent', 'reason']) if (typeof step[key] !== 'string') invalid(key, 'invalid_type');
  if (!actionTypes.includes(action.type as string)) invalid('action.type', 'invalid_enum');
  if (!assessments.includes(step.assessment as string)) invalid('assessment', 'invalid_enum');
  for (const key of ['x', 'y', 'endX', 'endY', 'durationMs']) {
    if (action[key] !== null && (typeof action[key] !== 'number' || !Number.isFinite(action[key]))) invalid(`action.${key}`, 'invalid_number');
  }
  if (action.text !== null && typeof action.text !== 'string') invalid('action.text', 'invalid_type');
  if ((action.type === 'finish') !== (step.assessment === 'passed' || step.assessment === 'failed' || step.assessment === 'unverified')) invalid('assessment', 'action_assessment_mismatch');
  const used = actionParameters(action.type as string);
  for (const key of actionKeys.slice(1)) {
    if (used.includes(key) && action[key] === null) invalid(`action.${key}`, 'required_for_action');
    if (!used.includes(key) && action[key] !== null) invalid(`action.${key}`, 'must_be_null');
  }
  return value as AndroidStep;
}

/** Decode only a completed declared function's schema-constrained arguments. */
export async function inferStructuredAndroidStep(
  request: ChatGPTInferenceRequest,
  accessToken: string,
): Promise<AndroidStepInferenceResult> {
  const result = await sdkDecision(request, accessToken);
  let parsed: unknown;
  try { parsed = JSON.parse(result.response); }
  catch (error) {
    const trimmed = result.response.trimStart();
    const positionMatch = error instanceof SyntaxError ? error.message.match(/position (\d+)/) : undefined;
    const position = positionMatch ? Number(positionMatch[1]) : undefined;
    throw new ChatGPTRequestError('ChatGPT did not return the requested Android function schema (function_call.arguments: invalid_json). The result is unverified.', {
      code: 'invalid_structured_step', validation: { field: 'function_call.arguments', reason: 'invalid_json' },
      diagnostics: result.diagnostics,
      payloadDiagnostics: { characterCount: result.response.length, startsFence: trimmed.startsWith('```'),
        firstCharacter: trimmed.slice(0, 1), ...(position !== undefined && position <= result.response.length ? { jsonParsePosition: position } : {}) },
    });
  }
  try { return { step: validateAndroidStep(parsed), usage: result.usage, model: result.model }; }
  catch (error) {
    if (error instanceof ChatGPTRequestError) {
      throw new ChatGPTRequestError(error.message, { code: error.code, validation: error.validation, diagnostics: result.diagnostics });
    }
    throw error;
  }
}
