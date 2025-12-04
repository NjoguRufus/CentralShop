// src/pages/Customers.tsx
import React, { useState, useEffect } from 'react';
import { collection, getDocs, doc, query, orderBy, where } from 'firebase/firestore';
import { addDoc, updateDoc, deleteDoc } from '../offline/firestoreWrappers';
import { loadCustomersCacheFirst, loadOrdersCacheFirst } from '../offline/cacheFirstLoader';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { getShopCollectionName, BRANCHES, BranchName } from '../config/shopConfig';
import Dropdown from '../components/UI/Dropdown';
import Card from '../components/UI/Card';
import Table from '../components/UI/Table';
import Modal from '../components/Modal';
import FormInput from '../components/UI/FormInput';
import Button from '../components/UI/Button';
import ConfirmationModal from '../components/UI/ConfirmationModal';
import { ShoppingBag, DollarSign, Eye } from 'lucide-react';
import { toast } from 'react-toastify';

interface Customer {
  id?: string;
  name: string;
  email?: string;
  phone?: string;
  loyaltyPoints: number;
  avatar?: string;
  totalPurchases?: number;
  totalSpent?: number;
  orderCount?: number;
}

interface Order {
  id: string;
  customerId?: string;
  items: Array<{
    productId: string;
    quantity: number;
    price: number;
    name?: string;
  }>;
  total: number;
  subtotal: number;
  tax: number;
  status: string;
  createdAt: any;
  paymentMethod?: string;
}

