/**
 * Shop Configuration
 * 
 * To use this codebase for a different shop:
 * 1. Change the SHOP_NAME constant below to your shop name
 * 2. The shop name will be used as a prefix for all collections
 *    Example: "CentralShop" -> CentralShopCustomers, CentralShopProducts, etc.
 *    Example: "AnotherShop" -> AnotherShopCustomers, AnotherShopProducts, etc.
 * 
 * IMPORTANT: Make sure to update Firestore rules to match your shop prefix pattern
 */

// Change this to your shop name (e.g., "CentralShop", "AnotherShop", "MyShop")
export const SHOP_NAME = 'CentralShop';

/**
 * Gets the shop-specific collection name with shop prefix
 * Converts: customers -> CentralShopCustomers, products -> CentralShopProducts, etc.
 */
export const getShopCollectionName = (collectionName: string): string => {
  // Handle special cases for proper capitalization
  const specialCases: { [key: string]: string } = {
    'orders': `${SHOP_NAME}Orders`,
    'customers': `${SHOP_NAME}Customers`,
    'products': `${SHOP_NAME}Products`,
    'invoices': `${SHOP_NAME}Invoices`,
    'settings': `${SHOP_NAME}Settings`,
    'employees': `${SHOP_NAME}Employees`,
    'productCategories': `${SHOP_NAME}ProductCategories`,
    'users': `${SHOP_NAME}Users` // Dynamic user collection
  };
  
  if (specialCases[collectionName]) {
    return specialCases[collectionName];
  }
  
  // Default: capitalize first letter and add shop prefix
  return `${SHOP_NAME}${collectionName.charAt(0).toUpperCase() + collectionName.slice(1)}`;
};

/**
 * Gets the user collection name for a specific shop
 * If shopName is provided, it will use that shop's name
 * Otherwise uses default SHOP_NAME from config
 * 
 * @param shopId - Optional shop ID (not currently used, but kept for future enhancement)
 * @param shopName - Optional shop name (e.g., "CentralShop", "MyBusiness")
 * @returns Collection name like "CentralShopUsers" or "MyBusinessUsers"
 */
export const getUserCollectionName = (shopId?: string, shopName?: string): string => {
  // If shopName is provided, use it directly
  if (shopName) {
    // Remove spaces and ensure proper formatting
    const formattedShopName = shopName.trim().replace(/\s+/g, '');
    return `${formattedShopName}Users`;
  }
  
  // If shopId is provided, we'd need to fetch the shop name from Firestore
  // For now, use the default SHOP_NAME from config
  // TODO: In the future, you might want to fetch the shop document to get the actual name
  return `${SHOP_NAME}Users`;
};

/**
 * Gets the shop name (for display purposes)
 */
export const getShopName = (): string => {
  return SHOP_NAME;
};

