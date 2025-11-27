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
import { AppConfig, DEFAULT_CONFIG, isLegacyConfig, migrateConfig } from '../types/config';

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
 * Automatically migrates legacy configs to new format
 * @returns Parsed config object
 */
export function loadAppConfig(): AppConfig {
  const configPath = getConfigJsonPath();
  console.log('[config-storage] loadAppConfig called');
  console.log('[config-storage] Config path:', configPath);

  if (!fs.existsSync(configPath)) {
    console.log('[config-storage] Config file does not exist, returning defaults');
    return { ...DEFAULT_CONFIG };
  }

  try {
    const fileContents = fs.readFileSync(configPath, 'utf8');
    const rawConfig = JSON.parse(fileContents);
    console.log('[config-storage] Loaded model config from file:', JSON.stringify(rawConfig.model, null, 2));

    // Check if this is a legacy config and migrate if needed
    if (isLegacyConfig(rawConfig)) {
      console.log('[config-storage] Detected legacy config format, migrating...');
      const migratedConfig = migrateConfig(rawConfig);
      
      // Save the migrated config
      saveAppConfig(migratedConfig);
      console.log('[config-storage] Config migration complete');
      
      return migratedConfig;
    }

    const config = rawConfig as AppConfig;

    // Merge with defaults to ensure all fields exist (for version upgrades)
    const mergedConfig = mergeWithDefaults(config, DEFAULT_CONFIG);
    console.log('[config-storage] Returning merged config, model section:', JSON.stringify(mergedConfig.model, null, 2));
    return mergedConfig;
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
  console.log('[config-storage] saveAppConfig called');
  console.log('[config-storage] Config path:', configPath);

  // Ensure parent directory exists
  const parentDir = path.dirname(configPath);
  if (!fs.existsSync(parentDir)) {
    console.log('[config-storage] Creating parent directory:', parentDir);
    fs.mkdirSync(parentDir, { recursive: true });
  }

  try {
    const jsonStr = JSON.stringify(config, null, 2);
    console.log('[config-storage] Writing config to file...');
    console.log('[config-storage] Model section being saved:', JSON.stringify(config.model, null, 2));
    fs.writeFileSync(configPath, jsonStr, 'utf8');
    console.log('[config-storage] Config saved successfully to:', configPath);
    
    // Verify the save by reading back
    const savedContent = fs.readFileSync(configPath, 'utf8');
    const savedConfig = JSON.parse(savedContent);
    console.log('[config-storage] Verified saved model config:', JSON.stringify(savedConfig.model, null, 2));
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
  const userDataPath = app.getPath('userData');
  const homeDir = os.homedir();
  const legacyPath = path.join(homeDir, '.klever-desktop');

  console.log('[config-storage] ===== HARD RESET STARTING =====');
  console.log('[config-storage] Primary user data path:', userDataPath);

  let deletedCount = 0;

  // 1. Delete all project workspace directories first
  const projectsJsonPath = path.join(userDataPath, 'projects.json');
  if (fs.existsSync(projectsJsonPath)) {
    try {
      const projectsData = JSON.parse(fs.readFileSync(projectsJsonPath, 'utf8'));
      if (projectsData.projects && Array.isArray(projectsData.projects)) {
        console.log('[config-storage] Found', projectsData.projects.length, 'projects to clean up');

        for (const project of projectsData.projects) {
          if (project.workspaceDir && fs.existsSync(project.workspaceDir)) {
            try {
              console.log('[config-storage] Deleting project workspace:', project.workspaceDir);
              fs.rmSync(project.workspaceDir, { recursive: true, force: true });
              console.log('[config-storage] ✓ Successfully deleted workspace for:', project.name);
              deletedCount++;
            } catch (error) {
              const message = error instanceof Error ? error.message : 'Unknown error';
              console.error('[config-storage] ✗ Failed to delete workspace for:', project.name, 'Error:', message);
            }
          }
        }
      }
    } catch (error) {
      console.error('[config-storage] Failed to read projects.json:', error);
    }
  }

  // 2. Delete specific items in userDataPath (safer than deleting the whole directory while running)
  const itemsToDelete = [
    'config.json',
    'projects.json',
    'python',  // Downloaded Python runtime
    'python-env',  // Legacy Python venv
    'logs',
    'blob_storage',
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
    // Note: We intentionally avoid deleting 'Local Storage' and 'Cookies' here
    // as they are better handled by the renderer process or require a full restart
  ];

  if (fs.existsSync(userDataPath)) {
    for (const item of itemsToDelete) {
      const itemPath = path.join(userDataPath, item);
      if (fs.existsSync(itemPath)) {
        try {
          console.log('[config-storage] Deleting:', itemPath);
          fs.rmSync(itemPath, { recursive: true, force: true });
          console.log('[config-storage] ✓ Successfully deleted:', item);
          deletedCount++;
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown error';
          console.error('[config-storage] ✗ Failed to delete:', item, 'Error:', message);
        }
      }
    }
  }

  // 3. Delete legacy path if it exists (this is safe to delete entirely)
  if (fs.existsSync(legacyPath)) {
    try {
      console.log('[config-storage] Deleting legacy path:', legacyPath);
      fs.rmSync(legacyPath, { recursive: true, force: true });
      console.log('[config-storage] ✓ Successfully deleted legacy path');
      deletedCount++;
    } catch (error) {
      console.error('[config-storage] Failed to delete legacy path:', error);
    }
  }

  console.log('[config-storage] ===== HARD RESET COMPLETE =====');
  console.log('[config-storage] Deleted', deletedCount, 'items');
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