const Customers: React.FC = () => {
  const { currentUser } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [showPurchaseHistoryModal, setShowPurchaseHistoryModal] = useState<boolean>(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerOrders, setCustomerOrders] = useState<Order[]>([]);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState<string | null>(null);
  const [selectedBranch, setSelectedBranch] = useState<string>('CentralShop');
  const [formData, setFormData] = useState<Omit<Customer, 'id'>>({
    name: '',
    email: '',
    phone: '',
    loyaltyPoints: 0,
    avatar: ''
  });

  // Determine if user can switch between shops
  const canSwitchBranches =
    (Array.isArray((currentUser as any)?.assignedShops) &&
      new Set(
        ((currentUser as any).assignedShops as string[]).map(s => s.replace(/\s+/g, '').toLowerCase())
      ).size > 1) ||
    currentUser?.role === 'mainAdmin' ||
    currentUser?.role === 'Admin' ||
    currentUser?.role === 'astraronix';

  // Auto-select the current user's shop as the active branch
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
    fetchCustomers();
    fetchOrders();
  }, [selectedBranch]);

  const fetchOrders = async (): Promise<void> => {
    try {
      if (!currentUser?.shopId) return;

      // Use cache-first loading
      const ordersData = await loadOrdersCacheFirst(selectedBranch as BranchName);
      setOrders(ordersData as Order[]);
    } catch (error) {
      console.error('Error fetching orders:', error);
      // Try cache fallback
      try {
        const cached = await loadOrdersCacheFirst(selectedBranch as BranchName);
        if (cached.length > 0) {
          setOrders(cached as Order[]);
        }
      } catch (e) {
        // Ignore
      }
    }
  };

  const fetchCustomers = async (): Promise<void> => {
    try {
      setLoading(true);
      
      if (!currentUser?.shopId) {
        console.error('No shop ID found for current user');
        toast.error('No shop assigned to your account');
        return;
      }

      // Use cache-first loading
      const customersData = await loadCustomersCacheFirst(selectedBranch as BranchName);

      // Calculate purchase statistics for each customer
      const customersWithStats = customersData.map((customer: any) => {
        const customerOrdersList = orders.filter(order => order.customerId === customer.id);
        const totalSpent = customerOrdersList.reduce((sum, order) => sum + (order.total || 0), 0);
        const orderCount = customerOrdersList.length;
        
        return {
          ...customer,
          totalPurchases: orderCount,
          totalSpent,
          orderCount
        };
      });

      setCustomers(customersWithStats as Customer[]);
      
      // If there are no customers, let the UI show an empty state instead of an error toast
      if (customersData.length === 0 && !navigator.onLine) {
        toast.info('Loading customers from cache...');
      }
    } catch (error) {
      console.error('Error fetching customers:', error);
      // Try cache fallback
      try {
        const cached = await loadCustomersCacheFirst(selectedBranch as BranchName);
        if (cached.length > 0) {
          const customersWithStats = cached.map((customer: any) => {
            const customerOrdersList = orders.filter(order => order.customerId === customer.id);
            const totalSpent = customerOrdersList.reduce((sum, order) => sum + (order.total || 0), 0);
            const orderCount = customerOrdersList.length;
            return { ...customer, totalPurchases: orderCount, totalSpent, orderCount };
          });
          setCustomers(customersWithStats as Customer[]);
          toast.info('Loaded customers from cache');
        }
      } catch (e) {
        // Silent – UI will show empty state
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (orders.length > 0) {
      fetchCustomers();
    }
  }, [orders.length]);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>): void => {
    setSearchTerm(e.target.value);
  };

  const filteredCustomers = customers.filter(customer => 
    customer.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    customer.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.phone?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    
    if (!currentUser?.shopId) {
      toast.error('No shop assigned to your account');
      return;
    }
    
    try {
      if (editingCustomer && editingCustomer.id) {
        await updateDoc(doc(db, getShopCollectionName('customers', selectedBranch as BranchName), editingCustomer.id), formData);
        toast.success('Customer updated successfully');
      } else {
        await addDoc(collection(db, getShopCollectionName('customers', selectedBranch as BranchName)), formData);
        toast.success('Customer added successfully');
      }
      setIsModalOpen(false);
      setEditingCustomer(null);
      setFormData({ name: '', email: '', phone: '', loyaltyPoints: 0, avatar: '' });
      fetchCustomers();
    } catch (error) {
      toast.error('Failed to save customer');
      console.error('Error saving customer:', error);
    }
  };

  const handleDelete = (id: string): void => {
    setCustomerToDelete(id);
    setShowDeleteModal(true);
  };

  const confirmDeleteCustomer = async (): Promise<void> => {
    if (!currentUser?.shopId || !customerToDelete) {
      toast.error('No shop assigned to your account');
      return;
    }

    try {
      await deleteDoc(doc(db, getShopCollectionName('customers', selectedBranch as BranchName), customerToDelete));
      toast.success('Customer deleted successfully');
      fetchCustomers();
      setShowDeleteModal(false);
      setCustomerToDelete(null);
    } catch (error) {
      toast.error('Failed to delete customer');
      console.error('Error deleting customer:', error);
    }
  };

  const handleEdit = (customer: Customer): void => {
    setEditingCustomer(customer);
    setFormData({
      name: customer.name,
      email: customer.email || '',
      phone: customer.phone || '',
      loyaltyPoints: customer.loyaltyPoints,
      avatar: customer.avatar || ''
    });
    setIsModalOpen(true);
  };

  const handleViewPurchaseHistory = (customer: Customer): void => {
    setSelectedCustomer(customer);
    const customerOrdersList = orders.filter(order => order.customerId === customer.id);
    setCustomerOrders(customerOrdersList);
    setShowPurchaseHistoryModal(true);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = e.target.files?.[0];
    if (file) {
      // Cloudinary upload implementation
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', 'your_upload_preset');
      
      try {
        const response = await fetch(
          `https://api.cloudinary.com/v1_1/your_cloud_name/image/upload`,
          {
            method: 'POST',
            body: formData,
          }
        );
        const data = await response.json();
        setFormData(prev => ({ ...prev, avatar: data.secure_url }));
        toast.success('Image uploaded successfully');
      } catch (error) {
        toast.error('Failed to upload image');
        console.error('Error uploading image:', error);
      }
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'loyaltyPoints' ? parseInt(value) || 0 : value
    }));
  };

  const totalCustomers = customers.length;
  const totalRevenue = customers.reduce((sum, c) => sum + (c.totalSpent || 0), 0);
  const totalOrders = customers.reduce((sum, c) => sum + (c.orderCount || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">Customers</h1>
          <p className="text-gray-600 dark:text-gray-300">Manage customers and view their purchase history</p>
        </div>
        <div className="flex items-center gap-3">
          {canSwitchBranches && (
            <Dropdown
              value={selectedBranch}
              onChange={setSelectedBranch}
              options={[
                { value: BRANCHES.CENTRAL, label: 'Central Shop' },
                { value: BRANCHES.KAMWENE, label: 'Kamwene Shop' }
              ]}
              placeholder="Select Branch"
            />
          )}
        <Button onClick={() => setIsModalOpen(true)}>Add Customer</Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 md:gap-3">
        <Card className="p-3 md:p-4">
          <h3 className="text-xs font-medium text-gray-600 dark:text-gray-400">Total Customers</h3>
          <p className="text-xl md:text-2xl font-bold text-[#4A90A4] mt-1">{totalCustomers}</p>
          </Card>
        <Card className="p-3 md:p-4">
          <h3 className="text-xs font-medium text-gray-600 dark:text-gray-400">Total Revenue</h3>
          <p className="text-xl md:text-2xl font-bold text-green-600 mt-1">KSH {totalRevenue.toLocaleString()}</p>
          </Card>
        <Card className="p-3 md:p-4">
          <h3 className="text-xs font-medium text-gray-600 dark:text-gray-400">Total Orders</h3>
          <p className="text-xl md:text-2xl font-bold text-blue-600 mt-1">{totalOrders}</p>
          </Card>
      </div>

      <Card className="p-6">
        {loading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 bg-gray-200 dark:bg-gray-700 animate-pulse rounded"></div>
            ))}
          </div>
        ) : customers.length === 0 ? (
          <div className="py-8 text-center">
            <ShoppingBag className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <p className="text-gray-600 dark:text-gray-400 font-medium">No customers found</p>
            <p className="text-xs md:text-sm text-gray-500 dark:text-gray-500 mt-1">
              Add a customer to get started.
            </p>
          </div>
        ) : (
          <>
            <div className="mb-4">
              <FormInput
                name="search"
                type="text"
                placeholder="Search customers..."
                value={searchTerm}
                onChange={handleSearch}
                className="w-full md:w-1/2"
              />
            </div>
            <Table
              columns={[
                { header: 'Name', accessor: 'name' },
                { header: 'Email', accessor: 'email' },
                { header: 'Phone', accessor: 'phone' },
                { 
                  header: 'Orders', 
                  accessor: 'totalPurchases',
                  render: (row: Customer) => (
                    <div className="flex items-center space-x-2">
                      <ShoppingBag className="w-4 h-4 text-gray-500" />
                      <span>{row.totalPurchases || 0}</span>
                    </div>
                  )
                },
                { 
                  header: 'Total Spent', 
                  accessor: 'totalSpent',
                  render: (row: Customer) => (
                    <div className="flex items-center space-x-2">
                      <DollarSign className="w-4 h-4 text-green-600" />
                      <span className="font-semibold text-green-600">KSH {(row.totalSpent || 0).toLocaleString()}</span>
                    </div>
                  )
                },
                { header: 'Loyalty Points', accessor: 'loyaltyPoints' },
                {
                  header: 'Actions',
                  accessor: 'actions',
                  render: (row: Customer) => (
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleViewPurchaseHistory(row)}
                        className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                        title="View Purchase History"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleEdit(row)}
                        className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(row.id!)}
                        className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                      >
                        Delete
                      </button>
                    </div>
                  ),
                },
              ]}
              data={filteredCustomers}
            />
          </>
        )}
      </Card>

      {/* Purchase History Modal */}
      <Modal open={showPurchaseHistoryModal} onClose={() => setShowPurchaseHistoryModal(false)} title={`Purchase History - ${selectedCustomer?.name}`} size="lg">
        <div className="p-6">
          <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Orders</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{customerOrders.length}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Spent</p>
                <p className="text-2xl font-bold text-green-600">
                  KSH {customerOrders.reduce((sum, order) => sum + (order.total || 0), 0).toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          {customerOrders.length > 0 ? (
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {customerOrders.map((order) => (
                <Card key={order.id} className="p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-white">Order #{order.id?.substring(0, 8)}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {order.createdAt?.toDate ? new Date(order.createdAt.toDate()).toLocaleString() : 'Date not available'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-gray-900 dark:text-white">KSH {order.total?.toLocaleString() || '0'}</p>
                      <span className={`px-2 py-1 rounded text-xs ${
                        order.status === 'completed' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                        order.status === 'pending' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                        'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                      }`}>
                        {order.status}
                      </span>
                    </div>
                  </div>
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Items:</p>
                    <div className="space-y-1">
                      {order.items?.map((item, idx) => (
                        <div key={idx} className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                          <span>{item.name || `Product ${item.productId}`} x {item.quantity}</span>
                          <span>KSH {(item.quantity * item.price).toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                    {order.paymentMethod && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                        Payment: {order.paymentMethod}
                      </p>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <ShoppingBag className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400">No purchase history found for this customer</p>
            </div>
          )}
        </div>
      </Modal>

      <Modal
        open={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingCustomer(null);
          setFormData({ name: '', email: '', phone: '', loyaltyPoints: 0, avatar: '' });
        }}
        title={editingCustomer ? 'Edit Customer' : 'Add Customer'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Avatar</label>
            <input 
              type="file" 
              onChange={handleImageUpload} 
              className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-blue-900 dark:file:text-blue-100" 
            />
            {formData.avatar && (
              <img src={formData.avatar} alt="Avatar" className="w-20 h-20 rounded-full mt-2 object-cover" />
            )}
          </div>
          <FormInput
            label="Name"
            name="name"
            type="text"
            value={formData.name}
            onChange={handleInputChange}
            required
          />
          <FormInput
            label="Email"
            name="email"
            type="email"
            value={formData.email}
            onChange={handleInputChange}
          />
          <FormInput
            label="Phone"
            name="phone"
            type="tel"
            value={formData.phone}
            onChange={handleInputChange}
          />
          <FormInput
            label="Loyalty Points"
            name="loyaltyPoints"
            type="number"
            value={formData.loyaltyPoints.toString()}
            onChange={handleInputChange}
          />
          <div className="flex justify-end space-x-2 pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setIsModalOpen(false);
                setEditingCustomer(null);
                setFormData({ name: '', email: '', phone: '', loyaltyPoints: 0, avatar: '' });
              }}
            >
              Cancel
            </Button>
            <Button type="submit">{editingCustomer ? 'Update' : 'Add'} Customer</Button>
          </div>
        </form>
      </Modal>

      <ConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={confirmDeleteCustomer}
        title="Delete Customer"
        message="Are you sure you want to delete this customer? This action cannot be undone."
        type="danger"
        confirmText="Delete"
        cancelText="Cancel"
      />
    </div>
  );
};

export default Customers;
