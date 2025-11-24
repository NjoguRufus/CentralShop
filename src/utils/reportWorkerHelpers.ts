/**
 * Report Worker Helpers
 * Main-thread processing functions (can be moved to worker later)
 */

import { StockReportData, Product, Order } from '../types';

interface ProcessOptions {
  products: Product[];
  orders: Order[];
  reportType: 'inventory_summary' | 'low_stock' | 'out_of_stock' | 'movement' | 'valuation';
  lowStockThreshold?: number;
}

type ProgressCallback = (pct: number, message: string) => void;

export async function generateReportData(
  options: ProcessOptions,
  onProgress?: ProgressCallback
): Promise<StockReportData> {
  const { products, orders, reportType, lowStockThreshold = 5 } = options;

  onProgress?.(10, 'Calculating inventory totals...');

  let result: StockReportData;

  switch (reportType) {
    case 'inventory_summary':
      result = await generateInventorySummary(products, orders, onProgress);
      break;
    case 'low_stock':
      result = await generateLowStockReport(products, lowStockThreshold, onProgress);
      break;
    case 'out_of_stock':
      result = await generateOutOfStockReport(products, onProgress);
      break;
    case 'movement':
      result = await generateMovementReport(products, orders, onProgress);
      break;
    case 'valuation':
      result = await generateValuationReport(products, onProgress);
      break;
    default:
      result = await generateInventorySummary(products, orders, onProgress);
  }

  onProgress?.(100, 'Complete');
  return result;
}

async function generateInventorySummary(
  products: Product[],
  orders: Order[],
  onProgress?: ProgressCallback
): Promise<StockReportData> {
  onProgress?.(20, 'Calculating totals...');

  const totalItems = products.length;
  const totalValue = products.reduce((sum, p) => sum + (p.price * p.stock), 0);
  const lowStockItems = products.filter(p => p.stock <= 5 && p.stock > 0).length;
  const outOfStockItems = products.filter(p => p.stock === 0).length;

  onProgress?.(40, 'Analyzing product sales...');

  const productSales = new Map<string, { quantity: number; revenue: number }>();
  
  orders.forEach((order, idx) => {
    if (idx % 100 === 0 && idx > 0) {
      onProgress?.(40 + (idx / orders.length) * 20, `Processing order ${idx} of ${orders.length}...`);
    }
    
    order.items?.forEach((item) => {
      const existing = productSales.get(item.productId) || { quantity: 0, revenue: 0 };
      productSales.set(item.productId, {
        quantity: existing.quantity + item.quantity,
        revenue: existing.revenue + (item.quantity * item.price)
      });
    });
  });

  onProgress?.(70, 'Processing top movers...');

  const topMovingItems = Array.from(productSales.entries())
    .map(([productId, data]) => {
      const product = products.find(p => p.id === productId);
      return {
        productId,
        name: product?.name || 'Unknown',
        quantitySold: data.quantity,
        revenue: data.revenue
      };
    })
    .sort((a, b) => b.quantitySold - a.quantitySold)
    .slice(0, 10);

  onProgress?.(85, 'Identifying slow movers...');

  const slowMovingItems = products
    .filter(p => !productSales.has(p.id))
    .map(product => ({
      productId: product.id,
      name: product.name,
      quantitySold: 0,
      daysInStock: Math.floor(
        (Date.now() - new Date(product.createdAt).getTime()) / (1000 * 60 * 60 * 24)
      )
    }))
    .sort((a, b) => b.daysInStock - a.daysInStock)
    .slice(0, 10);

  onProgress?.(95, 'Calculating category breakdown...');

  const categoryBreakdown = new Map<string, { itemCount: number; totalValue: number }>();
  products.forEach(product => {
    const existing = categoryBreakdown.get(product.category) || { itemCount: 0, totalValue: 0 };
    categoryBreakdown.set(product.category, {
      itemCount: existing.itemCount + 1,
      totalValue: existing.totalValue + (product.price * product.stock)
    });
  });

  return {
    totalItems,
    totalValue,
    lowStockItems,
    outOfStockItems,
    topMovingItems,
    slowMovingItems,
    categoryBreakdown: Array.from(categoryBreakdown.entries()).map(([category, data]) => ({
      category,
      ...data
    }))
  };
}

