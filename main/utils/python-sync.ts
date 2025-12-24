/**
 * Python Environment Synchronization Manager
 * 
 * Handles automatic synchronization of Python environment after app updates.
 * When app version changes or requirements.txt is modified, this module
 * detects the mismatch and triggers automatic package reinstallation.
 * 
 * Manifest file location: ~/.klever-desktop/env-manifest.json
 * 
 * The manifest contains:
 * - appVersion: Current app version when environment was last synced
 * - requirementsHash: MD5 hash of requirements.txt content
 * - lastSyncTime: Timestamp of last successful sync
 * - pythonVersion: Python runtime version
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { app } from 'electron';
import {
  getKleverDir,
  checkVenvStatus,
  installRequirements,
  createVirtualEnvironment,
  getCorePath
} from './python-runtime';

// Manifest file structure
interface EnvManifest {
  appVersion: string;
  requirementsHash: string;
  lastSyncTime: string;
  pythonVersion: string;
  syncReason?: string;
}

// Sync check result
export interface SyncCheckResult {
  needsSync: boolean;
  reason?: 'version_mismatch' | 'requirements_changed' | 'venv_invalid' | 'manifest_missing' | 'first_install';
  currentAppVersion: string;
  manifestAppVersion?: string;
  currentRequirementsHash: string;
  manifestRequirementsHash?: string;
}

// Sync result
export interface SyncResult {
  success: boolean;
  error?: string;
  synced: boolean;
  reason?: string;
}

/**
 * Get the path to the environment manifest file
 */
function getManifestPath(): string {
  return path.join(getKleverDir(), 'env-manifest.json');
}

/**
 * Calculate MD5 hash of a file
 */
function calculateFileHash(filePath: string): string {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return crypto.createHash('md5').update(content).digest('hex');
  } catch {
    return '';
  }
}

/**
 * Read the current manifest
 */
function readManifest(): EnvManifest | null {
  const manifestPath = getManifestPath();
  try {
    if (!fs.existsSync(manifestPath)) {
      return null;
    }
    const content = fs.readFileSync(manifestPath, 'utf8');
    return JSON.parse(content) as EnvManifest;
  } catch (error) {
    console.error('[Python Sync] Failed to read manifest:', error);
    return null;
  }
}

/**
 * Write the manifest after successful sync
 */
