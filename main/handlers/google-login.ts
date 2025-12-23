/**
 * Google Login IPC handlers
 * Handles Google login for web browsers (Playwright) and Android devices (ADB)
 */

import { IpcMain, BrowserWindow, dialog, app } from 'electron';
import { ChildProcess, exec } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { spawnBundledPython, getPythonEnv, getCorePath } from '../utils/python-runtime';
import { loadAppConfig, saveAppConfig } from '../utils/config-storage';

let webLoginProcess: ChildProcess | null = null;
let androidLoginProcess: ChildProcess | null = null;

/**
 * Get browser profile directory path
 */
function getBrowserProfilePath(): string {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'browser-profile');
}

/**
 * Get storage state file path (for Playwright auth)
 */
function getStorageStatePath(): string {
  return path.join(getBrowserProfilePath(), 'google-auth.json');
}

/**
 * Check actual login status by inspecting storage state file directly
 * No need to run Python - just check the JSON file for Google cookies
 */
function checkStorageStateForGoogleLogin(): { loggedIn: boolean; hasAuthCookies: boolean } {
  const storagePath = getStorageStatePath();
  
  if (!fs.existsSync(storagePath)) {
    console.log('[Google Login] No storage state file found');
    return { loggedIn: false, hasAuthCookies: false };
  }
  
  try {
    const stateData = fs.readFileSync(storagePath, 'utf-8');
    const state = JSON.parse(stateData);
    const cookies = state.cookies || [];
    
    // Filter Google cookies
    const googleCookies = cookies.filter((c: { domain?: string }) => 
      c.domain && c.domain.includes('google.com')
    );
    
    // Check for essential Google auth cookies
    const authCookieNames = ['SID', 'HSID', 'SSID', 'APISID', 'SAPISID'];
    const hasAuthCookies = googleCookies.some((c: { name?: string }) => 
      c.name && authCookieNames.includes(c.name)
    );
    
    console.log('[Google Login] Storage state check:', {
      totalCookies: cookies.length,
      googleCookies: googleCookies.length,
      hasAuthCookies,
    });
    
    return { loggedIn: hasAuthCookies, hasAuthCookies };
  } catch (error) {
    console.error('[Google Login] Error reading storage state:', error);
    return { loggedIn: false, hasAuthCookies: false };
  }
}

/**
 * Execute ADB command and return result
 */
function executeAdb(command: string, sdkPath?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    // Find adb path
    let adbPath = 'adb';
    if (sdkPath) {
      const platformToolsAdb = path.join(sdkPath, 'platform-tools', 'adb');
      if (fs.existsSync(platformToolsAdb)) {
        adbPath = platformToolsAdb;
      }
    }
    
    const fullCommand = `${adbPath} ${command}`;
    exec(fullCommand, (error, stdout, stderr) => {
      if (error) {
        reject(stderr || error.message);
      } else {
        resolve(stdout.trim());
      }
    });
  });
}


/**
 * List connected Android devices
 */
async function listAndroidDevices(sdkPath?: string): Promise<string[]> {
  try {
    const result = await executeAdb('devices', sdkPath);
    const lines = result.split('\n').slice(1); // Skip header line
    const devices: string[] = [];
    
    for (const line of lines) {
      const parts = line.trim().split('\t');
      if (parts.length >= 2 && parts[1] === 'device') {
        devices.push(parts[0]);
      }
    }
    
    return devices;
  } catch {
    return [];
  }
}

/**
 * Register all Google login handlers
 */
