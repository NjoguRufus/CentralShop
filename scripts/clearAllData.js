/**
 * Script to clear all local data (IndexedDB, localStorage, cache)
 * Run this in browser console or as a utility function
 */

// Clear IndexedDB
async function clearIndexedDB() {
  return new Promise((resolve, reject) => {
    const deleteReq = indexedDB.deleteDatabase('CentralShopDB');
    deleteReq.onsuccess = () => {
      console.log('✅ CentralShopDB deleted');
      const deleteReq2 = indexedDB.deleteDatabase('OfflineUsersDB');
      deleteReq2.onsuccess = () => {
        console.log('✅ OfflineUsersDB deleted');
        resolve();
      };
      deleteReq2.onerror = () => reject(deleteReq2.error);
    };
    deleteReq.onerror = () => reject(deleteReq.error);
  });
}

// Clear localStorage
function clearLocalStorage() {
  const keys = Object.keys(localStorage);
  keys.forEach(key => localStorage.removeItem(key));
  console.log(`✅ Cleared ${keys.length} localStorage items`);
}

// Clear cache
async function clearCache() {
  if ('caches' in window) {
    const names = await caches.keys();
    await Promise.all(names.map(name => caches.delete(name)));
    console.log(`✅ Cleared ${names.length} cache(s)`);
  }
}

// Main function
async function clearAllData() {
  console.log('🧹 Starting complete data clear...');
  
  try {
    await clearIndexedDB();
    clearLocalStorage();
    await clearCache();
    
    console.log('✅ All local data cleared successfully!');
    console.log('🔄 Please reload the page (Ctrl+R or F5)');
  } catch (error) {
    console.error('❌ Error clearing data:', error);
  }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { clearAllData, clearIndexedDB, clearLocalStorage, clearCache };
}

// Auto-run if in browser console
if (typeof window !== 'undefined') {
  window.clearAllData = clearAllData;
  console.log('💡 Run clearAllData() in console to clear all local data');
}

