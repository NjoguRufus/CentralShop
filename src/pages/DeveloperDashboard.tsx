import React, { useState, useEffect } from 'react';
import { collection, getDocs, doc, query, orderBy, where } from 'firebase/firestore';
import { addDoc, updateDoc, deleteDoc } from '../offline/firestoreWrappers';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { db, auth } from '../firebase';
import { createShopCollections } from '../utils/shopDataManager';
import { getUserCollectionName } from '../config/shopConfig';
import Card from '../components/UI/Card';
import Modal from '../components/Modal';
import FormInput from '../components/UI/FormInput';
import Button from '../components/UI/Button';
import ConfirmationModal from '../components/UI/ConfirmationModal';
import Dropdown from '../components/UI/Dropdown';
import { toast } from 'react-toastify';
import { Shop } from '../types';
import { 
  Building2, 
  Plus, 
  Users, 
  Edit, 
  Trash2, 
  Search,
  Filter,
  TrendingUp,
  Activity,
  Mail,
  Phone,
  MapPin,
  Calendar,
  CheckCircle2,
  XCircle,
  AlertCircle,
  MoreVertical,
  Eye,
  Settings,
  Sparkles,
  BarChart3,
  Clock,
  Globe
} from 'lucide-react';
import { format } from 'date-fns';

interface ShopStats {
  totalShops: number;
  activeShops: number;
  inactiveShops: number;
  suspendedShops: number;
  totalAdmins: number;
}

