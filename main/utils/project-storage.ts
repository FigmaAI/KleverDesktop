/**
 * Project storage utilities
 * Manages reading/writing projects.json and workspace directories
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ProjectsData } from '../types';

/**
 * Get the path to the projects storage file
 * @returns Path to ~/.klever-desktop/projects.json
 */
export function getProjectsStoragePath(): string {
  const homeDir = os.homedir();
  const storageDir = path.join(homeDir, '.klever-desktop');

  if (!fs.existsSync(storageDir)) {
    fs.mkdirSync(storageDir, { recursive: true });
  }

  return path.join(storageDir, 'projects.json');
}

/**
 * Load projects from storage
 * @returns Projects data object
 */
export function loadProjects(): ProjectsData {
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
 * @returns Path to ~/Documents/apps/{projectName}
 */
export function getProjectWorkspaceDir(projectName: string): string {
  const homeDir = os.homedir();
  const documentsDir = path.join(homeDir, 'Documents', 'apps');

  // Ensure apps directory exists
  ensureDirectoryExists(documentsDir);

  return path.join(documentsDir, projectName);
}

/**
 * Ensure a directory exists, creating it if necessary
 * @param dirPath - Path to the directory
 */
export function ensureDirectoryExists(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
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
