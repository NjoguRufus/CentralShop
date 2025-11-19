# Electron Desktop Setup Notes

## Overview

This document outlines the changes made to add Electron desktop support to Central Shop POS, along with setup instructions and troubleshooting tips.

## Changes Made

### 1. Dependencies Added

**Dev Dependencies:**
- `electron` - Electron framework
- `electron-builder` - Build and package Electron apps
- `electron-updater` - Auto-update functionality
- `concurrently` - Run multiple commands simultaneously
- `wait-on` - Wait for dev server to be ready
- `electron-log` - Logging for Electron
- `@types/electron` - TypeScript types

**Dependencies:**
- `node-thermal-printer` - Thermal printer support (optional, graceful fallback)
- `printer` - Windows printer support (optional, graceful fallback)
- `escpos-usb` - ESC/POS USB printer support (optional)

### 2. Files Created

**Electron Main Process:**
- `electron/main.ts` - Main Electron process (window management, tray, IPC handlers)
- `electron/preload.ts` - Preload script (secure API bridge)
- `electron/printerService.ts` - Printer service with thermal printer and fallback support
- `electron/package.json` - Electron package config
- `electron/icons/` - Icon directory (placeholder icons needed)

**Offline Sync:**
- `src/offline/sync.ts` - Firestore sync functions
- `src/offline/useSync.ts` - React hook for automatic sync

**Components:**
- `src/components/BarcodeListener.tsx` - Barcode scanner input handler
- `src/components/Updater.tsx` - Auto-update UI component
- `src/components/InstallPWAButton.tsx` - Already exists, integrated

**Utilities:**
- `src/utils/receiptTemplate.ts` - Receipt HTML/ESC-POS template generator

**Configuration:**
- `tsconfig.electron.json` - TypeScript config for Electron
- Updated `package.json` with build config and scripts
- Updated `vite.config.ts` with PWA support (already done)

### 3. Files Updated

- `src/App.tsx` - Added BarcodeListener, Updater, useOfflineSync hook
- `package.json` - Added scripts and electron-builder config
- `src/offline/index.ts` - Updated with sync functions

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Add Icons

Place the following icon files in `electron/icons/`:
- `icon.ico` - Main application icon (256x256 recommended)
- `tray.ico` - Tray icon (16x16 or 32x32)

**Note:** You can generate icons from PNG files using online converters or ImageMagick.

### 3. Configure GitHub Repository (for auto-updates)

Edit `package.json` and update the `build.publish` section:

```json
"publish": [
  {
    "provider": "github",
    "owner": "YOUR_GITHUB_USERNAME",
    "repo": "YOUR_REPO_NAME"
  }
]
```

Or set environment variables:
- `GH_TOKEN` - GitHub personal access token
- `GH_OWNER` - GitHub username/organization
- `GH_REPO` - Repository name

### 4. Development

Run the app in development mode:

```bash
npm run electron:dev
```

This will:
1. Start Vite dev server on http://localhost:5173
2. Wait for server to be ready
3. Launch Electron window

### 5. Building

Build the Windows installer:

```bash
npm run electron:build
```

This will:
1. Build the React app (`npm run build`)
2. Package Electron app with electron-builder
3. Generate NSIS installer in `dist/` directory

### 6. Publishing Updates

1. Build the installer: `npm run electron:build`
2. Create a GitHub Release with the `.exe` file
3. Tag the release (e.g., `v1.0.0`)
4. The app will automatically check for updates and notify users

## Configuration

### Auto-Start

Users can enable auto-start via the Settings page (if integrated) or the tray menu.

### Kiosk Mode

Enable kiosk mode programmatically:
```typescript
if (window.electron) {
  await window.electron.setKiosk(true);
}
```

### Printer Configuration

The printer service tries multiple methods:
1. Thermal printer via `node-thermal-printer` (TCP/IP)
2. Windows spool printer via `printer` module
3. Browser print dialog (fallback)

**To configure thermal printer:**
Edit `electron/printerService.ts` and update the printer interface:
```typescript
interface: 'tcp://192.168.1.100' // Your printer IP
```

## Troubleshooting

### Windows Thermal Printer Issues

1. **Printer not detected:**
   - Ensure printer drivers are installed
   - Check printer IP address/connection
   - Verify printer supports ESC/POS commands

2. **Native modules fail to build:**
   - Install Windows Build Tools: `npm install -g windows-build-tools`
   - Or use Visual Studio Build Tools
   - The app will gracefully fallback to browser print dialog

3. **Print dialog doesn't appear:**
   - Check browser permissions
   - Ensure popup blockers are disabled
   - Try the native print API fallback

### Auto-Update Issues

1. **Updates not checking:**
   - Verify GitHub repository is set correctly
   - Check network connectivity
   - Review electron-log files in `%APPDATA%/Central Shop POS/logs/`

2. **Update download fails:**
   - Check GitHub token permissions
   - Verify release assets are uploaded correctly
   - Check firewall/antivirus settings

### Build Issues

1. **electron-builder fails:**
   - Ensure all dependencies are installed
   - Check Windows permissions
   - Review build logs in `dist/` directory

2. **TypeScript errors:**
   - Run `npm run lint:fix`
   - Check `tsconfig.electron.json` includes all necessary types

### Offline Sync Issues

1. **Orders not syncing:**
   - Check IndexedDB in browser DevTools
   - Verify Firestore rules allow writes
   - Review sync errors in console

2. **Sync conflicts:**
   - The sync module handles conflicts by updating local data
   - Check `syncError` field in IndexedDB for failed syncs

## Security Notes

- **Context Isolation:** Enabled - renderer cannot access Node.js APIs directly
- **Node Integration:** Disabled - secure by default
- **Preload Script:** Only exposes minimal, necessary APIs
- **IPC Communication:** All IPC handlers validate input and handle errors

## Environment Variables

Create a `.env` file (optional) for development:

```env
GH_TOKEN=your_github_token_here
GH_OWNER=your_username
GH_REPO=your_repo_name
```

## Next Steps

1. ✅ Add real icons to `electron/icons/`
2. ✅ Configure GitHub repository for auto-updates
3. ✅ Test thermal printer with your hardware
4. ✅ Set up CI/CD for automated releases (GitHub Actions recommended)
5. ✅ Test offline sync functionality
6. ✅ Configure printer IP addresses for your environment

## CI/CD Setup (GitHub Actions)

Example workflow (`.github/workflows/build.yml`):

```yaml
name: Build Electron App

on:
  release:
    types: [created]

jobs:
  build:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - run: npm run electron:build
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
      - uses: actions/upload-artifact@v3
        with:
          name: installer
          path: dist/*.exe
```

## Support

For issues or questions:
1. Check electron-log files: `%APPDATA%/Central Shop POS/logs/`
2. Review browser console for renderer errors
3. Check Electron DevTools for debugging

## Notes

- The app works as both a PWA (browser) and Electron desktop app
- Offline functionality uses IndexedDB (Dexie) for local storage
- All native features gracefully fallback if dependencies fail
- Printer service supports multiple methods with automatic fallback

