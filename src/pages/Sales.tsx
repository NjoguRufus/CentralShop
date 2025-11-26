import React, { useEffect, useMemo, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { getShopCollectionName, BRANCHES, BranchName } from '../config/shopConfig';
import Card from '../components/UI/Card';
import Modal from '../components/Modal';
import Dropdown from '../components/UI/Dropdown';
import DateInput from '../components/UI/DateInput';
import { toast } from 'react-toastify';

interface SalesOrder {
  id: string;
  total: number;
  status?: string;
  paymentMethod?: string;
  amountReceived?: number;
  cashAmount?: number;
  mpesaAmount?: number;
  debtAmount?: number;
  partialAmount?: number;
  remainingAmount?: number;
  createdAt?: any;
}

interface SalesSummary {
  totalSales: number;
  cashTotal: number;
  mpesaTotal: number;
  debtTotal: number;
  ordersCount: number;
  splitCount: number;
}

interface ProductSalesRow {
  productId: string;
  name: string;
  quantitySold: number;
  revenue: number;
  remainingStock?: number;
  unit?: string;
}

const Sales: React.FC = () => {
  const { currentUser } = useAuth();
  const [selectedBranch, setSelectedBranch] = useState<string>('CentralShop');
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [summary, setSummary] = useState<SalesSummary>({
    totalSales: 0,
    cashTotal: 0,
    mpesaTotal: 0,
    debtTotal: 0,
    ordersCount: 0,
    splitCount: 0,
  });
  const [productSummary, setProductSummary] = useState<ProductSalesRow[]>([]);
  const [showProductModal, setShowProductModal] = useState(false);

  // Determine if user can switch between shops
  const canSwitchBranches = useMemo(() => {
    const assigned = (currentUser as any)?.assignedShops as string[] | undefined;
    const normalized = (assigned || []).map((s) => s.toLowerCase().replace(/\s+/g, ''));
    const unique = Array.from(new Set(normalized));
    const hasBoth =
      unique.includes(BRANCHES.CENTRAL.toLowerCase()) &&
      unique.includes(BRANCHES.KAMWENE.toLowerCase());

    return (
      hasBoth ||
      currentUser?.role === 'mainAdmin' ||
      currentUser?.role === 'Admin' ||
      currentUser?.role === 'astraronix'
    );
  }, [currentUser]);

  // Auto-select current user's shop as active branch
  useEffect(() => {
    if (currentUser?.shopName) {
      setSelectedBranch(currentUser.shopName);
    } else if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('selectedShop');
      if (saved) {
        setSelectedBranch(saved);
      }
    }
  }, [currentUser?.shopName]);

  useEffect(() => {
    if (!currentUser?.shopId) return;
    fetchSales();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.shopId, selectedBranch, selectedDate]);

  const fetchSales = async () => {
    try {
      setLoading(true);
      const branch = selectedBranch as BranchName;
      const ordersPath = getShopCollectionName('orders', branch);
      const start = new Date(selectedDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);

      const qRef = query(
        collection(db, ordersPath),
        where('createdAt', '>=', start),
        where('createdAt', '<', end)
      );

      const [ordersSnap, productsSnap] = await Promise.all([
        getDocs(qRef),
        getDocs(collection(db, getShopCollectionName('products', branch))),
      ]);

      const productMap: Record<
        string,
        { name: string; stock: number; unit?: string }
      > = {};
      productsSnap.forEach((p) => {
        const d = p.data() as any;
        productMap[p.id] = {
          name: d.name,
          stock: Number(d.stock || 0),
          unit: d.unit,
        };
      });

      const productAgg: Record<string, ProductSalesRow> = {};
      const rows: SalesOrder[] = [];

      let totalSales = 0;
      let cashTotal = 0;
      let mpesaTotal = 0;
      let debtTotal = 0;
      let ordersCount = 0;
      let splitCount = 0;

      ordersSnap.forEach((docSnap) => {
        const data = docSnap.data() as any;

        const status: string = (data.status || 'completed').toString().toLowerCase();
        // Skip cancelled orders from sales metrics
        if (status === 'cancelled') return;

        const total = Number(data.total || 0);
        const paymentMethod = (data.paymentMethod || '').toLowerCase();
        const cashAmount = Number(data.cashAmount || 0);
        const mpesaAmount = Number(data.mpesaAmount || 0);
        const amountReceived = Number(data.amountReceived || 0);
        const debtAmount = Number(data.debtAmount || 0);
        const partialAmount = Number(data.partialAmount || 0);
        const remainingAmount = data.remainingAmount != null ? Number(data.remainingAmount) : undefined;

        ordersCount += 1;
        totalSales += total;

        // Base payment breakdown
        if (paymentMethod === 'cash') {
          cashTotal += cashAmount || amountReceived || total;
        } else if (paymentMethod === 'mpesa' || paymentMethod === 'm-pesa') {
          mpesaTotal += mpesaAmount || amountReceived || total;
        } else if (paymentMethod === 'split') {
          cashTotal += cashAmount;
          mpesaTotal += mpesaAmount;
          splitCount += 1;
        }

        // Debt / outstanding balance
        if (
          paymentMethod === 'debt' ||
          paymentMethod === 'partial' ||
          debtAmount > 0 ||
          (remainingAmount != null && remainingAmount > 0)
        ) {
          const paid = cashAmount + mpesaAmount + partialAmount;
          const outstanding =
            remainingAmount != null
              ? remainingAmount
              : debtAmount > 0
              ? debtAmount
              : Math.max(0, total - paid);
          debtTotal += outstanding;
        }

        rows.push({
          id: docSnap.id,
          total,
          status,
          paymentMethod,
          amountReceived,
          cashAmount,
          mpesaAmount,
          debtAmount,
          partialAmount,
          remainingAmount,
          createdAt: data.createdAt,
        });

        // Build product-level aggregates for this order
        const items: any[] = Array.isArray(data.items)
          ? data.items
          : Array.isArray(data.products)
          ? data.products
          : [];

        items.forEach((item) => {
          const productId: string = item.productId || item.id || item.productId?.toString() || '';
          const meta = productMap[productId] || { name: item.name || `Product ${productId}`, stock: 0, unit: item.unit };
          const name = meta.name || item.name || `Product ${productId}`;
          const qty = Number(item.quantity || 0);
          const price = Number(item.price || 0);

          if (!productAgg[productId || name]) {
            productAgg[productId || name] = {
              productId: productId || name,
              name,
              quantitySold: 0,
              revenue: 0,
              remainingStock: meta.stock,
              unit: meta.unit,
            };
          }

          productAgg[productId || name].quantitySold += qty;
          productAgg[productId || name].revenue += qty * price;
        });
      });

      setOrders(rows);
      setSummary({
        totalSales,
        cashTotal,
        mpesaTotal,
        debtTotal,
        ordersCount,
        splitCount,
      });
      setProductSummary(
        Object.values(productAgg).sort((a, b) => b.quantitySold - a.quantitySold)
      );
    } catch (e) {
      console.error('Error fetching sales data:', e);
      toast.error('Failed to load sales data');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => `KSH ${value.toLocaleString()}`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">
            Sales Summary
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            Today&apos;s sales breakdown by payment method and outstanding debt.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {canSwitchBranches && (
            <Dropdown
              value={selectedBranch}
              onChange={setSelectedBranch}
              options={[
                { value: BRANCHES.CENTRAL, label: 'Central Shop' },
                { value: BRANCHES.KAMWENE, label: 'Kamwene Shop' },
              ]}
              placeholder="Select Shop"
            />
          )}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-700 dark:text-gray-300">Date:</span>
            <DateInput value={selectedDate} onChange={setSelectedDate} />
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <Card className="p-3 md:p-4">
          <p className="text-xs md:text-sm font-medium text-gray-600 dark:text-gray-400">
            Total Sales
          </p>
          <p className="text-xl md:text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">
            {formatCurrency(summary.totalSales)}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {summary.ordersCount} order{summary.ordersCount !== 1 ? 's' : ''} on {selectedDate}
          </p>
        </Card>

        <Card className="p-3 md:p-4">
          <p className="text-xs md:text-sm font-medium text-gray-600 dark:text-gray-400">
            Cash Total
          </p>
          <p className="text-xl md:text-2xl font-bold text-green-600 dark:text-green-400 mt-1">
            {formatCurrency(summary.cashTotal)}
          </p>
        </Card>

        <Card className="p-3 md:p-4">
          <p className="text-xs md:text-sm font-medium text-gray-600 dark:text-gray-400">
            Mpesa Total
          </p>
          <p className="text-xl md:text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
            {formatCurrency(summary.mpesaTotal)}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {summary.splitCount} split payment{summary.splitCount !== 1 ? 's' : ''}
          </p>
        </Card>

        <Card className="p-3 md:p-4">
          <p className="text-xs md:text-sm font-medium text-gray-600 dark:text-gray-400">
            Outstanding Debt
          </p>
          <p className="text-xl md:text-2xl font-bold text-red-600 dark:text-red-400 mt-1">
            {formatCurrency(summary.debtTotal)}
          </p>
        </Card>
      </div>

      {/* Products sold summary */}
      <Card
        className="p-3 md:p-4 cursor-pointer hover:shadow-lg transition-shadow"
        onClick={() => productSummary.length > 0 && setShowProductModal(true)}
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs md:text-sm font-medium text-gray-600 dark:text-gray-400">
              Products Sold
            </p>
            <p className="text-xl md:text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-1">
              {productSummary.reduce((sum, p) => sum + p.quantitySold, 0).toLocaleString()}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {productSummary.length} unique product
              {productSummary.length !== 1 ? 's' : ''} sold on {selectedDate}
            </p>
          </div>
          <div className="text-xs md:text-sm text-blue-500 dark:text-blue-300 font-medium">
            View details ▸
          </div>
        </div>
      </Card>

      {/* Detailed orders list */}
      <Card className="p-3 md:p-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
          Orders Detail ({selectedDate})
        </h2>
        {loading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, idx) => (
              <div
                key={idx}
                className="h-10 bg-gray-200 dark:bg-gray-700 animate-pulse rounded"
              />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            No orders found for the selected date.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm md:text-base">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-3 py-2 text-left text-xs md:text-sm font-semibold text-gray-600 dark:text-gray-300">
                    Time
                  </th>
                  <th className="px-3 py-2 text-left text-xs md:text-sm font-semibold text-gray-600 dark:text-gray-300">
                    Payment
                  </th>
                  <th className="px-3 py-2 text-right text-xs md:text-sm font-semibold text-gray-600 dark:text-gray-300">
                    Total
                  </th>
                  <th className="px-3 py-2 text-right text-xs md:text-sm font-semibold text-gray-600 dark:text-gray-300">
                    Cash
                  </th>
                  <th className="px-3 py-2 text-right text-xs md:text-sm font-semibold text-gray-600 dark:text-gray-300">
                    Mpesa
                  </th>
                  <th className="px-3 py-2 text-right text-xs md:text-sm font-semibold text-gray-600 dark:text-gray-300">
                    Debt
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                {orders.map((order) => {
                  const d: Date =
                    order.createdAt?.toDate?.() || new Date(order.createdAt || selectedDate);
                  const timeLabel = `${d.getHours().toString().padStart(2, '0')}:${d
                    .getMinutes()
                    .toString()
                    .padStart(2, '0')}`;

                  const method = (order.paymentMethod || '').toLowerCase();
                  const label =
                    method === 'mpesa' || method === 'm-pesa'
                      ? 'Mpesa'
                      : method === 'cash'
                      ? 'Cash'
                      : method === 'split'
                      ? 'Split'
                      : method === 'debt'
                      ? 'Debt'
                      : method || 'N/A';

                  const cash = order.cashAmount || 0;
                  const mpesa = order.mpesaAmount || 0;
                  const paid = cash + mpesa + (order.partialAmount || 0);
                  const debt =
                    order.remainingAmount != null
                      ? order.remainingAmount
                      : order.debtAmount != null
                      ? order.debtAmount
                      : Math.max(0, (order.total || 0) - paid);

                  return (
                    <tr key={order.id}>
                      <td className="px-3 py-2 text-gray-900 dark:text-white text-sm md:text-base font-medium">
                        {timeLabel}
                      </td>
                      <td className="px-3 py-2 text-gray-800 dark:text-gray-200 text-sm md:text-base">
                        {label}
                      </td>
                      <td className="px-3 py-2 text-right text-gray-900 dark:text-white text-sm md:text-base font-semibold tabular-nums">
                        {formatCurrency(order.total || 0)}
                      </td>
                      <td className="px-3 py-2 text-right text-gray-900 dark:text-white text-sm md:text-base tabular-nums">
                        {cash > 0 ? formatCurrency(cash) : '-'}
                      </td>
                      <td className="px-3 py-2 text-right text-gray-900 dark:text-white text-sm md:text-base tabular-nums">
                        {mpesa > 0 ? formatCurrency(mpesa) : '-'}
                      </td>
                      <td className="px-3 py-2 text-right text-gray-900 dark:text-white text-sm md:text-base tabular-nums">
                        {debt > 0 ? formatCurrency(debt) : '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Product sales modal */}
      <Modal
        open={showProductModal}
        onClose={() => setShowProductModal(false)}
        title={`Products Sold on ${selectedDate}`}
        size="lg"
      >
        {productSummary.length === 0 ? (
          <p className="text-sm text-gray-600 dark:text-gray-300">
            No product sales recorded for this date.
          </p>
        ) : (
          <div className="space-y-3">
            <div className="text-sm text-gray-600 dark:text-gray-300">
              <span className="font-semibold">Total products sold:</span>{' '}
              {productSummary.reduce((sum, p) => sum + p.quantitySold, 0).toLocaleString()} units
            </div>
            <div className="max-h-96 overflow-y-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm md:text-base">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs md:text-sm font-semibold text-gray-600 dark:text-gray-300">
                      Product
                    </th>
                    <th className="px-3 py-2 text-right text-xs md:text-sm font-semibold text-gray-600 dark:text-gray-300">
                      Sold (Qty)
                    </th>
                    <th className="px-3 py-2 text-right text-xs md:text-sm font-semibold text-gray-600 dark:text-gray-300">
                      Revenue
                    </th>
                    <th className="px-3 py-2 text-right text-xs md:text-sm font-semibold text-gray-600 dark:text-gray-300">
                      Remaining Stock
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                  {productSummary.map((p) => (
                    <tr key={p.productId}>
                      <td className="px-3 py-2 text-gray-900 dark:text-white font-medium">
                        {p.name}
                      </td>
                      <td className="px-3 py-2 text-right text-gray-900 dark:text-white font-semibold tabular-nums">
                        {p.quantitySold.toLocaleString()}
                        {p.unit ? ` ${p.unit}` : ''}
                      </td>
                      <td className="px-3 py-2 text-right text-gray-900 dark:text-white font-semibold tabular-nums">
                        {formatCurrency(p.revenue)}
                      </td>
                      <td className="px-3 py-2 text-right text-gray-900 dark:text-white tabular-nums">
                        {p.remainingStock != null ? p.remainingStock.toLocaleString() : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Sales;


