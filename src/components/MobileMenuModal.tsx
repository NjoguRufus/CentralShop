/**
 * Mobile Menu Modal Component
 * Displays sidebar menu items in a modal/dropdown for mobile devices
 */
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { X } from 'lucide-react';
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
import { useAuth } from '../contexts/AuthContext';

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

interface MobileMenuModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const MobileMenuModal: React.FC<MobileMenuModalProps> = ({ isOpen, onClose }) => {
  const location = useLocation();
  const { hasPermission } = useAuth();

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 z-50 md:hidden"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-gray-900 rounded-t-3xl shadow-2xl max-h-[80vh] overflow-y-auto md:hidden animate-slide-up">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Menu</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Menu Items */}
        <nav className="px-2 py-4 space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            const hasAccess = !item.requiredRole || hasPermission(item.requiredRole);
            
            if (!hasAccess) return null;
            
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={onClose}
                className={`
                  flex items-center px-4 py-3 rounded-xl transition-all duration-200
                  ${isActive 
                    ? 'bg-gradient-primary text-white shadow-lg shadow-primary backdrop-blur-sm' 
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-primary'
                  }
                `}
              >
                <Icon className="w-5 h-5 mr-3" />
                <span className="font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </>
  );
};

export default MobileMenuModal;

