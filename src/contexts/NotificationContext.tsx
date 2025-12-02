import React, { createContext, useContext, useMemo, useState, useEffect } from 'react';
import { collection, doc, query, where, getDocs, orderBy, limit, Timestamp } from 'firebase/firestore';
import { addDoc, updateDoc } from '../offline/firestoreWrappers';
import { db } from '../firebase';
import { useAuth } from './AuthContext';
import { getShopCollectionName } from '../config/shopConfig';

export type AppNotification = {
  id: string;
  title?: string;
  message: string;
  createdAt: Date;
  read: boolean;
  type?: 'info' | 'success' | 'warning' | 'error';
};

type NotificationContextValue = {
  notifications: AppNotification[];
  unreadCount: number;
  loading: boolean;
  addNotification: (n: Omit<AppNotification, 'id' | 'createdAt' | 'read'> & { id?: string }) => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  clear: () => void;
};

const NotificationContext = createContext<NotificationContextValue | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  const unreadCount = useMemo(
    () => notifications.filter(n => !n.read).length,
    [notifications]
  );

  // DISABLED: Notifications are now local-only (in-memory), no Firestore fetching
  // Old collection "CentralShopNotifications" has been replaced and disabled
  useEffect(() => {
    // Notifications are now only stored in local state, not in Firestore
        setLoading(false);
  }, [currentUser?.shopId]);

  const addNotification: NotificationContextValue['addNotification'] = async (n) => {
    const notificationId = n.id || crypto.randomUUID();
    const newNotification: AppNotification = {
      id: notificationId,
      title: n.title,
      message: n.message,
      type: n.type,
      read: false,
      createdAt: new Date()
    };

    // Update local state immediately (in-memory only)
    setNotifications(prev => [newNotification, ...prev]);

    // DISABLED: No longer saving notifications to Firestore automatically
    // Notifications are now only stored in local state (in-memory)
    // This prevents automatic creation of CentralShopNotifications documents
    // If you need persistent notifications, they must be created manually through the UI
    console.log('Notification created (local only):', n.title);
  };

  const markAllAsRead: NotificationContextValue['markAllAsRead'] = async () => {
    const unreadNotifications = notifications.filter(n => !n.read);
    
    // Update local state only (in-memory)
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));

    // DISABLED: No longer updating notifications in Firestore
    // This prevents automatic creation/updates of CentralShopNotifications documents
    console.log('Marked all notifications as read (local only)');
  };

  const markAsRead: NotificationContextValue['markAsRead'] = async (id: string) => {
    // Update local state only (in-memory)
    setNotifications(prev => prev.map(n => (n.id === id ? { ...n, read: true } : n)));

    // DISABLED: No longer updating notifications in Firestore
    // This prevents automatic creation/updates of CentralShopNotifications documents
    console.log('Marked notification as read (local only):', id);
  };

  const clear = () => {
    setNotifications([]);
  };

  const value: NotificationContextValue = {
    notifications,
    unreadCount,
    loading,
    addNotification,
    markAsRead,
    markAllAsRead,
    clear
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

export function useNotifications(): NotificationContextValue {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    // Provide a safe fallback to avoid crashes if provider isn't mounted yet
    return {
      notifications: [],
      unreadCount: 0,
      loading: false,
      addNotification: async () => {},
      markAsRead: async () => {},
      markAllAsRead: async () => {},
      clear: () => {}
    };
  }
  return ctx;
}

export default NotificationProvider;



