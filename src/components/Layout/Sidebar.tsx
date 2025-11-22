import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Package, 
  ShoppingCart, 
  Users, 
  FileText, 
  UserCheck, 
  Settings,
  Building2,
  Receipt,
  Truck,
  CreditCard,
  BarChart3
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';

const menuItems = [
  { path: '/developer', label: 'Developer Dashboard', icon: Building2, requiredRole: 'astraronix' },
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, requiredRole: 'Admin' },
  { path: '/inventory', label: 'Inventory', icon: Package, requiredRole: 'Stock Manager' },
  { path: '/pos', label: 'POS', icon: ShoppingCart, requiredRole: 'Cashier' },
  { path: '/customers', label: 'Customers', icon: Users, requiredRole: 'Admin' },
  { path: '/orders', label: 'Orders', icon: FileText, requiredRole: 'Cashier' },
  { path: '/invoicing', label: 'Invoicing', icon: Receipt, requiredRole: 'Admin' },
  { path: '/suppliers', label: 'Suppliers', icon: Truck, requiredRole: 'Admin' },
  { path: '/expenses', label: 'Expenses', icon: CreditCard, requiredRole: 'Admin' },
  { path: '/stock-reports', label: 'Stock Reports', icon: BarChart3, requiredRole: 'Admin' },
  { path: '/employees', label: 'Employees', icon: UserCheck, requiredRole: 'Admin' },
  { path: '/settings', label: 'Settings', icon: Settings, requiredRole: 'Admin' },
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const location = useLocation();
  const { hasPermission } = useAuth();
  const { theme } = useTheme();

  return (
    <>
      {/* Sidebar - Hidden on mobile, visible on desktop, starts below header */}
      <div className={`
        hidden lg:block
        fixed left-0 top-[73px] z-40 h-[calc(100vh-73px)] w-64
        bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700
        backdrop-blur-xl bg-opacity-95 dark:bg-opacity-95
        transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex flex-col h-full">
          {/* Navigation - Logo removed, now in header */}
          <nav className="flex-1 px-2 md:px-3 py-3 md:py-4 space-y-1 md:space-y-2">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + '/');
              const hasAccess = !item.requiredRole || hasPermission(item.requiredRole);
              
              if (!hasAccess) return null;
              
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`
                    flex items-center px-2 md:px-3 py-1.5 md:py-2 rounded-lg md:rounded-xl transition-all duration-200 text-sm
                    ${isActive 
                      ? 'bg-gradient-primary text-black dark:text-white shadow-lg shadow-primary backdrop-blur-sm' 
                      : 'text-gray-900 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-primary'
                    }
                  `}
                >
                  <Icon className={`w-4 h-4 md:w-5 md:h-5 mr-2 ${isActive ? 'text-black dark:text-white' : 'text-gray-900 dark:text-gray-300'}`} />
                  <span className="font-medium">{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
