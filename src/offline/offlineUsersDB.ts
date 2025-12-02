/**
 * Offline Users Database
 * Stores credentials for offline-only users in IndexedDB via Dexie
 */
import Dexie, { Table } from 'dexie';

export interface OfflineUser {
  id?: number;
  email: string;
  passwordHash: string;
  role: 'astraronix' | 'mainAdmin' | 'Admin' | 'Cashier' | 'Stock Manager';
  name: string;
  shopName: string;
}

class OfflineUsersDB extends Dexie {
  offlineUsers!: Table<OfflineUser, number>;

  constructor() {
    super('OfflineUsersDB');

    this.version(1).stores({
      // email is indexed to allow fast lookups
      offlineUsers: '++id, email'
    });
  }
}

export const offlineUsersDb = new OfflineUsersDB();

/**
 * Add or update an offline user.
 * If a user with the same email exists, it will be updated.
 */
export async function addOfflineUser(user: OfflineUser): Promise<number> {
  const existing = await offlineUsersDb.offlineUsers
    .where('email')
    .equalsIgnoreCase(user.email)
    .first();

  if (existing && existing.id != null) {
    await offlineUsersDb.offlineUsers.update(existing.id, {
      passwordHash: user.passwordHash,
      role: user.role,
      name: user.name,
      shopName: user.shopName
    });
    return existing.id;
  }

  return offlineUsersDb.offlineUsers.add(user);
}

export async function getOfflineUserByEmail(email: string): Promise<OfflineUser | undefined> {
  return offlineUsersDb.offlineUsers.where('email').equalsIgnoreCase(email).first();
}

export async function getAllOfflineUsers(): Promise<OfflineUser[]> {
  return offlineUsersDb.offlineUsers.toArray();
}


