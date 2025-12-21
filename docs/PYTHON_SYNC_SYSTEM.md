# Python Environment Synchronization System

## Overview

This document describes the Python environment synchronization system that ensures the Python virtual environment stays in sync with the app version and `requirements.txt` after app updates.

## Problem Statement

When the app is updated:
1. **Python scripts (appagent)** are automatically updated as they're bundled in `resources/appagent`
2. **Python packages** in `~/.klever-desktop/python-env` remain unchanged
3. If `requirements.txt` has changed, the old packages may be incompatible

## Solution

A **version-based manifest system** that:
1. Records the app version and requirements.txt hash after each successful environment setup
2. Checks for mismatches on app startup
3. Triggers automatic or manual resync when needed

## Architecture

### Manifest File

Location: `~/.klever-desktop/env-manifest.json`

```json
{
  "appVersion": "2.0.7",
  "requirementsHash": "abc123...",
  "lastSyncTime": "2025-12-21T15:30:00.000Z",
  "pythonVersion": "3.11.9",
  "syncReason": "version_mismatch"
}
```

### Sync Detection Reasons

| Reason | Description |
|--------|-------------|
| `version_mismatch` | App version changed (e.g., 2.0.6 → 2.0.7) |
| `requirements_changed` | requirements.txt was modified |
| `venv_invalid` | Virtual environment is missing or corrupted |
| `manifest_missing` | First run or manifest was deleted |

## Implementation Files

### Main Process

1. **`main/utils/python-sync.ts`** - Core synchronization logic
   - `checkSyncNeeded()` - Check if sync is required
   - `syncPythonEnvironment()` - Perform the sync
   - `updateManifest()` - Update manifest after setup
   - `resetManifest()` - Force resync on next check

2. **`main/handlers/installations.ts`** - IPC handlers
   - `sync:check` - Check sync status
   - `sync:run` - Run synchronization
   - `sync:reset` - Reset manifest
   - `sync:updateManifest` - Update manifest manually

3. **`main/index.ts`** - Startup check
   - `checkPythonSync()` - Check on app startup
   - Sends `python:sync-needed` event if sync required

### Preload

**`main/preload.ts`** - Exposed APIs
- `syncCheck()` - Check if sync needed
- `syncRun(forceRecreateVenv?)` - Run sync
- `syncReset()` - Reset manifest
- `syncUpdateManifest()` - Update manifest
- `onSyncProgress(callback)` - Listen to sync progress
- `onPythonSyncNeeded(callback)` - Listen for sync-needed notification

## Usage Patterns

### 1. Check Sync on App Startup (Automatic)

The app automatically checks for sync needs on startup:

```typescript
// main/index.ts
app.whenReady().then(() => {
  // ... window creation ...
  checkPythonSync(); // Checks manifest and notifies renderer
});
```

### 2. Manual Sync from Settings

```typescript
// In renderer process
const result = await window.electronAPI.syncCheck();
if (result.needsSync) {
  console.log('Sync needed:', result.reason);
  await window.electronAPI.syncRun();
}
```

### 3. Force Full Resync

```typescript
// Recreate venv and reinstall all packages
await window.electronAPI.syncRun(true);
```

### 4. Listen for Sync Progress

```typescript
const cleanup = window.electronAPI.onSyncProgress((message) => {
  console.log(message);
});
// Later: cleanup();
```

## Flow Diagrams

### App Update Flow

```
App Update Downloaded
        ↓
User clicks "Restart"
        ↓
autoUpdater.quitAndInstall()
        ↓
    App Restarts
        ↓
checkPythonSync() called
        ↓
Read manifest & compare
        ↓
    Version mismatch?
       ↓ Yes
Notify renderer: python:sync-needed
        ↓
Renderer shows sync dialog
        ↓
User confirms or auto-sync
        ↓
syncPythonEnvironment() runs
        ↓
pip install -r requirements.txt
        ↓
Update manifest
        ↓
       Done!
```

### First Install Flow

```
env:setup called (Setup Wizard)
        ↓
Download Python (if needed)
        ↓
Create venv
        ↓
pip install -r requirements.txt
        ↓
Install Playwright browsers
        ↓
updateManifest() called ← NEW
        ↓
Manifest created with current version
        ↓
       Done!
```

## Integration with Auto-Updater

The Python sync system is **separate from but complementary to** the auto-updater:

- **Auto-updater** (`updater.ts`): Handles app binary updates from GitHub Releases
- **Python sync** (`python-sync.ts`): Handles Python environment updates after app restart

The reason for separation:
1. Auto-updater terminates the app (`quitAndInstall()`)
2. New app process starts fresh
3. Python sync detects version change via manifest comparison

## Testing

### Manual Testing

1. Run the app and complete setup
2. Check manifest: `cat ~/.klever-desktop/env-manifest.json`
3. Modify `appagent/requirements.txt` (add/remove a package)
4. Restart the app
5. Should see "Environment sync needed" in console

### Reset for Testing

```bash
# Delete manifest to force sync check
rm ~/.klever-desktop/env-manifest.json

# Or reset entire environment
rm -rf ~/.klever-desktop
```

## Future Improvements

1. **Auto-sync option**: Add user preference to auto-sync without prompts
2. **Playwright browser sync**: Also check if Playwright browsers need updates
3. **Selective sync**: Only install new/changed packages (use pip freeze comparison)
4. **Version history**: Keep track of previous syncs for debugging