function writeManifest(manifest: EnvManifest): void {
  const manifestPath = getManifestPath();
  try {
    const dir = path.dirname(manifestPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    console.log('[Python Sync] Manifest updated:', manifest);
  } catch (error) {
    console.error('[Python Sync] Failed to write manifest:', error);
  }
}

/**
 * Get the path to requirements.txt (now in core/ directory)
 */
function getRequirementsPath(): string {
  // Phase C Migration: Requirements now centralized in core/
  return path.join(getCorePath(), 'requirements.txt');
}

/**
 * Check if Python environment needs synchronization
 * Returns detailed information about what differs
 */
export function checkSyncNeeded(): SyncCheckResult {
  const currentAppVersion = app.getVersion();
  const requirementsPath = getRequirementsPath();
  const currentRequirementsHash = calculateFileHash(requirementsPath);

  // Check if venv is valid first
  const venvStatus = checkVenvStatus();
  if (!venvStatus.valid) {
    return {
      needsSync: true,
      reason: 'venv_invalid',
      currentAppVersion,
      currentRequirementsHash,
    };
  }

  // Read manifest
  const manifest = readManifest();

  if (!manifest) {
    // First install or manifest was deleted
    return {
      needsSync: true,
      reason: 'manifest_missing',
      currentAppVersion,
      currentRequirementsHash,
    };
  }

  // Check app version
  if (manifest.appVersion !== currentAppVersion) {
    console.log(`[Python Sync] App version mismatch: ${manifest.appVersion} -> ${currentAppVersion}`);
    return {
      needsSync: true,
      reason: 'version_mismatch',
      currentAppVersion,
      manifestAppVersion: manifest.appVersion,
      currentRequirementsHash,
      manifestRequirementsHash: manifest.requirementsHash,
    };
  }

  // Check requirements.txt hash
  if (manifest.requirementsHash !== currentRequirementsHash) {
    console.log('[Python Sync] Requirements hash mismatch');
    return {
      needsSync: true,
      reason: 'requirements_changed',
      currentAppVersion,
      manifestAppVersion: manifest.appVersion,
      currentRequirementsHash,
      manifestRequirementsHash: manifest.requirementsHash,
    };
  }

  // Everything is in sync
  return {
    needsSync: false,
    currentAppVersion,
    currentRequirementsHash,
    manifestAppVersion: manifest.appVersion,
    manifestRequirementsHash: manifest.requirementsHash,
  };
}

/**
 * Synchronize Python environment
 * Reinstalls packages from requirements.txt
 */
export async function syncPythonEnvironment(
  onProgress?: (message: string) => void,
  forceRecreateVenv: boolean = false
): Promise<SyncResult> {
  const syncCheck = checkSyncNeeded();

  if (!syncCheck.needsSync && !forceRecreateVenv) {
    console.log('[Python Sync] Environment is up to date');
    return { success: true, synced: false };
  }

  const reasonMessages: Record<string, string> = {
    'version_mismatch': `App updated from ${syncCheck.manifestAppVersion} to ${syncCheck.currentAppVersion}`,
    'requirements_changed': 'requirements.txt has been modified',
    'venv_invalid': 'Virtual environment is invalid or missing',
    'manifest_missing': 'First synchronization or manifest was reset',
    'first_install': 'First time environment setup',
  };

  const reason = syncCheck.reason || 'unknown';
  const reasonMessage = reasonMessages[reason] || 'Unknown reason';

  onProgress?.(`🔄 Syncing Python environment...\n`);
  onProgress?.(`Reason: ${reasonMessage}\n\n`);

  try {
    // Check if we need to recreate venv
    const venvStatus = checkVenvStatus();
    if (!venvStatus.valid || forceRecreateVenv) {
      onProgress?.('📦 Creating virtual environment...\n');
      const venvResult = await createVirtualEnvironment(
        onProgress,
        onProgress
      );
      if (!venvResult.success) {
        return {
          success: false,
          error: `Failed to create venv: ${venvResult.error}`,
          synced: false,
          reason: reasonMessage
        };
      }
      onProgress?.('✓ Virtual environment created\n\n');
    }

    // Install requirements
    onProgress?.('📦 Installing Python packages...\n');
    const requirementsPath = getRequirementsPath();

    const installResult = await installRequirements(
      requirementsPath,
      onProgress,
      onProgress
    );

    if (!installResult.success) {
      return {
        success: false,
        error: `Failed to install packages: ${installResult.error}`,
        synced: false,
        reason: reasonMessage
      };
    }

    // Update manifest
    const newManifest: EnvManifest = {
      appVersion: syncCheck.currentAppVersion,
      requirementsHash: syncCheck.currentRequirementsHash,
      lastSyncTime: new Date().toISOString(),
      pythonVersion: '3.11.9',
      syncReason: reason,
    };

    writeManifest(newManifest);

    onProgress?.('\n✅ Python environment synchronized successfully!\n');

    return {
      success: true,
      synced: true,
      reason: reasonMessage
    };

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Python Sync] Error during sync:', message);
    return {
      success: false,
      error: message,
      synced: false,
      reason: reasonMessage
    };
  }
}

/**
 * Force update manifest without syncing
 * Useful after manual environment setup
 */
export function updateManifest(): void {
  const currentAppVersion = app.getVersion();
  const requirementsPath = getRequirementsPath();
  const currentRequirementsHash = calculateFileHash(requirementsPath);

  const manifest: EnvManifest = {
    appVersion: currentAppVersion,
    requirementsHash: currentRequirementsHash,
    lastSyncTime: new Date().toISOString(),
    pythonVersion: '3.11.9',
    syncReason: 'manual_update',
  };

  writeManifest(manifest);
}

/**
 * Reset manifest to trigger full sync on next check
 */
export function resetManifest(): void {
  const manifestPath = getManifestPath();
  try {
    if (fs.existsSync(manifestPath)) {
      fs.unlinkSync(manifestPath);
      console.log('[Python Sync] Manifest reset');
    }
  } catch (error) {
    console.error('[Python Sync] Failed to reset manifest:', error);
  }
}
