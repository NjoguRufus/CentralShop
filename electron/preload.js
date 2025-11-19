// Temporary preload - will be replaced by compiled preload.ts
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  printReceipt: (orderData) => ipcRenderer.invoke('print-receipt', orderData),
  nativePrint: (filePath) => ipcRenderer.invoke('native-print', filePath),
  setKiosk: (flag) => ipcRenderer.invoke('set-kiosk', flag),
  setAutoLaunch: (flag) => ipcRenderer.invoke('set-auto-launch', flag),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  onUpdateAvailable: (callback) => ipcRenderer.on('update-available', (_event, info) => callback(info)),
  onUpdateDownloaded: (callback) => ipcRenderer.on('update-downloaded', (_event, info) => callback(info)),
  onUpdateError: (callback) => ipcRenderer.on('update-error', (_event, error) => callback(error)),
  removeUpdateListeners: () => {
    ipcRenderer.removeAllListeners('update-available');
    ipcRenderer.removeAllListeners('update-downloaded');
    ipcRenderer.removeAllListeners('update-error');
  }
});

