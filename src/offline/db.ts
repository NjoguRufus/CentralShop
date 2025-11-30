/**
 * IndexedDB Database Setup using Dexie
 * Provides offline storage for products, orders, customers, and settings
 */
import Dexie, { Table } from 'dexie';
import { ProductUnit } from '../types';

export interface OfflineProduct {
  id?: string;
  name: string;
  price: number;
  stock: number;
  category: string;
  image?: string;
  barcode?: string;
  description?: string;
  unit?: ProductUnit;
  requireMeasurement?: boolean;
  measurementLabel?: string;
  lastSynced?: Date;
  isDirty?: boolean;
}

export interface OfflineOrder {
  id?: string;
  customerId: string;
  items: Array<{
    productId: string;
    name: string;
    quantity: number;
    price: number;
  }>;
  subtotal: number;
  tax: number;
  total: number;
  status: 'completed' | 'pending' | 'cancelled' | 'partial';
  paymentMethod: string;
  createdAt: Date;
  employeeId?: string;
  employeeName?: string;
  synced: boolean;
  syncError?: string;
}

export interface OfflineCustomer {
  id?: string;
  name: string;
  email?: string;
  phone: string;
  address?: string;
  lastSynced?: Date;
  isDirty?: boolean;
}

export interface OfflineSetting {
  key: string;
  value: any;
  lastSynced?: Date;
}

export interface PendingWrite {
  id?: string;
  collection: string;
  data: any;
  type: 'add' | 'update' | 'delete';
  status: 'pending' | 'syncing' | 'synced' | 'error';
  docId?: string; // For update/delete operations
  timestamp: Date;
  retryCount?: number;
  error?: string;
}

export interface LocalCache {
  id: string;
  collection: string;
  data: any;
  lastSynced?: Date;
}

class CentralShopDB extends Dexie {
  products!: Table<OfflineProduct, string>;
  orders!: Table<OfflineOrder, string>;
  customers!: Table<OfflineCustomer, string>;
  settings!: Table<OfflineSetting, string>;
  syncQueue!: Table<{ id?: string; type: string; data: any; timestamp: Date }, string>;
  pendingWrites!: Table<PendingWrite, string>;
  localCache!: Table<LocalCache, string>;

  constructor() {
    super('CentralShopDB');
    
    this.version(1).stores({
      products: 'id, name, category, lastSynced, isDirty',
      orders: 'id, customerId, createdAt, synced, status',
      customers: 'id, phone, name, lastSynced, isDirty',
      settings: 'key, lastSynced',
      syncQueue: '++id, type, timestamp'
    });

    // Version 2: Add pendingWrites and localCache tables
    this.version(2).stores({
      products: 'id, name, category, lastSynced, isDirty',
      orders: 'id, customerId, createdAt, synced, status',
      customers: 'id, phone, name, lastSynced, isDirty',
      settings: 'key, lastSynced',
      syncQueue: '++id, type, timestamp',
      pendingWrites: '++id, collection, type, status, timestamp',
      localCache: 'id, collection, lastSynced'
    });
  }
}

export const db = new CentralShopDB();

