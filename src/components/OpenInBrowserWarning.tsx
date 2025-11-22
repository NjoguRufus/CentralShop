import React, { useState, useEffect } from 'react';
import { X, ExternalLink } from 'lucide-react';
import { isMedianBrowser, getCurrentURL } from '../utils/browserCheck';

/**
 * OpenInBrowserWarning Component
 * Shows a warning modal when running inside Median browser
 */
const OpenInBrowserWarning: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Only show if inside Median
    if (isMedianBrowser()) {
      setIsVisible(true);
    }
  }, []);

  const handleOpenInBrowser = () => {
    const currentURL = getCurrentURL();
    
    // Try to open in system browser
    // For Android: Try Chrome
    if (/android/i.test(navigator.userAgent)) {
      const chromeURL = currentURL.replace(/^https?:\/\//, 'googlechrome://');
      window.location.href = chromeURL;
    } else {
      // For iOS and others: Just open the same URL
      window.location.href = currentURL;
    }
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6 relative">
        {/* Close Button */}
        <button
          onClick={() => setIsVisible(false)}
          className="absolute top-4 right-4 p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          aria-label="Close warning"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Content */}
        <div className="text-center">
          <div className="mb-4 flex justify-center">
            <div className="w-16 h-16 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center">
              <ExternalLink className="w-8 h-8 text-yellow-600 dark:text-yellow-400" />
            </div>
          </div>

          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            Camera Access Blocked
          </h2>

          <p className="text-gray-600 dark:text-gray-300 mb-6">
            Camera access is blocked by the Median app. Please open this POS in Chrome/Safari for full functionality, including barcode scanning.
          </p>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleOpenInBrowser}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 px-6 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
            >
              <ExternalLink className="w-5 h-5" />
              Open in Browser
            </button>
            <button
              onClick={() => setIsVisible(false)}
              className="flex-1 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-white py-3 px-6 rounded-lg font-semibold transition-colors"
            >
              Continue Anyway
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OpenInBrowserWarning;

