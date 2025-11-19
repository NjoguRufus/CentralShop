/**
 * Electron Main Process
 * Central Shop POS - Desktop Application
 */
import { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage } from 'electron';
import { autoUpdater } from 'electron-updater';
import * as path from 'path';
import * as log from 'electron-log';
import { printReceipt } from './printerService';

// Configure logging
log.transports.file.level = 'info';
log.transports.console.level = 'debug';

// Enable auto-updater logging
autoUpdater.logger = log;

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isKioskMode = false;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    },
    icon: path.join(__dirname, '../electron/icons/icon.ico'),
    show: false,
    titleBarStyle: 'default'
  });

  // Load app
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
    
    // Check for updates on startup
    if (!isDev) {
      autoUpdater.checkForUpdatesAndNotify().catch(err => {
        log.error('Update check failed:', err);
      });
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Handle window close (hide to tray if enabled)
  mainWindow.on('close', (event) => {
    if (!(app as any).isQuiting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });
}

function createTray(): void {
  const iconPath = path.join(__dirname, '../electron/icons/tray.ico');
  const icon = nativeImage.createFromPath(iconPath);
  
  tray = new Tray(icon.resize({ width: 16, height: 16 }));
  
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show Central Shop POS',
      click: () => {
        mainWindow?.show();
      }
    },
    {
      label: 'Kiosk Mode',
      type: 'checkbox',
      checked: isKioskMode,
      click: (item) => {
        isKioskMode = item.checked;
        if (mainWindow) {
          mainWindow.setKiosk(isKioskMode);
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.isQuiting = true;
        app.quit();
      }
    }
  ]);

  tray.setToolTip('Central Shop POS');
  tray.setContextMenu(contextMenu);
  
  tray.on('click', () => {
    mainWindow?.show();
  });
}

// IPC Handlers
ipcMain.handle('set-kiosk', async (_event, flag: boolean) => {
  isKioskMode = flag;
  if (mainWindow) {
    mainWindow.setKiosk(flag);
  }
  return { success: true };
});

ipcMain.handle('set-auto-launch', async (_event, enabled: boolean) => {
  app.setLoginItemSettings({
    openAtLogin: enabled,
    name: 'Central Shop POS'
  });
  return { success: true };
});

ipcMain.handle('print-receipt', async (_event, orderData: any) => {
  try {
    await printReceipt(orderData, mainWindow);
    return { success: true };
  } catch (error) {
    log.error('Print receipt error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

ipcMain.handle('native-print', async (_event, filePath: string) => {
  try {
    if (mainWindow) {
      await mainWindow.webContents.printToPDF({}).then((data) => {
        // Use Windows print dialog
        const { exec } = require('child_process');
        const fs = require('fs');
        const tempFile = path.join(app.getPath('temp'), `receipt-${Date.now()}.pdf`);
        fs.writeFileSync(tempFile, data);
        exec(`start "" "${tempFile}"`, (error: any) => {
          if (error) {
            log.error('Print error:', error);
          }
        });
      });
    }
    return { success: true };
  } catch (error) {
    log.error('Native print error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

ipcMain.handle('install-update', async () => {
  autoUpdater.quitAndInstall();
  return { success: true };
});

// Auto-updater events
autoUpdater.on('update-available', (info) => {
  log.info('Update available:', info.version);
  mainWindow?.webContents.send('update-available', info);
});

autoUpdater.on('update-downloaded', (info) => {
  log.info('Update downloaded:', info.version);
  mainWindow?.webContents.send('update-downloaded', info);
});

autoUpdater.on('error', (error) => {
  log.error('Auto-updater error:', error);
  mainWindow?.webContents.send('update-error', error.message);
});

// App lifecycle
app.whenReady().then(() => {
  createWindow();
  createTray();
  
  // Set autostart (optional, can be controlled via settings)
  app.setLoginItemSettings({
    openAtLogin: false,
    name: 'Central Shop POS'
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else {
      mainWindow?.show();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    // Keep app running on Windows/Linux when all windows closed (tray)
  }
});

app.on('before-quit', () => {
  (app as any).isQuiting = true;
});

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

