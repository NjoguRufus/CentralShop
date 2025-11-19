import { collection, query, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { getShopCollectionName } from '../config/shopConfig';

        .map(([name, data]) => ({ name, ...data }))
  async getCustomerData(): Promise<CustomerData> {
  hasData: boolean;
  todaySales: number;
  yesterdaySales: number;
  weekSales: number;
  topProducts: Array<{
    name: string;
    quantity: number;
    revenue: number;
  }>;
}

export interface InventoryData {
  hasData: boolean;
  totalItems: number;
  lowStockItems: Array<{
    name: string;
    currentStock: number;
    threshold: number;
  }>;
  outOfStockItems: Array<{
    name: string;
    currentStock: number;
  }>;
}

export interface CustomerData {
  hasData: boolean;
  totalCustomers: number;
  topCustomers: Array<{
    name: string;
    loyaltyPoints: number;
  }>;
}

export interface EmployeeData {
  hasData: boolean;
  totalEmployees: number;
}

export class DataService {
  private shopId: string;

  constructor(shopId: string) {
    this.shopId = shopId;
  }

  // Validate if data is available for a query type
  async validateDataAvailability(queryType: string): Promise<boolean> {
    try {
      let collectionName = '';
      
      switch (queryType) {
        case 'sales':
        case 'sales_report_today':
        case 'sales_report_yesterday':
        case 'sales_report_week':
          collectionName = 'orders';
          break;
        case 'inventory':
        case 'check_stock':
        case 'low_stock_items':
        case 'out_of_stock_items':
          collectionName = 'products';
          break;
        case 'customers':
        case 'customer_count':
        case 'top_customers':
          collectionName = 'customers';
          break;
        case 'employees':
        case 'employee_count':
        case 'sales_by_employee':
          collectionName = 'employees';
          break;
        default:
          return false;
      }

      const q = query(collection(db, `shops/${this.shopId}/${collectionName}`));
      const snapshot = await getDocs(q);
      return !snapshot.empty;
    } catch (error) {
      console.error('Error validating data availability:', error);
      return false;
    }
  }

  // Get sales data for a specific period
  async getSalesData(period: 'today' | 'yesterday' | 'week' | 'month' | 'all'): Promise<SalesData> {
    try {
      const q = query(
        collection(db, `shops/${this.shopId}/orders`),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        return {
          hasData: false,
          todaySales: 0,
          yesterdaySales: 0,
          weekSales: 0,
          topProducts: []
        };
      }

      const orders = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        items: doc.data().items || doc.data().products || []
      }));

      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
      const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

      let todaySales = 0;
      let yesterdaySales = 0;
      let weekSales = 0;
      const productSales = new Map<string, { quantity: number; revenue: number }>();

      orders.forEach(order => {
        const orderDate = order.createdAt;
        const orderTotal = order.total || 0;

        if (orderDate >= today) {
          todaySales += orderTotal;
        }
        if (orderDate >= yesterday && orderDate < today) {
          yesterdaySales += orderTotal;
        }
        if (orderDate >= weekAgo) {
          weekSales += orderTotal;
        }

        // Track product sales
        order.items.forEach((item: any) => {
          const productName = item.product?.name || item.name || 'Unknown';
          const existing = productSales.get(productName) || { quantity: 0, revenue: 0 };
          productSales.set(productName, {
            quantity: existing.quantity + (item.quantity || 0),
            revenue: existing.revenue + ((item.quantity || 0) * (item.price || 0))
          });
        });
      });

      const topProducts = Array.from(productSales.entries())
        .map(([name, data]) => ({ name, ...data }))
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 5);

      return {
        hasData: true,
        todaySales,
        yesterdaySales,
        weekSales,
        topProducts
      };
    } catch (error) {
      console.error('Error getting sales data:', error);
      return {
        hasData: false,
        todaySales: 0,
        yesterdaySales: 0,
        weekSales: 0,
        topProducts: []
      };
    }
  }

  // Get inventory data
  async getInventoryData(): Promise<InventoryData> {
    try {
      const q = query(collection(db, `shops/${this.shopId}/products`));
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        return {
          hasData: false,
          totalItems: 0,
          lowStockItems: [],
          outOfStockItems: []
        };
      }

      const products = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        stock: doc.data().stock || 0
      }));

      const lowStockItems = products
        .filter(p => p.stock > 0 && p.stock <= 5)
        .map(p => ({
          name: p.name,
          currentStock: p.stock,
          threshold: 5
        }));

      const outOfStockItems = products
        .filter(p => p.stock === 0)
        .map(p => ({
          name: p.name,
          currentStock: p.stock
        }));

      return {
        hasData: true,
        totalItems: products.length,
        lowStockItems,
        outOfStockItems
      };
    } catch (error) {
      console.error('Error getting inventory data:', error);
      return {
        hasData: false,
        totalItems: 0,
        lowStockItems: [],
        outOfStockItems: []
      };
    }
  }

  // Get customer data
  async getCustomerData(): Promise<CustomerData> {
    try {
      const q = query(collection(db, `shops/${this.shopId}/customers`));
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        return {
          hasData: false,
          totalCustomers: 0,
          topCustomers: []
        };
      }

      const customers = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        loyaltyPoints: doc.data().loyaltyPoints || 0
      }));

      const topCustomers = customers
        .sort((a, b) => b.loyaltyPoints - a.loyaltyPoints)
        .slice(0, 5)
        .map(customer => ({
          name: customer.name,
          loyaltyPoints: customer.loyaltyPoints
        }));

      return {
        hasData: true,
        totalCustomers: customers.length,
        topCustomers
      };
    } catch (error) {
      console.error('Error getting customer data:', error);
      return {
        hasData: false,
        totalCustomers: 0,
        topCustomers: []
      };
    }
  }

  // Get employee data
  async getEmployeeData(): Promise<EmployeeData> {
    try {
      const q = query(collection(db, getShopCollectionName('employees')));
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        return {
          hasData: false,
          totalEmployees: 0
        };
      }

      const employees = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      return {
        hasData: true,
        totalEmployees: employees.length
      };
    } catch (error) {
      console.error('Error getting employee data:', error);
      return {
        hasData: false,
        totalEmployees: 0
      };
    }
  }
}

export default DataService;