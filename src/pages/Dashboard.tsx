import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { DollarSign, ShoppingCart, Users, Package, TrendingUp, AlertTriangle, RefreshCw } from 'lucide-react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { getShopCollectionName } from '../config/shopConfig';
import StatsCard from '../components/Dashboard/StatsCard';
import SalesChart from '../components/Dashboard/SalesChart';
import Card from '../components/UI/Card';
import Button from '../components/UI/Button';
import Modal from '../components/Modal';
import Select, { SelectOption } from '../components/UI/Select';
import DateInput from '../components/UI/DateInput';
import { toast } from 'react-toastify';

interface DashboardStats {
  totalRevenue: number;
  ordersToday: number;
  activeCustomers: number;
  totalProducts: number;
  revenueChange: number;
  ordersChange: number;
  customersChange: number;
  productsChange: number;
}

interface TopProduct {
  name: string;
  sales: number;
  revenue: number;
}

interface LowStockItem {
  name: string;
  stock: number;
  threshold: number;
}

interface SalesData {
  name: string;
  sales: number;
  orders: number;
}

const Dashboard: React.FC = () => {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState<boolean>(true);
  const [stats, setStats] = useState<DashboardStats>({
    totalRevenue: 0,
    ordersToday: 0,
    activeCustomers: 0,
    totalProducts: 0,
    revenueChange: 0,
    ordersChange: 0,
    customersChange: 0,
    productsChange: 0
  });
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [lowStockItems, setLowStockItems] = useState<LowStockItem[]>([]);
  const [salesData, setSalesData] = useState<SalesData[]>([]);
  const [salesPeriod, setSalesPeriod] = useState<'today' | 'week' | 'month'>('week');
  const [isRevenueModalOpen, setIsRevenueModalOpen] = useState<boolean>(false);
  const [revenueRange, setRevenueRange] = useState<'yesterday' | 'week' | 'month' | 'year' | 'custom-day'>('yesterday');
  const [revenueSelectedDate, setRevenueSelectedDate] = useState<string>('');
  const [revenueLoading, setRevenueLoading] = useState<boolean>(false);
  const [revenueResult, setRevenueResult] = useState<number | null>(null);
  const [isExpensesModalOpen, setIsExpensesModalOpen] = useState<boolean>(false);
  const [expensesRange, setExpensesRange] = useState<'day' | 'week' | 'month' | 'year' | 'custom-day'>('day');
  const [expensesSelectedDate, setExpensesSelectedDate] = useState<string>('');
  const [expensesLoading, setExpensesLoading] = useState<boolean>(false);
  const [expensesResult, setExpensesResult] = useState<number | null>(null);
  const [expensesToday, setExpensesToday] = useState<number>(0);
  const [profitToday, setProfitToday] = useState<number>(0);
  const [dateFilter, setDateFilter] = useState<'today' | 'yesterday' | 'week' | 'month' | 'custom'>('today');
  const [customDate, setCustomDate] = useState<string>('');
  const [isFiltering, setIsFiltering] = useState<boolean>(false);

  const formatSelectedDayInfo = (dateStr: string): string => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    const weekdays = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    const monthsFull = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const getISOWeek = (date: Date) => {
      const tmp = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
      const dayNum = tmp.getUTCDay() || 7;
      tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
      const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(),0,1));
      const weekNo = Math.ceil((((tmp as any) - (yearStart as any)) / 86400000 + 1) / 7);
      return { week: weekNo, year: tmp.getUTCFullYear() };
    };
    const { week, year } = getISOWeek(d);
    const dayName = weekdays[d.getDay()];
    const monthName = monthsFull[d.getMonth()];
    const day = d.getDate();
    const y = d.getFullYear();
    return `${dayName}, ${day} ${monthName} ${y} • Week ${week} of ${year} (${monthName})`;
  };

  const getDateRange = (filter: typeof dateFilter, customDateStr?: string) => {
    let start = new Date();
    let end = new Date();

    switch (filter) {
      case 'today':
        start = new Date();
        start.setHours(0, 0, 0, 0);
        end = new Date(start);
        end.setDate(end.getDate() + 1);
        break;
      case 'yesterday':
        start = new Date();
        start.setDate(start.getDate() - 1);
        start.setHours(0, 0, 0, 0);
        end = new Date(start);
        end.setDate(end.getDate() + 1);
        break;
      case 'week':
        start = new Date();
        start.setDate(start.getDate() - 7);
        start.setHours(0, 0, 0, 0);
        end = new Date();
        end.setHours(0, 0, 0, 0);
        break;
      case 'month':
        start = new Date();
        start.setMonth(start.getMonth() - 1);
        start.setHours(0, 0, 0, 0);
        end = new Date();
        end.setHours(0, 0, 0, 0);
        break;
      case 'custom':
        if (customDateStr) {
          start = new Date(customDateStr);
          start.setHours(0, 0, 0, 0);
          end = new Date(start);
          end.setDate(end.getDate() + 1);
        }
        break;
    }

    return { start, end };
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // Debounced filtering effect
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setIsFiltering(true);
      fetchDashboardData().finally(() => setIsFiltering(false));
    }, 300); // 300ms debounce

    return () => clearTimeout(timeoutId);
  }, [dateFilter, customDate]);

  // Memoized date range calculation
  const dateRange = useMemo(() => {
    return getDateRange(dateFilter, customDate);
  }, [dateFilter, customDate]);


  const fetchDashboardData = async (): Promise<void> => {
    try {
      setLoading(true);
      await Promise.all([
        fetchStats(),
        fetchTopProducts(),
        fetchLowStockItems(),
        fetchSalesData()
      ]);
    } catch (error) {
      toast.error('Failed to fetch dashboard data');
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = useCallback(async (): Promise<void> => {
    try {
      // Get date range based on filter
      const { start, end } = dateRange;

      const ordersPath = getShopCollectionName('orders');
      const customersPath = getShopCollectionName('customers');
      const productsPath = getShopCollectionName('products');

      // Fetch all data in parallel
      const [ordersSnapshot, customersSnapshot, productsSnapshot] = await Promise.all([
        getDocs(query(collection(db, ordersPath), where('createdAt', '>=', start), where('createdAt', '<', end))),
        getDocs(query(collection(db, customersPath))),
        getDocs(query(collection(db, productsPath)))
      ]);

      // Calculate stats for the selected period
      let totalRevenue = 0;
      let ordersCount = 0;

      ordersSnapshot.forEach((doc) => {
        const order = doc.data();
        totalRevenue += order.total || 0;
        ordersCount += 1;
      });

      const activeCustomers = customersSnapshot.size;
      const totalProducts = productsSnapshot.size;
      
      // For comparison, get previous period data
      let comparisonStart: Date;
      let comparisonEnd: Date;
      
      if (dateFilter === 'today') {
        comparisonStart = new Date(start);
        comparisonStart.setDate(comparisonStart.getDate() - 1);
        comparisonEnd = new Date(start);
      } else if (dateFilter === 'yesterday') {
        comparisonStart = new Date(start);
        comparisonStart.setDate(comparisonStart.getDate() - 1);
        comparisonEnd = new Date(start);
      } else if (dateFilter === 'week') {
        comparisonStart = new Date(start);
        comparisonStart.setDate(comparisonStart.getDate() - 7);
        comparisonEnd = new Date(start);
      } else if (dateFilter === 'month') {
        comparisonStart = new Date(start);
        comparisonStart.setMonth(comparisonStart.getMonth() - 1);
        comparisonEnd = new Date(start);
      } else {
        // For custom dates, compare with previous day
        comparisonStart = new Date(start);
        comparisonStart.setDate(comparisonStart.getDate() - 1);
        comparisonEnd = new Date(start);
      }
      
      const comparisonOrdersSnapshot = await getDocs(
        query(collection(db, ordersPath), where('createdAt', '>=', comparisonStart), where('createdAt', '<', comparisonEnd))
      );
      
      let comparisonRevenue = 0;
      let comparisonOrders = 0;
      
      comparisonOrdersSnapshot.forEach((doc) => {
        const order = doc.data();
        comparisonRevenue += order.total || 0;
        comparisonOrders += 1;
      });
      
      // Calculate percentage changes
      const revenueChange = comparisonRevenue > 0 ? ((totalRevenue - comparisonRevenue) / comparisonRevenue) * 100 : 0;
      const ordersChange = comparisonOrders > 0 ? ((ordersCount - comparisonOrders) / comparisonOrders) * 100 : 0;
      const customersChange = 0; // This would need historical data
      const productsChange = 0; // This would need historical data

      setStats({
        totalRevenue,
        ordersToday: ordersCount,
        activeCustomers,
        totalProducts,
        revenueChange,
        ordersChange,
        customersChange,
        productsChange
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  }, [dateRange, dateFilter, currentUser?.shopId]);

  const fetchTopProducts = useCallback(async (): Promise<void> => {
    try {
      const ordersPath = getShopCollectionName('orders');
      const productsPath = getShopCollectionName('products');

      // Get date range based on filter
      const { start, end } = dateRange;

      // Fetch products and orders in parallel
      const [productsSnapshot, ordersSnapshot] = await Promise.all([
        getDocs(query(collection(db, productsPath))),
        getDocs(query(collection(db, ordersPath), where('createdAt', '>=', start), where('createdAt', '<', end)))
      ]);
      
      const productStats: { [key: string]: { sales: number; revenue: number } } = {};
      
      // Process orders
      ordersSnapshot.forEach((doc) => {
        const order = doc.data();
        if (order.items) {
          order.items.forEach((item: any) => {
            if (productStats[item.productId]) {
              productStats[item.productId].sales += item.quantity;
              productStats[item.productId].revenue += item.quantity * item.price;
            } else {
              productStats[item.productId] = {
                sales: item.quantity,
                revenue: item.quantity * item.price
              };
            }
          });
        }
      });

      // Get product names and create top products list
      const productsMap: { [key: string]: string } = {};
      productsSnapshot.forEach((doc) => {
        productsMap[doc.id] = doc.data().name;
      });

      const topProductsList = Object.entries(productStats)
        .map(([productId, stats]) => ({
          name: productsMap[productId] || 'Unknown Product',
          sales: stats.sales,
          revenue: stats.revenue
        }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 4);

      setTopProducts(topProductsList);
    } catch (error) {
      console.error('Error fetching top products:', error);
    }
  }, [dateRange, currentUser?.shopId]);

  const fetchLowStockItems = async (): Promise<void> => {
    try {
      // Use shop-prefixed collection name
      const productsPath = getShopCollectionName('products');

      const productsQuery = query(collection(db, productsPath));
      const productsSnapshot = await getDocs(productsQuery);
      
      const lowStockList: LowStockItem[] = [];
      
      productsSnapshot.forEach((doc) => {
        const product = doc.data();
        const stock = product.stock || 0;
        const threshold = 20; // Default threshold
        
        if (stock <= threshold) {
          lowStockList.push({
            name: product.name,
            stock: stock,
            threshold: threshold
          });
        }
      });

      setLowStockItems(lowStockList.slice(0, 3)); // Show top 3
    } catch (error) {
      console.error('Error fetching low stock items:', error);
    }
  };

  const fetchSalesData = async (period: 'today' | 'week' | 'month' = salesPeriod): Promise<void> => {
    try {
      const ordersPath = getShopCollectionName('orders');
      const now = new Date();
      let startDate = new Date();
      const endDate = new Date();
      endDate.setHours(23, 59, 59, 999);
      
      let salesDataList: SalesData[] = [];
      
      if (period === 'today') {
        startDate.setHours(0, 0, 0, 0);
        const ordersQuery = query(
          collection(db, ordersPath),
          where('createdAt', '>=', startDate),
          where('createdAt', '<=', endDate)
        );
        const ordersSnapshot = await getDocs(ordersQuery);
        
        // Group by hour
        const hourData: { [key: number]: { sales: number; orders: number } } = {};
        for (let i = 0; i < 24; i++) {
          hourData[i] = { sales: 0, orders: 0 };
        }
        
        ordersSnapshot.forEach((doc) => {
          const order = doc.data();
          const orderDate = order.createdAt?.toDate?.() || new Date(order.createdAt);
          const hour = orderDate.getHours();
          hourData[hour].sales += order.total || 0;
          hourData[hour].orders += 1;
        });
        
        salesDataList = Object.keys(hourData).map(hour => ({
          name: `${hour}:00`,
          sales: hourData[parseInt(hour)].sales,
          orders: hourData[parseInt(hour)].orders
        }));
      } else if (period === 'week') {
        startDate.setDate(startDate.getDate() - 6);
        startDate.setHours(0, 0, 0, 0);
        
        const ordersQuery = query(
          collection(db, ordersPath),
          where('createdAt', '>=', startDate),
          where('createdAt', '<=', endDate)
        );
        const ordersSnapshot = await getDocs(ordersQuery);
        
        const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        const dayData: { [key: string]: { sales: number; orders: number } } = {};
        
        for (let i = 6; i >= 0; i--) {
          const date = new Date();
          date.setDate(date.getDate() - i);
          date.setHours(0, 0, 0, 0);
          const dayKey = date.toISOString().split('T')[0];
          dayData[dayKey] = { sales: 0, orders: 0 };
        }
        
        ordersSnapshot.forEach((doc) => {
          const order = doc.data();
          const orderDate = order.createdAt?.toDate?.() || new Date(order.createdAt);
          const dayKey = orderDate.toISOString().split('T')[0];
          if (dayData[dayKey]) {
            dayData[dayKey].sales += order.total || 0;
            dayData[dayKey].orders += 1;
          }
        });
        
        for (let i = 6; i >= 0; i--) {
          const date = new Date();
          date.setDate(date.getDate() - i);
          date.setHours(0, 0, 0, 0);
          const dayKey = date.toISOString().split('T')[0];
          const isToday = i === 0;
          const dayName = isToday ? 'Today' : days[6 - i];
          
          salesDataList.push({
            name: dayName,
            sales: dayData[dayKey]?.sales || 0,
            orders: dayData[dayKey]?.orders || 0
          });
        }
      } else if (period === 'month') {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        startDate.setHours(0, 0, 0, 0);
        
        const ordersQuery = query(
          collection(db, ordersPath),
          where('createdAt', '>=', startDate),
          where('createdAt', '<=', endDate)
        );
        const ordersSnapshot = await getDocs(ordersQuery);
        
        const weekData: { [key: number]: { sales: number; orders: number } } = {};
        const weeksInMonth = Math.ceil((now.getDate() + new Date(now.getFullYear(), now.getMonth(), 0).getDay()) / 7);
        
        for (let i = 0; i < weeksInMonth; i++) {
          weekData[i] = { sales: 0, orders: 0 };
        }
        
        ordersSnapshot.forEach((doc) => {
          const order = doc.data();
          const orderDate = order.createdAt?.toDate?.() || new Date(order.createdAt);
          const weekOfMonth = Math.floor((orderDate.getDate() - 1) / 7);
          if (weekData[weekOfMonth]) {
            weekData[weekOfMonth].sales += order.total || 0;
            weekData[weekOfMonth].orders += 1;
          }
        });
        
        salesDataList = Object.keys(weekData).map(week => ({
          name: `Week ${parseInt(week) + 1}`,
          sales: weekData[parseInt(week)].sales,
          orders: weekData[parseInt(week)].orders
        }));
      }
      
      setSalesData(salesDataList);
    } catch (error) {
      console.error('Error fetching sales data:', error);
    }
  };

  const computeDateRange = (range: typeof revenueRange, dateStr: string): { start: Date; end: Date } => {
    const base = dateStr ? new Date(dateStr) : new Date();
    let start = new Date();
    let end = new Date();
    switch (range) {
      case 'yesterday': {
        start = new Date(base);
        start.setDate(start.getDate() - 1);
        start.setHours(0, 0, 0, 0);
        end = new Date(start);
        end.setDate(end.getDate() + 1);
        break;
      }
      case 'week': {
        // Last 7 full days, ending at start of base day
        end = new Date(base);
        end.setHours(0, 0, 0, 0);
        start = new Date(end);
        start.setDate(start.getDate() - 7);
        break;
      }
      case 'month': {
        // Month of base date
        start = new Date(base.getFullYear(), base.getMonth(), 1);
        end = new Date(base.getFullYear(), base.getMonth() + 1, 1);
        break;
      }
      case 'year': {
        start = new Date(base.getFullYear(), 0, 1);
        end = new Date(base.getFullYear() + 1, 0, 1);
        break;
      }
      case 'custom-day':
      default: {
        const d = base;
        start = new Date(d);
        start.setHours(0, 0, 0, 0);
        end = new Date(start);
        end.setDate(end.getDate() + 1);
        break;
      }
    }
    return { start, end };
  };

  const fetchRevenueForRange = async () => {
    try {
      setRevenueLoading(true);
      setRevenueResult(null);

      const ordersPath = getShopCollectionName('orders');

      const { start, end } = computeDateRange(revenueRange, revenueSelectedDate);
      const qRef = query(
        collection(db, ordersPath),
        where('createdAt', '>=', start),
        where('createdAt', '<', end)
      );
      const snap = await getDocs(qRef);
      let sum = 0;
      snap.forEach(doc => { const d = doc.data(); sum += d.total || 0; });
      setRevenueResult(sum);
    } catch (e) {
      console.error('Error fetching revenue range:', e);
      toast.error('Failed to fetch revenue');
    } finally {
      setRevenueLoading(false);
    }
  };

  const fetchExpensesForRange = async () => {
    try {
      setExpensesLoading(true);
      setExpensesResult(null);

      let expensesPath = 'expenses';
      if (currentUser?.shopId && currentUser.role !== 'astraronix') {
        expensesPath = `shops/${currentUser.shopId}/expenses`;
      }

      const map: any = { day: 'custom-day', week: 'week', month: 'month', year: 'year', 'custom-day': 'custom-day' };
      const { start, end } = computeDateRange(map[expensesRange], expensesSelectedDate);

      const expensesQ = query(collection(db, expensesPath), where('date', '>=', start), where('date', '<', end));
      const expensesSnap = await getDocs(expensesQ);
      let sum = 0;
      expensesSnap.forEach(d => { const v = d.data(); sum += v.amount || 0; });
      setExpensesResult(sum);
    } catch (e) {
      console.error('Error fetching expenses:', e);
      toast.error('Failed to fetch expenses');
    } finally {
      setExpensesLoading(false);
    }
  };

  // Compute expenses and profit for the selected period
  useEffect(() => {
    const computePeriodData = async () => {
      try {
        // Use shop-specific expenses path (expenses are stored in shops/{shopId}/expenses)
        let expensesPath = 'expenses';
        if (currentUser?.shopId && currentUser.role !== 'astraronix') {
          expensesPath = `shops/${currentUser.shopId}/expenses`;
        }
        const ordersPath = getShopCollectionName('orders');
        
        const { start, end } = getDateRange(dateFilter, customDate);
        
        // Get expenses for the period
        const expensesQRef = query(collection(db, expensesPath), where('date', '>=', start), where('date', '<', end));
        const expensesSnap = await getDocs(expensesQRef);
        let expensesSum = 0;
        expensesSnap.forEach(d => { const v = d.data(); expensesSum += v.amount || 0; });
        setExpensesToday(expensesSum);
        
        // Get revenue for the period
        const ordersQRef = query(collection(db, ordersPath), where('createdAt', '>=', start), where('createdAt', '<', end));
        const ordersSnap = await getDocs(ordersQRef);
        let revenueSum = 0;
        ordersSnap.forEach(d => { const v = d.data(); revenueSum += v.total || 0; });
        
        // Calculate profit
        const profit = revenueSum - expensesSum;
        setProfitToday(profit);
      } catch (e) {
        console.error('Failed computing period expenses and profit:', e);
      }
    };
    computePeriodData();
  }, [currentUser?.shopId, dateFilter, customDate]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
          <p className="text-gray-600 dark:text-gray-300">Overview of your business performance</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="p-3 md:p-4">
              <div className="animate-pulse">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded mb-2"></div>
                <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded mb-2"></div>
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
          <p className="text-gray-600 dark:text-gray-300">Overview of your business performance</p>
        </div>
        <button
          onClick={fetchDashboardData}
          disabled={loading}
          className="flex items-center space-x-2 px-4 py-2 bg-[#4A90A4] text-white rounded-lg hover:bg-[#3a7a8a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Filter Bar */}
      <Card className="p-2 md:p-4">
        <div className="flex flex-wrap items-center gap-2 md:gap-4">
          <div className="flex items-center space-x-1 md:space-x-2">
            <span className="text-xs md:text-sm font-medium text-gray-700 dark:text-gray-300">Filter:</span>
            {isFiltering && (
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 md:w-3 md:h-3 border-2 border-[#4A90A4] border-t-transparent rounded-full animate-spin"></div>
                <span className="text-xs text-[#4A90A4]">Updating...</span>
              </div>
            )}
            <div className="flex flex-wrap gap-1 md:gap-2">
              {[
                { value: 'today', label: 'Today' },
                { value: 'yesterday', label: 'Yesterday' },
                { value: 'week', label: '7 Days' },
                { value: 'month', label: 'Month' },
                { value: 'custom', label: 'Custom' }
              ].map((option) => (
                <button
                  key={option.value}
                  onClick={() => setDateFilter(option.value as any)}
                  className={`px-2 py-1 md:px-3 md:py-1.5 text-xs md:text-sm rounded-lg transition-colors whitespace-nowrap ${
                    dateFilter === option.value
                      ? 'bg-[#4A90A4] text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          
          {dateFilter === 'custom' && (
            <div className="flex items-center space-x-2 w-full md:w-auto">
              <DateInput 
                value={customDate} 
                onChange={setCustomDate}
                placeholder="Select date"
              />
              {customDate && (
                <span className="text-xs text-gray-500 dark:text-gray-400 hidden md:inline">
                  {formatSelectedDayInfo(customDate)}
                </span>
              )}
            </div>
          )}
        </div>
      </Card>


      {/* Stats Cards */}
      <div className="space-y-4 md:space-y-6">
        {/* First Row: Revenue, Expenses, Profit */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
          <Card className="p-3 md:p-4 hover:shadow-xl transition-all duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs md:text-sm font-medium text-gray-600 dark:text-gray-400">Total Revenue</p>
                <p className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white mt-1 md:mt-2">{`KSH ${stats.totalRevenue.toLocaleString()}`}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {dateFilter === 'today' ? 'Today' : 
                   dateFilter === 'yesterday' ? 'Yesterday' :
                   dateFilter === 'week' ? 'Last 7 days' :
                   dateFilter === 'month' ? 'Last month' :
                   'Custom period'}
                </p>
              </div>
              <div className="p-3 md:p-4 rounded-xl md:rounded-2xl bg-gradient-primary backdrop-blur-sm shrink-0">
                <DollarSign className="w-5 h-5 md:w-8 md:h-8 text-white" />
              </div>
            </div>
          </Card>

          {/* Expenses Card */}
          <Card className="p-3 md:p-4 hover:shadow-xl transition-all duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs md:text-sm font-medium text-gray-600 dark:text-gray-400">Expenses</p>
                <p className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white mt-1 md:mt-2">{`KSH ${expensesToday.toLocaleString()}`}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {dateFilter === 'today' ? 'Today' : 
                   dateFilter === 'yesterday' ? 'Yesterday' :
                   dateFilter === 'week' ? 'Last 7 days' :
                   dateFilter === 'month' ? 'Last month' :
                   'Custom period'}
                </p>
              </div>
              <div className="p-3 md:p-4 rounded-xl md:rounded-2xl bg-gradient-primary backdrop-blur-sm shrink-0">
                <TrendingUp className="w-5 h-5 md:w-8 md:h-8 text-white" />
              </div>
            </div>
          </Card>

          {/* Profit Card */}
          <Card className="p-3 md:p-4 hover:shadow-xl transition-all duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs md:text-sm font-medium text-gray-600 dark:text-gray-400">Profit</p>
                <p className={`text-xl md:text-2xl font-bold mt-1 md:mt-2 ${profitToday >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {`KSH ${profitToday.toLocaleString()}`}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Revenue - Expenses
                </p>
              </div>
              <div className={`p-3 md:p-4 rounded-xl md:rounded-2xl shrink-0 ${profitToday >= 0 ? 'bg-green-500' : 'bg-red-500'}`}>
                <DollarSign className="w-5 h-5 md:w-8 md:h-8 text-white" />
              </div>
            </div>
          </Card>
        </div>

        {/* Second Row: Orders, Customers, Products - 3 columns on mobile */}
        <div className="grid grid-cols-3 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          <StatsCard
            title={dateFilter === 'today' ? 'Orders Today' : 
                   dateFilter === 'yesterday' ? 'Orders Yesterday' :
                   dateFilter === 'week' ? 'Orders (7 days)' :
                   dateFilter === 'month' ? 'Orders (30 days)' :
                   'Orders (Custom)'}
            value={stats.ordersToday.toString()}
            icon={ShoppingCart}
            change={{ value: Math.abs(stats.ordersChange), trend: stats.ordersChange >= 0 ? 'up' : 'down' }}
            color="green"
          />
          <StatsCard
            title="Active Customers"
            value={stats.activeCustomers.toLocaleString()}
            icon={Users}
            change={{ value: Math.abs(stats.customersChange), trend: stats.customersChange >= 0 ? 'up' : 'down' }}
            color="purple"
          />
          <StatsCard
            title="Products"
            value={stats.totalProducts.toString()}
            icon={Package}
            change={{ value: Math.abs(stats.productsChange), trend: stats.productsChange >= 0 ? 'up' : 'down' }}
            color="orange"
          />
        </div>
      </div>

      {/* Revenue Modal */}
      <Modal open={isRevenueModalOpen} onClose={() => setIsRevenueModalOpen(false)} title="View Past Revenue" size="md">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Range</label>
            <Select
              value={revenueRange}
              onChange={(v) => setRevenueRange(v as any)}
              options={[
                { value: 'yesterday', label: 'Yesterday' },
                { value: 'week', label: 'Last 7 days' },
                { value: 'month', label: 'This month' },
                { value: 'year', label: 'This year' },
                { value: 'custom-day', label: 'Specific day' },
              ] as SelectOption[]}
            />
          </div>

          {revenueRange === 'custom-day' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Select date</label>
              <DateInput value={revenueSelectedDate} onChange={setRevenueSelectedDate} />
              {revenueSelectedDate && (
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{formatSelectedDayInfo(revenueSelectedDate)}</p>
              )}
            </div>
          )}

          <div className="flex items-center space-x-3">
            <Button onClick={fetchRevenueForRange} disabled={revenueLoading}>
              {revenueLoading ? 'Loading...' : 'Fetch revenue'}
            </Button>
            <Button variant="secondary" onClick={() => { setRevenueResult(null); setIsRevenueModalOpen(false); }}>Close</Button>
          </div>

          {revenueResult != null && (
            <div className="mt-2 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <p className="text-sm text-gray-600 dark:text-gray-300">Revenue for selected period</p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">{`KSH ${revenueResult.toLocaleString()}`}</p>
            </div>
          )}
        </div>
      </Modal>

      {/* Past Expenses Modal */}
      <Modal open={isExpensesModalOpen} onClose={() => setIsExpensesModalOpen(false)} title="Past Expenses" size="md">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Range</label>
            <Select
              value={expensesRange}
              onChange={(v) => setExpensesRange(v as any)}
              options={[
                { value: 'day', label: 'Today' },
                { value: 'week', label: 'Last 7 days' },
                { value: 'month', label: 'This month' },
                { value: 'year', label: 'This year' },
                { value: 'custom-day', label: 'Specific day' },
              ] as SelectOption[]}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Select day (optional)</label>
            <DateInput value={expensesSelectedDate} onChange={setExpensesSelectedDate} />
            {expensesSelectedDate && (
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{formatSelectedDayInfo(expensesSelectedDate)}</p>
            )}
            <div className="mt-2 flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => { setExpensesRange('day'); setExpensesSelectedDate(new Date().toISOString().split('T')[0]); }}>Today</Button>
              <Button variant="secondary" onClick={() => { const d=new Date(); d.setDate(d.getDate()-1); setExpensesRange('day'); setExpensesSelectedDate(d.toISOString().split('T')[0]); }}>Yesterday</Button>
              <Button variant="secondary" onClick={() => { const d=new Date(); d.setDate(d.getDate()-2); setExpensesRange('day'); setExpensesSelectedDate(d.toISOString().split('T')[0]); }}>Day before</Button>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <Button onClick={fetchExpensesForRange} disabled={expensesLoading}>
              {expensesLoading ? 'Loading...' : 'Fetch expenses'}
            </Button>
            <Button variant="secondary" onClick={() => { setExpensesResult(null); setIsExpensesModalOpen(false); }}>Close</Button>
          </div>

          {expensesResult != null && (
            <div className="mt-2 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <p className="text-sm text-gray-600 dark:text-gray-300">Expenses for selected period</p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">{`KSH ${expensesResult.toLocaleString()}`}</p>
            </div>
          )}
        </div>
      </Modal>

      {/* Charts and Tables Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-4">
        <SalesChart data={salesData} period={salesPeriod} onPeriodChange={(period) => {
          setSalesPeriod(period);
          fetchSalesData(period);
        }} />
        
        {/* Top Products */}
        <Card className="p-3 md:p-4">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Top Products</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">Best performing items</p>
            </div>
            <TrendingUp className="w-6 h-6 text-[#4A90A4]" />
          </div>
          
          <div className="space-y-4">
            {topProducts.length > 0 ? (
              topProducts.map((product, index) => (
              <div key={index} className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">{product.name}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{product.sales} sold</p>
                </div>
                <div className="text-right">
                    <p className="font-semibold text-gray-900 dark:text-white">KSH {product.revenue.toLocaleString()}</p>
                  <p className="text-sm text-green-600">Revenue</p>
                </div>
              </div>
              ))
            ) : (
              <p className="text-gray-500 dark:text-gray-400 text-center py-4">No sales data available</p>
            )}
          </div>
        </Card>
      </div>

      {/* Low Stock Alert */}
      <Card className="p-6">
        <div className="flex items-center mb-6">
          <AlertTriangle className="w-6 h-6 text-red-500 mr-3" />
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Low Stock Alert</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">Items that need restocking</p>
          </div>
        </div>
        
        {lowStockItems.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {lowStockItems.map((item, index) => (
            <div key={index} className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
              <h4 className="font-medium text-gray-900 dark:text-white mb-2">{item.name}</h4>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-300">Current: {item.stock}</span>
                <span className="text-sm text-red-600 dark:text-red-400">Min: {item.threshold}</span>
              </div>
              <div className="mt-2 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div 
                  className="bg-red-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${Math.min((item.stock / item.threshold) * 100, 100)}%` }}
                ></div>
              </div>
            </div>
          ))}
        </div>
        ) : (
          <div className="text-center py-8">
            <div className="w-16 h-16 mx-auto mb-4 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center">
              <Package className="w-8 h-8 text-green-600" />
            </div>
            <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">All Good!</h4>
            <p className="text-gray-600 dark:text-gray-400">No low stock items at the moment</p>
          </div>
        )}
      </Card>
    </div>
  );
};

export default Dashboard;