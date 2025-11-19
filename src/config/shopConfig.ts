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
    'productCategories': `${SHOP_NAME}ProductCategories`
  };
  
  if (specialCases[collectionName]) {
    return specialCases[collectionName];
  }
  
  // Default: capitalize first letter and add shop prefix
  return `${SHOP_NAME}${collectionName.charAt(0).toUpperCase() + collectionName.slice(1)}`;
};

/**
 * Gets the shop name (for display purposes)
 */
export const getShopName = (): string => {
  return SHOP_NAME;
};

