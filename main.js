const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const { spawn, exec } = require('child_process');
const fs = require('fs');
const yaml = require('js-yaml');
const os = require('os');

let mainWindow;
let pythonProcess = null;
let integrationTestProcess = null;
let taskProcesses = {}; // Map of taskId -> process

// Helper function to get projects storage path
function getProjectsStoragePath() {
  const homeDir = os.homedir();
  const storageDir = path.join(homeDir, '.klever-desktop');
  if (!fs.existsSync(storageDir)) {
    fs.mkdirSync(storageDir, { recursive: true });
  }
  return path.join(storageDir, 'projects.json');
}

// Helper function to load projects
function loadProjects() {
  const projectsPath = getProjectsStoragePath();
  if (!fs.existsSync(projectsPath)) {
    return { projects: [] };
  }
  try {
    const data = fs.readFileSync(projectsPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading projects:', error);
    return { projects: [] };
  }
}

// Helper function to save projects
function saveProjects(data) {
  const projectsPath = getProjectsStoragePath();
  fs.writeFileSync(projectsPath, JSON.stringify(data, null, 2), 'utf8');
}

// Helper function to get project workspace directory
function getProjectWorkspaceDir(projectName) {
  const homeDir = os.homedir();
  const documentsDir = path.join(homeDir, 'Documents');
  return path.join(documentsDir, projectName);
}

// Create the browser window
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 1000,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Load the app
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
    // Cleanup Python process on window close
    if (pythonProcess) {
      pythonProcess.kill();
      pythonProcess = null;
    }
  });
}

// App lifecycle
app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// ============================================
// IPC Handlers
// ============================================

// Check Python version
ipcMain.handle('check:python', async () => {
  return new Promise((resolve) => {
    exec('python --version', { timeout: 5000 }, (error, stdout, stderr) => {
      if (error) {
        resolve({ success: false, error: error.message });
        return;
      }
      const output = stdout || stderr;
      const match = output.match(/Python (\d+)\.(\d+)\.(\d+)/);
      if (match) {
        const major = parseInt(match[1]);
        const minor = parseInt(match[2]);
        resolve({
          success: true,
          version: `${major}.${minor}.${match[3]}`,
          isValid: major === 3 && minor >= 11,
        });
      } else {
        resolve({ success: false, error: 'Failed to parse Python version' });
      }
    });
  });
});

// Check Python packages
ipcMain.handle('check:packages', async () => {
  return new Promise((resolve) => {
    const requirementsPath = path.join(__dirname, 'appagent', 'requirements.txt');
    console.log('[Check Packages] Checking packages from:', requirementsPath);
    
    // Try to install with --dry-run to see if all packages can be installed
    exec(`python -m pip install --dry-run -r "${requirementsPath}"`, { timeout: 10000 }, (error, stdout, stderr) => {
      if (error) {
        console.log('[Check Packages] Error:', stderr || error.message);
        resolve({ success: false, error: 'Some packages are missing or cannot be installed' });
        return;
      }
      
      // Check if it says "would install" (meaning packages are missing)
      if (stdout.includes('would install') || stderr.includes('would install')) {
        console.log('[Check Packages] Packages need to be installed');
        resolve({ success: false, error: 'Some packages are not installed' });
        return;
      }
      
      console.log('[Check Packages] All packages are satisfied');
      resolve({ success: true, output: stdout });
    });
  });
});

// Install Python packages
ipcMain.handle('install:packages', async () => {
  return new Promise((resolve) => {
    const requirementsPath = path.join(__dirname, 'appagent', 'requirements.txt');
    console.log('[Install Packages] Starting installation from:', requirementsPath);
    
    // Check if requirements.txt exists
    if (!fs.existsSync(requirementsPath)) {
      console.error('[Install Packages] requirements.txt not found at:', requirementsPath);
      resolve({ success: false, error: 'requirements.txt not found' });
      return;
    }

    const pip = spawn('python', ['-m', 'pip', 'install', '-r', requirementsPath]);

    let output = '';
    let errorOutput = '';
    
    pip.stdout.on('data', (data) => {
      const text = data.toString();
      output += text;
      console.log('[Install Packages] stdout:', text);
      mainWindow?.webContents.send('install:progress', text);
    });

    pip.stderr.on('data', (data) => {
      const text = data.toString();
      errorOutput += text;
      console.log('[Install Packages] stderr:', text);
      mainWindow?.webContents.send('install:progress', text);
    });

    pip.on('close', (code) => {
      console.log('[Install Packages] Process closed with code:', code);
      if (code === 0) {
        resolve({ success: true, output });
      } else {
        resolve({ success: false, output: output || errorOutput, error: `pip install failed with code ${code}` });
      }
    });

    pip.on('error', (error) => {
      console.error('[Install Packages] Process error:', error.message);
      resolve({ success: false, error: error.message });
    });
  });
});