const DeveloperDashboard: React.FC = () => {
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'Active' | 'Inactive' | 'Suspended'>('all');
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingShop, setEditingShop] = useState<Shop | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [shopToDelete, setShopToDelete] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedShop, setSelectedShop] = useState<Shop | null>(null);
  const [showShopDetails, setShowShopDetails] = useState(false);
  const [stats, setStats] = useState<ShopStats>({
    totalShops: 0,
    activeShops: 0,
    inactiveShops: 0,
    suspendedShops: 0,
    totalAdmins: 0
  });
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

  useEffect(() => {
    calculateStats();
  }, [shops]);

  const calculateStats = () => {
    const totalShops = shops.length;
    const activeShops = shops.filter(s => s.status === 'Active').length;
    const inactiveShops = shops.filter(s => s.status === 'Inactive').length;
    const suspendedShops = shops.filter(s => s.status === 'Suspended').length;
    const totalAdmins = shops.length;

    setStats({
      totalShops,
      activeShops,
      inactiveShops,
      suspendedShops,
      totalAdmins
    });
  };

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

  const filteredShops = shops.filter(shop => {
    const matchesSearch = 
    shop.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    shop.mainAdminName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      shop.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      shop.mainAdminEmail.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || shop.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    try {
      if (editingShop && editingShop.id) {
        const { mainAdminName, mainAdminEmail, mainAdminPassword, ...shopData } = formData;
        await updateDoc(doc(db, 'shops', editingShop.id), {
          ...shopData,
          updatedAt: new Date()
        });
        toast.success('Shop updated successfully');
      } else {
        if (!formData.mainAdminPassword) {
          toast.error('Main admin password is required');
          return;
        }

        const userCredential = await createUserWithEmailAndPassword(
          auth, 
          formData.mainAdminEmail, 
          formData.mainAdminPassword
        );
        
        await updateProfile(userCredential.user, {
          displayName: formData.mainAdminName
        });

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

        const userCollectionName = getUserCollectionName(shopDoc.id, formData.name);
        
        await addDoc(collection(db, userCollectionName), {
          name: formData.mainAdminName,
          email: formData.mainAdminEmail,
          role: 'mainAdmin',
          status: 'Active',
          uid: userCredential.user.uid,
          shopId: shopDoc.id,
          shopName: formData.name,
          createdAt: new Date(),
          updatedAt: new Date()
        });
        
        toast.success('Shop and Main admin created successfully');
      }
      
      setIsModalOpen(false);
      setEditingShop(null);
      resetForm();
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

  const resetForm = () => {
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

  const handleViewDetails = (shop: Shop): void => {
    setSelectedShop(shop);
    setShowShopDetails(true);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>): void => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'taxRate' ? parseFloat(value) || 0 : value
    }));
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Active': return <CheckCircle2 className="w-4 h-4" />;
      case 'Inactive': return <XCircle className="w-4 h-4" />;
      case 'Suspended': return <AlertCircle className="w-4 h-4" />;
      default: return <AlertCircle className="w-4 h-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Active': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 border-green-200 dark:border-green-800';
      case 'Inactive': return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300 border-gray-200 dark:border-gray-700';
      case 'Suspended': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 border-red-200 dark:border-red-800';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
    }
  };

  const getStatCardColor = (index: number) => {
    const colors = [
      'bg-blue-500/10 dark:bg-blue-500/20 border-blue-200 dark:border-blue-800',
      'bg-green-500/10 dark:bg-green-500/20 border-green-200 dark:border-green-800',
      'bg-gray-500/10 dark:bg-gray-500/20 border-gray-200 dark:border-gray-700',
      'bg-red-500/10 dark:bg-red-500/20 border-red-200 dark:border-red-800',
      'bg-purple-500/10 dark:bg-purple-500/20 border-purple-200 dark:border-purple-800'
    ];
    return colors[index % colors.length];
  };

  const getStatIconColor = (index: number) => {
    const colors = [
      'text-blue-600 dark:text-blue-400',
      'text-green-600 dark:text-green-400',
      'text-gray-600 dark:text-gray-400',
      'text-red-600 dark:text-red-400',
      'text-purple-600 dark:text-purple-400'
    ];
    return colors[index % colors.length];
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6 animate-fadeIn">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-3 rounded-xl bg-blue-500/20 backdrop-blur-sm border border-blue-500/30 shadow-lg">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
        <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Shop Management
          </h1>
                <p className="text-gray-600 dark:text-gray-400 mt-1">
                  Manage shops, admins, and system configuration
                </p>
              </div>
            </div>
        </div>
          <Button 
            onClick={() => {
              setEditingShop(null);
              resetForm();
              setIsModalOpen(true);
            }} 
            className="flex items-center gap-2 shadow-lg hover:shadow-xl transition-all bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Plus className="w-4 h-4" />
          Create New Shop
        </Button>
      </div>

      {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {[
            { label: 'Total Shops', value: stats.totalShops, icon: Building2 },
            { label: 'Active Shops', value: stats.activeShops, icon: Activity },
            { label: 'Inactive', value: stats.inactiveShops, icon: XCircle },
            { label: 'Suspended', value: stats.suspendedShops, icon: AlertCircle },
            { label: 'Total Admins', value: stats.totalAdmins, icon: Users }
          ].map((stat, index) => (
            <Card 
              key={stat.label}
              className={`p-4 ${getStatCardColor(index)} backdrop-blur-sm hover:shadow-lg transition-all`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                    {stat.label}
                  </p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {stat.value}
                  </p>
            </div>
                <div className={`p-2 rounded-lg bg-white/50 dark:bg-gray-800/50 ${getStatIconColor(index)}`}>
                  <stat.icon className="w-6 h-6" />
            </div>
          </div>
        </Card>
          ))}
      </div>

        {/* Filters and Search */}
        <Card className="p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
          <div className="flex flex-col md:flex-row gap-4 items-center">
            <div className="flex-1 w-full md:w-auto">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <FormInput
            name="search"
            type="text"
                  placeholder="Search shops, admins, or emails..."
            value={searchTerm}
            onChange={handleSearch}
                  className="pl-10 w-full bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600"
                />
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-400" />
              <Dropdown
                value={statusFilter}
                onChange={(value) => setStatusFilter(value as typeof statusFilter)}
                options={[
                  { value: 'all', label: 'All Status' },
                  { value: 'Active', label: 'Active' },
                  { value: 'Inactive', label: 'Inactive' },
                  { value: 'Suspended', label: 'Suspended' }
                ]}
                className="min-w-[150px] bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600"
          />
        </div>

            <div className="flex items-center gap-1 border-l border-gray-200 dark:border-gray-700 pl-4">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-lg transition-colors ${
                  viewMode === 'grid'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
                title="Grid View"
              >
                <Building2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-lg transition-colors ${
                  viewMode === 'list'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
                title="List View"
              >
                <BarChart3 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </Card>

        {/* Shops Display */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="p-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                <div className="animate-pulse space-y-4">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3"></div>
                </div>
              </Card>
            ))}
          </div>
        ) : filteredShops.length === 0 ? (
          <Card className="p-12 text-center bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
            <Building2 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No shops found</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {searchTerm || statusFilter !== 'all' 
                ? 'Try adjusting your search or filters'
                : 'Get started by creating your first shop'}
            </p>
            {!searchTerm && statusFilter === 'all' && (
              <Button 
                onClick={() => setIsModalOpen(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create First Shop
              </Button>
            )}
          </Card>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredShops.map((shop) => (
              <Card 
                key={shop.id} 
                className="p-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-all duration-300 group cursor-pointer hover:border-blue-300 dark:hover:border-blue-700"
                onClick={() => handleViewDetails(shop)}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30 group-hover:scale-105 transition-transform">
                      <Building2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        {shop.name}
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-1">
                        {shop.description || 'No description'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <Users className="w-4 h-4" />
                    <span>{shop.mainAdminName}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <Mail className="w-4 h-4" />
                    <span className="truncate">{shop.email}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <Phone className="w-4 h-4" />
                    <span>{shop.phone}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {format(shop.createdAt, 'MMM dd, yyyy')}
                    </span>
                  </div>
                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(shop.status)}`}>
                    {getStatusIcon(shop.status)}
                    {shop.status}
                  </span>
                </div>

                <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEdit(shop);
                    }}
                    className="flex-1 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    <Edit className="w-4 h-4 mr-1" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleViewDetails(shop);
                    }}
                    className="flex-1 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    <Eye className="w-4 h-4 mr-1" />
                    View
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(shop.id);
                    }}
                    className="border-gray-300 dark:border-gray-600 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="p-0 overflow-hidden bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-600">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Shop</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Admin</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Contact</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Created</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredShops.map((shop) => (
                    <tr key={shop.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                            <Building2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                          </div>
                          <div>
                            <div className="font-medium text-gray-900 dark:text-white">{shop.name}</div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">{shop.description || 'No description'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <div className="font-medium text-gray-900 dark:text-white">{shop.mainAdminName}</div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">{shop.mainAdminEmail}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          <div className="text-sm text-gray-900 dark:text-white flex items-center gap-2">
                            <Mail className="w-4 h-4 text-gray-400" />
                            {shop.email}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
                            <Phone className="w-4 h-4 text-gray-400" />
                            {shop.phone}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(shop.status)}`}>
                          {getStatusIcon(shop.status)}
                          {shop.status}
                  </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900 dark:text-white">
                          {format(shop.createdAt, 'MMM dd, yyyy')}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {format(shop.createdAt, 'hh:mm a')}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleViewDetails(shop)}
                            className="p-2 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                            title="View Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                    <button
                            onClick={() => handleEdit(shop)}
                            className="p-2 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                      title="Edit Shop"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                            onClick={() => handleDelete(shop.id)}
                            className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                      title="Delete Shop"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* Shop Details Modal */}
        <Modal
          open={showShopDetails}
          onClose={() => {
            setShowShopDetails(false);
            setSelectedShop(null);
          }}
          title="Shop Details"
          size="lg"
        >
          {selectedShop && (
            <div className="space-y-6">
              <div className="flex items-center gap-4 pb-4 border-b border-gray-200 dark:border-gray-700">
                <div className="p-3 rounded-xl bg-blue-100 dark:bg-blue-900/30">
                  <Building2 className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">{selectedShop.name}</h3>
                  <p className="text-gray-600 dark:text-gray-400">{selectedShop.description || 'No description'}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Main Administrator
                  </h4>
                  <div className="space-y-2">
                    <p className="text-gray-900 dark:text-white font-medium">{selectedShop.mainAdminName}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{selectedShop.mainAdminEmail}</p>
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    Contact Information
                  </h4>
                  <div className="space-y-2">
                    <p className="text-sm text-gray-900 dark:text-white">{selectedShop.email}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{selectedShop.phone}</p>
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    Address
                  </h4>
                  <p className="text-sm text-gray-900 dark:text-white">{selectedShop.address}</p>
                </div>

                <div>
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                    <Settings className="w-4 h-4" />
                    Settings
                  </h4>
                  <div className="space-y-2">
                    <p className="text-sm text-gray-900 dark:text-white">
                      Currency: <span className="font-medium">{selectedShop.settings.currency}</span>
                    </p>
                    <p className="text-sm text-gray-900 dark:text-white">
                      Tax Rate: <span className="font-medium">{(selectedShop.settings.taxRate * 100).toFixed(1)}%</span>
                    </p>
                    <p className="text-sm text-gray-900 dark:text-white flex items-center gap-2">
                      <Globe className="w-4 h-4" />
                      <span className="font-medium">{selectedShop.settings.timezone}</span>
                    </p>
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                    <Activity className="w-4 h-4" />
                    Status
                  </h4>
                  <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(selectedShop.status)}`}>
                    {getStatusIcon(selectedShop.status)}
                    {selectedShop.status}
                  </span>
                </div>

                <div>
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Dates
                  </h4>
                  <div className="space-y-2">
                    <p className="text-sm text-gray-900 dark:text-white">
                      Created: <span className="font-medium">{format(selectedShop.createdAt, 'MMM dd, yyyy hh:mm a')}</span>
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Updated: <span className="font-medium">{format(selectedShop.updatedAt, 'MMM dd, yyyy hh:mm a')}</span>
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowShopDetails(false);
                    handleEdit(selectedShop);
                  }}
                  className="border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300"
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Edit Shop
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowShopDetails(false);
                    setSelectedShop(null);
                  }}
                  className="border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300"
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </Modal>

      {/* Create/Edit Shop Modal */}
      <Modal
        open={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingShop(null);
            resetForm();
        }}
        title={editingShop ? 'Edit Shop' : 'Create New Shop'}
        size="lg"
      >
          <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormInput
              label="Shop Name"
              name="name"
              type="text"
              value={formData.name}
              onChange={handleInputChange}
              required
                placeholder="Enter shop name"
                className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
            />
            <FormInput
              label="Shop Email"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleInputChange}
              required
                placeholder="shop@example.com"
                className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
            />
          </div>
          
          <FormInput
            label="Description"
            name="description"
            type="text"
            value={formData.description}
            onChange={handleInputChange}
            placeholder="Brief description of the shop"
              className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
          />
          
          <FormInput
            label="Address"
            name="address"
            type="text"
            value={formData.address}
            onChange={handleInputChange}
            required
              placeholder="Full address"
              className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
          />
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormInput
              label="Phone"
              name="phone"
              type="tel"
              value={formData.phone}
              onChange={handleInputChange}
              required
                placeholder="+1234567890"
                className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
            />
            <FormInput
              label="Currency"
              name="currency"
              type="text"
              value={formData.currency}
              onChange={handleInputChange}
              required
                placeholder="USD"
                className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
            />
          </div>

            <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                Main Administrator
              </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormInput
                label="Admin Name"
                name="mainAdminName"
                type="text"
                value={formData.mainAdminName}
                onChange={handleInputChange}
                required
                  placeholder="Admin full name"
                  className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
              />
              <FormInput
                label="Admin Email"
                name="mainAdminEmail"
                type="email"
                value={formData.mainAdminEmail}
                onChange={handleInputChange}
                required
                  placeholder="admin@example.com"
                  className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
              />
            </div>
            {!editingShop && (
              <FormInput
                label="Admin Password"
                name="mainAdminPassword"
                type="password"
                value={formData.mainAdminPassword}
                onChange={handleInputChange}
                  required={!editingShop}
                placeholder="Minimum 6 characters"
                  className="mt-4 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
              />
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Tax Rate
                </label>
              <input
                name="taxRate"
                type="number"
                step="0.01"
                min="0"
                max="1"
                value={formData.taxRate}
                onChange={handleInputChange}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-800 dark:text-white px-3 py-2"
                required
              />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Enter as decimal (e.g., 0.1 for 10%)
                </p>
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Timezone
                </label>
              <Dropdown
                value={formData.timezone}
                  onChange={(value) => handleInputChange({ target: { name: 'timezone', value } } as any)}
                options={[
                  { value: 'UTC', label: 'UTC' },
                    { value: 'America/New_York', label: 'Eastern Time (ET)' },
                    { value: 'America/Chicago', label: 'Central Time (CT)' },
                    { value: 'America/Denver', label: 'Mountain Time (MT)' },
                    { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
                    { value: 'Europe/London', label: 'London (GMT)' },
                    { value: 'Europe/Paris', label: 'Paris (CET)' },
                    { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
                    { value: 'Asia/Dubai', label: 'Dubai (GST)' },
                    { value: 'Africa/Nairobi', label: 'Nairobi (EAT)' }
                ]}
                placeholder="Select timezone"
                  className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
              />
            </div>
          </div>

            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button
              type="button"
                variant="outline"
              onClick={() => {
                setIsModalOpen(false);
                setEditingShop(null);
                  resetForm();
                }}
                className="border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300"
            >
              Cancel
            </Button>
              <Button 
                type="submit"
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
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
          message="Are you sure you want to delete this shop? This will also delete all associated data including products, orders, customers, and employees. This action cannot be undone."
        type="danger"
          confirmText="Delete Shop"
        cancelText="Cancel"
      />
      </div>
    </div>
  );
};

export default DeveloperDashboard;
