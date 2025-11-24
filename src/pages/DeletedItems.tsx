// src/pages/DeletedItems.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, query, orderBy, where } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { getShopCollectionName } from '../config/shopConfig';
import Card from '../components/UI/Card';
import Button from '../components/UI/Button';
import { toast } from 'react-toastify';
import { ArrowLeft, Trash2, Package, FileText, Calendar, User, DollarSign } from 'lucide-react';
import Table from '../components/UI/Table';

interface RefundedItem {
  productName: string;
  removedBy: string;
  removedById: string;
  removedAt: Date;
  originalItem: any;
}

interface OrderWithRefunds {
  id: string;
  orderId: string;
  date: string;
  customerName: string;
  total: number;
  refundedItems: RefundedItem[];
  employeeName?: string;
  createdAt?: any;
}

interface DeletedOrder {
  id: string;
  orderId: string;
  date: string;
  customerName: string;
  total: number;
  deletedBy: string;
  deletedAt: Date;
  employeeName?: string;
}

const DeletedItems: React.FC = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'products' | 'orders'>('products');
  const [refundedProducts, setRefundedProducts] = useState<OrderWithRefunds[]>([]);
  const [deletedOrders, setDeletedOrders] = useState<DeletedOrder[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');

  useEffect(() => {
    fetchDeletedItems();
  }, [currentUser?.shopId]);

  const fetchDeletedItems = async (): Promise<void> => {
    try {
      setLoading(true);
      
      if (!currentUser?.shopId) {
        toast.error('No shop assigned to your account');
        return;
      }

      const ordersCollectionName = getShopCollectionName('orders');
      const ordersQuery = query(
        collection(db, ordersCollectionName),
        orderBy('createdAt', 'desc')
      );
      const querySnapshot = await getDocs(ordersQuery);
      
      const ordersWithRefunds: OrderWithRefunds[] = [];
      const allDeletedOrders: DeletedOrder[] = [];

      querySnapshot.forEach((doc) => {
        const orderData = doc.data();
        
        // Collect orders with refunded items
        if (orderData.refundedItems && Array.isArray(orderData.refundedItems) && orderData.refundedItems.length > 0) {
          ordersWithRefunds.push({
            id: doc.id,
            orderId: orderData.id || doc.id,
            date: orderData.date || (orderData.createdAt?.toDate ? orderData.createdAt.toDate().toLocaleDateString() : 'N/A'),
            customerName: orderData.customerName || 'Walk In Customer',
            total: orderData.total || 0,
            refundedItems: orderData.refundedItems.map((item: any) => ({
              ...item,
              removedAt: item.removedAt?.toDate ? item.removedAt.toDate() : new Date(item.removedAt || Date.now())
            })),
            employeeName: orderData.employeeName,
            createdAt: orderData.createdAt
          });
        }

        // Collect deleted orders (status is 'cancelled' or 'refunded')
        if (orderData.status === 'cancelled' || orderData.status === 'refunded') {
          allDeletedOrders.push({
            id: doc.id,
            orderId: orderData.id || doc.id,
            date: orderData.date || (orderData.createdAt?.toDate ? orderData.createdAt.toDate().toLocaleDateString() : 'N/A'),
            customerName: orderData.customerName || 'Walk In Customer',
            total: orderData.total || 0,
            deletedBy: orderData.lastModifiedBy || orderData.employeeName || 'System',
            deletedAt: orderData.lastModifiedAt?.toDate ? orderData.lastModifiedAt.toDate() : (orderData.createdAt?.toDate ? orderData.createdAt.toDate() : new Date()),
            employeeName: orderData.employeeName
          });
        }
      });

      // Sort by date (most recent first)
      ordersWithRefunds.sort((a, b) => {
        const dateA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : new Date(a.date).getTime();
        const dateB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : new Date(b.date).getTime();
        return dateB - dateA;
      });

      allDeletedOrders.sort((a, b) => b.deletedAt.getTime() - a.deletedAt.getTime());

      setRefundedProducts(ordersWithRefunds);
      setDeletedOrders(allDeletedOrders);
    } catch (error) {
      console.error('Error fetching deleted items:', error);
      toast.error('Failed to fetch deleted items');
    } finally {
      setLoading(false);
    }
  };

  const filteredRefundedProducts = refundedProducts.filter(order => {
    const matchesSearch = 
      order.orderId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.refundedItems.some(item => 
        item.productName.toLowerCase().includes(searchTerm.toLowerCase())
      );
    return matchesSearch;
  });

  const filteredDeletedOrders = deletedOrders.filter(order => {
    const matchesSearch = 
      order.orderId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.deletedBy.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  // Flatten refunded products for display
  const flattenedRefundedProducts = filteredRefundedProducts.flatMap(order =>
    order.refundedItems.map(item => ({
      ...item,
      orderId: order.orderId,
      orderDate: order.date,
      customerName: order.customerName,
      orderTotal: order.total,
      employeeName: order.employeeName
    }))
  );

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-4">
          <Button
            variant="secondary"
            onClick={() => navigate('/orders')}
            className="flex items-center space-x-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Orders</span>
          </Button>
          <h1 className="text-xl md:text-2xl font-bold text-gray-800 dark:text-white">
            Deleted Items & Orders
          </h1>
        </div>
      </div>

      {/* Tabs */}
      <Card className="p-4 mb-6">
        <div className="flex space-x-4 border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setActiveTab('products')}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === 'products'
                ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
            }`}
          >
            <div className="flex items-center space-x-2">
              <Package className="w-4 h-4" />
              <span>Deleted Products ({flattenedRefundedProducts.length})</span>
            </div>
          </button>
          <button
            onClick={() => setActiveTab('orders')}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === 'orders'
                ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
            }`}
          >
            <div className="flex items-center space-x-2">
              <FileText className="w-4 h-4" />
              <span>Deleted Orders ({filteredDeletedOrders.length})</span>
            </div>
          </button>
        </div>
      </Card>

      {/* Search */}
      <Card className="p-4 mb-6">
        <input
          type="text"
          placeholder={`Search ${activeTab === 'products' ? 'products' : 'orders'}...`}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </Card>

      {loading ? (
        <Card className="p-8">
          <div className="text-center text-gray-600 dark:text-gray-400">
            Loading deleted items...
          </div>
        </Card>
      ) : activeTab === 'products' ? (
        <Card className="p-4">
          {flattenedRefundedProducts.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No deleted products found</p>
            </div>
          ) : (
            <Table
              columns={[
                { header: 'Product Name', accessor: 'productName' },
                { 
                  header: 'Order ID', 
                  accessor: 'orderId',
                  render: (row: any) => (
                    <span className="font-mono text-sm">{row.orderId}</span>
                  )
                },
                { 
                  header: 'Customer', 
                  accessor: 'customerName' 
                },
                { 
                  header: 'Order Date', 
                  accessor: 'orderDate' 
                },
                { 
                  header: 'Removed By', 
                  accessor: 'removedBy',
                  render: (row: any) => (
                    <div className="flex items-center space-x-2">
                      <User className="w-4 h-4 text-gray-500" />
                      <span>{row.removedBy}</span>
                    </div>
                  )
                },
                { 
                  header: 'Removed At', 
                  accessor: 'removedAt',
                  render: (row: any) => {
                    const date = row.removedAt instanceof Date ? row.removedAt : new Date(row.removedAt);
                    return (
                      <div className="flex items-center space-x-2">
                        <Calendar className="w-4 h-4 text-gray-500" />
                        <span>{date.toLocaleString()}</span>
                      </div>
                    );
                  }
                },
                { 
                  header: 'Original Price', 
                  accessor: 'originalItem',
                  render: (row: any) => {
                    const price = row.originalItem?.price || 0;
                    const quantity = row.originalItem?.quantity || 1;
                    const total = price * quantity;
                    return (
                      <div className="flex items-center space-x-2">
                        <DollarSign className="w-4 h-4 text-gray-500" />
                        <span>KSH {total.toLocaleString()}</span>
                      </div>
                    );
                  }
                }
              ]}
              data={flattenedRefundedProducts}
            />
          )}
        </Card>
      ) : (
        <Card className="p-4">
          {filteredDeletedOrders.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No deleted orders found</p>
            </div>
          ) : (
            <Table
              columns={[
                { 
                  header: 'Order ID', 
                  accessor: 'orderId',
                  render: (row: DeletedOrder) => (
                    <span className="font-mono text-sm">{row.orderId}</span>
                  )
                },
                { 
                  header: 'Customer', 
                  accessor: 'customerName' 
                },
                { 
                  header: 'Order Date', 
                  accessor: 'date' 
                },
                { 
                  header: 'Total', 
                  accessor: 'total',
                  render: (row: DeletedOrder) => (
                    <div className="flex items-center space-x-2">
                      <DollarSign className="w-4 h-4 text-gray-500" />
                      <span>KSH {row.total.toLocaleString()}</span>
                    </div>
                  )
                },
                { 
                  header: 'Sold By', 
                  accessor: 'employeeName',
                  render: (row: DeletedOrder) => row.employeeName || 'N/A'
                },
                { 
                  header: 'Deleted By', 
                  accessor: 'deletedBy',
                  render: (row: DeletedOrder) => (
                    <div className="flex items-center space-x-2">
                      <User className="w-4 h-4 text-gray-500" />
                      <span>{row.deletedBy}</span>
                    </div>
                  )
                },
                { 
                  header: 'Deleted At', 
                  accessor: 'deletedAt',
                  render: (row: DeletedOrder) => (
                    <div className="flex items-center space-x-2">
                      <Calendar className="w-4 h-4 text-gray-500" />
                      <span>{row.deletedAt.toLocaleString()}</span>
                    </div>
                  )
                }
              ]}
              data={filteredDeletedOrders}
            />
          )}
        </Card>
      )}
    </div>
  );
};

export default DeletedItems;