// Check Ollama
ipcMain.handle('check:ollama', async () => {
  return new Promise((resolve) => {
    exec('curl -s http://localhost:11434/api/tags', { timeout: 5000 }, (error, stdout) => {
      if (error) {
        resolve({ success: false, running: false, error: 'Ollama not running' });
        return;
      }
      try {
        const data = JSON.parse(stdout);
        resolve({ success: true, running: true, models: data.models || [] });
      } catch (e) {
        resolve({ success: false, running: false, error: 'Failed to parse Ollama response' });
      }
    });
  });
});

// List Ollama models
ipcMain.handle('ollama:list', async () => {
  return new Promise((resolve) => {
    exec('ollama list', { timeout: 5000 }, (error, stdout) => {
      if (error) {
        resolve({ success: false, error: error.message });
        return;
      }
      const lines = stdout.split('\n').slice(1); // Skip header
      const models = lines
        .map((line) => {
          const parts = line.trim().split(/\s+/);
          return parts[0];
        })
        .filter(Boolean);
      resolve({ success: true, models });
    });
  });
});

// Pull Ollama model
ipcMain.handle('ollama:pull', async (event, modelName) => {
  return new Promise((resolve) => {
    const ollama = spawn('ollama', ['pull', modelName]);

    ollama.stdout.on('data', (data) => {
      mainWindow?.webContents.send('ollama:pull:progress', data.toString());
    });

    ollama.stderr.on('data', (data) => {
      mainWindow?.webContents.send('ollama:pull:progress', data.toString());
    });

    ollama.on('close', (code) => {
      resolve({ success: code === 0 });
    });
  });
});

// Check ADB/Android SDK
ipcMain.handle('check:androidStudio', async () => {
  return new Promise((resolve) => {
    console.log('[Android SDK Check] Starting check...');

    // Method 1: Check if adb command is available (most reliable)
    exec('adb --version', { timeout: 5000 }, (error, stdout, stderr) => {
      if (!error) {
        // adb is available in PATH
        const output = stdout || stderr;
        const versionMatch = output.match(/Android Debug Bridge version ([\d.]+)/);
        const version = versionMatch ? versionMatch[1] : 'unknown';
        console.log('[Android SDK Check] adb found via PATH:', version);
        resolve({ success: true, version: version, method: 'adb_command' });
        return;
      }

      console.log('[Android SDK Check] adb command not found in PATH');

      // Method 2: Check environment variables
      const androidHome = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
      if (androidHome) {
        const adbPath = path.join(androidHome, 'platform-tools', 'adb');
        const adbPathExe = adbPath + (process.platform === 'win32' ? '.exe' : '');

        if (fs.existsSync(adbPathExe)) {
          console.log('[Android SDK Check] Found via ANDROID_HOME/ANDROID_SDK_ROOT:', androidHome);
          resolve({ success: true, version: 'installed', method: 'env_variable', path: androidHome });
          return;
        }
      }

      console.log('[Android SDK Check] Environment variables not set or invalid');

      // Method 3: Check common SDK locations
      const commonPaths = [
        path.join(process.env.HOME || '/root', 'Library', 'Android', 'sdk'), // macOS
        path.join(process.env.HOME || '/root', 'Android', 'Sdk'), // Linux
        '/Volumes/Backup/Android-SDK', // External volume (user's case)
        'C:\\Users\\' + (process.env.USERNAME || 'user') + '\\AppData\\Local\\Android\\Sdk', // Windows
      ];

      for (const sdkPath of commonPaths) {
        console.log('[Android SDK Check] Checking path:', sdkPath);
        const adbPath = path.join(sdkPath, 'platform-tools', 'adb');
        const adbPathExe = adbPath + (process.platform === 'win32' ? '.exe' : '');

        if (fs.existsSync(adbPathExe)) {
          console.log('[Android SDK Check] Found at:', sdkPath);
          resolve({ success: true, version: 'installed', method: 'common_path', path: sdkPath });
          return;
        }
      }

      // Method 4: Search in /Volumes for external drives (macOS)
      if (process.platform === 'darwin') {
        try {
          const volumes = fs.readdirSync('/Volumes');
          for (const volume of volumes) {
            const possiblePaths = [
              path.join('/Volumes', volume, 'Android-SDK'),
              path.join('/Volumes', volume, 'AndroidSDK'),
              path.join('/Volumes', volume, 'Android', 'Sdk'),
            ];

            for (const sdkPath of possiblePaths) {
              const adbPath = path.join(sdkPath, 'platform-tools', 'adb');
              if (fs.existsSync(adbPath)) {
                console.log('[Android SDK Check] Found on external volume:', sdkPath);
                resolve({ success: true, version: 'installed', method: 'external_volume', path: sdkPath });
                return;
              }
            }
          }
        } catch (e) {
          console.log('[Android SDK Check] Could not search volumes:', e.message);
        }
      }

      console.log('[Android SDK Check] Result: NOT FOUND');
      resolve({
        success: false,
        error: 'Android SDK not found. Please install Android Studio or set ANDROID_HOME environment variable.'
      });
    });
  });
});

