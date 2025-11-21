/**
 * PWA Update Component
 * Shows service worker update notifications and install prompt
 */
import React, { useState, useEffect } from 'react';
import Card from './UI/Card';
import Button from './UI/Button';
import { RefreshCw, X } from 'lucide-react';
import { registerSW } from 'virtual:pwa-register';

const Updater: React.FC = () => {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    const { needRefresh, updateServiceWorker } = registerSW({
      immediate: true,
      onNeedRefresh() {
        console.log('New content available, please refresh.');
        setUpdateAvailable(true);
      },
      onOfflineReady() {
        console.log('App ready to work offline');
      },
      onRegistered(registration) {
        console.log('Service Worker registered:', registration);
      },
      onRegisterError(error) {
        console.error('Service Worker registration error:', error);
      }
    });

    if (needRefresh) {
      setUpdateAvailable(true);
    }
  }, []);

  const handleUpdate = async () => {
    setIsUpdating(true);
    try {
      // Reload to apply update
      window.location.reload();
    } catch (error) {
      console.error('Update error:', error);
      setIsUpdating(false);
    }
  };

  const handleDismiss = () => {
    setUpdateAvailable(false);
  };

  if (!updateAvailable) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-md">
      <Card className="p-4 shadow-lg border-2 border-blue-500">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1 flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-blue-500" />
              Update Available
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              A new version of the app is available. Refresh to update.
            </p>
          </div>
          <button
            onClick={handleDismiss}
            className="ml-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            aria-label="Dismiss"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleUpdate} className="flex-1" disabled={isUpdating}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isUpdating ? 'animate-spin' : ''}`} />
            {isUpdating ? 'Updating...' : 'Update Now'}
          </Button>
          <Button onClick={handleDismiss} variant="outline" className="flex-1">
            Later
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default Updater;
