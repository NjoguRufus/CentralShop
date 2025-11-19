/**
 * Electron Preload Script
 * Exposes secure APIs to renderer process
 */
import { contextBridge, ipcRenderer } from 'electron';

// Define types for exposed APIs
export interface ElectronAPI {
  printReceipt: (orderData: any) => Promise<{ success: boolean; error?: string }>;
  nativePrint: (filePath: string) => Promise<{ success: boolean; error?: string }>;
  setKiosk: (flag: boolean) => Promise<{ success: boolean }>;
  setAutoLaunch: (flag: boolean) => Promise<{ success: boolean }>;
  installUpdate: () => Promise<{ success: boolean }>;
  onUpdateAvailable: (callback: (info: any) => void) => void;
  onUpdateDownloaded: (callback: (info: any) => void) => void;
  onUpdateError: (callback: (error: string) => void) => void;
  removeUpdateListeners: () => void;
}

// Expose protected APIs to renderer
contextBridge.exposeInMainWorld('electron', {
  printReceipt: (orderData: any) => 
    ipcRenderer.invoke('print-receipt', orderData),
  
  nativePrint: (filePath: string) => 
    ipcRenderer.invoke('native-print', filePath),
  
  setKiosk: (flag: boolean) => 
    ipcRenderer.invoke('set-kiosk', flag),
  
  setAutoLaunch: (flag: boolean) => 
    ipcRenderer.invoke('set-auto-launch', flag),
  
  installUpdate: () => 
    ipcRenderer.invoke('install-update'),
  
  onUpdateAvailable: (callback: (info: any) => void) => {
    ipcRenderer.on('update-available', (_event, info) => callback(info));
  },
  
  onUpdateDownloaded: (callback: (info: any) => void) => {
    ipcRenderer.on('update-downloaded', (_event, info) => callback(info));
  },
  
  onUpdateError: (callback: (error: string) => void) => {
    ipcRenderer.on('update-error', (_event, error) => callback(error));
  },
  
  removeUpdateListeners: () => {
    ipcRenderer.removeAllListeners('update-available');
    ipcRenderer.removeAllListeners('update-downloaded');
    ipcRenderer.removeAllListeners('update-error');
  }
} as ElectronAPI);

// Type declaration for window.electron
declare global {
  interface Window {
    electron: ElectronAPI;
  }
}

