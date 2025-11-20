/**
 * Offline Notifier Component
 * Shows a banner when the app goes offline
 */
import React, { useState, useEffect } from 'react';
import Card from './UI/Card';
import { WifiOff, Wifi } from 'lucide-react';

const OfflineNotifier: React.FC = () => {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      setShowBanner(true);
      setTimeout(() => setShowBanner(false), 3000);
    };

    const handleOffline = () => {
      setIsOffline(true);
      setShowBanner(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Auto-hide offline banner after 5 seconds, but keep showing online banner briefly
  useEffect(() => {
    if (isOffline && showBanner) {
      const timer = setTimeout(() => setShowBanner(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [isOffline, showBanner]);

  if (!showBanner) return null;

  return (
    <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-40 max-w-md w-full px-4">
      <Card className={`p-3 md:p-4 shadow-lg ${
        isOffline 
          ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800' 
          : 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
      }`}>
        <div className="flex items-center gap-2 md:gap-3">
          {isOffline ? (
            <>
              <WifiOff className="w-4 h-4 md:w-5 md:h-5 text-orange-600 dark:text-orange-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs md:text-sm font-semibold text-orange-900 dark:text-orange-100">
                  Working Offline
                </p>
                <p className="text-xs text-orange-700 dark:text-orange-300">
                  Changes will sync automatically when online.
                </p>
              </div>
            </>
          ) : (
            <>
              <Wifi className="w-4 h-4 md:w-5 md:h-5 text-green-600 dark:text-green-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs md:text-sm font-semibold text-green-900 dark:text-green-100">
                  Back Online
                </p>
                <p className="text-xs text-green-700 dark:text-green-300">
                  Syncing your changes...
                </p>
              </div>
            </>
          )}
        </div>
      </Card>
    </div>
  );
};

export default OfflineNotifier;

