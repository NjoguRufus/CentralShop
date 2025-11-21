/**
 * Mobile Bottom Navigation Component
 * Provides mobile-friendly bottom navigation for PWA
 */
import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, ShoppingCart, Package, FileText, Menu } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import MobileMenuModal from './MobileMenuModal';

const MobileBottomNav: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Check if mobile device
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  ) || window.innerWidth < 768;

  if (!isMobile) {
    return null;
  }

  const navItems = [
    {
      path: '/dashboard',
      icon: Home,
      label: 'Home',
      roles: ['Admin', 'mainAdmin']
    },
    {
      path: '/pos',
      icon: ShoppingCart,
      label: 'POS',
      roles: ['Cashier', 'Admin', 'mainAdmin']
    },
    {
      path: '/inventory',
      icon: Package,
      label: 'Stock',
      roles: ['Stock Manager', 'Admin', 'mainAdmin']
    },
    {
      path: '/orders',
      icon: FileText,
      label: 'Orders',
      roles: ['Cashier', 'Admin', 'mainAdmin']
    }
  ];

  // Filter nav items based on user role
  const availableItems = navItems.filter(item => {
    if (!currentUser?.role) return false;
    return item.roles.includes(currentUser.role);
  });

  const isActive = (path: string) => {
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 md:hidden">
      <div className="flex justify-around items-center h-16">
        {availableItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
                active
                  ? 'text-[#4A90A4] dark:text-[#4A90A4]'
                  : 'text-gray-500 dark:text-gray-400 hover:text-[#4A90A4] dark:hover:text-[#4A90A4]'
              }`}
              aria-label={item.label}
            >
              <Icon className="w-5 h-5 mb-1" />
              <span className="text-xs font-medium">{item.label}</span>
            </button>
          );
        })}
        <button
          onClick={() => setIsMenuOpen(true)}
          className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
            isMenuOpen
              ? 'text-[#4A90A4] dark:text-[#4A90A4]'
              : 'text-gray-500 dark:text-gray-400 hover:text-[#4A90A4] dark:hover:text-[#4A90A4]'
          }`}
          aria-label="More Menu"
        >
          <Menu className="w-5 h-5 mb-1" />
          <span className="text-xs font-medium">More</span>
        </button>
      </div>
      
      {/* Mobile Menu Modal */}
      <MobileMenuModal isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />
    </nav>
  );
};

export default MobileBottomNav;

