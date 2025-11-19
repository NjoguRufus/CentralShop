/**
 * Gets the shop-specific collection name using the configured shop name
 */
import { getShopCollectionName } from '../config/shopConfig';

/**
 * Gets the shop-specific orders collection name
 * Returns the orders collection name based on configured shop name
 */
export const getShopOrdersCollectionName = async (shopId: string): Promise<string> => {
  return getShopCollectionName('orders');
};

/**
 * Gets the shop-specific orders collection name (cached version)
 * Returns the orders collection name based on configured shop name
 */
export const getShopOrdersCollectionNameCached = async (shopId: string): Promise<string> => {
  return getShopCollectionName('orders');
};

/**
 * Gets the shop-specific collection name with shop prefix
 * Converts: customers -> {ShopName}Customers, products -> {ShopName}Products, etc.
 * @deprecated Use getShopCollectionName from shopConfig instead
 */
export const getCentralShopCollectionName = (collectionName: string): string => {
  return getShopCollectionName(collectionName);
};

