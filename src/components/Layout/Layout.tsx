import React, { useState, useRef } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import ProfileModal from '../ProfileModal';
import NotificationsDropdown from '../NotificationsDropdown';
import { useAuth } from '../../contexts/AuthContext';

const Layout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  // AI assistant state removed
  const notificationTriggerRef = useRef<HTMLButtonElement>(null);
  const { currentUser } = useAuth();

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-black">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      <div className="flex-1 flex flex-col overflow-hidden lg:ml-0">
        <Header 
          onMenuClick={() => setSidebarOpen(true)} 
          onProfileClick={() => setIsProfileOpen(true)}
          onNotificationClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
          notificationTriggerRef={notificationTriggerRef}
        />
        
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
      
                  {/* Notifications Dropdown - Rendered at outermost layer */}
                  <NotificationsDropdown 
                    isOpen={isNotificationsOpen}
                    onClose={() => setIsNotificationsOpen(false)}
                    triggerRef={notificationTriggerRef}
                  />
                  
                  {/* Profile Modal - Rendered at outermost layer */}
                  <ProfileModal
                    isOpen={isProfileOpen}
                    onClose={() => setIsProfileOpen(false)}
                    user={currentUser}
                  />
    </div>
  );
};

export default Layout;
