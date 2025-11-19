/**
 * App Update Prompt Component
 * Detects new service worker versions and prompts user to update
 */
import React, { useState, useEffect } from 'react';
import { registerSW } from 'virtual:pwa-register';
import Button from './UI/Button';
import Card from './UI/Card';
import { RefreshCw, X } from 'lucide-react';

const AppUpdatePrompt: React.FC = () => {
  const [showPrompt, setShowPrompt] = useState(false);
  const [updateSW, setUpdateSW] = useState<(() => Promise<void>) | null>(null);

  useEffect(() => {
    const { needRefresh, updateServiceWorker } = registerSW({
      onNeedRefresh() {
        console.log('New content available, please refresh.');
        setShowPrompt(true);
        setUpdateSW(() => updateServiceWorker);
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
      setShowPrompt(true);
      setUpdateSW(() => updateServiceWorker);
    }
  }, []);

  const handleUpdate = async () => {
    if (updateSW) {
      await updateSW();
      window.location.reload();
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-md">
      <Card className="p-4 shadow-lg border-2 border-[#4A90A4]">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
              New Version Available
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              A new version of Central Shop POS is available. Update now to get the latest features and improvements.
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
          <Button
            onClick={handleUpdate}
            className="flex-1"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Update Now
          </Button>
          <Button
            onClick={handleDismiss}
            variant="outline"
            className="flex-1"
          >
            Later
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default AppUpdatePrompt;

