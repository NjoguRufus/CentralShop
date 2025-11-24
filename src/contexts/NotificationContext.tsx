import React, { createContext, useContext, useMemo, useState } from 'react';

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
  addNotification: (n: Omit<AppNotification, 'id' | 'createdAt' | 'read'> & { id?: string }) => void;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  clear: () => void;
};

const NotificationContext = createContext<NotificationContextValue | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading] = useState(false);

  const unreadCount = useMemo(
    () => notifications.filter(n => !n.read).length,
    [notifications]
  );

  const addNotification: NotificationContextValue['addNotification'] = (n) => {
    setNotifications(prev => [
      {
        id: n.id || crypto.randomUUID(),
        title: n.title,
        message: n.message,
        type: n.type,
        read: false,
        createdAt: new Date()
      },
      ...prev
    ]);
  };

  const markAllAsRead: NotificationContextValue['markAllAsRead'] = async () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const markAsRead: NotificationContextValue['markAsRead'] = async (id: string) => {
    setNotifications(prev => prev.map(n => (n.id === id ? { ...n, read: true } : n)));
  };

  const clear = () => setNotifications([]);

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
      addNotification: () => {},
      markAsRead: async () => {},
      markAllAsRead: async () => {},
      clear: () => {}
    };
  }
  return ctx;
}

export default NotificationProvider;



