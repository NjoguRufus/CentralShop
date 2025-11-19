import React, { useEffect, useRef } from 'react';
import { User, Mail, Building2, Shield, Calendar, X } from 'lucide-react';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'astraronix' | 'mainAdmin' | 'Admin' | 'Cashier' | 'Stock Manager';
  status: 'Active' | 'Inactive';
  avatar?: string;
  uid: string;
  shopId?: string;
  shopName?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
}

const ProfileModal: React.FC<ProfileModalProps> = ({ isOpen, onClose, user }) => {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !user) return null;

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'astraronix':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'mainAdmin':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'Admin':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'Stock Manager':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      case 'Cashier':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const getStatusColor = (status: string) => {
    return status === 'Active' 
      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
      : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
  };

  return (
    <div
      ref={modalRef}
      className="fixed right-4 top-16 w-80 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-[9999]"
    >
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Profile</h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
          >
            <X className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        <div className="space-y-3">
        {/* Profile Header */}
        <div className="text-center">
          <div className="w-20 h-20 mx-auto mb-4 bg-gradient-primary rounded-full flex items-center justify-center">
            {user.avatar ? (
              <img 
                src={user.avatar} 
                alt={user.name}
                className="w-20 h-20 rounded-full object-cover"
              />
            ) : (
              <User className="w-10 h-10 text-white" />
            )}
          </div>
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white">{user.name}</h3>
          <p className="text-gray-600 dark:text-gray-400">{user.email}</p>
        </div>

        {/* Profile Details */}
        <div className="space-y-4">
          <div className="flex items-center space-x-3">
            <Shield className="w-5 h-5 text-gray-400" />
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Role</p>
              <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${getRoleColor(user.role)}`}>
                {user.role}
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <div className="w-5 h-5 flex items-center justify-center">
              <div className={`w-3 h-3 rounded-full ${user.status === 'Active' ? 'bg-green-500' : 'bg-red-500'}`}></div>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Status</p>
              <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(user.status)}`}>
                {user.status}
              </span>
            </div>
          </div>

          {user.shopName && (
            <div className="flex items-center space-x-3">
              <Building2 className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Shop</p>
                <p className="text-gray-900 dark:text-white">{user.shopName}</p>
              </div>
            </div>
          )}

          <div className="flex items-center space-x-3">
            <Calendar className="w-5 h-5 text-gray-400" />
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Member Since</p>
              <p className="text-gray-900 dark:text-white">
                {user.createdAt.toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <Mail className="w-5 h-5 text-gray-400" />
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">User ID</p>
              <p className="text-gray-900 dark:text-white font-mono text-xs">{user.uid}</p>
            </div>
          </div>
        </div>

          {/* Actions */}
          <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex justify-end">
              <button
                onClick={onClose}
                className="px-4 py-2 bg-[#4A90A4] text-white rounded-lg hover:bg-[#3a7a8a] transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileModal;
