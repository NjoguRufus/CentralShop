import React, { useState, useRef } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import ProfileModal from '../ProfileModal';
import NotificationsDropdown from '../NotificationsDropdown';
import MobileBottomNav from '../MobileBottomNav';
import { useAuth } from '../../contexts/AuthContext';

const Layout: React.FC = () => {
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  // AI assistant state removed
  const notificationTriggerRef = useRef<HTMLButtonElement>(null);
  const { currentUser } = useAuth();

  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-black">
      <Header 
        onProfileClick={() => setIsProfileOpen(true)}
        onNotificationClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
        notificationTriggerRef={notificationTriggerRef}
        onSidebarToggle={() => setSidebarOpen(!sidebarOpen)}
        sidebarOpen={sidebarOpen}
      />
      
      <div className="flex flex-1 overflow-hidden">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        
        <div className={`flex-1 flex flex-col overflow-hidden transition-all duration-300 ${sidebarOpen ? 'lg:ml-64' : 'lg:ml-0'}`}>
          <main className="flex-1 overflow-y-auto p-2 md:p-3 pb-20 md:pb-3">
            <Outlet />
          </main>
        </div>
      </div>
      
      {/* Mobile Bottom Navigation */}
      <MobileBottomNav />
      
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
