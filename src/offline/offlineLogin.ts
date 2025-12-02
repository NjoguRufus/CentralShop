/**
 * Offline Login Logic
 * - Hashes passwords using Web Crypto SHA-256
 * - Attempts offline login using IndexedDB-stored users
 * - Persists offline auth session in localStorage
 */
import { addOfflineUser, getOfflineUserByEmail, getAllOfflineUsers, OfflineUser } from './offlineUsersDB';

export interface OfflineAuthSession {
  uid: string;
  email: string;
  displayName: string;
  role: OfflineUser['role'];
  shopName: string;
  isOfflineUser: true;
  loggedInAt: string;
}

const OFFLINE_SESSION_KEY = 'offlineAuthSession';
let offlineUsersInitialized = false;

/**
 * Hash a password using SHA-256 (Web Crypto)
 */
export async function hashPassword(password: string): Promise<string> {
  if (!password) return '';

  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const cryptoObj = (window.crypto || (window as any).msCrypto);
  const digest = await cryptoObj.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(digest));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Seed initial offline users if the table is empty (one-time)
 */
export async function initializeOfflineUsers(): Promise<void> {
  if (offlineUsersInitialized) return;

  try {
    const existingUsers = await getAllOfflineUsers();
    if (existingUsers.length > 0) {
      offlineUsersInitialized = true;
      return;
    }

    // Seed the initial offline users (passwords are hashed before storing)
    const seedUsers: Array<{ email: string; password: string; role: OfflineUser['role']; name: string; shopName: string }> = [
      {
        email: 'wchege20@gmail.com',
        password: 'sanyoras',
        role: 'mainAdmin',
        name: 'Wilfred Mwangi Chege',
        shopName: 'CentralShop'
      },
      {
        email: 'mkenya1tv@gmail.com',
        password: 'mkenya123',
        role: 'Cashier',
        name: 'Mkenya 1Tv',
        shopName: 'CentralShop'
      },
      {
        email: 'kamwene@gmail.com',
        password: 'kamwene123',
        role: 'Cashier',
        name: 'Mercy (Kamwene)',
        shopName: 'KamweneShop'
      },
      {
        email: 'mercymutheu498@gmail.com',
        password: 'sanyoras',
        role: 'Cashier',
        name: 'mercy kyalo',
        shopName: 'KamweneShop'
      }
    ];

    for (const seed of seedUsers) {
      const passwordHash = await hashPassword(seed.password);
      await addOfflineUser({
        email: seed.email,
        passwordHash,
        role: seed.role,
        name: seed.name,
        shopName: seed.shopName
      });
    }

    console.log('Seeded initial offline users into IndexedDB');
    offlineUsersInitialized = true;
  } catch (error) {
    console.error('Error seeding offline users:', error);
  }
}

export function saveOfflineSession(session: OfflineAuthSession): void {
  try {
    localStorage.setItem(OFFLINE_SESSION_KEY, JSON.stringify(session));
  } catch (error) {
    console.error('Error saving offline auth session:', error);
  }
}

export function loadOfflineSession(): OfflineAuthSession | null {
  try {
    const raw = localStorage.getItem(OFFLINE_SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as OfflineAuthSession;
  } catch (error) {
    console.error('Error loading offline auth session:', error);
    return null;
  }
}

export function clearOfflineSession(): void {
  try {
    localStorage.removeItem(OFFLINE_SESSION_KEY);
  } catch (error) {
    console.error('Error clearing offline auth session:', error);
  }
}

/**
 * Attempt to log in using offline users stored in IndexedDB
 */
export async function tryOfflineLogin(email: string, password: string): Promise<OfflineAuthSession | null> {
  if (!email || !password) return null;

  await initializeOfflineUsers();

  const user = await getOfflineUserByEmail(email);
  if (!user) {
    return null;
  }

  const inputHash = await hashPassword(password);
  if (inputHash !== user.passwordHash) {
    return null;
  }

  const session: OfflineAuthSession = {
    uid: `offline-${email}`,
    email: user.email,
    displayName: user.name,
    role: user.role,
    shopName: user.shopName,
    isOfflineUser: true,
    loggedInAt: new Date().toISOString()
  };

  saveOfflineSession(session);
  return session;
}