// Check Playwright
ipcMain.handle('check:playwright', async () => {
  return new Promise((resolve) => {
    exec('python -m playwright install --dry-run chromium', { timeout: 5000 }, (error, stdout, stderr) => {
      if (error) {
        resolve({ success: false, error: stderr || error.message });
        return;
      }
      resolve({ success: true, output: stdout });
    });
  });
});

// Install Playwright
ipcMain.handle('install:playwright', async () => {
  return new Promise((resolve) => {
    console.log('[Playwright] Starting installation via pip...');
    // First install playwright package via pip
    const playwright = spawn('python', ['-m', 'pip', 'install', 'playwright']);

    let output = '';
    playwright.stdout.on('data', (data) => {
      output += data.toString();
      console.log('[Playwright] stdout:', data.toString());
      mainWindow?.webContents.send('install:progress', data.toString());
    });

    playwright.stderr.on('data', (data) => {
      output += data.toString();
      console.log('[Playwright] stderr:', data.toString());
      mainWindow?.webContents.send('install:progress', data.toString());
    });

    playwright.on('close', (code) => {
      console.log('[Playwright] pip install finished with code:', code);
      if (code === 0) {
        // Then install browsers
        console.log('[Playwright] Installing browsers...');
        mainWindow?.webContents.send('install:progress', 'Installing Playwright browsers...\n');
        const browserInstall = spawn('python', ['-m', 'playwright', 'install', 'chromium']);

        let browserOutput = '';
        browserInstall.stdout.on('data', (data) => {
          browserOutput += data.toString();
          console.log('[Playwright] browser install stdout:', data.toString());
          mainWindow?.webContents.send('install:progress', data.toString());
        });

        browserInstall.stderr.on('data', (data) => {
          browserOutput += data.toString();
          console.log('[Playwright] browser install stderr:', data.toString());
          mainWindow?.webContents.send('install:progress', data.toString());
        });

        browserInstall.on('close', (browserCode) => {
          console.log('[Playwright] Browser installation finished with code:', browserCode);
          resolve({ success: browserCode === 0, output: output + '\n' + browserOutput });
        });

        browserInstall.on('error', (error) => {
          console.error('[Playwright] Browser install error:', error.message);
          resolve({ success: false, error: error.message });
        });
      } else {
        resolve({ success: false, error: 'Failed to install playwright package' });
      }
    });

    playwright.on('error', (error) => {
      console.error('[Playwright] Error:', error.message);
      resolve({ success: false, error: error.message });
    });
  });
});

// Install Android Studio (via Homebrew cask)
ipcMain.handle('install:androidStudio', async () => {
  return new Promise((resolve) => {
    console.log('[Android Studio] Starting installation via Homebrew...');
    const install = spawn('brew', ['install', '--cask', 'android-studio']);

    let output = '';
    install.stdout.on('data', (data) => {
      output += data.toString();
      console.log('[Android Studio] stdout:', data.toString());
      mainWindow?.webContents.send('install:progress', data.toString());
    });

    install.stderr.on('data', (data) => {
      output += data.toString();
      console.log('[Android Studio] stderr:', data.toString());
      mainWindow?.webContents.send('install:progress', data.toString());
    });

    install.on('close', (code) => {
      console.log('[Android Studio] Installation finished with code:', code);
      resolve({ success: code === 0, output });
    });

    install.on('error', (error) => {
      console.error('[Android Studio] Error:', error.message);
      resolve({ success: false, error: error.message });
    });
  });
});

