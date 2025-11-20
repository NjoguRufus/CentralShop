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

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}
      
      {/* Sidebar */}
      <div className={`
        fixed left-0 top-0 z-50 h-full w-64 transform transition-transform duration-300 ease-in-out
        lg:translate-x-0 lg:static lg:inset-0
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700
        backdrop-blur-xl bg-opacity-95 dark:bg-opacity-95
      `}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-center h-12 md:h-14 px-3 md:px-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-1 md:space-x-2">
              <img src="/icons/central.png" alt="Central POS" className="w-6 h-6 md:w-7 md:h-7" />
              <span className="text-base md:text-lg font-bold bg-gradient-primary-text">
                Central POS
              </span>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-2 md:px-3 py-3 md:py-4 space-y-1 md:space-y-2">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              const hasAccess = !item.requiredRole || hasPermission(item.requiredRole);
              
              if (!hasAccess) return null;
              
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => window.innerWidth < 1024 && onClose()}
                  className={`
                    flex items-center px-2 md:px-3 py-1.5 md:py-2 rounded-lg md:rounded-xl transition-all duration-200 text-sm
                    ${isActive 
                      ? 'bg-gradient-primary text-white shadow-lg shadow-primary' 
                      : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-primary'
                    }
                  `}
                >
                  <Icon className="w-4 h-4 md:w-5 md:h-5 mr-2" />
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
