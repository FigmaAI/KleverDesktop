/**
 * Analytics utility for Renderer Process
 * Tracks user interactions and UI events
 */

import { trackEvent } from '@aptabase/electron/renderer';

/**
 * Track an event from the renderer process
 * Automatically sanitizes sensitive information (PII)
 */
export function trackAppEvent(
  eventName: string,
  properties?: Record<string, string | number | boolean>
): void {
  try {
    const sanitized = sanitizeProperties(properties || {});

    // Log in development for debugging
    if (process.env.NODE_ENV === 'development') {
      console.log('[Analytics]', eventName, sanitized);
    }

    trackEvent(eventName, sanitized);
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

  // Remove project/task names (may contain sensitive info)
  delete sanitized.projectName;
  delete sanitized.taskName;
  delete sanitized.goal;
  delete sanitized.description;

  return sanitized;
}

/**
 * Type-safe analytics helpers for common events
 */
export const Analytics = {
  // Project events
  projectCreated: (platform: string, hasCustomWorkspace: boolean) => {
    trackAppEvent('project_created', { platform, hasCustomWorkspace });
  },

  projectDeleted: (platform: string, taskCount: number, projectAgeDays: number) => {
    trackAppEvent('project_deleted', { platform, taskCount, projectAgeDays });
  },

  // Task events
  taskCreated: (params: {
    platform: string;
    modelProvider: string;
    modelName: string;
    isScheduled: boolean;
    hasUrl: boolean;
    hasApkSource: boolean;
    customMaxRounds?: boolean;
  }) => {
    trackAppEvent('task_created', params);
  },

  taskQueued: (platform: string, queueLength: number) => {
    trackAppEvent('task_queued', { platform, queueLength });
  },

  // Model events
  modelUsed: (provider: string, model: string, context: string) => {
    trackAppEvent('model_used', { provider, model, context });
  },

  modelSwitched: (
    fromProvider: string,
    fromModel: string,
    toProvider: string,
    toModel: string
  ) => {
    trackAppEvent('model_switched', {
      fromProvider,
      fromModel,
      toProvider,
      toModel,
    });
  },

  // Schedule events
  scheduleCreated: (platform: string, scheduledType: string, futureMinutes: number) => {
    trackAppEvent('schedule_created', { platform, scheduledType, futureMinutes });
  },

  // Onboarding events
  onboardingStarted: () => {
    trackAppEvent('onboarding_started', {
      timestamp: new Date().toISOString(),
    });
  },

  onboardingCompleted: (
    durationSeconds: number,
    pythonInstalled: boolean,
    ollamaInstalled: boolean,
    providersCount: number
  ) => {
    trackAppEvent('onboarding_completed', {
      durationSeconds,
      pythonInstalled,
      ollamaInstalled,
      providersCount,
    });
  },

  // App lifecycle
  appOpened: (setupComplete: boolean, platform: string, appVersion: string) => {
    trackAppEvent('app_opened', { setupComplete, platform, appVersion });
  },

  // Settings events
  settingsChanged: (section: string, field: string) => {
    trackAppEvent('settings_changed', { section, field });
  },
};
