/**
 * Configuration storage utilities
 * Manages ~/.klever-desktop/config.json
 *
 * IMPORTANT: This replaces the old config-manager.ts which modified appagent/config.yaml
 * Now config.yaml is read-only and only used as default values
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { app } from 'electron';
import { AppConfig, DEFAULT_CONFIG, isLegacyConfig, isSingleProviderConfig, migrateConfig, migrateSingleProviderConfig } from '../types/config';
import { getKleverDir } from './python-runtime';

/**
 * Get the path to config.json in user data directory
 * @returns Path to ~/.klever-desktop/config.json
 */
export function getConfigJsonPath(): string {
  return path.join(getKleverDir(), 'config.json');
}

/**
 * Load application configuration from config.json
 * If file doesn't exist, returns default configuration
 * Automatically migrates legacy configs to new format
 * @returns Parsed config object
 */
export function loadAppConfig(): AppConfig {
  const configPath = getConfigJsonPath();

  if (!fs.existsSync(configPath)) {
    console.log('[config-storage] Config not found, using defaults');
    return { ...DEFAULT_CONFIG };
  }

  try {
    const fileContents = fs.readFileSync(configPath, 'utf8');
    const rawConfig = JSON.parse(fileContents);

    // Check if this is a very old legacy config (enableLocal/enableApi) and migrate
    if (isLegacyConfig(rawConfig)) {
      console.log('[config-storage] Migrating legacy config...');
      const migratedConfig = migrateConfig(rawConfig);
      saveAppConfig(migratedConfig);
      return migratedConfig;
    }

    // Check if this is a single-provider config and migrate to multi-provider
    if (isSingleProviderConfig(rawConfig)) {
      console.log('[config-storage] Migrating single-provider to multi-provider...');
      const migratedConfig = migrateSingleProviderConfig(rawConfig);
      saveAppConfig(migratedConfig);
      return migratedConfig;
    }

    // Merge with defaults to ensure all fields exist (for version upgrades)
    return mergeWithDefaults(rawConfig as AppConfig, DEFAULT_CONFIG);
  } catch (error) {
    console.error('[config-storage] Error loading config:', error);
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
  } catch (error) {
    console.error('[config-storage] Error saving config:', error);
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

  if (fs.existsSync(configPath)) {
    try {
      fs.unlinkSync(configPath);
    } catch (error) {
      console.error('[config-storage] Failed to delete configuration file:', error);
      throw error;
    }
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
 * Hard reset: Delete entire user data directory and all project workspaces
 * WARNING: This will remove ALL user data including:
 * - config.json (settings)
 * - projects.json (all projects and tasks)
 * - All project workspace directories in ~/Documents
 * - python/ (Downloaded Python runtime)
 * - python-env/ (Python virtual environment)
 * - Any other data stored in user directory
 *
 * This action cannot be undone!
 */
export function hardResetUserData(): void {
  const kleverDir = getKleverDir();

  console.log('[config-storage] Hard reset starting...');

  // 1. Delete all project workspace directories first
  const projectsJsonPath = path.join(kleverDir, 'projects.json');
  if (fs.existsSync(projectsJsonPath)) {
    try {
      const projectsData = JSON.parse(fs.readFileSync(projectsJsonPath, 'utf8'));
      if (projectsData.projects && Array.isArray(projectsData.projects)) {
        for (const project of projectsData.projects) {
          if (project.workspaceDir && fs.existsSync(project.workspaceDir)) {
            try {
              fs.rmSync(project.workspaceDir, { recursive: true, force: true });
            } catch {
              // Ignore deletion errors for workspaces
            }
          }
        }
      }
    } catch {
      // Ignore projects.json read errors
    }
  }

  // 2. Delete specific items in userDataPath
  const itemsToDelete = [
    'config.json',
    'projects.json',
    'python',
    'python-env',
    'logs',
    'blob_storage',
    'browser-profile',  // Playwright browser profile (Google login sessions)
    'Session Storage',
    'Code Cache',
    'DawnGraphiteCache',
    'DawnWebGPUCache',
    'GPUCache',
    'Network Persistent State',
    'Shared Dictionary',
    'SharedStorage',
    'Trust Tokens',
    'Trust Tokens-journal'
  ];

  // 2. Delete all items in ~/.klever-desktop/
  if (fs.existsSync(kleverDir)) {
    for (const item of itemsToDelete) {
      const itemPath = path.join(kleverDir, item);
      if (fs.existsSync(itemPath)) {
        try {
          fs.rmSync(itemPath, { recursive: true, force: true });
        } catch {
          // Ignore deletion errors
        }
      }
    }
  }

  console.log('[config-storage] Hard reset complete');
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