// Install Python (via Homebrew)
ipcMain.handle('install:python', async () => {
  return new Promise((resolve) => {
    console.log('[Python] Starting installation via Homebrew...');
    const install = spawn('brew', ['install', 'python@3.11']);

    let output = '';
    install.stdout.on('data', (data) => {
      output += data.toString();
      console.log('[Python] stdout:', data.toString());
      mainWindow?.webContents.send('install:progress', data.toString());
    });

    install.stderr.on('data', (data) => {
      output += data.toString();
      console.log('[Python] stderr:', data.toString());
      mainWindow?.webContents.send('install:progress', data.toString());
    });

    install.on('close', (code) => {
      console.log('[Python] Installation finished with code:', code);
      resolve({ success: code === 0, output });
    });

    install.on('error', (error) => {
      console.error('[Python] Error:', error.message);
      resolve({ success: false, error: error.message });
    });
  });
});

// Check Homebrew

// Check Homebrew (macOS only)
ipcMain.handle('check:homebrew', async () => {
  return new Promise((resolve) => {
    exec('brew --version', { timeout: 5000 }, (error, stdout) => {
      if (error) {
        resolve({ success: false, error: 'Homebrew not installed' });
        return;
      }
      const match = stdout.match(/Homebrew ([\d.]+)/);
      if (match) {
        resolve({ success: true, version: match[1] });
      } else {
        resolve({ success: true, version: 'unknown' });
      }
    });
  });
});

