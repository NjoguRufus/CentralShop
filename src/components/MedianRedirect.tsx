import React, { useEffect } from 'react';
import { isMedianBrowser, isAndroid, isIOS, getCurrentURL, convertToChromeURL } from '../utils/browserCheck';

interface MedianRedirectProps {
  children: React.ReactNode;
}

/**
 * MedianRedirect Component
 * Detects when app is running inside Median's in-app browser and redirects to system browser
 */
const MedianRedirect: React.FC<MedianRedirectProps> = ({ children }) => {
  useEffect(() => {
    // Only redirect if we're in Median browser
    if (!isMedianBrowser()) {
      return;
    }

    const currentURL = getCurrentURL();

    // Handle Android: Redirect to Chrome using custom scheme
    if (isAndroid()) {
      const chromeURL = convertToChromeURL(currentURL);
      console.log('Median detected on Android, redirecting to Chrome:', chromeURL);
      
      // Try to open in Chrome
      window.location.href = chromeURL;
      
      // Fallback: If Chrome scheme doesn't work, try intent URL
      setTimeout(() => {
        const intentURL = `intent://${currentURL.replace(/^https?:\/\//, '')}#Intent;scheme=https;package=com.android.chrome;end`;
        window.location.href = intentURL;
      }, 1000);
      
      return;
    }

    // Handle iOS: Show alert and redirect
    if (isIOS()) {
      const message = 'Camera access is blocked by the Median app. Please open this POS in Safari for full functionality.';
      
      alert(message);
      
      // Redirect to same URL - Safari will prompt to open
      // iOS will automatically prompt to open in Safari when navigating to the same URL
      setTimeout(() => {
        window.location.href = currentURL;
      }, 500);
      
      return;
    }

    // For other platforms, just log
    console.warn('Median browser detected but platform not Android/iOS. Camera may not work.');
  }, []); // Remove location.pathname dependency since we're not using it

  // Render children normally (redirect happens via window.location)
  return <>{children}</>;
};

export default MedianRedirect;

