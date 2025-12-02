import React, { useState } from 'react';
import { clearAllLocalData } from '../utils/clearAllData';
import Card from '../components/UI/Card';
import Button from '../components/UI/Button';
import { toast } from 'react-toastify';

const ClearData: React.FC = () => {
  const [clearing, setClearing] = useState(false);

  const handleClearAll = async () => {
    if (!window.confirm('⚠️ WARNING: This will delete ALL local data (IndexedDB, localStorage, cache). This cannot be undone!\n\nAre you sure you want to continue?')) {
      return;
    }

    if (!window.confirm('⚠️ FINAL CONFIRMATION: This will permanently delete all local data. Continue?')) {
      return;
    }

    setClearing(true);
    try {
      await clearAllLocalData();
      toast.success('All local data cleared! Reloading page...');
      
      // Reload after a short delay
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error: any) {
      console.error('Error clearing data:', error);
      toast.error('Error clearing data: ' + (error.message || 'Unknown error'));
      setClearing(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900 dark:text-white">
            Clear All Data
          </h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Start from a clean slate
          </p>
        </div>
        
        <Card className="p-8">
          <div className="space-y-6">
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-yellow-800 dark:text-yellow-200 mb-2">
                ⚠️ Warning
              </h3>
              <p className="text-sm text-yellow-700 dark:text-yellow-300">
                This will permanently delete:
              </p>
              <ul className="list-disc list-inside text-sm text-yellow-700 dark:text-yellow-300 mt-2 space-y-1">
                <li>All IndexedDB data (products, orders, customers, etc.)</li>
                <li>All localStorage data (auth sessions, settings, etc.)</li>
                <li>All browser cache</li>
              </ul>
              <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-2">
                <strong>Note:</strong> This does NOT delete Firestore data. To clear Firestore, use Firebase Console.
              </p>
            </div>

            <Button
              onClick={handleClearAll}
              disabled={clearing}
              className="w-full bg-red-600 hover:bg-red-700 text-white"
            >
              {clearing ? 'Clearing Data...' : 'Clear All Local Data'}
            </Button>

            <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
              After clearing, the page will automatically reload
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default ClearData;

