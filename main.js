const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const { spawn, exec } = require('child_process');
const fs = require('fs');
const yaml = require('js-yaml');

let mainWindow;
let pythonProcess = null;

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
    exec(`python -m pip show -r ${requirementsPath}`, { timeout: 10000 }, (error, stdout, stderr) => {
      if (error) {
        resolve({ success: false, error: stderr || error.message });
        return;
      }
      resolve({ success: true, output: stdout });
    });
  });
});

// Install Python packages
ipcMain.handle('install:packages', async () => {
  return new Promise((resolve) => {
    const requirementsPath = path.join(__dirname, 'appagent', 'requirements.txt');
    const pip = spawn('python', ['-m', 'pip', 'install', '-r', requirementsPath]);

    let output = '';
    pip.stdout.on('data', (data) => {
      output += data.toString();
      mainWindow?.webContents.send('install:progress', data.toString());
    });

    pip.stderr.on('data', (data) => {
      output += data.toString();
      mainWindow?.webContents.send('install:progress', data.toString());
    });

    pip.on('close', (code) => {
      resolve({ success: code === 0, output });
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

// Check ADB
ipcMain.handle('check:adb', async () => {
  return new Promise((resolve) => {
    exec('adb devices', { timeout: 5000 }, (error, stdout) => {
      if (error) {
        resolve({ success: false, error: 'ADB not found' });
        return;
      }
      const lines = stdout.split('\n').slice(1); // Skip header
      const devices = lines
        .filter((line) => line.trim() && line.includes('device'))
        .map((line) => line.split('\t')[0]);
      resolve({ success: true, devices });
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
        max_tokens: 10,
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

    // Update config
    yamlConfig.MODEL = config.modelType;
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

// Run integration test
ipcMain.handle('integration:test', async () => {
  try {
    const testScript = path.join(__dirname, 'appagent', 'integration-test.py');

    if (!fs.existsSync(testScript)) {
      mainWindow?.webContents.send('integration:output', 'Error: integration-test.py not found\n');
      mainWindow?.webContents.send('integration:complete', false);
      return { success: false };
    }

    const testProcess = spawn('python', [testScript], {
      cwd: path.join(__dirname, 'appagent'),
    });

    testProcess.stdout.on('data', (data) => {
      mainWindow?.webContents.send('integration:output', data.toString());
    });

    testProcess.stderr.on('data', (data) => {
      mainWindow?.webContents.send('integration:output', data.toString());
    });

    testProcess.on('close', (code) => {
      mainWindow?.webContents.send('integration:complete', code === 0);
    });

    return { success: true };
  } catch (error) {
    mainWindow?.webContents.send('integration:output', `Error: ${error.message}\n`);
    mainWindow?.webContents.send('integration:complete', false);
    return { success: false };
  }
});