// Load config.yaml
ipcMain.handle('config:load', async () => {
  try {
    const configPath = path.join(__dirname, 'appagent', 'config.yaml');
    const fileContents = fs.readFileSync(configPath, 'utf8');
    const config = yaml.load(fileContents);
    return { success: true, config };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Save config.yaml
ipcMain.handle('config:save', async (event, config) => {
  try {
    const configPath = path.join(__dirname, 'appagent', 'config.yaml');
    const yamlStr = yaml.dump(config);
    fs.writeFileSync(configPath, yamlStr, 'utf8');
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Start self_explorer
ipcMain.handle('project:start', async (event, projectConfig) => {
  try {
    const scriptPath = path.join(__dirname, 'appagent', 'scripts', 'self_explorer.py');
    const args = [
      scriptPath,
      '--platform', projectConfig.platform,
      '--app', projectConfig.name,
    ];

    if (projectConfig.platform === 'web' && projectConfig.url) {
      args.push('--url', projectConfig.url);
    }

    if (projectConfig.device) {
      args.push('--device', projectConfig.device);
    }

    pythonProcess = spawn('python', args);

    pythonProcess.stdout.on('data', (data) => {
      mainWindow?.webContents.send('project:output', data.toString());
    });

    pythonProcess.stderr.on('data', (data) => {
      mainWindow?.webContents.send('project:error', data.toString());
    });

    pythonProcess.on('close', (code) => {
      mainWindow?.webContents.send('project:exit', code);
      pythonProcess = null;
    });

    return { success: true, pid: pythonProcess.pid };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Stop self_explorer
ipcMain.handle('project:stop', async () => {
  if (pythonProcess) {
    pythonProcess.kill('SIGTERM');
    pythonProcess = null;
    return { success: true };
  }
  return { success: false, error: 'No running process' };
});

// Open external URL
ipcMain.handle('shell:openExternal', async (event, url) => {
  await shell.openExternal(url);
  return { success: true };
});

// Get system info
ipcMain.handle('system:info', async () => {
  const os = require('os');
  return {
    platform: process.platform,
    arch: process.arch,
    cpus: os.cpus().length,
    totalMemory: os.totalmem(),
    freeMemory: os.freemem(),
  };
});

// Test model connection
ipcMain.handle('model:testConnection', async (event, config) => {
  try {
    const https = require('https');
    const http = require('http');

    // Support both old (modelType) and new (enableLocal/enableApi) formats
    const isLocal = config.modelType === 'local' || config.enableLocal;
    const url = isLocal ? config.localBaseUrl : config.apiBaseUrl;
    const model = isLocal ? config.localModel : config.apiModel;

    const urlObj = new URL(url);
    const protocol = urlObj.protocol === 'https:' ? https : http;

    return new Promise((resolve) => {
      const postData = JSON.stringify({
        model: model,
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 50,
      });

      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
        path: urlObj.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
        },
        timeout: 10000,
      };

      if (!isLocal && config.apiKey) {
        options.headers['Authorization'] = `Bearer ${config.apiKey}`;
      }

      const req = protocol.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          if (res.statusCode === 200 || res.statusCode === 201) {
            resolve({ success: true, message: 'Connection successful!' });
          } else {
            resolve({ success: false, message: `HTTP ${res.statusCode}: ${data}` });
          }
        });
      });

      req.on('error', (error) => {
        resolve({ success: false, message: error.message });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({ success: false, message: 'Connection timeout' });
      });

      req.write(postData);
      req.end();
    });
  } catch (error) {
    return { success: false, message: error.message };
  }
});

// Save model configuration
ipcMain.handle('model:saveConfig', async (event, config) => {
  try {
    const configPath = path.join(__dirname, 'appagent', 'config.yaml');
    const yamlContent = fs.readFileSync(configPath, 'utf8');
    const yamlConfig = yaml.load(yamlContent);

    // Determine primary provider: if both enabled, prefer API
    let modelProvider = 'local';
    if (config.enableApi && config.enableLocal) {
      modelProvider = 'api';
    } else if (config.enableApi) {
      modelProvider = 'api';
    } else if (config.enableLocal) {
      modelProvider = 'local';
    }

    // Update config
    yamlConfig.MODEL = modelProvider;
    yamlConfig.ENABLE_LOCAL = config.enableLocal;
    yamlConfig.ENABLE_API = config.enableApi;
    yamlConfig.API_BASE_URL = config.apiBaseUrl;
    yamlConfig.API_KEY = config.apiKey;
    yamlConfig.API_MODEL = config.apiModel;
    yamlConfig.LOCAL_BASE_URL = config.localBaseUrl;
    yamlConfig.LOCAL_MODEL = config.localModel;

    // Save config
    fs.writeFileSync(configPath, yaml.dump(yamlConfig), 'utf8');

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Fetch API models from various providers
ipcMain.handle('model:fetchApiModels', async (event, config) => {
  try {
    const { apiBaseUrl, apiKey } = config;
    const https = require('https');
    const http = require('http');

    // Detect provider from URL
    let provider = 'unknown';
    let modelsEndpoint = '';

    if (apiBaseUrl.includes('api.openai.com')) {
      provider = 'openai';
      modelsEndpoint = 'https://api.openai.com/v1/models';
    } else if (apiBaseUrl.includes('openrouter.ai')) {
      provider = 'openrouter';
      modelsEndpoint = 'https://openrouter.ai/api/v1/models';
    } else if (apiBaseUrl.includes('api.anthropic.com')) {
      provider = 'anthropic';
      // Anthropic doesn't have a models endpoint, return predefined list
      return {
        success: true,
        provider: 'anthropic',
        models: [
          'claude-3-5-sonnet-20241022',
          'claude-3-5-haiku-20241022',
          'claude-3-opus-20240229',
          'claude-3-sonnet-20240229',
          'claude-3-haiku-20240307',
        ],
      };
    } else if (apiBaseUrl.includes('api.x.ai') || apiBaseUrl.includes('api.grok')) {
      provider = 'grok';
      // Grok/X.AI doesn't have public models endpoint, return predefined list
      return {
        success: true,
        provider: 'grok',
        models: ['grok-beta', 'grok-vision-beta'],
      };
    }

    if (!modelsEndpoint) {
      return {
        success: false,
        provider: 'unknown',
        error: 'Unknown API provider. Please enter model name manually.',
      };
    }

    const urlObj = new URL(modelsEndpoint);
    const protocol = urlObj.protocol === 'https:' ? https : http;

    return new Promise((resolve) => {
      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
        path: urlObj.pathname + (urlObj.search || ''),
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      };

      if (apiKey) {
        if (provider === 'openrouter') {
          options.headers['Authorization'] = `Bearer ${apiKey}`;
          options.headers['HTTP-Referer'] = 'https://github.com/FigmaAI/KleverDesktop';
          options.headers['X-Title'] = 'Klever Desktop';
        } else {
          options.headers['Authorization'] = `Bearer ${apiKey}`;
        }
      }

      const req = protocol.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          if (res.statusCode === 200) {
            try {
              const parsed = JSON.parse(data);
              let models = [];

              if (provider === 'openai') {
                // OpenAI returns { data: [{ id: 'gpt-4', ... }] }
                models = parsed.data
                  ?.filter((m) => m.id && !m.id.includes('embedding') && !m.id.includes('tts') && !m.id.includes('whisper'))
                  .map((m) => m.id) || [];
              } else if (provider === 'openrouter') {
                // OpenRouter returns { data: [{ id: 'openai/gpt-4', ... }] }
                models = parsed.data?.map((m) => m.id) || [];
              }

              resolve({
                success: true,
                provider,
                models: models.slice(0, 50), // Limit to first 50 models
              });
            } catch (error) {
              resolve({ success: false, provider, error: 'Failed to parse models response' });
            }
          } else {
            resolve({ success: false, provider, error: `HTTP ${res.statusCode}: ${data}` });
          }
        });
      });

      req.on('error', (error) => {
        resolve({ success: false, provider, error: error.message });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({ success: false, provider, error: 'Request timeout' });
      });

      req.end();
    });
  } catch (error) {
    return { success: false, provider: 'unknown', error: error.message };
  }
});

// Run integration test
ipcMain.handle('integration:test', async (event, config) => {
  try {
    const selfExplorerScript = path.join(__dirname, 'appagent', 'scripts', 'self_explorer.py');

    if (!fs.existsSync(selfExplorerScript)) {
      mainWindow?.webContents.send('integration:output', 'Error: self_explorer.py not found\n');
      mainWindow?.webContents.send('integration:complete', false);
      return { success: false };
    }

    // Determine model provider
    let modelProvider = 'local';
    if (config.enableApi && config.enableLocal) {
      modelProvider = 'api';
    } else if (config.enableApi) {
      modelProvider = 'api';
    } else if (config.enableLocal) {
      modelProvider = 'local';
    }

    // Prepare environment variables
    const env = {
      ...process.env,
      MODEL: modelProvider,
      ENABLE_LOCAL: config.enableLocal.toString(),
      ENABLE_API: config.enableApi.toString(),
      API_BASE_URL: config.apiBaseUrl || '',
      API_KEY: config.apiKey || '',
      API_MODEL: config.apiModel || '',
      LOCAL_BASE_URL: config.localBaseUrl || '',
      LOCAL_MODEL: config.localModel || '',
      MAX_ROUNDS: '2',  // Limit to 2 rounds for quick test
    };

    mainWindow?.webContents.send('integration:output', '============================================================\n');
    mainWindow?.webContents.send('integration:output', 'Klever Desktop Integration Test\n');
    mainWindow?.webContents.send('integration:output', '============================================================\n\n');
    mainWindow?.webContents.send('integration:output', `Model Provider: ${modelProvider}\n`);

    if (modelProvider === 'local') {
      mainWindow?.webContents.send('integration:output', '\n');
      mainWindow?.webContents.send('integration:output', '⚠️  LOCAL MODEL PERFORMANCE NOTICE\n');
      mainWindow?.webContents.send('integration:output', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      mainWindow?.webContents.send('integration:output', 'You are using a local Ollama model for this test.\n');
      mainWindow?.webContents.send('integration:output', 'This test may take 3-5 minutes or longer, depending on:\n');
      mainWindow?.webContents.send('integration:output', '  • Your hardware (CPU/GPU performance)\n');
      mainWindow?.webContents.send('integration:output', '  • Model size (larger models = slower inference)\n');
      mainWindow?.webContents.send('integration:output', '  • System resources (RAM, other running processes)\n\n');
      mainWindow?.webContents.send('integration:output', 'Expected response times per round:\n');
      mainWindow?.webContents.send('integration:output', '  • Vision analysis: 60-120 seconds\n');
      mainWindow?.webContents.send('integration:output', '  • Reflection: 15-30 seconds\n');
      mainWindow?.webContents.send('integration:output', '  • Total for 2 rounds: ~3-5 minutes\n\n');
      mainWindow?.webContents.send('integration:output', 'For faster testing, consider using API models (OpenAI, etc.)\n');
      mainWindow?.webContents.send('integration:output', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n');
    }

    mainWindow?.webContents.send('integration:output', `Testing with Google search...\n\n`);

    // Kill existing test process if running
    if (integrationTestProcess) {
      integrationTestProcess.kill('SIGTERM');
      integrationTestProcess = null;
    }

    integrationTestProcess = spawn('python', [
      '-u',  // Unbuffered output
      selfExplorerScript,
      '--app', 'google_search_test',
      '--platform', 'web',
      '--root_dir', '.',
      '--url', 'https://www.google.com',
      '--task', 'Find and click the "I\'m Feeling Lucky" button'
    ], {
      cwd: path.join(__dirname, 'appagent'),  // Run from appagent directory
      env: env,
    });

    console.log('[Integration Test] Process started with PID:', integrationTestProcess.pid);

    integrationTestProcess.stdout.on('data', (data) => {
      mainWindow?.webContents.send('integration:output', data.toString());
    });

    integrationTestProcess.stderr.on('data', (data) => {
      mainWindow?.webContents.send('integration:output', data.toString());
    });

    integrationTestProcess.on('close', (code) => {
      mainWindow?.webContents.send('integration:output', '\n============================================================\n');
      if (code === 0) {
        mainWindow?.webContents.send('integration:output', 'Integration test PASSED ✓\n');
        mainWindow?.webContents.send('integration:output', '============================================================\n');
      } else {
        mainWindow?.webContents.send('integration:output', `Integration test FAILED (exit code: ${code})\n`);
        mainWindow?.webContents.send('integration:output', '============================================================\n');
      }
      mainWindow?.webContents.send('integration:complete', code === 0);
      integrationTestProcess = null;
    });

    return { success: true };
  } catch (error) {
    mainWindow?.webContents.send('integration:output', `Error: ${error.message}\n`);
    mainWindow?.webContents.send('integration:complete', false);
    return { success: false };
  }
});

// Stop integration test
ipcMain.handle('integration:stop', async () => {
  if (integrationTestProcess) {
    integrationTestProcess.kill('SIGTERM');
    integrationTestProcess = null;
    mainWindow?.webContents.send('integration:output', '\n[Test stopped by user]\n');
    mainWindow?.webContents.send('integration:complete', false);
    return { success: true };
  }
  return { success: false, error: 'No running test' };
});

// ============================================
// Project Management IPC Handlers
// ============================================

// List all projects
ipcMain.handle('project:list', async () => {
  try {
    const data = loadProjects();
    return { success: true, projects: data.projects };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Get single project
ipcMain.handle('project:get', async (event, projectId) => {
  try {
    const data = loadProjects();
    const project = data.projects.find(p => p.id === projectId);
    if (!project) {
      return { success: false, error: 'Project not found' };
    }
    return { success: true, project };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Create new project
ipcMain.handle('project:create', async (event, projectInput) => {
  try {
    const data = loadProjects();

    const newProject = {
      id: `proj_${Date.now()}`,
      name: projectInput.name,
      platform: projectInput.platform,
      device: projectInput.device,
      url: projectInput.url,
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tasks: [],
      workspaceDir: getProjectWorkspaceDir(projectInput.name),
    };

    // Create workspace directory
    if (!fs.existsSync(newProject.workspaceDir)) {
      fs.mkdirSync(newProject.workspaceDir, { recursive: true });
    }

    data.projects.push(newProject);
    saveProjects(data);

    return { success: true, project: newProject };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Update project
ipcMain.handle('project:update', async (event, projectId, updates) => {
  try {
    const data = loadProjects();
    const projectIndex = data.projects.findIndex(p => p.id === projectId);

    if (projectIndex === -1) {
      return { success: false, error: 'Project not found' };
    }

    data.projects[projectIndex] = {
      ...data.projects[projectIndex],
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    saveProjects(data);
    return { success: true, project: data.projects[projectIndex] };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Delete project
ipcMain.handle('project:delete', async (event, projectId) => {
  try {
    const data = loadProjects();
    const projectIndex = data.projects.findIndex(p => p.id === projectId);

    if (projectIndex === -1) {
      return { success: false, error: 'Project not found' };
    }

    data.projects.splice(projectIndex, 1);
    saveProjects(data);

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// ============================================
// Task Management IPC Handlers
// ============================================

// Create new task
ipcMain.handle('task:create', async (event, taskInput) => {
  try {
    const data = loadProjects();
    const project = data.projects.find(p => p.id === taskInput.projectId);

    if (!project) {
      return { success: false, error: 'Project not found' };
    }

    const newTask = {
      id: `task_${Date.now()}`,
      name: taskInput.name,
      description: taskInput.description,
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    project.tasks.push(newTask);
    project.updatedAt = new Date().toISOString();
    saveProjects(data);

    return { success: true, task: newTask };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Update task
ipcMain.handle('task:update', async (event, projectId, taskId, updates) => {
  try {
    const data = loadProjects();
    const project = data.projects.find(p => p.id === projectId);

    if (!project) {
      return { success: false, error: 'Project not found' };
    }

    const taskIndex = project.tasks.findIndex(t => t.id === taskId);
    if (taskIndex === -1) {
      return { success: false, error: 'Task not found' };
    }

    project.tasks[taskIndex] = {
      ...project.tasks[taskIndex],
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    project.updatedAt = new Date().toISOString();
    saveProjects(data);

    return { success: true, task: project.tasks[taskIndex] };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Delete task
ipcMain.handle('task:delete', async (event, projectId, taskId) => {
  try {
    const data = loadProjects();
    const project = data.projects.find(p => p.id === projectId);

    if (!project) {
      return { success: false, error: 'Project not found' };
    }

    const taskIndex = project.tasks.findIndex(t => t.id === taskId);
    if (taskIndex === -1) {
      return { success: false, error: 'Task not found' };
    }

    project.tasks.splice(taskIndex, 1);
    project.updatedAt = new Date().toISOString();
    saveProjects(data);

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Start task execution
ipcMain.handle('task:start', async (event, projectId, taskId) => {
  try {
    const data = loadProjects();
    const project = data.projects.find(p => p.id === projectId);

    if (!project) {
      return { success: false, error: 'Project not found' };
    }

    const task = project.tasks.find(t => t.id === taskId);
    if (!task) {
      return { success: false, error: 'Task not found' };
    }

    // Update task status
    task.status = 'running';
    task.lastRunAt = new Date().toISOString();
    task.output = '';
    task.error = '';
    saveProjects(data);

    // Start Python process
    const scriptPath = path.join(__dirname, 'appagent', 'scripts', 'self_explorer.py');
    const args = [
      scriptPath,
      '--platform', project.platform,
      '--app', task.name,
    ];

    if (project.platform === 'web' && project.url) {
      args.push('--url', project.url);
    }

    if (project.device) {
      args.push('--device', project.device);
    }

    const taskProcess = spawn('python', args, {
      cwd: project.workspaceDir,
    });

    taskProcesses[taskId] = taskProcess;

    taskProcess.stdout.on('data', (data) => {
      const output = data.toString();
      mainWindow?.webContents.send('task:output', { projectId, taskId, output });

      // Append to task output
      const currentData = loadProjects();
      const currentProject = currentData.projects.find(p => p.id === projectId);
      const currentTask = currentProject?.tasks.find(t => t.id === taskId);
      if (currentTask) {
        currentTask.output = (currentTask.output || '') + output;
        saveProjects(currentData);
      }
    });

    taskProcess.stderr.on('data', (data) => {
      const error = data.toString();
      mainWindow?.webContents.send('task:error', { projectId, taskId, error });

      // Append to task error
      const currentData = loadProjects();
      const currentProject = currentData.projects.find(p => p.id === projectId);
      const currentTask = currentProject?.tasks.find(t => t.id === taskId);
      if (currentTask) {
        currentTask.error = (currentTask.error || '') + error;
        saveProjects(currentData);
      }
    });

    taskProcess.on('close', (code) => {
      const currentData = loadProjects();
      const currentProject = currentData.projects.find(p => p.id === projectId);
      const currentTask = currentProject?.tasks.find(t => t.id === taskId);

      if (currentTask) {
        currentTask.status = code === 0 ? 'completed' : 'failed';
        currentTask.updatedAt = new Date().toISOString();
        saveProjects(currentData);
      }

      mainWindow?.webContents.send('task:complete', { projectId, taskId, code });
      delete taskProcesses[taskId];
    });

    return { success: true, pid: taskProcess.pid };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Stop task execution
ipcMain.handle('task:stop', async (event, projectId, taskId) => {
  try {
    const taskProcess = taskProcesses[taskId];

    if (!taskProcess) {
      return { success: false, error: 'Task not running' };
    }

    taskProcess.kill('SIGTERM');
    delete taskProcesses[taskId];

    // Update task status
    const data = loadProjects();
    const project = data.projects.find(p => p.id === projectId);
    const task = project?.tasks.find(t => t.id === taskId);

    if (task) {
      task.status = 'cancelled';
      task.updatedAt = new Date().toISOString();
      saveProjects(data);
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
