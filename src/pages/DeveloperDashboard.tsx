import React, { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy } from 'firebase/firestore';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { db, auth } from '../firebase';
import { createShopCollections, getShopCollectionPath } from '../utils/shopDataManager';
import Card from '../components/UI/Card';
import Table from '../components/UI/Table';
import Modal from '../components/Modal';
import FormInput from '../components/UI/FormInput';
import Button from '../components/UI/Button';
import ConfirmationModal from '../components/UI/ConfirmationModal';
import Dropdown from '../components/UI/Dropdown';
import { toast } from 'react-toastify';
import { Shop } from '../types';
import { Building2, Plus, Users, Eye, Edit, Trash2, Settings } from 'lucide-react';

const DeveloperDashboard: React.FC = () => {
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingShop, setEditingShop] = useState<Shop | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [shopToDelete, setShopToDelete] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    address: '',
    phone: '',
    email: '',
    mainAdminName: '',
    mainAdminEmail: '',
    mainAdminPassword: '',
    currency: 'USD',
    taxRate: 0.1,
    timezone: 'UTC'
  });

  useEffect(() => {
    fetchShops();
  }, []);

  const fetchShops = async (): Promise<void> => {
    try {
      setLoading(true);
      const q = query(collection(db, 'shops'), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      const shopsData: Shop[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        shopsData.push({ 
          id: doc.id, 
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date()
        } as Shop);
      });
      setShops(shopsData);
    } catch (error) {
      toast.error('Failed to fetch shops');
      console.error('Error fetching shops:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>): void => {
    setSearchTerm(e.target.value);
  };

  const filteredShops = shops.filter(shop => 
    shop.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    shop.mainAdminName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    shop.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    try {
      if (editingShop && editingShop.id) {
        // Update existing shop
        const { mainAdminName, mainAdminEmail, mainAdminPassword, ...shopData } = formData;
        await updateDoc(doc(db, 'shops', editingShop.id), {
          ...shopData,
          updatedAt: new Date()
        });
        toast.success('Shop updated successfully');
      } else {
        // Create new shop with mainAdmin
        if (!formData.mainAdminPassword) {
          toast.error('Main admin password is required');
          return;
        }

        // Create Firebase Auth user for mainAdmin
        const userCredential = await createUserWithEmailAndPassword(
          auth, 
          formData.mainAdminEmail, 
          formData.mainAdminPassword
        );
        
        // Update the user's display name
        await updateProfile(userCredential.user, {
          displayName: formData.mainAdminName
        });

        // Create shop document
        const { mainAdminPassword, ...shopData } = formData;
        const shopDoc = await addDoc(collection(db, 'shops'), {
          ...shopData,
          mainAdminId: userCredential.user.uid,
          mainAdminName: formData.mainAdminName,
          mainAdminEmail: formData.mainAdminEmail,
          status: 'Active',
          createdAt: new Date(),
          updatedAt: new Date(),
          settings: {
            currency: formData.currency,
            taxRate: formData.taxRate,
            timezone: formData.timezone,
            theme: {
              primary: '#4A90A4',
              secondary: '#9DC3E6'
            }
          }
        });

        // Create shop-specific collections
        await createShopCollections(shopDoc.id, {
          id: shopDoc.id,
          ...shopData,
          mainAdminId: userCredential.user.uid,
          mainAdminName: formData.mainAdminName,
          mainAdminEmail: formData.mainAdminEmail,
          status: 'Active',
          createdAt: new Date(),
          updatedAt: new Date(),
          settings: {
            currency: formData.currency,
            taxRate: formData.taxRate,
            timezone: formData.timezone,
            theme: {
              primary: '#4A90A4',
              secondary: '#9DC3E6'
            }
          }
        });

        // Create mainAdmin user record in users collection
        await addDoc(collection(db, 'users'), {
          name: formData.mainAdminName,
          email: formData.mainAdminEmail,
          role: 'Admin',
          status: 'Active',
          uid: userCredential.user.uid,
          shopId: shopDoc.id,
          shopName: formData.name,
          createdAt: new Date(),
          updatedAt: new Date()
        });

        // Note: MainAdmin is already created in users collection above
        // Shop-specific employee collections will be used for additional shop data if needed
        
        toast.success('Shop and main admin created successfully');
      }
      
      setIsModalOpen(false);
      setEditingShop(null);
      setFormData({
        name: '',
        description: '',
        address: '',
        phone: '',
        email: '',
        mainAdminName: '',
        mainAdminEmail: '',
        mainAdminPassword: '',
        currency: 'USD',
        taxRate: 0.1,
        timezone: 'UTC'
      });
      fetchShops();
    } catch (error: any) {
      console.error('Error saving shop:', error);
      if (error.code === 'auth/email-already-in-use') {
        toast.error('Main admin email is already in use');
      } else if (error.code === 'auth/weak-password') {
        toast.error('Password should be at least 6 characters');
      } else {
        toast.error('Failed to save shop');
      }
    }
  };

  const handleDelete = (id: string): void => {
    setShopToDelete(id);
    setShowDeleteModal(true);
  };

  const confirmDeleteShop = async (): Promise<void> => {
    if (!shopToDelete) return;

    try {
      await deleteDoc(doc(db, 'shops', shopToDelete));
      toast.success('Shop deleted successfully');
      fetchShops();
      setShowDeleteModal(false);
      setShopToDelete(null);
    } catch (error) {
      toast.error('Failed to delete shop');
      console.error('Error deleting shop:', error);
    }
  };

  const handleEdit = (shop: Shop): void => {
    setEditingShop(shop);
    setFormData({
      name: shop.name,
      description: shop.description || '',
      address: shop.address,
      phone: shop.phone,
      email: shop.email,
      mainAdminName: shop.mainAdminName,
      mainAdminEmail: shop.mainAdminEmail,
      mainAdminPassword: '',
      currency: shop.settings.currency,
      taxRate: shop.settings.taxRate,
      timezone: shop.settings.timezone
    });
    setIsModalOpen(true);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>): void => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'taxRate' ? parseFloat(value) || 0 : value
    }));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Active': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'Inactive': return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
      case 'Suspended': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center">
            <Building2 className="w-8 h-8 mr-3 text-[#4A90A4]" />
            Developer Dashboard
          </h1>
          <p className="text-gray-600 dark:text-gray-300 mt-2">Manage your POS shops and their administrators</p>
        </div>
        <Button onClick={() => setIsModalOpen(true)} className="flex items-center">
          <Plus className="w-4 h-4 mr-2" />
          Create New Shop
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-blue-100 dark:bg-blue-900">
              <Building2 className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Shops</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{shops.length}</p>
            </div>
          </div>
        </Card>
        
        <Card className="p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-green-100 dark:bg-green-900">
              <Users className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Active Shops</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {shops.filter(s => s.status === 'Active').length}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Shops Table */}
      <Card className="p-6">
        <div className="mb-4">
          <FormInput
            name="search"
            type="text"
            placeholder="Search shops..."
            value={searchTerm}
            onChange={handleSearch}
            className="w-full md:w-1/2"
          />
        </div>

        {loading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 bg-gray-200 dark:bg-gray-700 animate-pulse rounded"></div>
            ))}
          </div>
        ) : (
          <Table
            columns={[
              { header: 'Shop Name', accessor: 'name' },
              { header: 'Main Admin', accessor: 'mainAdminName' },
              { header: 'Email', accessor: 'email' },
              { header: 'Phone', accessor: 'phone' },
              { 
                header: 'Status', 
                accessor: 'status',
                render: (row: Shop) => (
                  <span className={`px-2 py-1 rounded-full text-xs ${getStatusColor(row.status)}`}>
                    {row.status}
                  </span>
                )
              },
              { header: 'Created', accessor: 'createdAt', render: (row: Shop) => row.createdAt.toLocaleDateString() },
              {
                header: 'Actions',
                accessor: 'actions',
                render: (row: Shop) => (
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleEdit(row)}
                      className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                      title="Edit Shop"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(row.id)}
                      className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                      title="Delete Shop"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ),
              },
            ]}
            data={filteredShops}
          />
        )}
      </Card>

      {/* Create/Edit Shop Modal */}
      <Modal
        open={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingShop(null);
          setFormData({
            name: '',
            description: '',
            address: '',
            phone: '',
            email: '',
            mainAdminName: '',
            mainAdminEmail: '',
            mainAdminPassword: '',
            currency: 'USD',
            taxRate: 0.1,
            timezone: 'UTC'
          });
        }}
        title={editingShop ? 'Edit Shop' : 'Create New Shop'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormInput
              label="Shop Name"
              name="name"
              type="text"
              value={formData.name}
              onChange={handleInputChange}
              required
            />
            <FormInput
              label="Shop Email"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleInputChange}
              required
            />
          </div>
          
          <FormInput
            label="Description"
            name="description"
            type="text"
            value={formData.description}
            onChange={handleInputChange}
            placeholder="Brief description of the shop"
          />
          
          <FormInput
            label="Address"
            name="address"
            type="text"
            value={formData.address}
            onChange={handleInputChange}
            required
          />
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormInput
              label="Phone"
              name="phone"
              type="tel"
              value={formData.phone}
              onChange={handleInputChange}
              required
            />
            <FormInput
              label="Currency"
              name="currency"
              type="text"
              value={formData.currency}
              onChange={handleInputChange}
              required
            />
          </div>

          <div className="border-t pt-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Main Administrator</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormInput
                label="Admin Name"
                name="mainAdminName"
                type="text"
                value={formData.mainAdminName}
                onChange={handleInputChange}
                required
              />
              <FormInput
                label="Admin Email"
                name="mainAdminEmail"
                type="email"
                value={formData.mainAdminEmail}
                onChange={handleInputChange}
                required
              />
            </div>
            {!editingShop && (
              <FormInput
                label="Admin Password"
                name="mainAdminPassword"
                type="password"
                value={formData.mainAdminPassword}
                onChange={handleInputChange}
                required
                placeholder="Minimum 6 characters"
              />
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tax Rate</label>
              <input
                name="taxRate"
                type="number"
                step="0.01"
                min="0"
                max="1"
                value={formData.taxRate}
                onChange={handleInputChange}
                className="w-full rounded-lg border-gray-300 focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Timezone</label>
              <Dropdown
                value={formData.timezone}
                onChange={(value) => handleInputChange({ target: { name: 'timezone', value } })}
                options={[
                  { value: 'UTC', label: 'UTC' },
                  { value: 'America/New_York', label: 'Eastern Time' },
                  { value: 'America/Chicago', label: 'Central Time' },
                  { value: 'America/Denver', label: 'Mountain Time' },
                  { value: 'America/Los_Angeles', label: 'Pacific Time' },
                  { value: 'Europe/London', label: 'London' },
                  { value: 'Europe/Paris', label: 'Paris' },
                  { value: 'Asia/Tokyo', label: 'Tokyo' }
                ]}
                placeholder="Select timezone"
              />
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setIsModalOpen(false);
                setEditingShop(null);
                setFormData({
                  name: '',
                  description: '',
                  address: '',
                  phone: '',
                  email: '',
                  mainAdminName: '',
                  mainAdminEmail: '',
                  mainAdminPassword: '',
                  currency: 'USD',
                  taxRate: 0.1,
                  timezone: 'UTC'
                });
              }}
            >
              Cancel
            </Button>
            <Button type="submit">
              {editingShop ? 'Update Shop' : 'Create Shop'}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={confirmDeleteShop}
        title="Delete Shop"
        message="Are you sure you want to delete this shop? This will also delete all associated data. This action cannot be undone."
        type="danger"
        confirmText="Delete"
        cancelText="Cancel"
      />
    </div>
  );
};

export default DeveloperDashboard;
