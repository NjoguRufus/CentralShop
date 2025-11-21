/**
 * Background Sync Utility
 * Registers background sync for offline operations
 */
export async function registerBackgroundSync(tag: string): Promise<void> {
  if ('serviceWorker' in navigator && 'sync' in (self as any).registration) {
    try {
      const registration = await navigator.serviceWorker.ready;
      await (registration as any).sync.register(tag);
      console.log(`Background sync registered: ${tag}`);
    } catch (error) {
      console.error('Error registering background sync:', error);
    }
  } else {
    console.warn('Background Sync API not supported');
  }
}

/**
 * Register periodic background sync
 */
export async function registerPeriodicSync(tag: string, minInterval: number): Promise<void> {
  if ('serviceWorker' in navigator && 'periodicSync' in (self as any).registration) {
    try {
      const registration = await navigator.serviceWorker.ready;
      await (registration as any).periodicSync.register(tag, {
        minInterval: minInterval
      });
      console.log(`Periodic sync registered: ${tag}`);
    } catch (error) {
      console.error('Error registering periodic sync:', error);
    }
  } else {
    console.warn('Periodic Background Sync API not supported');
  }
}

/**
 * Unregister background sync
 */
export async function unregisterBackgroundSync(tag: string): Promise<void> {
  if ('serviceWorker' in navigator && 'sync' in (self as any).registration) {
    try {
      const registration = await navigator.serviceWorker.ready;
      const tags = await (registration as any).sync.getTags();
      if (tags.includes(tag)) {
        // Note: There's no direct unregister method, but sync will complete automatically
        console.log(`Background sync tag exists: ${tag}`);
      }
    } catch (error) {
      console.error('Error checking background sync:', error);
    }
  }
}

