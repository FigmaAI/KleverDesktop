/**
 * Analytics utility for Main Process
 * Tracks events from background tasks and system operations
 */

import { trackEvent as mainTrackEvent } from '@aptabase/electron/main';

/**
 * Track an event from the main process
 * Automatically sanitizes sensitive information (PII)
 */
export function trackTaskEvent(
  eventName: string,
  properties: Record<string, string | number | boolean>
): void {
  try {
    const sanitized = sanitizeProperties(properties);
    mainTrackEvent(eventName, sanitized);
  } catch (error) {
    console.error('[Analytics] Failed to track event:', eventName, error);
  }
}

/**
 * Sanitize properties to remove PII and sensitive information
 */
function sanitizeProperties(
  props: Record<string, string | number | boolean>
): Record<string, string | number | boolean> {
  const sanitized = { ...props };

  // Remove API keys
  delete sanitized.apiKey;
  delete sanitized.API_KEY;
  delete sanitized.api_key;

  // Remove/sanitize URLs
  if (sanitized.url && typeof sanitized.url === 'string') {
    sanitized.url = sanitized.url.includes('http') ? 'provided' : 'none';
  }
  if (sanitized.baseUrl && typeof sanitized.baseUrl === 'string') {
    sanitized.baseUrl = sanitized.baseUrl.includes('localhost') ? 'local' : 'remote';
  }

  // Remove file paths
  delete sanitized.path;
  delete sanitized.workspaceDir;
  delete sanitized.apkPath;
  delete sanitized.resultPath;

  // Remove task descriptions (may contain sensitive info)
  delete sanitized.goal;
  delete sanitized.description;

  return sanitized;
}
