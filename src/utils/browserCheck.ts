/**
 * Browser Detection Utility
 * Detects if the app is running inside the Median app's in-app browser
 */

/**
 * Checks if the current browser is Median's in-app browser
 * @returns {boolean} True if running in Median browser
 */
export function isMedianBrowser(): boolean {
  if (typeof navigator === 'undefined' || !navigator.userAgent) {
    return false;
  }
  
  const userAgent = navigator.userAgent.toLowerCase();
  return userAgent.includes('median');
}

/**
 * Checks if the device is Android
 * @returns {boolean} True if Android device
 */
export function isAndroid(): boolean {
  if (typeof navigator === 'undefined' || !navigator.userAgent) {
    return false;
  }
  
  return /android/i.test(navigator.userAgent);
}

/**
 * Checks if the device is iOS (iPhone/iPad)
 * @returns {boolean} True if iOS device
 */
export function isIOS(): boolean {
  if (typeof navigator === 'undefined' || !navigator.userAgent) {
    return false;
  }
  
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

/**
 * Gets the current URL
 * @returns {string} Current URL
 */
export function getCurrentURL(): string {
  return window.location.href;
}

/**
 * Converts HTTPS URL to Chrome custom scheme URL for Android
 * @param {string} url - The HTTPS URL
 * @returns {string} Chrome custom scheme URL
 */
export function convertToChromeURL(url: string): string {
  // Remove https:// and convert to googlechrome://
  return url.replace(/^https?:\/\//, 'googlechrome://');
}

