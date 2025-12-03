/**
 * Service Worker for Background Sync
 * Handles offline write operations when connection is restored
 * SAFE VERSION: Does NOT spam sync
 */

const CACHE_NAME = 'central-shop-v1';
const SYNC_TAG = 'sync-pending-writes';

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

// Background sync event - SAFE VERSION
self.addEventListener('sync', (event) => {
  if (event.tag === SYNC_TAG) {
    console.log('Background sync triggered for sync-pending-writes');
    // Use waitUntil to ensure sync completes
    event.waitUntil(doSyncOnce());
  }
});

/**
 * Sync pending writes ONCE (does not re-trigger sync)
 * This function runs one time and does NOT spam Firebase
 */
async function doSyncOnce() {
  try {
    // Get all clients (tabs) and notify them to sync
    const clients = await self.clients.matchAll();
    
    // Only notify if we have clients
    if (clients.length === 0) {
      console.log('No clients to notify for sync');
      return;
    }
    
    // Notify each client to sync (they will check if queue is empty)
    clients.forEach((client) => {
      client.postMessage({
        type: 'SYNC_PENDING_WRITES',
        timestamp: Date.now()
      });
    });
    
    console.log('Background sync: Notified clients to sync pending writes');
  } catch (error) {
    console.error('Background sync error:', error);
    throw error; // Re-throw to let browser retry if needed
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
