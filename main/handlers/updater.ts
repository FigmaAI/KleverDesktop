import { autoUpdater, BrowserWindow, dialog, app } from 'electron';
import { updateElectronApp } from 'update-electron-app';
import log from 'electron-log';

// Configure logging
log.transports.file.level = 'info';

let isManualCheck = false;

export function initializeUpdater() {
  log.info('Initializing Auto Updater via update-electron-app...');

  // Initialize the helper with default configuration
  // Defaults: checks at startup, then every 10 minutes. 
  // Automatically notifies user when update is downloaded.
  updateElectronApp({
    repo: 'FigmaAI/KleverDesktop',
    logger: log
  });

  // Add event listeners to native autoUpdater for manual check feedback
  
  autoUpdater.on('update-available', () => {
    log.info('Update available.');
    // Default behavior will download automatically.
    // update-electron-app will show a dialog when downloaded.
    if (isManualCheck) {
        // Optional: We could notify user that download started, but 
        // default behavior is usually silent until ready to restart.
        // Let's just log it.
        isManualCheck = false;
    }
  });

  autoUpdater.on('update-not-available', () => {
    log.info('Update not available.');
    if (isManualCheck) {
      const focusedWindow = BrowserWindow.getFocusedWindow();
      if (focusedWindow) {
        dialog.showMessageBox(focusedWindow, {
          type: 'info' as const,
          title: 'No Updates',
          message: 'Current version is up-to-date.',
          buttons: ['OK']
        });
      }
      isManualCheck = false;
    }
  });

  autoUpdater.on('error', (err) => {
    log.error('Error in auto-updater:', err);
    if (isManualCheck) {
        const focusedWindow = BrowserWindow.getFocusedWindow();
        if (focusedWindow) {
          dialog.showMessageBox(focusedWindow, {
            type: 'error' as const,
            title: 'Update Error',
            message: 'Failed to check for updates.',
            detail: err.message,
            buttons: ['OK']
          });
        }
      isManualCheck = false;
    }
  });
}

export function checkForUpdates(manual: boolean = false) {
  isManualCheck = manual;
  
  if (!app.isPackaged) {
      log.info('Skipping update check in dev mode (not supported by native autoUpdater without signing)');
      if (manual) {
          dialog.showMessageBox({
              type: 'info',
              title: 'Development Mode',
              message: 'Update checks are only available in the packaged application.'
          });
      }
      return;
  }
  
  log.info(`Update check initiated (Manual: ${manual})`);
  autoUpdater.checkForUpdates();
}
