import { app, Menu, MenuItemConstructorOptions, shell, BrowserWindow, dialog } from 'electron';
import { checkForUpdates } from './handlers/updater';
import log from 'electron-log';

export function createMenu(mainWindow: BrowserWindow) {
  const isMac = process.platform === 'darwin';

  const template: MenuItemConstructorOptions[] = [
    // { role: 'appMenu' }
    ...(isMac
      ? [{
          label: app.name,
          submenu: [
            { role: 'about' },
            {
              label: 'Check for Updates...',
              click: () => {
                checkForUpdates(true);
              }
            },
            { type: 'separator' },
            { role: 'services' },
            { type: 'separator' },
            { role: 'hide' },
            { role: 'hideOthers' },
            { role: 'unhide' },
            { type: 'separator' },
            { role: 'quit' }
          ]
        } as MenuItemConstructorOptions]
      : []),
    // { role: 'fileMenu' }
    {
      label: 'File',
      submenu: [
        isMac ? { role: 'close' } : { role: 'quit' }
      ] as MenuItemConstructorOptions[]
    },
    // { role: 'editMenu' }
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        ...(isMac
          ? [
              { role: 'pasteAndMatchStyle' },
              { role: 'delete' },
              { role: 'selectAll' },
              { type: 'separator' },
              {
                label: 'Speech',
                submenu: [
                  { role: 'startSpeaking' },
                  { role: 'stopSpeaking' }
                ]
              }
            ]
          : [
              { role: 'delete' },
              { type: 'separator' },
              { role: 'selectAll' }
            ])
      ] as MenuItemConstructorOptions[]
    },
    // { role: 'viewMenu' }
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ] as MenuItemConstructorOptions[]
    },
    // { role: 'windowMenu' }
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(isMac
          ? [
              { type: 'separator' },
              { role: 'front' },
              { type: 'separator' },
              { role: 'window' }
            ]
          : [{ role: 'close' }])
      ] as MenuItemConstructorOptions[]
    },
    {
      role: 'help',
      submenu: [
        ...(!isMac
          ? [
              {
                label: 'Check for Updates...',
                click: () => {
                  checkForUpdates(true);
                }
              },
              { type: 'separator' as const }
            ]
          : []),
        {
          label: 'Learn More',
          click: async () => {
            await shell.openExternal('https://github.com/StartKlever/KleverDesktop');
          }
        },
        {
            label: 'Documentation',
            click: async () => {
                await shell.openExternal('https://docs.klever.ai');
            }
        },
        { type: 'separator' },
        {
            label: 'Report Issue',
            click: async () => {
                await shell.openExternal('https://github.com/StartKlever/KleverDesktop/issues');
            }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}