export function registerGoogleLoginHandlers(
  ipcMain: IpcMain,
  getMainWindow: () => BrowserWindow | null
): void {
  
  // Get browser profile path
  ipcMain.handle('google-login:get-profile-path', async () => {
    return { success: true, path: getBrowserProfilePath() };
  });

  // Start web browser Google login
  ipcMain.handle('google-login:web:start', async () => {
    try {
      const mainWindow = getMainWindow();
      const profilePath = getBrowserProfilePath();
      const corePath = getCorePath();
      const loginScript = path.join(corePath, 'auth', 'google_login.py');

      if (!fs.existsSync(loginScript)) {
        return { success: false, error: 'google_login.py script not found in core/auth/' };
      }

      // Kill existing process if running
      if (webLoginProcess) {
        webLoginProcess.kill('SIGTERM');
        webLoginProcess = null;
      }

      mainWindow?.webContents.send('google-login:web:status', 'starting');

      // Spawn Python process
      const env = getPythonEnv();
      const authDir = path.join(corePath, 'auth');
      env.PYTHONPATH = `${corePath}:${authDir}`;
      env.PYTHONIOENCODING = 'utf-8';

      webLoginProcess = spawnBundledPython(
        [
          '-u',
          loginScript,
          '--profile_dir',
          profilePath,
          '--mode',
          'login',
          '--url',
          'https://accounts.google.com',
        ],
        {
          cwd: corePath,
          env,
        }
      );

      if (!webLoginProcess) {
        return { success: false, error: 'Failed to start login process' };
      }

      // Handle stdout
      webLoginProcess.stdout?.on('data', (data) => {
        const output = data.toString();
        console.log('[Google Login Web]', output);
        
        // Parse status messages - match all status lines in the output
        const lines = output.split('\n');
        for (const line of lines) {
          const statusMatch = line.match(/\[GOOGLE_LOGIN_STATUS\] (\w+): (.*)/);
          if (statusMatch) {
            const [, status, message] = statusMatch;
            console.log('[Google Login Web] Parsed status:', status, 'message:', message);
            mainWindow?.webContents.send('google-login:web:status', status.toLowerCase(), message);
            
            // Handle both new login and already logged in cases
            if (status === 'LOGIN_SUCCESS' || status === 'ALREADY_LOGGED_IN') {
              console.log('[Google Login Web] Login detected, showing dialog...');
              const isExisting = status === 'ALREADY_LOGGED_IN';
              
              if (!mainWindow) {
                console.error('[Google Login Web] mainWindow is null!');
                return;
              }
              
              dialog.showMessageBox(mainWindow, {
                type: 'info',
                title: 'Google Login Detected',
                message: isExisting 
                  ? 'You are already logged into Google!'
                  : 'Google login was detected successfully!',
                detail: 'Click OK to save your login session and close the browser.',
                buttons: ['OK', 'Cancel'],
                defaultId: 0,
              }).then((result) => {
                console.log('[Google Login Web] Dialog result:', result.response);
                if (result.response === 0) {
                  // User confirmed - save config and close browser
                  console.log('[Google Login Web] User confirmed, saving config...');
                  const config = loadAppConfig();
                  config.googleLogin = config.googleLogin || {};
                  config.googleLogin.web = {
                    enabled: true,
                    profilePath: profilePath,
                    lastLoginAt: new Date().toISOString(),
                  };
                  saveAppConfig(config);
                  console.log('[Google Login Web] Config saved');
                  
                  // Kill the browser process
                  if (webLoginProcess) {
                    webLoginProcess.kill('SIGTERM');
                    webLoginProcess = null;
                  }
                  
                  mainWindow?.webContents.send('google-login:web:status', 'completed');
                  console.log('[Google Login Web] Completed status sent');
                } else {
                  // User cancelled - just close the dialog
                  console.log('[Google Login Web] User cancelled');
                  mainWindow?.webContents.send('google-login:web:status', 'waiting');
                }
              }).catch((err) => {
                console.error('[Google Login Web] Dialog error:', err);
              });
            }
          }
        }
      });

      webLoginProcess.stderr?.on('data', (data) => {
        console.error('[Google Login Web Error]', data.toString());
      });

      webLoginProcess.on('close', (code) => {
        console.log('[Google Login Web] Process closed with code:', code);
        webLoginProcess = null;
        mainWindow?.webContents.send('google-login:web:status', 'closed');
      });

      return { success: true };
    } catch (error) {
      console.error('[Google Login Web] Error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // Stop web browser Google login
  ipcMain.handle('google-login:web:stop', async () => {
    if (webLoginProcess) {
      webLoginProcess.kill('SIGTERM');
      webLoginProcess = null;
      return { success: true };
    }
    return { success: false, error: 'No running process' };
  });

  // Get web login status from config (fast, cached)
  ipcMain.handle('google-login:web:get-status', async () => {
    const config = loadAppConfig();
    const webLogin = config.googleLogin?.web;
    
    if (webLogin?.enabled && webLogin?.lastLoginAt) {
      return {
        success: true,
        loggedIn: true,
        lastLoginAt: webLogin.lastLoginAt,
        profilePath: webLogin.profilePath,
      };
    }
    
    return { success: true, loggedIn: false };
  });

  // Verify actual web login status (fast, checks storage state file directly)
  ipcMain.handle('google-login:web:verify-status', async () => {
    try {
      const profilePath = getBrowserProfilePath();
      
      // Check storage state file for Google cookies
      const storageCheck = checkStorageStateForGoogleLogin();
      
      if (storageCheck.loggedIn) {
        // Update config to reflect logged-in state
        const config = loadAppConfig();
        const existingLogin = config.googleLogin?.web;
        
        if (!existingLogin?.enabled) {
          config.googleLogin = config.googleLogin || {};
          config.googleLogin.web = {
            enabled: true,
            profilePath: profilePath,
            lastLoginAt: existingLogin?.lastLoginAt || new Date().toISOString(),
          };
          saveAppConfig(config);
        }
        
        return {
          success: true,
          loggedIn: true,
          verified: true,
          lastLoginAt: config.googleLogin?.web?.lastLoginAt,
          profilePath: profilePath,
        };
      }
      
      // Not logged in - update config if needed
      const config = loadAppConfig();
      if (config.googleLogin?.web?.enabled) {
        config.googleLogin.web.enabled = false;
        saveAppConfig(config);
      }
      
      return { success: true, loggedIn: false, verified: true };
    } catch (error) {
      console.error('[Google Login] Verify error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        verified: false,
      };
    }
  });

  // List Android devices
  ipcMain.handle('google-login:android:list-devices', async () => {
    try {
      const config = loadAppConfig();
      const sdkPath = config.android?.sdkPath;
      const devices = await listAndroidDevices(sdkPath);
      return { success: true, devices };
    } catch (error) {
      return { success: false, devices: [], error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // Start Android Google login using Python script
  ipcMain.handle('google-login:android:start', async (_event, deviceId?: string) => {
    try {
      const mainWindow = getMainWindow();
      const corePath = getCorePath();
      const loginScript = path.join(corePath, 'auth', 'google_login_android.py');

      if (!fs.existsSync(loginScript)) {
        return { success: false, error: 'google_login_android.py script not found in core/auth/' };
      }

      mainWindow?.webContents.send('google-login:android:status', 'starting');

      // Spawn Python process
      const config = loadAppConfig();
      const sdkPath = config.android?.sdkPath;

      const env = getPythonEnv();
      const authDir = path.join(corePath, 'auth');
      env.PYTHONPATH = `${corePath}:${authDir}`;
      env.PYTHONIOENCODING = 'utf-8';

      // Inject Android SDK path if available
      if (sdkPath) {
        env.ANDROID_HOME = sdkPath;
        env.ANDROID_SDK_ROOT = sdkPath;

        // Add platform-tools and emulator to PATH to ensure find_tool works
        const platformTools = path.join(sdkPath, 'platform-tools');
        const emulatorTools = path.join(sdkPath, 'emulator');
        const cmdlineTools = path.join(sdkPath, 'cmdline-tools', 'latest', 'bin');

        // Prepend to PATH
        env.PATH = `${platformTools}${path.delimiter}${emulatorTools}${path.delimiter}${cmdlineTools}${path.delimiter}${env.PATH || ''}`;

        console.log('[Google Login Android] Injected SDK path:', sdkPath);
      } else {
        console.warn('[Google Login Android] Android SDK path not configured in settings');
      }

      const args = [
        '-u',
        loginScript,
        '--mode',
        'login',
      ];

      // Add device ID if specified
      if (deviceId) {
        args.push('--device', deviceId);
      }

      // Kill existing process if running
      if (androidLoginProcess) {
        androidLoginProcess.kill('SIGTERM');
        androidLoginProcess = null;
      }

      androidLoginProcess = spawnBundledPython(args, {
        cwd: corePath,
        env,
      });

      if (!androidLoginProcess) {
        return { success: false, error: 'Failed to start login process' };
      }

      // Handle stdout
      androidLoginProcess.stdout?.on('data', (data) => {
        const output = data.toString();
        console.log('[Google Login Android]', output);
        
        // Parse status messages
        const lines = output.split('\n');
        for (const line of lines) {
          const statusMatch = line.match(/\[GOOGLE_LOGIN_ANDROID\] (\w+): (.*)/);
          if (statusMatch) {
            const [, status, message] = statusMatch;
            console.log('[Google Login Android] Parsed status:', status, 'message:', message);
            mainWindow?.webContents.send('google-login:android:status', status.toLowerCase(), message);
            
            // Handle login success (new login or already logged in)
            if (status === 'LOGIN_SUCCESS') {
              console.log('[Google Login Android] Login detected, showing dialog...');
              
              // Extract device ID from message (format: "Device: emulator-5554")
              const deviceMatch = message.match(/Device:\s*(\S+)/i);
              const detectedDevice = deviceMatch ? deviceMatch[1] : deviceId || 'unknown';
              
              if (!mainWindow) {
                console.error('[Google Login Android] mainWindow is null!');
                return;
              }
              
              const isEmulator = detectedDevice.startsWith('emulator-');
              
              // Check if this was already logged in (from previous status message)
              const isAlreadyLoggedIn = output.includes('ALREADY_LOGGED_IN');
              
              dialog.showMessageBox(mainWindow, {
                type: 'info',
                title: isAlreadyLoggedIn ? 'Google Account Found' : 'Google Account Detected',
                message: isAlreadyLoggedIn 
                  ? 'This device already has a Google account logged in.'
                  : 'A new Google account was detected on your device!',
                detail: `Device: ${detectedDevice}\nClick OK to save this configuration.${isEmulator ? '\n\nThe emulator will be closed after confirmation.' : ''}`,
                buttons: ['OK', 'Cancel'],
                defaultId: 0,
              }).then(async (result) => {
                console.log('[Google Login Android] Dialog result:', result.response);
                if (result.response === 0) {
                  // Save config
                  console.log('[Google Login Android] User confirmed, saving config...');
                  const config = loadAppConfig();
                  config.googleLogin = config.googleLogin || {};
                  config.googleLogin.android = {
                    enabled: true,
                    deviceId: detectedDevice,
                    lastLoginAt: new Date().toISOString(),
                  };
                  saveAppConfig(config);
                  console.log('[Google Login Android] Config saved');
                  
                  // Stop emulator if it's an emulator (not a physical device)
                  if (isEmulator) {
                    console.log('[Google Login Android] Stopping emulator:', detectedDevice);
                    try {
                      const sdkPath = config.android?.sdkPath;
                      await executeAdb(`-s ${detectedDevice} emu kill`, sdkPath);
                      console.log('[Google Login Android] Emulator stopped');
                    } catch (err) {
                      console.error('[Google Login Android] Failed to stop emulator:', err);
                    }
                  }
                  
                  mainWindow?.webContents.send('google-login:android:status', 'completed');
                } else {
                  console.log('[Google Login Android] User cancelled');
                  mainWindow?.webContents.send('google-login:android:status', 'cancelled');
                }
              }).catch((err) => {
                console.error('[Google Login Android] Dialog error:', err);
              });
            }
          }
        }
      });

      androidLoginProcess.stderr?.on('data', (data) => {
        console.error('[Google Login Android Error]', data.toString());
      });

      androidLoginProcess.on('close', (code) => {
        console.log('[Google Login Android] Process closed with code:', code);
        mainWindow?.webContents.send('google-login:android:status', 'closed');
      });

      return { success: true };
    } catch (error) {
      console.error('[Google Login Android] Error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // Stop Android Google login process
  ipcMain.handle('google-login:android:stop', async () => {
    if (androidLoginProcess) {
      androidLoginProcess.kill('SIGTERM');
      androidLoginProcess = null;
      return { success: true };
    }
    return { success: false, error: 'No running process' };
  });

  // Get Android login status from config
  ipcMain.handle('google-login:android:get-status', async () => {
    const config = loadAppConfig();
    const androidLogin = config.googleLogin?.android;
    
    if (androidLogin?.enabled && androidLogin?.lastLoginAt) {
      return {
        success: true,
        loggedIn: true,
        deviceId: androidLogin.deviceId,
        lastLoginAt: androidLogin.lastLoginAt,
      };
    }
    
    return { success: true, loggedIn: false };
  });

  // Clear Google login config
  ipcMain.handle('google-login:clear', async (_event, platform: 'web' | 'android' | 'all') => {
    try {
      const config = loadAppConfig();
      
      if (platform === 'web' || platform === 'all') {
        if (config.googleLogin?.web) {
          config.googleLogin.web = {
            enabled: false,
            profilePath: getBrowserProfilePath(),
          };
        }
      }
      
      if (platform === 'android' || platform === 'all') {
        if (config.googleLogin?.android) {
          config.googleLogin.android = {
            enabled: false,
          };
        }
      }
      
      saveAppConfig(config);
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });
}

/**
 * Cleanup Google login processes
 */
export function cleanupGoogleLoginProcesses(): void {
  if (webLoginProcess) {
    webLoginProcess.kill('SIGTERM');
    webLoginProcess = null;
  }
  
  if (androidLoginProcess) {
    androidLoginProcess.kill('SIGTERM');
    androidLoginProcess = null;
  }
}

