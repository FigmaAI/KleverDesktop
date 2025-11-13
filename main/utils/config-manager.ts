/**
 * Configuration file management utilities
 * Handles reading/writing YAML config files for the Python backend
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

/**
 * Get the path to the appagent config file
 * @returns Path to appagent/config.yaml
 */
export function getConfigPath(): string {
  return path.join(process.cwd(), 'appagent', 'config.yaml');
}

/**
 * Load configuration from YAML file
 * @returns Parsed config object
 */
export function loadConfig(): Record<string, unknown> {
  const configPath = getConfigPath();

  if (!fs.existsSync(configPath)) {
    return {};
  }

  try {
    const fileContents = fs.readFileSync(configPath, 'utf8');
    return yaml.load(fileContents) as Record<string, unknown>;
  } catch (error) {
    console.error('Error loading config:', error);
    return {};
  }
}

/**
 * Save configuration to YAML file
 * @param config - Configuration object to save
 */
export function saveConfig(config: Record<string, unknown>): void {
  const configPath = getConfigPath();
  const yamlStr = yaml.dump(config);
  fs.writeFileSync(configPath, yamlStr, 'utf8');
}

/**
 * Update specific config values
 * @param updates - Object containing config keys to update
 */
export function updateConfig(updates: Record<string, unknown>): void {
  const config = loadConfig();
  Object.assign(config, updates);
  saveConfig(config);
}

/**
 * Reset configuration by deleting the config file
 * This will force the user back to the setup wizard
 */
export function resetConfig(): void {
  const configPath = getConfigPath();
  
  console.log('[config-manager] Attempting to reset configuration at:', configPath);
  
  if (fs.existsSync(configPath)) {
    try {
      fs.unlinkSync(configPath);
      console.log('[config-manager] Configuration file successfully deleted:', configPath);
    } catch (error) {
      console.error('[config-manager] Failed to delete configuration file:', error);
      throw error;
    }
  } else {
    console.log('[config-manager] Configuration file does not exist (already reset):', configPath);
  }
}
