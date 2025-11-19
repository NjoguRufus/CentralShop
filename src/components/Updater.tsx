/**
 * Updater Component
 * Shows update notifications and install prompt
 */
import React, { useState, useEffect } from 'react';
import Card from './UI/Card';
import Button from './UI/Button';
import { Download, RefreshCw, X } from 'lucide-react';

interface UpdateInfo {
  version: string;
  releaseDate?: string;
  releaseNotes?: string;
}

const Updater: React.FC = () => {
  const [updateAvailable, setUpdateAvailable] = useState<UpdateInfo | null>(null);
  const [updateDownloaded, setUpdateDownloaded] = useState<UpdateInfo | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);

  useEffect(() => {
    // Check if running in Electron
    if (typeof window !== 'undefined' && window.electron) {
      // Listen for update available
      window.electron.onUpdateAvailable((info: UpdateInfo) => {
        setUpdateAvailable(info);
        setUpdateError(null);
      });

      // Listen for update downloaded
      window.electron.onUpdateDownloaded((info: UpdateInfo) => {
        setUpdateDownloaded(info);
        setUpdateAvailable(null);
      });

      // Listen for update errors
      window.electron.onUpdateError((error: string) => {
        setUpdateError(error);
      });

      return () => {
        window.electron.removeUpdateListeners();
      };
    }
  }, []);

  const handleInstallUpdate = async () => {
    if (window.electron) {
      await window.electron.installUpdate();
    }
  };

  const handleDismiss = () => {
    setUpdateAvailable(null);
    setUpdateDownloaded(null);
    setUpdateError(null);
  };

  if (!updateAvailable && !updateDownloaded && !updateError) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-md">
      <Card className="p-4 shadow-lg border-2 border-blue-500">
        {updateAvailable && (
          <>
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1 flex items-center gap-2">
                  <Download className="w-5 h-5 text-blue-500" />
                  Update Available
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Version {updateAvailable.version} is available. Downloading...
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
          </>
        )}

        {updateDownloaded && (
          <>
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1 flex items-center gap-2">
                  <RefreshCw className="w-5 h-5 text-green-500" />
                  Update Ready
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Version {updateDownloaded.version} has been downloaded. Restart to install.
                </p>
                {updateDownloaded.releaseNotes && (
                  <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    {updateDownloaded.releaseNotes}
                  </div>
                )}
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
              <Button onClick={handleInstallUpdate} className="flex-1">
                <RefreshCw className="w-4 h-4 mr-2" />
                Restart & Install
              </Button>
              <Button onClick={handleDismiss} variant="outline" className="flex-1">
                Later
              </Button>
            </div>
          </>
        )}

        {updateError && (
          <>
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-red-600 dark:text-red-400 mb-1">
                  Update Error
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {updateError}
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
          </>
        )}
      </Card>
    </div>
  );
};

export default Updater;

