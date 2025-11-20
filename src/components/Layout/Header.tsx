import React, { useState } from 'react';
import { Menu, Sun, Moon, User, LogOut, Bell } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useNotifications } from '../../contexts/NotificationContext';

interface HeaderProps {
  onMenuClick: () => void;
  onProfileClick: () => void;
  onNotificationClick: () => void;
  notificationTriggerRef: React.RefObject<HTMLButtonElement>;
}

const Header: React.FC<HeaderProps> = ({ onMenuClick, onProfileClick, onNotificationClick, notificationTriggerRef }) => {
  const { user, currentUser, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { unreadCount } = useNotifications();

  return (
    <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 backdrop-blur-xl bg-opacity-95 dark:bg-opacity-95">
      {/* Welcome Message - Top on Mobile */}
      <div className="px-3 md:px-4 py-2 lg:hidden border-b border-gray-200 dark:border-gray-700">
        <h1 className="text-sm md:text-base font-semibold text-gray-900 dark:text-white">
          Welcome back, {currentUser?.name || user?.displayName || 'User'}
        </h1>
      </div>

      {/* Main Header Content */}
      <div className="flex items-center justify-between px-3 md:px-4 py-2 md:py-3">
        <div className="flex items-center space-x-4">
          <button
            onClick={onMenuClick}
            className="p-1.5 md:p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 lg:hidden"
          >
            <Menu className="w-5 h-5 md:w-6 md:h-6" />
          </button>
          
          {/* Welcome message - Hidden on mobile, shown on desktop */}
          <h1 className="hidden lg:block text-base md:text-lg font-semibold text-gray-900 dark:text-white">
            Welcome back, {currentUser?.name || user?.displayName || 'User'}
          </h1>
        </div>

        <div className="flex items-center space-x-4">
          <button
            onClick={toggleTheme}
            className="p-1.5 md:p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            {theme === 'light' ? <Moon className="w-4 h-4 md:w-5 md:h-5" /> : <Sun className="w-4 h-4 md:w-5 md:h-5" />}
          </button>
          
          <button
            ref={notificationTriggerRef}
            onClick={onNotificationClick}
            className="relative p-1.5 md:p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
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
            <div className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-gradient-primary flex items-center justify-center">
              <User className="w-3.5 h-3.5 md:w-4 md:h-4 text-white" />
            </div>
            <span className="hidden sm:inline text-xs md:text-sm font-medium text-gray-700 dark:text-gray-300">
              {currentUser?.role || 'User'}
            </span>
          </button>

          <button
            onClick={logout}
            className="p-1.5 md:p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <LogOut className="w-4 h-4 md:w-5 md:h-5" />
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
