/**
 * Configuration IPC handlers
 * Handles loading and saving YAML config files
 */

import { IpcMain } from 'electron';
import { loadConfig, saveConfig, resetConfig } from '../utils/config-manager';
import { checkVenvStatus } from '../utils/python-manager';

/**
 * Register all config handlers
 */
export function registerConfigHandlers(ipcMain: IpcMain): void {
  // Load config from YAML
  ipcMain.handle('config:load', async () => {
    try {
      const config = loadConfig();
      return { success: true, config };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: message };
    }
  });

  // Save config to YAML
  ipcMain.handle('config:save', async (_event, config: Record<string, unknown>) => {
    try {
      saveConfig(config);
      return { success: true };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: message };
    }
  });

  // Check if initial setup is complete (checks Python venv AND config file)
  ipcMain.handle('check:setup', async () => {
    try {
      console.log('[check:setup] Checking if setup is complete...');

      // Check if config exists and has required fields
      let hasValidConfig = false;
      try {
        const config = loadConfig();
        const hasLocalEnabled = config.ENABLE_LOCAL === true;
        const hasApiEnabled = config.ENABLE_API === true;

        // Check if at least one model is configured
        if (hasLocalEnabled && config.LOCAL_BASE_URL && config.LOCAL_MODEL) {
          hasValidConfig = true;
        }
        if (hasApiEnabled && config.API_BASE_URL && config.API_KEY && config.API_MODEL) {
          hasValidConfig = true;
        }
        console.log('[check:setup] Config valid:', hasValidConfig);
      } catch {
        console.log('[check:setup] Config does not exist or is invalid');
        hasValidConfig = false;
      }

      // Check if venv exists and is valid
      const venvStatus = checkVenvStatus();
      console.log('[check:setup] Venv status:', venvStatus);

      // Setup is complete if BOTH venv is valid AND config is valid
      const setupComplete = venvStatus.valid && hasValidConfig;
      console.log('[check:setup] Setup complete:', setupComplete);

      return { success: true, setupComplete };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('[check:setup] Error:', message);
      return { success: true, setupComplete: false };
    }
  });

  // LEGACY: Check if initial setup is complete (checks config only)
  ipcMain.handle('config:checkSetup', async () => {
    try {
      const config = loadConfig();

      // Check if config has required fields
      const hasModel = config.MODEL === 'local' || config.MODEL === 'api';
      const hasLocalEnabled = config.ENABLE_LOCAL === true;
      const hasApiEnabled = config.ENABLE_API === true;

      // Check if at least one model is configured
      let isConfigured = false;

      if (hasLocalEnabled && config.LOCAL_BASE_URL && config.LOCAL_MODEL) {
        isConfigured = true;
      }

      if (hasApiEnabled && config.API_BASE_URL && config.API_KEY && config.API_MODEL) {
        isConfigured = true;
      }

      return {
        success: true,
        setupComplete: hasModel && isConfigured
      };
    } catch {
      // If config doesn't exist or error loading, setup is not complete
      return { success: true, setupComplete: false };
    }
  });

  // Reset configuration and return to setup wizard
  ipcMain.handle('config:reset', async () => {
    try {
      console.log('[config:reset] Resetting configuration...');
      resetConfig();
      console.log('[config:reset] Configuration reset successful');
      return { success: true };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('[config:reset] Error:', message);
      return { success: false, error: message };
    }
  });
}
