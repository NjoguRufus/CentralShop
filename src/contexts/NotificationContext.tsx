import React, { createContext, useContext, useMemo, useState, useEffect } from 'react';
import { collection, addDoc, updateDoc, doc, query, where, getDocs, orderBy, limit, Timestamp } from 'firebase/firestore';
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

  // Fetch notifications from Firestore
  useEffect(() => {
    const fetchNotifications = async () => {
      if (!currentUser?.shopId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const notificationsRef = collection(db, getShopCollectionName('notifications'));
        const q = query(
          notificationsRef,
          where('shopId', '==', currentUser.shopId),
          orderBy('createdAt', 'desc'),
          limit(100)
        );
        const snapshot = await getDocs(q);
        
        const fetchedNotifications: AppNotification[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          fetchedNotifications.push({
            id: docSnap.id,
            title: data.title,
            message: data.message,
            type: data.type,
            read: data.read || false,
            createdAt: data.createdAt?.toDate() || new Date()
          });
        });
        
        setNotifications(fetchedNotifications);
      } catch (error) {
        console.error('Error fetching notifications:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchNotifications();
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

    // Update local state immediately
    setNotifications(prev => [newNotification, ...prev]);

    // Save to Firestore
    if (currentUser?.shopId) {
      try {
        const notificationsRef = collection(db, getShopCollectionName('notifications'));
        await addDoc(notificationsRef, {
          id: notificationId,
          title: n.title,
          message: n.message,
          type: n.type || 'info',
          read: false,
          shopId: currentUser.shopId,
          createdAt: Timestamp.now()
        });
      } catch (error) {
        console.error('Error saving notification to Firestore:', error);
      }
    }
  };

  const markAllAsRead: NotificationContextValue['markAllAsRead'] = async () => {
    const unreadNotifications = notifications.filter(n => !n.read);
    
    // Update local state
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));

    // Update in Firestore
    if (currentUser?.shopId && unreadNotifications.length > 0) {
      try {
        const notificationsRef = collection(db, getShopCollectionName('notifications'));
        const updatePromises = unreadNotifications.map(notification => {
          const notificationDoc = doc(notificationsRef, notification.id);
          return updateDoc(notificationDoc, { read: true });
        });
        await Promise.all(updatePromises);
      } catch (error) {
        console.error('Error updating notifications in Firestore:', error);
      }
    }
  };

  const markAsRead: NotificationContextValue['markAsRead'] = async (id: string) => {
    // Update local state
    setNotifications(prev => prev.map(n => (n.id === id ? { ...n, read: true } : n)));

    // Update in Firestore
    if (currentUser?.shopId) {
      try {
        const notificationsRef = collection(db, getShopCollectionName('notifications'));
        const notificationDoc = doc(notificationsRef, id);
        await updateDoc(notificationDoc, { read: true });
      } catch (error) {
        console.error('Error updating notification in Firestore:', error);
      }
    }
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



