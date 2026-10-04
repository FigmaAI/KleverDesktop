import { IpcMain, BrowserWindow, dialog, shell } from 'electron';
import { loadAppConfig } from '../utils/config-storage';
import { getAndroidStatus, listAndroidDevices, listAndroidEmulators, startAndroidEmulator } from '../utils/android-driver';

const setupControllers = new Set<AbortController>();

export function registerAndroidHandlers(ipcMain: IpcMain, getMainWindow: () => BrowserWindow | null): void {
  ipcMain.handle('android:status', async () => {
    try {
      const sdkPath = loadAppConfig().android.sdkPath;
      const status = await getAndroidStatus({ sdkPath });
      return { success: true, ready: status.adbAvailable, sdkPath, adbPath: status.adbPath,
        ...(!status.adbAvailable ? { error: 'Set up Android SDK platform tools to connect a device.' } : {}),
      };
    } catch (error) { return { success: false, ready: false, error: error instanceof Error ? error.message : 'Unable to check Android tools.' }; }
  });
  ipcMain.handle('android:devices', async () => {
    try {
      const devices = await listAndroidDevices({ sdkPath: loadAppConfig().android.sdkPath });
      return { success: true, devices: devices.map(device => ({ id: device.serial, state: device.state, ...(device.model ? { model: device.model } : {}) })) };
    } catch (error) { return { success: false, devices: [], error: error instanceof Error ? error.message : 'Unable to list Android devices.' }; }
  });
  ipcMain.handle('android:emulators', async () => {
    try { return { success: true, names: await listAndroidEmulators({ sdkPath: loadAppConfig().android.sdkPath }) }; }
    catch (error) { return { success: false, names: [], error: error instanceof Error ? error.message : 'Unable to list Android emulators.' }; }
  });
  ipcMain.handle('android:start-emulator', async (_event, avdName?: string) => {
    const controller = new AbortController();
    setupControllers.add(controller);
    try {
      if (avdName !== undefined && (typeof avdName !== 'string' || !/^[A-Za-z0-9._-]{1,200}$/.test(avdName))) throw new Error('Select a valid Android emulator.');
      const result = await startAndroidEmulator({ sdkPath: loadAppConfig().android.sdkPath, avdName, signal: controller.signal });
      return { success: true, serial: result.serial };
    } catch (error) { return { success: false, error: error instanceof Error ? error.message : 'Unable to start Android emulator.' }; }
    finally { setupControllers.delete(controller); }
  });
  ipcMain.handle('android:installTools', async () => {
    try {
      await shell.openExternal('https://developer.android.com/studio');
      return { success: true, needsManualInstall: true };
    } catch (error) { return { success: false, error: error instanceof Error ? error.message : 'Unable to open Android SDK setup.' }; }
  });
  ipcMain.handle('apk:selectFile', async () => {
    try {
      const window = getMainWindow();
      if (!window || window.isDestroyed()) return { success: false, error: 'Open the application window to select an APK.' };
      const selected = await dialog.showOpenDialog(window, { properties: ['openFile'], filters: [{ name: 'Android package', extensions: ['apk'] }] });
      return { success: true, canceled: selected.canceled, ...(selected.filePaths[0] ? { path: selected.filePaths[0] } : {}) };
    } catch (error) { return { success: false, error: error instanceof Error ? error.message : 'Unable to select APK.' }; }
  });
}

export function cleanupAndroidSetup(): void {
  for (const controller of setupControllers) controller.abort();
  setupControllers.clear();
}
