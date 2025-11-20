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
    console.log('[dialogs] Opening folder:', folderPath)

    // Check if folder exists
    if (!existsSync(folderPath)) {
      const error = `Folder does not exist: ${folderPath}`
      console.error('[dialogs]', error)
      return { success: false, error }
    }

    try {
      const platform = process.platform
      console.log('[dialogs] Platform:', platform)

      // Use platform-specific commands for better reliability
      if (platform === 'linux') {
        // Linux: use xdg-open
        console.log('[dialogs] Using xdg-open for Linux')
        await execAsync(`xdg-open "${folderPath}"`)
        console.log('[dialogs] Folder opened successfully with xdg-open')
        return { success: true }
      } else {
        // macOS and Windows: shell.openPath works well
        console.log('[dialogs] Using shell.openPath')
        const error = await shell.openPath(folderPath)
        console.log('[dialogs] shell.openPath result:', error)
        if (error) {
          console.error('[dialogs] Failed to open path:', error)
          return { success: false, error }
        }
        console.log('[dialogs] Folder opened successfully')
        return { success: true }
      }
    } catch (error: unknown) {
      console.error('[dialogs] Exception:', error)
      return { success: false, error: (error instanceof Error ? error.message : 'Unknown error') }
    }
  })
}