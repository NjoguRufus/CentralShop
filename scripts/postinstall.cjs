#!/usr/bin/env node

/**
 * Postinstall script that conditionally runs electron-builder install-app-deps
 * Skips on Vercel and other CI environments where Electron native modules aren't needed
 */

const { execSync } = require('child_process');

// Skip on Vercel or if explicitly disabled
if (process.env.VERCEL || process.env.SKIP_ELECTRON_BUILD === 'true') {
  console.log('Skipping electron-builder install-app-deps (not needed on Vercel/CI)');
  process.exit(0);
}

try {
  console.log('Installing Electron app dependencies...');
  execSync('npx electron-builder install-app-deps', { stdio: 'inherit' });
} catch (error) {
  console.warn('Warning: electron-builder install-app-deps failed, but continuing...');
  console.warn('This is normal if you\'re not building Electron apps.');
  // Don't fail the install process
  process.exit(0);
}