async function generateLowStockReport(
  products: Product[],
  threshold: number,
  onProgress?: ProgressCallback
): Promise<StockReportData> {
  onProgress?.(50, 'Filtering low stock items...');

  const lowStockProducts = products.filter(p => p.stock <= threshold && p.stock > 0);
  const totalItems = lowStockProducts.length;
  const totalValue = lowStockProducts.reduce((sum, p) => sum + (p.price * p.stock), 0);

  return {
    totalItems,
    totalValue,
    lowStockItems: totalItems,
    outOfStockItems: 0,
    topMovingItems: [],
    slowMovingItems: [],
    categoryBreakdown: []
  };
}

async function generateOutOfStockReport(
  products: Product[],
  onProgress?: ProgressCallback
): Promise<StockReportData> {
  onProgress?.(50, 'Filtering out of stock items...');

  const outOfStockProducts = products.filter(p => p.stock === 0);
  const totalItems = outOfStockProducts.length;

  return {
    totalItems,
    totalValue: 0,
    lowStockItems: 0,
    outOfStockItems: totalItems,
    topMovingItems: [],
    slowMovingItems: [],
    categoryBreakdown: []
  };
}

async function generateMovementReport(
  products: Product[],
  orders: Order[],
  onProgress?: ProgressCallback
): Promise<StockReportData> {
  onProgress?.(30, 'Analyzing product movement...');

  const productSales = new Map<string, { quantity: number; revenue: number }>();
  
  orders.forEach((order, idx) => {
    if (idx % 100 === 0 && idx > 0) {
      onProgress?.(30 + (idx / orders.length) * 30, `Processing order ${idx}...`);
    }
    
    order.items?.forEach((item) => {
      const existing = productSales.get(item.productId) || { quantity: 0, revenue: 0 };
      productSales.set(item.productId, {
        quantity: existing.quantity + item.quantity,
        revenue: existing.revenue + (item.quantity * item.price)
      });
    });
  });

  onProgress?.(70, 'Processing movement data...');

  const topMovingItems = Array.from(productSales.entries())
    .map(([productId, data]) => {
      const product = products.find(p => p.id === productId);
      return {
        productId,
        name: product?.name || 'Unknown',
        quantitySold: data.quantity,
        revenue: data.revenue
      };
    })
    .sort((a, b) => b.quantitySold - a.quantitySold);

  onProgress?.(90, 'Identifying slow movers...');

  const slowMovingItems = products
    .filter(p => !productSales.has(p.id))
    .map(product => ({
      productId: product.id,
      name: product.name,
      quantitySold: 0,
      daysInStock: Math.floor(
        (Date.now() - new Date(product.createdAt).getTime()) / (1000 * 60 * 60 * 24)
      )
    }))
    .sort((a, b) => b.daysInStock - a.daysInStock);

  return {
    totalItems: products.length,
    totalValue: 0,
    lowStockItems: 0,
    outOfStockItems: 0,
    topMovingItems,
    slowMovingItems,
    categoryBreakdown: []
  };
}

async function generateValuationReport(
  products: Product[],
  onProgress?: ProgressCallback
): Promise<StockReportData> {
  onProgress?.(50, 'Calculating inventory valuation...');

  const totalItems = products.length;
  const totalValue = products.reduce((sum, p) => sum + (p.price * p.stock), 0);

  const categoryBreakdown = new Map<string, { itemCount: number; totalValue: number }>();
  products.forEach(product => {
    const existing = categoryBreakdown.get(product.category) || { itemCount: 0, totalValue: 0 };
    categoryBreakdown.set(product.category, {
      itemCount: existing.itemCount + 1,
      totalValue: existing.totalValue + (product.price * product.stock)
    });
  });

  return {
    totalItems,
    totalValue,
    lowStockItems: 0,
    outOfStockItems: 0,
    topMovingItems: [],
    slowMovingItems: [],
    categoryBreakdown: Array.from(categoryBreakdown.entries()).map(([category, data]) => ({
      category,
      ...data
    }))
  };
}

