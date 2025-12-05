import React, { useState, useEffect } from 'react';
import { Sun, Moon, User, LogOut, Bell, Menu, X, Wifi, WifiOff } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useNotifications } from '../../contexts/NotificationContext';
import ConfirmationModal from '../UI/ConfirmationModal';

interface HeaderProps {
  onProfileClick: () => void;
  onNotificationClick: () => void;
  notificationTriggerRef: React.RefObject<HTMLButtonElement>;
  onSidebarToggle?: () => void;
  sidebarOpen?: boolean;
}

const Header: React.FC<HeaderProps> = ({ onProfileClick, onNotificationClick, notificationTriggerRef, onSidebarToggle, sidebarOpen = true }) => {
  const { user, currentUser, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { unreadCount } = useNotifications();
  const [isOnline, setIsOnline] = useState(() => {
    // Check initial online status
    if (typeof navigator !== 'undefined') {
      return navigator.onLine;
    }
    return true; // Default to online if navigator is not available
  });
  const [showLogoutConfirm, setShowLogoutConfirm] = useState<boolean>(false);

  useEffect(() => {
    // Function to check actual connectivity with timeout
    const checkConnectivity = async () => {
      // First check navigator.onLine (fast)
      if (!navigator.onLine) {
        setIsOnline(false);
        return;
      }

      // Then verify with a lightweight connectivity check
      try {
        // Use a small image request with timeout to verify connectivity
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout

        await fetch('https://www.google.com/favicon.ico', {
          method: 'HEAD',
          mode: 'no-cors',
          cache: 'no-cache',
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        setIsOnline(true);
      } catch (error) {
        // If fetch fails or times out, use navigator.onLine as fallback
        setIsOnline(navigator.onLine);
      }
    };

    const handleOnline = () => {
      // When browser detects online, verify it
      checkConnectivity();
    };

    const handleOffline = () => {
      // When browser detects offline, immediately set to offline
      setIsOnline(false);
    };

    // Initial connectivity check
    checkConnectivity();

    // Listen to browser online/offline events
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Periodic connectivity check (every 30 seconds) to catch cases where
    // navigator.onLine might be stale
    const connectivityInterval = setInterval(() => {
      checkConnectivity();
    }, 30000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(connectivityInterval);
    };
  }, []);

  return (
    <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 backdrop-blur-xl bg-opacity-95 dark:bg-opacity-95">
      {/* Welcome Message - Top on Mobile */}
      <div className="px-3 md:px-4 py-1 lg:hidden border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <h1 className="text-xs md:text-sm font-semibold text-gray-900 dark:text-white">
          Welcome back, {currentUser?.name || user?.displayName || 'User'}
        </h1>
        <div className="flex items-center gap-2">
          {isOnline ? (
            <Wifi className="w-4 h-4 text-green-600 dark:text-green-400" />
          ) : (
            <WifiOff className="w-4 h-4 text-red-600 dark:text-red-400" />
          )}
          <span className={`text-xs font-medium whitespace-nowrap ${
            isOnline 
              ? 'text-green-600 dark:text-green-400' 
              : 'text-red-600 dark:text-red-400'
          }`}>
            {isOnline ? 'Online' : 'Offline'}
          </span>
        </div>
      </div>

      {/* Main Header Content */}
      <div className="flex items-center justify-between px-3 md:px-4 py-2 md:py-3">
        <div className="flex items-center space-x-3 md:space-x-4">
          {/* Sidebar Toggle Button - Desktop only */}
          {onSidebarToggle && (
            <button
              onClick={onSidebarToggle}
              className="hidden lg:flex p-1.5 md:p-2 rounded-lg text-gray-900 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              aria-label="Toggle sidebar"
            >
              {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          )}
          
          {/* Logo - Always visible */}
          <div className="flex items-center">
            <img 
              src={theme === 'dark' ? '/icons/CentalDarkmode.png' : '/icons/CentalLightmode.png'} 
              alt="Central POS" 
              className="w-6 h-6 md:w-8 md:h-8 scale-[2]" 
            />
          </div>
          
          {/* Welcome message - Hidden on mobile, shown on desktop */}
          <h1 className="hidden lg:block text-base md:text-lg font-semibold text-gray-900 dark:text-white">
            Welcome back, {currentUser?.name || user?.displayName || 'User'}
          </h1>
        </div>

        <div className="flex items-center space-x-2 md:space-x-4">
          <button
            onClick={toggleTheme}
            className="p-1.5 md:p-2 rounded-lg text-gray-900 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            {theme === 'light' ? <Moon className="w-4 h-4 md:w-5 md:h-5" /> : <Sun className="w-4 h-4 md:w-5 md:h-5" />}
          </button>
          
          <button
            ref={notificationTriggerRef}
            onClick={onNotificationClick}
            className="relative p-1.5 md:p-2 rounded-lg text-gray-900 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <Bell className="w-4 h-4 md:w-5 md:h-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-4 w-4 md:h-5 md:w-5 flex items-center justify-center text-xs">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          <button
            onClick={onProfileClick}
            className="flex items-center space-x-1 md:space-x-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg p-1.5 md:p-2 transition-colors"
          >
            <div className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-gradient-primary backdrop-blur-sm flex items-center justify-center">
              <User className="w-3.5 h-3.5 md:w-4 md:h-4 text-black dark:text-white" />
            </div>
            <span className="hidden sm:inline text-xs md:text-sm font-medium text-gray-700 dark:text-gray-300">
              {currentUser?.role || 'User'}
            </span>
          </button>

          <button
            onClick={() => setShowLogoutConfirm(true)}
            className="p-1.5 md:p-2 rounded-lg text-gray-900 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            title="Sign Out"
          >
            <LogOut className="w-4 h-4 md:w-5 md:h-5" />
          </button>

          {/* Online Status Indicator - Rightmost (Desktop only) */}
          <div className="hidden lg:flex items-center gap-2 ml-2">
            {isOnline ? (
              <Wifi className="w-4 h-4 text-green-600 dark:text-green-400" />
            ) : (
              <WifiOff className="w-4 h-4 text-red-600 dark:text-red-400" />
            )}
            <span className={`text-xs font-medium whitespace-nowrap ${
              isOnline 
                ? 'text-green-600 dark:text-green-400' 
                : 'text-red-600 dark:text-red-400'
            }`}>
              {isOnline ? 'Online' : 'Offline'}
            </span>
          </div>
        </div>
      </div>

      {/* Logout Confirmation Modal */}
      <ConfirmationModal
        isOpen={showLogoutConfirm}
        onClose={() => setShowLogoutConfirm(false)}
        onConfirm={async () => {
          setShowLogoutConfirm(false);
          await logout();
        }}
        title="Sign Out"
        message="Are you sure you want to sign out? You will need to log in again to access the system."
        type="warning"
        confirmText="Sign Out"
        cancelText="Cancel"
      />
    </header>
  );
};

export default Header;
