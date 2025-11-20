import { dialog, shell, BrowserWindow, IpcMain } from 'electron'

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
    try {
      const error = await shell.openPath(folderPath)
      console.log('[dialogs] shell.openPath error:', error)
      if (error) {
        console.error('[dialogs] Failed to open path:', error)
        return { success: false, error }
      }
      console.log('[dialogs] Folder opened successfully')
      return { success: true }
    } catch (error: unknown) {
      console.error('[dialogs] Exception:', error)
      return { success: false, error: (error instanceof Error ? error.message : 'Unknown error') }
    }
  })
}