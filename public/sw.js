/**
 * Service Worker for Background Sync
 * Handles offline write operations when connection is restored
 */

const CACHE_NAME = 'central-shop-v1';
const SYNC_TAG = 'firebase-sync';

// Install event - cache offline page
self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');
  self.skipWaiting();
});

// Activate event
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...');
  event.waitUntil(self.clients.claim());
});

// Background sync event
self.addEventListener('sync', (event) => {
  if (event.tag === SYNC_TAG) {
    console.log('Background sync triggered for firebase-sync');
    event.waitUntil(syncPendingWrites());
  }
});

/**
 * Sync pending writes to Firestore
 * This function will be called by the main app when online
 */
async function syncPendingWrites() {
  try {
    // Get all clients (tabs) and notify them to sync
    const clients = await self.clients.matchAll();
    
    clients.forEach((client) => {
      client.postMessage({
        type: 'SYNC_PENDING_WRITES',
        timestamp: Date.now()
      });
    });
    
    console.log('Background sync: Notified clients to sync pending writes');
  } catch (error) {
    console.error('Background sync error:', error);
    throw error;
  }
}

// Message handler for communication with main app
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Fetch event - serve offline page when offline
self.addEventListener('fetch', (event) => {
  // Only handle navigation requests
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match('/offline.html');
      })
    );
  }
});

