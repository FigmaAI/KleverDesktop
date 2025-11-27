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
import { AppConfig, LastUsedModel } from '../types/config';

/**
 * Register all config handlers
 */
export function registerConfigHandlers(ipcMain: IpcMain): void {
  // Load config from config.json
  ipcMain.handle('config:load', async () => {
    // console.log('[config:load] === LOAD CONFIG START ===');
    try {
      const config = loadAppConfig();
      // console.log('[config:load] Loaded model config:', JSON.stringify(config.model, null, 2));
      // console.log('[config:load] === LOAD CONFIG SUCCESS ===');
      return { success: true, config };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      // console.error('[config:load] === LOAD CONFIG FAILED ===', message);
      return { success: false, error: message };
    }
  });

  // Save config to config.json
  ipcMain.handle('config:save', async (_event, config: AppConfig) => {
    console.log('[config:save] === SAVE CONFIG START ===');
    console.log('[config:save] Received model config:', JSON.stringify(config.model, null, 2));
    try {
      saveAppConfig(config);
      console.log('[config:save] === SAVE CONFIG SUCCESS ===');
      return { success: true };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('[config:save] === SAVE CONFIG FAILED ===', message);
      return { success: false, error: message };
    }
  });

  // Check if initial setup is complete (checks Python venv AND config file)
  ipcMain.handle('check:setup', async () => {
    try {
      // FIRST: Check if config.json file actually exists
      const configFileExists = configExists();

      if (!configFileExists) {
        return { success: true, setupComplete: false };
      }

      // Check if config.json has valid model configuration
      let hasValidConfig = false;
      try {
        const config = loadAppConfig();

        // Multi-provider format: check if at least one provider is configured
        if (config.model.providers && config.model.providers.length > 0) {
          // Check if at least one provider has a valid configuration
          hasValidConfig = config.model.providers.some(provider => {
            // For Ollama, no API key required
            if (provider.id === 'ollama') {
              return !!provider.preferredModel;
            }
            // For other providers, API key is required
            return !!provider.apiKey && !!provider.preferredModel;
          });
        }
      } catch {
        hasValidConfig = false;
      }

      // Check if Python runtime is available
      const pythonStatus = checkPythonRuntime();

      // Setup is complete if BOTH Python runtime is available AND config is valid
      const setupComplete = pythonStatus.available && hasValidConfig;

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

      // Multi-provider format: check if at least one provider is configured
      let isConfigured = false;

      if (config.model.providers && config.model.providers.length > 0) {
        isConfigured = config.model.providers.some(provider => {
          if (provider.id === 'ollama') {
            return !!provider.preferredModel;
          }
          return !!provider.apiKey && !!provider.preferredModel;
        });
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

  // Update last used model selection (called after task creation)
  ipcMain.handle('config:updateLastUsed', async (_event, lastUsed: LastUsedModel) => {
    console.log('[config:updateLastUsed] Updating lastUsed:', lastUsed);
    try {
      const config = loadAppConfig();
      config.model.lastUsed = lastUsed;
      saveAppConfig(config);
      console.log('[config:updateLastUsed] Success');
      return { success: true };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('[config:updateLastUsed] Error:', message);
      return { success: false, error: message };
    }
  });

  // Reset configuration and return to setup wizard
  ipcMain.handle('config:reset', async () => {
    try {
      resetAppConfig();
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
