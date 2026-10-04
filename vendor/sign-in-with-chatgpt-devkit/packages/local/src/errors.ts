import type { SessionError } from "./types.js";

interface ErrorDiagnostics {
  requestId?: string;
  param?: string;
  responseShape?: string;
}

export class ChatGPTError extends Error implements SessionError {
  readonly code: string;
  readonly retryable: boolean;
  readonly status?: number;
  readonly requestId?: string;
  readonly param?: string;
  readonly responseShape?: string;

  constructor(code: string, message: string, retryable = false, status?: number, diagnostics: ErrorDiagnostics = {}) {
    super(message);
    this.name = "ChatGPTError";
    this.code = code;
    this.retryable = retryable;
    if (status !== undefined) this.status = status;
    if (diagnostics.requestId !== undefined) this.requestId = diagnostics.requestId;
    if (diagnostics.param !== undefined) this.param = diagnostics.param;
    if (diagnostics.responseShape !== undefined) this.responseShape = diagnostics.responseShape;
  }

  toJSON(): SessionError {
    return {
      code: this.code,
      message: this.message,
      retryable: this.retryable,
      ...(this.status !== undefined ? { status: this.status } : {}),
      ...(this.requestId !== undefined ? { requestId: this.requestId } : {}),
      ...(this.param !== undefined ? { param: this.param } : {}),
      ...(this.responseShape !== undefined ? { responseShape: this.responseShape } : {}),
    };
  }
}

const API_ERRORS: Record<string, [string, boolean]> = {
  subscription_sharing_user_not_eligible: ["Token sharing is not available for this ChatGPT account or workspace.", false],
  subscription_sharing_usage_limit_exceeded: ["A ChatGPT sharing limit has been reached. Check your usage and app limits in ChatGPT Settings.", false],
  subscription_sharing_usage_unavailable: ["ChatGPT usage could not be checked. Try again shortly.", true],
  subscription_sharing_unsupported_capability: ["This request includes a capability that token sharing does not support.", false],
  subscription_sharing_route_not_supported: ["This request uses a route that token sharing does not support.", false],
  subscription_sharing_invalid_user: ["ChatGPT could not validate the selected account's subscription context. Check this connection and its granted permissions.", false],
  subscription_sharing_user_unavailable: ["Your ChatGPT account or workspace is temporarily unavailable. Try again shortly.", true],
  chatpass_v2_scope_not_authorized: ["The granted ChatGPT permissions do not authorize this request. Check the app and grant configuration.", false],
  chatpass_v2_invalid_authorization_context: ["The ChatGPT authorization context does not permit this request. Check the app and grant configuration.", false],
  invalid_client: ["ChatGPT rejected the app's client configuration. Check the saved registration before trying again.", false],
  invalid_grant: ["ChatGPT did not accept this authorization grant. Start sign-in again with the saved connection.", false],
  invalid_refresh_token: ["Your ChatGPT connection can no longer be renewed. Sign in again.", false],
  token_expired: ["Your ChatGPT connection can no longer be renewed. Sign in again.", false],
  refresh_token_expired: ["Your ChatGPT connection can no longer be renewed. Sign in again.", false],
  refresh_token_invalidated: ["Your ChatGPT connection can no longer be renewed. Sign in again.", false],
  refresh_token_reused: ["Your ChatGPT connection can no longer be renewed. Sign in again.", false],
  invalid_token: ["ChatGPT did not accept this credential. Check the selected connection and its granted permissions.", false],
  invalid_api_key: ["ChatGPT did not accept this credential. Check the selected connection and its granted permissions.", false],
  access_denied: ["Sign-in was not completed. You can try again when you are ready.", false],
  model_not_found: ["This model is not available for your ChatGPT connection. Choose a supported model.", false],
};

// Recognize earlier responses without replacing the server's exact error code.
const LEGACY_CODES: Record<string, string> = {
  subscription_sharing_v2_user_not_eligible: "subscription_sharing_user_not_eligible",
  subscription_sharing_v2_route_not_supported: "subscription_sharing_route_not_supported",
  subscription_sharing_v2_invalid_user: "subscription_sharing_invalid_user",
  subscription_sharing_v2_user_unavailable: "subscription_sharing_user_unavailable",
};

const REQUEST_FIELDS: Record<string, string> = {
  input: "input",
  model: "model",
  instructions: "instructions",
  store: "storage setting",
  stream: "streaming setting",
  tools: "tools",
  background: "background setting",
  conversation: "conversation setting",
};

const SHAPE_FIELDS = new Set(["error", "detail", "code", "message", "type", "param", "loc", "input", "ctx", "response", "status", "request_id"]);

function shapeOf(value: unknown, depth = 0): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return depth < 3 ? `[${value.length ? shapeOf(value[0], depth + 1) : ""}]` : "array";
  if (!isObject(value)) return typeof value;
  if (depth >= 3) return "object";
  const fields = Object.entries(value).filter(([key]) => SHAPE_FIELDS.has(key)).slice(0, 12);
  const unknownCount = Object.keys(value).length - fields.length;
  return `{${[
    ...fields.map(([key, child]) => `${key}:${key === "input" || key === "ctx" ? "redacted" : shapeOf(child, depth + 1)}`),
    ...(unknownCount ? [`other:${unknownCount}`] : []),
  ].join(",")}}`;
}

