import { ipcMain, dialog, shell, BrowserWindow, IpcMain } from 'electron'

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
    try {
      const error = await shell.openPath(folderPath)
      if (error) {
        return { success: false, error }
      }
      return { success: true }
    } catch (error: unknown) {
      return { success: false, error: (error instanceof Error ? error.message : 'Unknown error') }
    }
  })
}