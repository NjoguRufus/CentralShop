/**
 * Web Worker for Stock Report Aggregations
 * Handles heavy data processing off the main thread
 */

import { StockReportData } from '../types';

export interface WorkerMessage {
  type: 'AGGREGATE' | 'CANCEL';
  payload?: {
    products: any[];
    orders: any[];
    reportType: 'inventory_summary' | 'low_stock' | 'out_of_stock' | 'movement' | 'valuation';
    lowStockThreshold?: number;
  };
}

export interface WorkerResponse {
  type: 'PROGRESS' | 'RESULT' | 'ERROR';
  pct?: number;
  message?: string;
  data?: StockReportData;
  error?: string;
}

let isCancelled = false;

// Listen for messages from main thread
self.addEventListener('message', (event: MessageEvent<WorkerMessage>) => {
  const { type, payload } = event.data;

  if (type === 'CANCEL') {
    isCancelled = true;
    return;
  }

  if (type === 'AGGREGATE' && payload) {
    isCancelled = false;
    aggregateData(payload);
  }
});

async function aggregateData(payload: WorkerMessage['payload']) {
  if (!payload) return;

  const { products, orders, reportType, lowStockThreshold = 5 } = payload;

  try {
    // Post initial progress
    postProgress(0, 'Starting aggregation...');

    let result: StockReportData;

    switch (reportType) {
      case 'inventory_summary':
        result = await generateInventorySummary(products, orders);
        break;
      case 'low_stock':
        result = await generateLowStockReport(products, lowStockThreshold);
        break;
      case 'out_of_stock':
        result = await generateOutOfStockReport(products);
        break;
      case 'movement':
        result = await generateMovementReport(products, orders);
        break;
      case 'valuation':
        result = await generateValuationReport(products);
        break;
      default:
        result = await generateInventorySummary(products, orders);
    }

    if (!isCancelled) {
      postResult(result);
    }
  } catch (error: any) {
    postError(error.message || 'Aggregation failed');
  }
}

function postProgress(pct: number, message: string) {
  const response: WorkerResponse = {
    type: 'PROGRESS',
    pct,
    message
  };
  self.postMessage(response);
}

function postResult(data: StockReportData) {
  const response: WorkerResponse = {
    type: 'RESULT',
    data
  };
  self.postMessage(response);
}

function postError(error: string) {
  const response: WorkerResponse = {
    type: 'ERROR',
    error
  };
  self.postMessage(response);
}

async function generateInventorySummary(
  products: any[],
  orders: any[]
): Promise<StockReportData> {
  postProgress(10, 'Calculating inventory totals...');

  if (isCancelled) throw new Error('Cancelled');

  const totalItems = products.length;
  const totalValue = products.reduce((sum, p) => sum + (p.price * p.stock), 0);
  const lowStockItems = products.filter(p => p.stock <= 5 && p.stock > 0).length;
  const outOfStockItems = products.filter(p => p.stock === 0).length;

  postProgress(30, 'Analyzing product sales...');

  if (isCancelled) throw new Error('Cancelled');

  // Calculate top moving items
  const productSales = new Map<string, { quantity: number; revenue: number }>();
  
  orders.forEach((order, idx) => {
    if (idx % 100 === 0 && isCancelled) throw new Error('Cancelled');
    
    order.items?.forEach((item: any) => {
      const existing = productSales.get(item.productId) || { quantity: 0, revenue: 0 };
      productSales.set(item.productId, {
        quantity: existing.quantity + item.quantity,
        revenue: existing.revenue + (item.quantity * item.price)
      });
    });
  });

  postProgress(50, 'Processing top movers...');

  if (isCancelled) throw new Error('Cancelled');

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

  postProgress(70, 'Identifying slow movers...');

  if (isCancelled) throw new Error('Cancelled');

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

  postProgress(85, 'Calculating category breakdown...');

  if (isCancelled) throw new Error('Cancelled');

  const categoryBreakdown = new Map<string, { itemCount: number; totalValue: number }>();
  products.forEach(product => {
    const existing = categoryBreakdown.get(product.category) || { itemCount: 0, totalValue: 0 };
    categoryBreakdown.set(product.category, {
      itemCount: existing.itemCount + 1,
      totalValue: existing.totalValue + (product.price * product.stock)
    });
  });

  postProgress(100, 'Complete');

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
  products: any[],
  threshold: number
): Promise<StockReportData> {
  postProgress(50, 'Filtering low stock items...');

  const lowStockProducts = products.filter(p => p.stock <= threshold && p.stock > 0);
  const totalItems = lowStockProducts.length;
  const totalValue = lowStockProducts.reduce((sum, p) => sum + (p.price * p.stock), 0);

  postProgress(100, 'Complete');

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

async function generateOutOfStockReport(products: any[]): Promise<StockReportData> {
  postProgress(50, 'Filtering out of stock items...');

  const outOfStockProducts = products.filter(p => p.stock === 0);
  const totalItems = outOfStockProducts.length;

  postProgress(100, 'Complete');

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
  products: any[],
  orders: any[]
): Promise<StockReportData> {
  postProgress(30, 'Analyzing product movement...');

  if (isCancelled) throw new Error('Cancelled');

  const productSales = new Map<string, { quantity: number; revenue: number }>();
  
  orders.forEach((order, idx) => {
    if (idx % 100 === 0 && isCancelled) throw new Error('Cancelled');
    
    order.items?.forEach((item: any) => {
      const existing = productSales.get(item.productId) || { quantity: 0, revenue: 0 };
      productSales.set(item.productId, {
        quantity: existing.quantity + item.quantity,
        revenue: existing.revenue + (item.quantity * item.price)
      });
    });
  });

  postProgress(60, 'Processing movement data...');

  if (isCancelled) throw new Error('Cancelled');

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

  postProgress(80, 'Identifying slow movers...');

  if (isCancelled) throw new Error('Cancelled');

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

  postProgress(100, 'Complete');

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

async function generateValuationReport(products: any[]): Promise<StockReportData> {
  postProgress(50, 'Calculating inventory valuation...');

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

  postProgress(100, 'Complete');

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

