import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, where, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Product, Order, StockReport, StockReportData } from '../types';
import Card from '../components/UI/Card';
import Button from '../components/UI/Button';
import FormInput from '../components/UI/SimpleFormInput';
import Select from '../components/UI/Select';
import DateInput from '../components/UI/DateInput';
import Table from '../components/UI/Table';
import { toast } from 'react-hot-toast';

const StockReports: React.FC = () => {
  const { currentUser } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [reportType, setReportType] = useState<'inventory_summary' | 'low_stock' | 'out_of_stock' | 'movement' | 'valuation'>('inventory_summary');
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly' | 'custom'>('monthly');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [reportData, setReportData] = useState<StockReportData | null>(null);
  const [generatedReport, setGeneratedReport] = useState<StockReport | null>(null);

  useEffect(() => {
    if (currentUser?.shopId) {
      fetchData();
    }
  }, [currentUser?.shopId]);

  const fetchData = async () => {
    if (!currentUser?.shopId) return;
    
    try {
      // Fetch products
      const productsQuery = query(collection(db, `shops/${currentUser.shopId}/products`));
      const productsSnapshot = await getDocs(productsQuery);
      const productsData = productsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date()
      })) as Product[];

      // Fetch orders
      const ordersQuery = query(
        collection(db, `shops/${currentUser.shopId}/orders`),
        orderBy('createdAt', 'desc')
      );
      const ordersSnapshot = await getDocs(ordersQuery);
      const ordersData = ordersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        items: doc.data().items || doc.data().products || []
      })) as Order[];

      setProducts(productsData);
      setOrders(ordersData);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const generateReport = () => {
    if (!products.length) {
      toast.error('No products found');
      return;
    }

    const now = new Date();
    let startDate: Date;
    let endDate: Date = now;

    // Calculate date range based on period
    switch (period) {
      case 'daily':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'weekly':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'monthly':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'custom':
        if (!customStartDate || !customEndDate) {
          toast.error('Please select custom date range');
          return;
        }
        startDate = new Date(customStartDate);
        endDate = new Date(customEndDate);
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    // Filter orders by date range
    const filteredOrders = orders.filter(order => 
      order.createdAt >= startDate && order.createdAt <= endDate
    );

    // Calculate report data based on type
    let data: StockReportData;

    switch (reportType) {
      case 'inventory_summary':
        data = generateInventorySummary(products, filteredOrders);
        break;
      case 'low_stock':
        data = generateLowStockReport(products);
        break;
      case 'out_of_stock':
        data = generateOutOfStockReport(products);
        break;
      case 'movement':
        data = generateMovementReport(products, filteredOrders);
        break;
      case 'valuation':
        data = generateValuationReport(products);
        break;
      default:
        data = generateInventorySummary(products, filteredOrders);
    }

    const report: StockReport = {
      id: Date.now().toString(),
      reportType,
      period,
      startDate,
      endDate,
      generatedAt: now,
      generatedBy: currentUser?.name || 'Unknown',
      shopId: currentUser?.shopId || '',
      data
    };

    setReportData(data);
    setGeneratedReport(report);
    toast.success('Report generated successfully');
  };

  const generateInventorySummary = (products: Product[], orders: Order[]): StockReportData => {
    const totalItems = products.length;
    const totalValue = products.reduce((sum, product) => sum + (product.price * product.stock), 0);
    const lowStockItems = products.filter(p => p.stock <= 5).length;
    const outOfStockItems = products.filter(p => p.stock === 0).length;

    // Calculate top moving items
    const productSales = new Map<string, { quantity: number; revenue: number }>();
    orders.forEach(order => {
      order.items.forEach(item => {
        const existing = productSales.get(item.productId) || { quantity: 0, revenue: 0 };
        productSales.set(item.productId, {
          quantity: existing.quantity + item.quantity,
          revenue: existing.revenue + (item.quantity * item.price)
        });
      });
    });

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

    // Calculate slow moving items (items with no sales in the period)
    const slowMovingItems = products
      .filter(p => !productSales.has(p.id))
      .map(product => ({
        productId: product.id,
        name: product.name,
        quantitySold: 0,
        daysInStock: Math.floor((Date.now() - product.createdAt.getTime()) / (1000 * 60 * 60 * 24))
      }))
      .sort((a, b) => b.daysInStock - a.daysInStock)
      .slice(0, 10);

    // Category breakdown
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
  };

  const generateLowStockReport = (products: Product[]): StockReportData => {
    const lowStockProducts = products.filter(p => p.stock <= 5 && p.stock > 0);
    const totalItems = lowStockProducts.length;
    const totalValue = lowStockProducts.reduce((sum, product) => sum + (product.price * product.stock), 0);

    return {
      totalItems,
      totalValue,
      lowStockItems: totalItems,
      outOfStockItems: 0,
      topMovingItems: [],
      slowMovingItems: [],
      categoryBreakdown: []
    };
  };

  const generateOutOfStockReport = (products: Product[]): StockReportData => {
    const outOfStockProducts = products.filter(p => p.stock === 0);
    const totalItems = outOfStockProducts.length;
    const totalValue = 0;

    return {
      totalItems,
      totalValue,
      lowStockItems: 0,
      outOfStockItems: totalItems,
      topMovingItems: [],
      slowMovingItems: [],
      categoryBreakdown: []
    };
  };

  const generateMovementReport = (products: Product[], orders: Order[]): StockReportData => {
    const productSales = new Map<string, { quantity: number; revenue: number }>();
    orders.forEach(order => {
      order.items.forEach(item => {
        const existing = productSales.get(item.productId) || { quantity: 0, revenue: 0 };
        productSales.set(item.productId, {
          quantity: existing.quantity + item.quantity,
          revenue: existing.revenue + (item.quantity * item.price)
        });
      });
    });

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

    const slowMovingItems = products
      .filter(p => !productSales.has(p.id))
      .map(product => ({
        productId: product.id,
        name: product.name,
        quantitySold: 0,
        daysInStock: Math.floor((Date.now() - product.createdAt.getTime()) / (1000 * 60 * 60 * 24))
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
  };

  const generateValuationReport = (products: Product[]): StockReportData => {
    const totalItems = products.length;
    const totalValue = products.reduce((sum, product) => sum + (product.price * product.stock), 0);

    // Category breakdown
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
  };

  const exportReport = () => {
    if (!generatedReport || !reportData) return;

    const reportContent = `
STOCK REPORT
Generated: ${generatedReport.generatedAt.toLocaleString()}
Period: ${generatedReport.period} (${generatedReport.startDate.toLocaleDateString()} - ${generatedReport.endDate.toLocaleDateString()})
Report Type: ${generatedReport.reportType.replace('_', ' ').toUpperCase()}

SUMMARY:
- Total Items: ${reportData.totalItems}
- Total Value: KSH ${reportData.totalValue.toFixed(2)}
- Low Stock Items: ${reportData.lowStockItems}
- Out of Stock Items: ${reportData.outOfStockItems}

${reportData.topMovingItems.length > 0 ? `
TOP MOVING ITEMS:
${reportData.topMovingItems.map((item, index) => 
  `${index + 1}. ${item.name} - ${item.quantitySold} units (KSH ${item.revenue.toFixed(2)})`
).join('\n')}
` : ''}

${reportData.slowMovingItems.length > 0 ? `
SLOW MOVING ITEMS:
${reportData.slowMovingItems.map((item, index) => 
  `${index + 1}. ${item.name} - ${item.daysInStock} days in stock`
).join('\n')}
` : ''}

${reportData.categoryBreakdown.length > 0 ? `
CATEGORY BREAKDOWN:
${reportData.categoryBreakdown.map(cat => 
  `- ${cat.category}: ${cat.itemCount} items (KSH ${cat.totalValue.toFixed(2)})`
).join('\n')}
` : ''}
    `;

    const blob = new Blob([reportContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stock-report-${generatedReport.reportType}-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Stock Reports</h1>
        {generatedReport && (
          <Button onClick={exportReport}>
            Export Report
          </Button>
        )}
      </div>

      {/* Report Configuration */}
      <Card>
        <div className="p-6">
          <h2 className="text-lg font-semibold mb-4">Generate Report</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Report Type</label>
              <Select
                value={reportType}
                onChange={(v) => setReportType(v as any)}
                options={[
                  { value: 'inventory_summary', label: 'Inventory Summary' },
                  { value: 'low_stock', label: 'Low Stock Report' },
                  { value: 'out_of_stock', label: 'Out of Stock Report' },
                  { value: 'movement', label: 'Movement Report' },
                  { value: 'valuation', label: 'Valuation Report' },
                ]}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Period</label>
              <Select
                value={period}
                onChange={(v) => setPeriod(v as any)}
                options={[
                  { value: 'daily', label: 'Daily' },
                  { value: 'weekly', label: 'Weekly' },
                  { value: 'monthly', label: 'Monthly' },
                  { value: 'custom', label: 'Custom Range' },
                ]}
              />
            </div>

            <div className="flex items-end">
              <Button onClick={generateReport} className="w-full">
                Generate Report
              </Button>
            </div>
          </div>

          {period === 'custom' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                <DateInput value={customStartDate} onChange={setCustomStartDate} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                <DateInput value={customEndDate} onChange={setCustomEndDate} />
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Report Results */}
      {reportData && generatedReport && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card>
              <div className="p-6">
                <h3 className="text-lg font-medium text-gray-900">Total Items</h3>
                <p className="text-3xl font-bold text-primary">{reportData.totalItems}</p>
              </div>
            </Card>
            <Card>
              <div className="p-6">
                <h3 className="text-lg font-medium text-gray-900">Total Value</h3>
                <p className="text-3xl font-bold text-green-600">KSH {reportData.totalValue.toFixed(2)}</p>
              </div>
            </Card>
            <Card>
              <div className="p-6">
                <h3 className="text-lg font-medium text-gray-900">Low Stock</h3>
                <p className="text-3xl font-bold text-yellow-600">{reportData.lowStockItems}</p>
              </div>
            </Card>
            <Card>
              <div className="p-6">
                <h3 className="text-lg font-medium text-gray-900">Out of Stock</h3>
                <p className="text-3xl font-bold text-red-600">{reportData.outOfStockItems}</p>
              </div>
            </Card>
          </div>

          {/* Top Moving Items */}
          {reportData.topMovingItems.length > 0 && (
            <Card>
              <div className="p-6">
                <h3 className="text-lg font-semibold mb-4">Top Moving Items</h3>
                <Table
                  headers={['Product', 'Quantity Sold', 'Revenue']}
                  data={reportData.topMovingItems.map(item => [
                    item.name,
                    item.quantitySold.toString(),
                    `KSH ${item.revenue.toFixed(2)}`
                  ])}
                />
              </div>
            </Card>
          )}

          {/* Slow Moving Items */}
          {reportData.slowMovingItems.length > 0 && (
            <Card>
              <div className="p-6">
                <h3 className="text-lg font-semibold mb-4">Slow Moving Items</h3>
                <Table
                  headers={['Product', 'Days in Stock', 'Quantity Sold']}
                  data={reportData.slowMovingItems.map(item => [
                    item.name,
                    item.daysInStock.toString(),
                    item.quantitySold.toString()
                  ])}
                />
              </div>
            </Card>
          )}

          {/* Category Breakdown */}
          {reportData.categoryBreakdown.length > 0 && (
            <Card>
              <div className="p-6">
                <h3 className="text-lg font-semibold mb-4">Category Breakdown</h3>
                <Table
                  headers={['Category', 'Item Count', 'Total Value']}
                  data={reportData.categoryBreakdown.map(cat => [
                    cat.category,
                    cat.itemCount.toString(),
                    `KSH ${cat.totalValue.toFixed(2)}`
                  ])}
                />
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
};

export default StockReports;





