/**
 * Report Utilities
 * Firestore query helpers and export functions for stock reports
 */

import { 
  collection, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  limit, 
  startAfter,
  Timestamp,
  DocumentSnapshot,
  QueryDocumentSnapshot
} from 'firebase/firestore';
import { db } from '../firebase';
import { getShopCollectionName } from '../config/shopConfig';
import { Product, Order, PaginatedResponse } from '../types';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import html2pdf from 'html2pdf.js';

/**
 * Fetch products with pagination
 * For large datasets, use cursor-based pagination
 */
export async function fetchProducts({
  shopId,
  pageSize = 500,
  cursor,
  categories
}: {
  shopId: string;
  pageSize?: number;
  cursor?: DocumentSnapshot;
  categories?: string[];
}): Promise<PaginatedResponse<Product>> {
  try {
    let q = query(
      collection(db, getShopCollectionName('products')),
      orderBy('name'),
      limit(pageSize)
    );

    if (categories && categories.length > 0) {
      // Note: Firestore 'in' queries are limited to 10 items
      // For more categories, consider multiple queries or server-side filtering
      if (categories.length <= 10) {
        q = query(q, where('category', 'in', categories));
      }
    }

    if (cursor) {
      q = query(q, startAfter(cursor));
    }

    const snapshot = await getDocs(q);
    const products = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate() || new Date(),
      updatedAt: doc.data().updatedAt?.toDate() || new Date()
    })) as Product[];

    const lastDoc = snapshot.docs[snapshot.docs.length - 1];
    const hasMore = snapshot.docs.length === pageSize;

    return {
      data: products,
      hasMore,
      lastDoc: hasMore ? lastDoc : undefined
    };
  } catch (error) {
    console.error('Error fetching products:', error);
    throw error;
  }
}

/**
 * Fetch all products (for smaller datasets)
 * For large datasets (>5000 items), use fetchProducts with pagination
 */
export async function fetchAllProducts(shopId: string): Promise<Product[]> {
  const allProducts: Product[] = [];
  let cursor: DocumentSnapshot | undefined;
  let hasMore = true;

  while (hasMore) {
    const result = await fetchProducts({ shopId, pageSize: 500, cursor });
    allProducts.push(...result.data);
    hasMore = result.hasMore;
    cursor = result.lastDoc;
  }

  return allProducts;
}

/**
 * Fetch orders within date range with pagination
 */
export async function fetchOrders({
  shopId,
  startDate,
  endDate,
  pageSize = 500,
  cursor
}: {
  shopId: string;
  startDate: Date;
  endDate: Date;
  pageSize?: number;
  cursor?: DocumentSnapshot;
}): Promise<PaginatedResponse<Order>> {
  try {
    let q = query(
      collection(db, getShopCollectionName('orders')),
      where('createdAt', '>=', Timestamp.fromDate(startDate)),
      where('createdAt', '<=', Timestamp.fromDate(endDate)),
      orderBy('createdAt', 'desc'),
      limit(pageSize)
    );

    if (cursor) {
      q = query(q, startAfter(cursor));
    }

    const snapshot = await getDocs(q);
    const orders = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate() || new Date(),
      items: doc.data().items || []
    })) as Order[];

    const lastDoc = snapshot.docs[snapshot.docs.length - 1];
    const hasMore = snapshot.docs.length === pageSize;

    return {
      data: orders,
      hasMore,
      lastDoc: hasMore ? lastDoc : undefined
    };
  } catch (error) {
    console.error('Error fetching orders:', error);
    throw error;
  }
}

/**
 * Fetch all orders within date range
 * For large datasets, consider server-side aggregation
 */
export async function fetchAllOrders(
  shopId: string,
  startDate: Date,
  endDate: Date
): Promise<Order[]> {
  const allOrders: Order[] = [];
  let cursor: DocumentSnapshot | undefined;
  let hasMore = true;

  while (hasMore) {
    const result = await fetchOrders({ shopId, startDate, endDate, pageSize: 500, cursor });
    allOrders.push(...result.data);
    hasMore = result.hasMore;
    cursor = result.lastDoc;
  }

  return allOrders;
}

/**
 * Export report data to CSV
 */
export function exportToCSV(data: any[], filename: string = 'stock-report'): void {
  if (!data || data.length === 0) {
    throw new Error('No data to export');
  }

  // Get headers from first object
  const headers = Object.keys(data[0]);
  
  // Create CSV content
  const csvContent = [
    headers.join(','),
    ...data.map(row => 
      headers.map(header => {
        const value = row[header];
        // Escape commas and quotes
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value ?? '';
      }).join(',')
    )
  ].join('\n');

  // Create blob and download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  saveAs(blob, `${filename}-${Date.now()}.csv`);
}

/**
 * Export report data to Excel (.xlsx)
 */
export function exportToXLSX(data: any[], filename: string = 'stock-report'): void {
  if (!data || data.length === 0) {
    throw new Error('No data to export');
  }

  // Create workbook and worksheet
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data);

  // Set column widths
  const colWidths = Object.keys(data[0]).map(key => ({
    wch: Math.max(key.length, 15)
  }));
  ws['!cols'] = colWidths;

  XLSX.utils.book_append_sheet(wb, ws, 'Stock Report');

  // Generate Excel file
  const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([excelBuffer], { 
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
  });
  
  saveAs(blob, `${filename}-${Date.now()}.xlsx`);
}

/**
 * Export HTML element to PDF with logo watermark
 */
export async function exportToPDF(
  element: HTMLElement,
  filename: string = 'stock-report',
  options: {
    logoUrl?: string;
    includeWatermark?: boolean;
  } = {}
): Promise<void> {
  const { logoUrl = '/mnt/data/A_logo_in_solid_black_is_displayed_on_a_white_back.png', includeWatermark = true } = options;

  const opt = {
    margin: [10, 10, 10, 10],
    filename: `${filename}-${Date.now()}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { 
      scale: 2,
      useCORS: true,
      logging: false
    },
    jsPDF: { 
      unit: 'mm', 
      format: 'a4', 
      orientation: 'portrait' 
    }
  };

  // Add logo watermark if specified
  if (includeWatermark && logoUrl) {
    // The logo will be embedded in the PrintView component
    // html2pdf will automatically include it
  }

  try {
    await html2pdf().set(opt).from(element).save();
  } catch (error) {
    console.error('PDF export error:', error);
    throw new Error('Failed to generate PDF');
  }
}

/**
 * Get unique categories from products
 */
export async function getProductCategories(shopId: string): Promise<string[]> {
  try {
    const products = await fetchAllProducts(shopId);
    const categories = new Set<string>();
    
    products.forEach(product => {
      if (product.category) {
        categories.add(product.category);
      }
    });

    return Array.from(categories).sort();
  } catch (error) {
    console.error('Error fetching categories:', error);
    return [];
  }
}

