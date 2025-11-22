/**
 * GitHub API IPC handlers
 */

import { IpcMain } from 'electron';
import https from 'https';

/**
 * Register all GitHub handlers
 */
export function registerGitHubHandlers(ipcMain: IpcMain): void {
  // Fetch GitHub repository stars
  ipcMain.handle('github:fetchStars', async (_event, repo: string) => {
    return new Promise((resolve) => {
      const options = {
        hostname: 'api.github.com',
        path: `/repos/${repo}`,
        method: 'GET',
        headers: {
          'User-Agent': 'KleverDesktop',
          'Accept': 'application/vnd.github.v3+json'
        }
      };

      const req = https.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (json.stargazers_count !== undefined) {
              resolve({ success: true, stars: json.stargazers_count });
            } else {
              resolve({ success: false, error: 'No stargazers_count in response' });
            }
          } catch (error) {
            resolve({ success: false, error: 'Failed to parse response' });
          }
        });
      });

      req.on('error', (error) => {
        resolve({ success: false, error: error.message });
      });

      req.end();
    });
  });
}
