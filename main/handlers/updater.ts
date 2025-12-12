import { autoUpdater, BrowserWindow, dialog, app } from 'electron';
import log from 'electron-log';

// Configure logging
log.transports.file.level = 'info';

let isManualCheck = false;
const UPDATE_CHECK_INTERVAL = 10 * 60 * 1000; // 10 minutes

export function initializeUpdater() {
  // Exit early on unsupported platforms
  if (process.platform !== 'darwin' && process.platform !== 'win32') {
    log.info('Auto-updater not supported on', process.platform);
    return;
  }

  // Don't run in development
  if (!app.isPackaged) {
    log.info('Auto-updater disabled in development mode');
    return;
  }

  log.info('Initializing Auto Updater with manual configuration...');

  // Construct feed URL
  // For macOS universal builds, always use 'darwin-universal' regardless of actual arch
  const platform = process.platform === 'darwin' ? 'darwin-universal' : `${process.platform}-${process.arch}`;
  const feedURL = `https://update.electronjs.org/FigmaAI/KleverDesktop/${platform}/${app.getVersion()}`;
  const userAgent = `update-electron-app/manual (${process.platform}: ${process.arch})`;

  log.info('feedURL:', feedURL);
  log.info('requestHeaders:', { 'User-Agent': userAgent });

  // Set feed URL
  autoUpdater.setFeedURL({
    url: feedURL,
    headers: { 'User-Agent': userAgent },
    serverType: 'default',
  });

  // Add event listeners
  autoUpdater.on('error', (err) => {
    log.error('Auto-updater error:', err);
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

  autoUpdater.on('checking-for-update', () => {
    log.info('Checking for update...');
  });

  autoUpdater.on('update-available', () => {
    log.info('Update available - downloading...');
    if (isManualCheck) {
      isManualCheck = false;
    }
  });

  autoUpdater.on('update-not-available', () => {
    log.info('No updates available');
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

  autoUpdater.on('update-downloaded', (event, releaseNotes, releaseName) => {
    log.info('Update downloaded:', releaseName);

    const focusedWindow = BrowserWindow.getFocusedWindow();
    if (focusedWindow) {
      dialog.showMessageBox(focusedWindow, {
        type: 'info' as const,
        buttons: ['Restart', 'Later'],
        title: 'Application Update',
        message: process.platform === 'win32' ? releaseNotes : releaseName,
        detail: 'A new version has been downloaded. Restart the application to apply the updates.',
      }).then(({ response }) => {
        if (response === 0) {
          autoUpdater.quitAndInstall();
        }
      });
    }
  });

  // Check for updates on startup
  autoUpdater.checkForUpdates();

  // Check for updates every 10 minutes
  setInterval(() => {
    autoUpdater.checkForUpdates();
  }, UPDATE_CHECK_INTERVAL);
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
