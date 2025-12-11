/**
 * Project storage utilities
 * Manages reading/writing projects.json and workspace directories
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { app } from 'electron';
import { ProjectsData } from '../types';

/**
 * Get the path to the projects storage file
 * Now uses Electron userData path for consistency with config.json
 * @returns Path to ~/Library/Application Support/klever-desktop/projects.json (macOS)
 */
export function getProjectsStoragePath(): string {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'projects.json');
}

/**
 * Get the legacy projects storage path (for migration)
 * @returns Path to ~/.klever-desktop/projects.json
 */
function getLegacyProjectsStoragePath(): string {
  const homeDir = os.homedir();
  const storageDir = path.join(homeDir, '.klever-desktop');
  return path.join(storageDir, 'projects.json');
}

/**
 * Migrate projects.json from legacy location to new userData location
 * This runs automatically on first load
 */
function migrateProjectsIfNeeded(): void {
  const newPath = getProjectsStoragePath();
  const legacyPath = getLegacyProjectsStoragePath();

  // If new location already has projects.json, no migration needed
  if (fs.existsSync(newPath)) {
    return;
  }

  // If legacy location has projects.json, migrate it
  if (fs.existsSync(legacyPath)) {
    try {
      // Ensure userData directory exists
      const userDataPath = app.getPath('userData');
      if (!fs.existsSync(userDataPath)) {
        fs.mkdirSync(userDataPath, { recursive: true });
      }

      // Copy the file
      const data = fs.readFileSync(legacyPath, 'utf8');
      fs.writeFileSync(newPath, data, 'utf8');
    } catch (error) {
      console.error('[project-storage] Migration failed:', error);
    }
  }
}

/**
 * Load projects from storage
 * @returns Projects data object
 */
export function loadProjects(): ProjectsData {
  // Migrate from legacy location if needed
  migrateProjectsIfNeeded();

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

/**
 * Save projects to storage
 * @param data - Projects data to save
 */
export function saveProjects(data: ProjectsData): void {
  const projectsPath = getProjectsStoragePath();
  fs.writeFileSync(projectsPath, JSON.stringify(data, null, 2), 'utf8');
}

/**
 * Get the workspace directory for a project
 * @param projectName - Name of the project
 * @returns Path to ~/Documents/{projectName}
 *
 * Projects are stored directly in the Documents folder for better user accessibility.
 */
export function getProjectWorkspaceDir(projectName: string): string {
  // Use userData/Projects as the default location for better reliability on both Windows and macOS
  // This avoids permission issues with the Documents folder
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'Projects', projectName);
}

/**
 * Ensure a directory exists, creating it if necessary
 * @param dirPath - Path to the directory
 * @returns true if directory exists or was created successfully, false otherwise
 */
export function ensureDirectoryExists(dirPath: string): boolean {
  try {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
    // Verify the directory was created
    return fs.existsSync(dirPath);
  } catch (error) {
    console.error('Error creating directory:', error);
    return false;
  }
}

/**
 * Sanitize app name for Python usage (remove spaces)
 * Matches the behavior of learn.py: app = app.replace(" ", "")
 * @param appName - Original app name
 * @returns Sanitized app name without spaces
 */
export function sanitizeAppName(appName: string): string {
  return appName.replace(/ /g, '');
}

/**
 * Delete a directory and all its contents recursively
 * @param dirPath - Path to the directory to delete
 */
export function deleteDirectory(dirPath: string): void {
  if (fs.existsSync(dirPath)) {
    fs.rmSync(dirPath, { recursive: true, force: true });
  }
}

/**
 * Clean up zombie tasks on app startup
 * Tasks that were 'running' when the app was terminated will be marked as 'failed'
 * This prevents orphaned running tasks from appearing after restart
 */
export function cleanupZombieTasks(): void {
  try {
    const data = loadProjects();
    let hasChanges = false;
    
    for (const project of data.projects) {
      for (const task of project.tasks) {
        if (task.status === 'running') {
          console.log(`[project-storage] Cleaning up zombie task: ${task.id} (was running)`);
          task.status = 'failed';
          task.error = 'Task was interrupted by app shutdown';
          task.completedAt = new Date().toISOString();
          task.updatedAt = new Date().toISOString();
          hasChanges = true;
        }
      }
    }
    
    if (hasChanges) {
      saveProjects(data);
      console.log('[project-storage] Zombie tasks cleaned up');
    }
  } catch (error) {
    console.error('[project-storage] Error cleaning up zombie tasks:', error);
  }
}
