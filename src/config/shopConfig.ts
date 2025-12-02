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

// Branch configuration
export const BRANCHES = {
  CENTRAL: 'CentralShop',
  KAMWENE: 'Kamwene' // Simplified to generate 'KamweneOrders' instead of 'KamwenesShopOrders'
} as const;

export type BranchName = typeof BRANCHES[keyof typeof BRANCHES];

/**
 * Gets the shop-specific collection name with shop prefix
 * Converts: customers -> CentralShopCustomers, products -> CentralShopProducts, etc.
 * @param collectionName - The collection name (e.g., 'orders', 'products')
 * @param branch - Optional branch name. If not provided, uses SHOP_NAME
 */
export const getShopCollectionName = (collectionName: string, branch?: BranchName): string => {
  const shopPrefix = branch || SHOP_NAME;
  
  // Handle special cases for proper capitalization
  const specialCases: { [key: string]: string } = {
    'orders': `${shopPrefix}Orders`,
    'customers': `${shopPrefix}Customers`,
    'products': `${shopPrefix}Products`,
    'invoices': `${shopPrefix}Invoices`,
    'settings': `${shopPrefix}Settings`,
    'employees': `${shopPrefix}Employees`,
    'productCategories': `${shopPrefix}ProductCategories`,
    'users': `${shopPrefix}Staff`, // Changed from Users to Staff
    'notifications': `${shopPrefix}Alerts` // Changed from Notifications to Alerts (but disabled)
  };
  
  if (specialCases[collectionName]) {
    return specialCases[collectionName];
  }
  
  // Default: capitalize first letter and add shop prefix
  return `${shopPrefix}${collectionName.charAt(0).toUpperCase() + collectionName.slice(1)}`;
};

/**
 * Gets the user collection name for a specific shop
 * If shopName is provided, it will use that shop's name
 * Otherwise uses default SHOP_NAME from config
 * 
 * @param shopId - Optional shop ID (not currently used, but kept for future enhancement)
 * @param shopName - Optional shop name (e.g., "CentralShop", "MyBusiness")
 * @returns Collection name like "CentralShopStaff" or "MyBusinessStaff"
 */
export const getUserCollectionName = (shopId?: string, shopName?: string): string => {
  // If shopName is provided, use it directly
  if (shopName) {
    // Remove spaces and ensure proper formatting
    const formattedShopName = shopName.trim().replace(/\s+/g, '');
    return `${formattedShopName}Staff`; // Changed from Users to Staff
  }
  
  // If shopId is provided, we'd need to fetch the shop name from Firestore
  // For now, use the default SHOP_NAME from config
  // TODO: In the future, you might want to fetch the shop document to get the actual name
  return `${SHOP_NAME}Staff`; // Changed from Users to Staff
};

/**
 * Gets the shop name (for display purposes)
 */
export const getShopName = (): string => {
  return SHOP_NAME;
};

