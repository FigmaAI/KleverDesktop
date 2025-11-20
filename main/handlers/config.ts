/**
 * Configuration IPC handlers
 * Handles loading and saving config.json (NOT config.yaml)
 *
 * IMPORTANT: config.yaml is now read-only and only used as default values
 * All user settings are stored in ~/.klever-desktop/config.json
 */

import { IpcMain, app } from 'electron';
import { loadAppConfig, saveAppConfig, resetAppConfig, configExists, hardResetUserData } from '../utils/config-storage';
import { checkPythonRuntime } from '../utils/python-runtime';
import { AppConfig } from '../types/config';

/**
 * Register all config handlers
 */
export function registerConfigHandlers(ipcMain: IpcMain): void {
  // Load config from config.json
  ipcMain.handle('config:load', async () => {
    try {
      const config = loadAppConfig();
      return { success: true, config };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: message };
    }
  });

  // Save config to config.json
  ipcMain.handle('config:save', async (_event, config: AppConfig) => {
    try {
      saveAppConfig(config);
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

      // FIRST: Check if config.json file actually exists
      const configFileExists = configExists();
      console.log('[check:setup] Config file exists:', configFileExists);

      if (!configFileExists) {
        console.log('[check:setup] Config file does not exist, setup not complete');
        return { success: true, setupComplete: false };
      }

      // Check if config.json has valid model configuration
      let hasValidConfig = false;
      try {
        const config = loadAppConfig();

        // Check if at least one model is configured
        if (config.model.enableLocal && config.model.local.baseUrl && config.model.local.model) {
          hasValidConfig = true;
        }
        if (config.model.enableApi && config.model.api.baseUrl && config.model.api.key && config.model.api.model) {
          hasValidConfig = true;
        }
        console.log('[check:setup] Config valid:', hasValidConfig);
      } catch {
        console.log('[check:setup] Config is invalid');
        hasValidConfig = false;
      }

      // Check if Python runtime is available
      const pythonStatus = checkPythonRuntime();
      console.log('[check:setup] Python runtime status:', pythonStatus);

      // Setup is complete if BOTH Python runtime is available AND config is valid
      const setupComplete = pythonStatus.available && hasValidConfig;
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
      if (!configExists()) {
        return { success: true, setupComplete: false };
      }

      const config = loadAppConfig();

      // Check if at least one model is configured
      let isConfigured = false;

      // Local model: requires baseUrl and model
      if (config.model.enableLocal && config.model.local.baseUrl && config.model.local.model) {
        isConfigured = true;
      }

      // API model: requires key and model (baseUrl is optional for most providers)
      if (config.model.enableApi && config.model.api.key && config.model.api.model) {
        isConfigured = true;
      }

      return {
        success: true,
        setupComplete: isConfigured
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
      resetAppConfig();
      console.log('[config:reset] Configuration reset successful');
      return { success: true };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('[config:reset] Error:', message);
      return { success: false, error: message };
    }
  });

  // Hard reset: Delete entire ~/.klever-desktop/ directory
  ipcMain.handle('config:hardReset', async () => {
    try {
      console.log('[config:hardReset] Performing HARD RESET...');
      hardResetUserData();
      console.log('[config:hardReset] Hard reset successful - all user data deleted');
      return { success: true };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('[config:hardReset] Error:', message);
      return { success: false, error: message };
    }
  });

  // App restart: Relaunch the entire application
  ipcMain.handle('app:restart', async () => {
    try {
      console.log('[app:restart] Restarting application...');
      app.relaunch();
      app.quit();
      return { success: true };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('[app:restart] Error:', message);
      return { success: false, error: message };
    }
  });
}
