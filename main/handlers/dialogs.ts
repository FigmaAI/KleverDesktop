/**
 * Dialog handlers
 * Handles folder selection and opening folders
 */


import { dialog, shell, BrowserWindow, IpcMain } from 'electron'
import { existsSync } from 'fs'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export function registerDialogHandlers(ipcMain: IpcMain, getMainWindow: () => BrowserWindow | null) {
  ipcMain.handle('dialog:showFolderSelect', async () => {
    const mainWindow = getMainWindow()
    if (!mainWindow) {
      return null
    }

    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
    })

    if (canceled || filePaths.length === 0) {
      return null
    }

    return filePaths[0]
  })

  ipcMain.handle('dialog:openFolder', async (_event, folderPath: string) => {
    // Check if folder exists
    if (!existsSync(folderPath)) {
      const error = `Folder does not exist: ${folderPath}`
      console.error('[dialogs]', error)
      return { success: false, error }
    }

    try {
      const platform = process.platform

      // Use platform-specific commands for better reliability
      if (platform === 'linux') {
        // Linux: use xdg-open
        await execAsync(`xdg-open "${folderPath}"`)
        return { success: true }
      } else {
        // macOS and Windows: shell.openPath works well
        const error = await shell.openPath(folderPath)
        if (error) {
          console.error('[dialogs] Failed to open path:', error)
          return { success: false, error }
        }
        return { success: true }
      }
    } catch (error: unknown) {
      console.error('[dialogs] Exception:', error)
      return { success: false, error: (error instanceof Error ? error.message : 'Unknown error') }
    }
  })
}