function safeIdentifier(value: unknown, maxLength = 160): string | undefined {
  return typeof value === "string" && value.length <= maxLength && /^[a-zA-Z0-9_][a-zA-Z0-9_.:[\]-]*$/.test(value)
    ? value : undefined;
}

function invalidRequest(detail: Record<string, unknown>): string {
  // Validation responses can echo the submitted input. Use recognized field
  // names and categories only, never server messages or submitted values.
  const issues = Array.isArray(detail.detail) ? detail.detail.filter(isObject) : [detail];
  for (const issue of issues) {
    const locations = Array.isArray(issue.loc) ? issue.loc : [issue.param];
    const field = locations.find((value): value is string => typeof value === "string" && Object.hasOwn(REQUEST_FIELDS, value));
    if (field === "input" && issue.type === "list_type") {
      return "ChatGPT requires input as a list of messages. Update the app's request format.";
    }
    if (field) return `ChatGPT rejected the request's ${REQUEST_FIELDS[field]}. Check its format and supported values.`;
  }
  return "ChatGPT rejected this request. Check its input, model, and supported options.";
}

export function apiError(body: unknown, status?: number, requestId?: string | null): ChatGPTError {
  let detail = isObject(body) ? body : {};
  for (let depth = 0; depth < 4; depth += 1) {
    if (isObject(detail.error)) detail = detail.error;
    else if (isObject(detail.detail)) detail = detail.detail;
    else break;
  }
  // OAuth errors use a string `error`; Responses errors use `error.code`.
  // In particular, admission `detail` text is not a machine-readable code.
  const code = safeIdentifier(typeof detail.error === "string" ? detail.error : detail.code, 100) ?? "api_error";
  const safeRequestId = safeIdentifier(requestId);
  const param = safeIdentifier(detail.param);
  const diagnostics: ErrorDiagnostics = {
    responseShape: shapeOf(body),
    ...(safeRequestId ? { requestId: safeRequestId } : {}),
    ...(param ? { param } : {}),
  };
  const error = (message: string, retryable = false) => new ChatGPTError(code, message, retryable, status, diagnostics);
  const known = API_ERRORS[code] ?? API_ERRORS[LEGACY_CODES[code] ?? ""];
  if (known) return error(known[0], known[1]);
  if (code === "subscription_sharing_v2_client_not_enabled") return error("This app is not enabled for token sharing. Contact the app developer.");
  if (status === 400 || status === 422 || code === "invalid_request_error" || code === "invalid_request") return error(invalidRequest(detail));
  if (status === 401) return error("ChatGPT did not accept the selected connection's signed identity or direct permission. Check the profile and granted scopes.");
  if (status === 403) return error("A ChatGPT policy or permission restriction prevented this request. Check the app's configuration and permitted serving region.");
  if (status === 429) return error("Too many requests. Wait a moment before trying again.", true);
  if (status && status >= 500) return error("ChatGPT is temporarily unavailable. Try again shortly.", true);
  return error("ChatGPT could not complete this request.");
}

export function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function asError(error: unknown): ChatGPTError {
  if (error instanceof ChatGPTError) return error;
  if (error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError")) {
    return new ChatGPTError("cancelled", "The request was cancelled.");
  }
  return new ChatGPTError("connection_error", "The connection could not be completed. Try again.", true);
}

// Apply only to errors from grant_type=refresh_token, not authorization-code
// exchange or API admission failures (including HTTP 401).
export function requiresReauthentication(error: ChatGPTError): boolean {
  return ["invalid_grant", "invalid_refresh_token", "token_expired", "refresh_token_expired", "refresh_token_invalidated", "refresh_token_reused"].includes(error.code);
}

export async function fetchRemote(url: string, init: RequestInit = {}, timeoutMs = 30_000): Promise<Response> {
  const timeout = AbortSignal.timeout(timeoutMs);
  const signal = init.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
  try {
    return await fetch(url, { ...init, signal, redirect: "error" });
  } catch {
    if (init.signal?.aborted) throw new ChatGPTError("cancelled", "The request was cancelled.");
    throw new ChatGPTError("network_error", "Could not reach ChatGPT. Check your connection and try again.", true);
  }
}

export async function jsonResponse(response: Response): Promise<unknown> {
  try {
    return await response.json() as unknown;
  } catch (error) {
    // Fetch may resolve its headers before cancellation interrupts the body.
    // Keep that cancellation distinct from a malformed JSON response.
    if (error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError")) {
      throw asError(error);
    }
    if (!response.ok) throw apiError(undefined, response.status, response.headers.get("x-request-id"));
    throw new ChatGPTError("invalid_response", "ChatGPT returned an unexpected response. Try again.", true, response.status);
  }
}
