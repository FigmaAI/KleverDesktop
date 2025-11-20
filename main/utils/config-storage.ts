/**
 * Configuration storage utilities
 * Manages ~/.klever-desktop/config.json
 *
 * IMPORTANT: This replaces the old config-manager.ts which modified appagent/config.yaml
 * Now config.yaml is read-only and only used as default values
 */

import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import { AppConfig, DEFAULT_CONFIG } from '../types/config';

/**
 * Get the path to config.json in user data directory
 * @returns Path to ~/.klever-desktop/config.json
 */
export function getConfigJsonPath(): string {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'config.json');
}

/**
 * Load application configuration from config.json
 * If file doesn't exist, returns default configuration
 * @returns Parsed config object
 */
export function loadAppConfig(): AppConfig {
  const configPath = getConfigJsonPath();

  if (!fs.existsSync(configPath)) {
    console.log('[config-storage] config.json not found, using defaults');
    return { ...DEFAULT_CONFIG };
  }

  try {
    const fileContents = fs.readFileSync(configPath, 'utf8');
    const config = JSON.parse(fileContents) as AppConfig;

    // Merge with defaults to ensure all fields exist (for version upgrades)
    return mergeWithDefaults(config, DEFAULT_CONFIG);
  } catch (error) {
    console.error('[config-storage] Error loading config.json:', error);
    return { ...DEFAULT_CONFIG };
  }
}

/**
 * Save application configuration to config.json
 * @param config - Configuration object to save
 */
export function saveAppConfig(config: AppConfig): void {
  const configPath = getConfigJsonPath();

  // Ensure parent directory exists
  const parentDir = path.dirname(configPath);
  if (!fs.existsSync(parentDir)) {
    fs.mkdirSync(parentDir, { recursive: true });
  }

  try {
    const jsonStr = JSON.stringify(config, null, 2);
    fs.writeFileSync(configPath, jsonStr, 'utf8');
    console.log('[config-storage] Configuration saved to:', configPath);
  } catch (error) {
    console.error('[config-storage] Error saving config.json:', error);
    throw error;
  }
}

/**
 * Update specific config values
 * @param updates - Partial config object with fields to update
 */
export function updateAppConfig(updates: Partial<AppConfig>): void {
  const config = loadAppConfig();
  const updatedConfig = deepMerge(config, updates);
  saveAppConfig(updatedConfig);
}

/**
 * Reset configuration by deleting config.json
 * This will force the user back to the setup wizard
 */
export function resetAppConfig(): void {
  const configPath = getConfigJsonPath();

  console.log('[config-storage] Attempting to reset configuration at:', configPath);

  if (fs.existsSync(configPath)) {
    try {
      fs.unlinkSync(configPath);
      console.log('[config-storage] Configuration file successfully deleted:', configPath);
    } catch (error) {
      console.error('[config-storage] Failed to delete configuration file:', error);
      throw error;
    }
  } else {
    console.log('[config-storage] Configuration file does not exist (already reset):', configPath);
  }
}

/**
 * Check if config.json exists
 * @returns true if config.json exists
 */
export function configExists(): boolean {
  const configPath = getConfigJsonPath();
  return fs.existsSync(configPath);
}

/**
 * Hard reset: Delete entire ~/.klever-desktop/ directory
 * WARNING: This will remove ALL user data including:
 * - config.json (settings)
 * - projects.json (all projects and tasks)
 * - python/ (bundled Python runtime)
 * - Any other data stored in user directory
 *
 * This action cannot be undone!
 */
export function hardResetUserData(): void {
  const userDataPath = app.getPath('userData');

  console.log('[config-storage] Attempting HARD RESET of user data directory:', userDataPath);

  if (fs.existsSync(userDataPath)) {
    try {
      // Recursively delete the entire directory
      fs.rmSync(userDataPath, { recursive: true, force: true });
      console.log('[config-storage] User data directory successfully deleted:', userDataPath);
    } catch (error) {
      console.error('[config-storage] Failed to delete user data directory:', error);
      throw error;
    }
  } else {
    console.log('[config-storage] User data directory does not exist:', userDataPath);
  }
}

/**
 * Deep merge two objects (for nested config updates)
 */
function deepMerge<T>(target: T, source: Partial<T>): T {
  const result = { ...target };

  for (const key in source) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      const sourceValue = source[key];
      const targetValue = result[key];

      if (
        sourceValue &&
        typeof sourceValue === 'object' &&
        !Array.isArray(sourceValue) &&
        targetValue &&
        typeof targetValue === 'object' &&
        !Array.isArray(targetValue)
      ) {
        // Recursively merge nested objects
        result[key] = deepMerge(targetValue, sourceValue as Partial<typeof targetValue>);
      } else {
        // Direct assignment for primitives and arrays
        result[key] = sourceValue as T[Extract<keyof T, string>];
      }
    }
  }

  return result;
}

/**
 * Merge loaded config with defaults to ensure all fields exist
 * Useful for handling config version upgrades
 */
function mergeWithDefaults(loaded: Partial<AppConfig>, defaults: AppConfig): AppConfig {
  return deepMerge(defaults, loaded);
}
