import React, { useState, useEffect } from 'react';
import { collection, getDocs, doc, query, orderBy, Timestamp } from 'firebase/firestore';
import { addDoc, updateDoc, deleteDoc } from '../offline/firestoreWrappers';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { getShopCollectionName, BRANCHES, BranchName } from '../config/shopConfig';
import { Supplier } from '../types';
import Card from '../components/UI/Card';
import Button from '../components/UI/Button';
import FormInput from '../components/UI/FormInput';
import Table from '../components/UI/Table';
import Select from '../components/UI/Select';
import Dropdown from '../components/UI/Dropdown';
import Modal from '../components/Modal';
import ConfirmationModal from '../components/UI/ConfirmationModal';
import LoadingSpinner from '../components/UI/LoadingSpinner';
import { Plus, Package, CheckCircle, XCircle, Eye } from 'lucide-react';
import { toast } from 'react-toastify';

interface Supply {
  id?: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  deliveryDate: string;
  expectedDate?: string;
  notes?: string;
  isCleared: boolean;
  createdAt: Date;
}

interface SupplierWithSupplies extends Supplier {
  supplies?: Supply[];
}

const Suppliers: React.FC = () => {
  const { currentUser } = useAuth();
  const [suppliers, setSuppliers] = useState<SupplierWithSupplies[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showSupplyModal, setShowSupplyModal] = useState(false);
  const [showSupplyDetailsModal, setShowSupplyDetailsModal] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<SupplierWithSupplies | null>(null);
  const [selectedSupply, setSelectedSupply] = useState<Supply | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [supplierToDelete, setSupplierToDelete] = useState<string | null>(null);
  const [selectedBranch, setSelectedBranch] = useState<string>('CentralShop');
  const [editingSupplier, setEditingSupplier] = useState<Partial<Supplier>>({
    name: '',
    email: '',
    phone: '',
    address: '',
    contactPerson: '',
    status: 'active'
  });
  const [editingSupply, setEditingSupply] = useState<Partial<Supply>>({
    productName: '',
    quantity: 0,
    unitPrice: 0,
    totalAmount: 0,
    deliveryDate: new Date().toISOString().split('T')[0],
    expectedDate: '',
    notes: '',
    isCleared: false
  });
  const [productNameInput, setProductNameInput] = useState('');
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Determine if user can switch between shops
  const canSwitchBranches =
    (Array.isArray((currentUser as any)?.assignedShops) &&
      new Set(
        ((currentUser as any).assignedShops as string[]).map(s => s.replace(/\s+/g, '').toLowerCase())
      ).size > 1) ||
    currentUser?.role === 'mainAdmin' ||
    currentUser?.role === 'Admin' ||
    currentUser?.role === 'astraronix';
  useEffect(() => {
    if (currentUser?.shopId) {
      fetchSuppliers();
      fetchProducts();
    }
  }, [currentUser?.shopId, selectedBranch]);

  const fetchProducts = async () => {
    if (!currentUser?.shopId) return;
    try {
      const q = query(collection(db, getShopCollectionName('products', selectedBranch as BranchName)), orderBy('name'));
      const snapshot = await getDocs(q);
      const productsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setProducts(productsData);
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

  const fetchSuppliers = async () => {
    if (!currentUser?.shopId) return;
    
    try {
      const suppliersCollectionName = getShopCollectionName('suppliers', selectedBranch as BranchName);
      const q = query(
        collection(db, suppliersCollectionName),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(q);
      const suppliersData = await Promise.all(snapshot.docs.map(async (doc) => {
        const supplierData = {
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate() || new Date(),
          updatedAt: doc.data().updatedAt?.toDate() || new Date()
        } as SupplierWithSupplies;

        // Fetch supplies for this supplier
        try {
          const suppliesCollection = collection(db, `${suppliersCollectionName}/${doc.id}/supplies`);
          // Try to order by deliveryDate, but if it fails, just get all supplies
          let suppliesQuery;
          try {
            suppliesQuery = query(suppliesCollection, orderBy('createdAt', 'desc'));
          } catch {
            suppliesQuery = query(suppliesCollection);
          }
          const suppliesSnapshot = await getDocs(suppliesQuery);
          supplierData.supplies = suppliesSnapshot.docs.map(supplyDoc => ({
            id: supplyDoc.id,
            ...supplyDoc.data(),
            deliveryDate: supplyDoc.data().deliveryDate?.toDate ? supplyDoc.data().deliveryDate.toDate() : (supplyDoc.data().deliveryDate || null),
            expectedDate: supplyDoc.data().expectedDate || '',
            createdAt: supplyDoc.data().createdAt?.toDate() || new Date()
          })) as Supply[];
        } catch (error) {
          console.error('Error fetching supplies:', error);
          supplierData.supplies = [];
        }

        return supplierData;
      }));
      
      setSuppliers(suppliersData);
    } catch (error) {
      console.error('Error fetching suppliers:', error);
      toast.error('Failed to fetch suppliers');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSupplier = async () => {
    if (!currentUser?.shopId || !editingSupplier.name) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      const supplierData = {
        ...editingSupplier,
        shopId: currentUser.shopId,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      };

      await addDoc(collection(db, getShopCollectionName('suppliers', selectedBranch as BranchName)), supplierData);
      
      toast.success('Supplier created successfully');
      setShowCreateModal(false);
      setEditingSupplier({
        name: '',
        email: '',
        phone: '',
        address: '',
        contactPerson: '',
        status: 'active'
      });
      fetchSuppliers();
    } catch (error) {
      console.error('Error creating supplier:', error);
      toast.error('Failed to create supplier');
    }
  };

  const handleUpdateSupplier = async () => {
    if (!currentUser?.shopId || !selectedSupplier) return;

    try {
      const supplierRef = doc(db, getShopCollectionName('suppliers', selectedBranch as BranchName), selectedSupplier.id);
      await updateDoc(supplierRef, {
        ...editingSupplier,
        updatedAt: Timestamp.now()
      });
      
      toast.success('Supplier updated successfully');
      setShowEditModal(false);
      setSelectedSupplier(null);
      fetchSuppliers();
    } catch (error) {
      console.error('Error updating supplier:', error);
      toast.error('Failed to update supplier');
    }
  };

  const handleAddSupply = async () => {
    if (!currentUser?.shopId || !selectedSupplier || !editingSupply.productName || !editingSupply.quantity || !editingSupply.unitPrice) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      const totalAmount = editingSupply.quantity! * editingSupply.unitPrice!;
      const supplyData = {
        ...editingSupply,
        totalAmount,
        deliveryDate: editingSupply.deliveryDate || new Date().toISOString().split('T')[0],
        isCleared: editingSupply.isCleared || false,
        createdAt: Timestamp.now()
      };

      await addDoc(collection(db, `${getShopCollectionName('suppliers', selectedBranch as BranchName)}/${selectedSupplier.id}/supplies`), supplyData);
      
      toast.success('Supply added successfully');
      setShowSupplyModal(false);
      setEditingSupply({
        productName: '',
        quantity: 0,
        unitPrice: 0,
        totalAmount: 0,
        deliveryDate: new Date().toISOString().split('T')[0],
        expectedDate: '',
        notes: '',
        isCleared: false
      });
      setProductNameInput('');
      setShowProductDropdown(false);
      fetchSuppliers();
    } catch (error) {
      console.error('Error adding supply:', error);
      toast.error('Failed to add supply');
    }
  };

  const handleToggleCleared = async (supplierId: string, supplyId: string, currentStatus: boolean) => {
    if (!currentUser?.shopId) return;

    try {
      const supplyRef = doc(db, `${getShopCollectionName('suppliers', selectedBranch as BranchName)}/${supplierId}/supplies`, supplyId);
      await updateDoc(supplyRef, {
        isCleared: !currentStatus,
        updatedAt: Timestamp.now()
      });
      
      toast.success(`Supply marked as ${!currentStatus ? 'cleared' : 'uncleared'}`);
      fetchSuppliers();
    } catch (error) {
      console.error('Error updating supply status:', error);
      toast.error('Failed to update supply status');
    }
  };

  const handleDeleteSupplier = (supplierId: string) => {
    setSupplierToDelete(supplierId);
    setShowDeleteModal(true);
  };

  const confirmDeleteSupplier = async () => {
    if (!currentUser?.shopId || !supplierToDelete) return;

    try {
      await deleteDoc(doc(db, getShopCollectionName('suppliers', selectedBranch as BranchName), supplierToDelete));
      toast.success('Supplier deleted successfully');
      fetchSuppliers();
      setShowDeleteModal(false);
      setSupplierToDelete(null);
    } catch (error) {
      console.error('Error deleting supplier:', error);
      toast.error('Failed to delete supplier');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'inactive': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
  };

  const totalSuppliers = suppliers.length;
  const activeSuppliers = suppliers.filter(s => s.status === 'active').length;
  const inactiveSuppliers = suppliers.filter(s => s.status === 'inactive').length;
  const totalSupplies = suppliers.reduce((sum, s) => sum + (s.supplies?.length || 0), 0);
  const clearedSupplies = suppliers.reduce((sum, s) => sum + (s.supplies?.filter(sp => sp.isCleared).length || 0), 0);
  const unclearedSupplies = totalSupplies - clearedSupplies;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <div className="h-6 md:h-8 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
            <div className="h-4 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mt-2"></div>
          </div>
          <div className="h-10 w-40 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
        </div>
        {/* Loading Skeleton for Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="aspect-square">
              <Card className="p-4 md:p-6 h-full flex flex-col justify-center">
                <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-2"></div>
                <div className="h-8 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
              </Card>
            </div>
          ))}
        </div>
        {/* Loading Skeleton for Table */}
        <Card className="p-6">
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
            ))}
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">Suppliers</h1>
          <p className="text-gray-600 dark:text-gray-300">Manage suppliers and their supplies</p>
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
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Supplier
        </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 md:gap-4">
        <Card className="p-2 md:p-4 hover:shadow-xl transition-all duration-300">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-gray-600 dark:text-gray-400 truncate">Total Suppliers</p>
              <p className="text-lg md:text-2xl font-bold text-gray-900 dark:text-white mt-1">{totalSuppliers}</p>
            </div>
          </div>
        </Card>
        <Card className="p-2 md:p-4 hover:shadow-xl transition-all duration-300">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-gray-600 dark:text-gray-400 truncate">Active</p>
              <p className="text-lg md:text-2xl font-bold text-gray-900 dark:text-white mt-1">{activeSuppliers}</p>
            </div>
          </div>
        </Card>
        <Card className="p-2 md:p-4 hover:shadow-xl transition-all duration-300">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-gray-600 dark:text-gray-400 truncate">Total Supplies</p>
              <p className="text-lg md:text-2xl font-bold text-gray-900 dark:text-white mt-1">{totalSupplies}</p>
            </div>
          </div>
        </Card>
        <Card className="p-2 md:p-4 hover:shadow-xl transition-all duration-300">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-gray-600 dark:text-gray-400 truncate">Uncleared</p>
              <p className="text-lg md:text-2xl font-bold text-gray-900 dark:text-white mt-1">{unclearedSupplies}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Search Bar */}
      <Card className="p-4">
        <FormInput
          label="Search Suppliers and Supplies"
          name="search"
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search by supplier name or product name..."
        />
      </Card>

      {/* Suppliers Grid */}
      {suppliers.length === 0 ? (
        <Card className="p-8 text-center">
          <Package className="w-12 h-12 mx-auto mb-4 text-gray-400" />
          <p className="text-gray-600 dark:text-gray-400 font-medium">No suppliers found</p>
          <p className="text-xs md:text-sm text-gray-500 dark:text-gray-500 mt-1">
            Add a supplier to start tracking supplies.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {suppliers.filter(supplier => {
            if (!searchTerm) return true;
            const searchLower = searchTerm.toLowerCase();
            // Search by supplier name
            const matchesSupplierName = supplier.name.toLowerCase().includes(searchLower);
            // Search by supply/product names
            const matchesSupplyName = supplier.supplies?.some(supply => 
              supply.productName.toLowerCase().includes(searchLower)
            ) || false;
            return matchesSupplierName || matchesSupplyName;
          }).map(supplier => (
            <Card key={supplier.id} className="p-4">
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <h3 className="font-semibold text-gray-900 dark:text-white text-sm md:text-base">{supplier.name}</h3>
                  <span className={`px-2 py-1 rounded-full text-xs shrink-0 ${getStatusColor(supplier.status)}`}>
                    {supplier.status}
                  </span>
                </div>
                
                <div className="space-y-1 text-xs md:text-sm text-gray-600 dark:text-gray-400">
                  {supplier.contactPerson && (
                    <div>
                      <span className="font-medium">Contact:</span> {supplier.contactPerson}
                    </div>
                  )}
                  {supplier.email && (
                    <div className="truncate">
                      <span className="font-medium">Email:</span> {supplier.email}
                    </div>
                  )}
                  {supplier.phone && (
                    <div>
                      <span className="font-medium">Phone:</span> {supplier.phone}
                    </div>
                  )}
                  <div className="flex items-center space-x-2">
                    <span className="font-medium">Supplies:</span>
                    <span className="text-sm">{supplier.supplies?.length || 0}</span>
                    {supplier.supplies && supplier.supplies.length > 0 && (
                      <span className={`text-xs px-2 py-1 rounded ${
                        supplier.supplies.filter(s => !s.isCleared).length > 0 
                          ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' 
                          : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                      }`}>
                        {supplier.supplies.filter(s => !s.isCleared).length} uncleared
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                  <button
                    onClick={() => {
                      setSelectedSupplier(supplier);
                      setShowSupplyDetailsModal(true);
                    }}
                    className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 p-1"
                    title="View Supplies"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      setSelectedSupplier(supplier);
                      setEditingSupply({
                        productName: '',
                        quantity: 0,
                        unitPrice: 0,
                        totalAmount: 0,
                        deliveryDate: new Date().toISOString().split('T')[0],
                        expectedDate: '',
                        notes: '',
                        isCleared: false
                      });
                      setShowSupplyModal(true);
                    }}
                    className="text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300 p-1"
                    title="Add Supply"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      setSelectedSupplier(supplier);
                      setEditingSupplier(supplier);
                      setShowEditModal(true);
                    }}
                    className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-xs px-2 py-1"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteSupplier(supplier.id)}
                    className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 text-xs px-2 py-1"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create Supplier Modal */}
      <Modal open={showCreateModal} onClose={() => setShowCreateModal(false)} title="Add New Supplier">
        <div className="p-6">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <FormInput
              label="Supplier Name *"
              value={editingSupplier.name || ''}
              onChange={(e) => setEditingSupplier(prev => ({ ...prev, name: e.target.value }))}
            />
            <FormInput
              label="Contact Person"
              value={editingSupplier.contactPerson || ''}
              onChange={(e) => setEditingSupplier(prev => ({ ...prev, contactPerson: e.target.value }))}
            />
            <FormInput
              label="Email"
              type="email"
              value={editingSupplier.email || ''}
              onChange={(e) => setEditingSupplier(prev => ({ ...prev, email: e.target.value }))}
            />
            <FormInput
              label="Phone"
              value={editingSupplier.phone || ''}
              onChange={(e) => setEditingSupplier(prev => ({ ...prev, phone: e.target.value }))}
            />
            <div className="col-span-2">
              <FormInput
                label="Address"
                value={editingSupplier.address || ''}
                onChange={(e) => setEditingSupplier(prev => ({ ...prev, address: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
              <Select
                value={editingSupplier.status || 'active'}
                onChange={(v) => setEditingSupplier(prev => ({ ...prev, status: v as any }))}
                options={[
                  { value: 'active', label: 'Active' },
                  { value: 'inactive', label: 'Inactive' },
                ]}
              />
            </div>
          </div>

          <div className="flex justify-end space-x-2">
            <Button variant="secondary" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateSupplier}>
              Create Supplier
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit Supplier Modal */}
      <Modal open={showEditModal} onClose={() => setShowEditModal(false)} title="Edit Supplier">
        <div className="p-6">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <FormInput
              label="Supplier Name *"
              value={editingSupplier.name || ''}
              onChange={(e) => setEditingSupplier(prev => ({ ...prev, name: e.target.value }))}
            />
            <FormInput
              label="Contact Person"
              value={editingSupplier.contactPerson || ''}
              onChange={(e) => setEditingSupplier(prev => ({ ...prev, contactPerson: e.target.value }))}
            />
            <FormInput
              label="Email"
              type="email"
              value={editingSupplier.email || ''}
              onChange={(e) => setEditingSupplier(prev => ({ ...prev, email: e.target.value }))}
            />
            <FormInput
              label="Phone"
              value={editingSupplier.phone || ''}
              onChange={(e) => setEditingSupplier(prev => ({ ...prev, phone: e.target.value }))}
            />
            <div className="col-span-2">
              <FormInput
                label="Address"
                value={editingSupplier.address || ''}
                onChange={(e) => setEditingSupplier(prev => ({ ...prev, address: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
              <Select
                value={editingSupplier.status || 'active'}
                onChange={(v) => setEditingSupplier(prev => ({ ...prev, status: v as any }))}
                options={[
                  { value: 'active', label: 'Active' },
                  { value: 'inactive', label: 'Inactive' },
                ]}
              />
            </div>
          </div>

          <div className="flex justify-end space-x-2">
            <Button variant="secondary" onClick={() => setShowEditModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateSupplier}>
              Update Supplier
            </Button>
          </div>
        </div>
      </Modal>

      {/* Add Supply Modal */}
      <Modal open={showSupplyModal} onClose={() => {
        setShowSupplyModal(false);
        setProductNameInput('');
        setShowProductDropdown(false);
      }} title={`Add Supply - ${selectedSupplier?.name}`} size="lg">
        <div className="p-6">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Product Name *</label>
              <div className="relative">
                <input
                  type="text"
                  value={productNameInput || editingSupply.productName || ''}
                  onChange={(e) => {
                    const value = e.target.value;
                    setProductNameInput(value);
                    setShowProductDropdown(true);
                    setEditingSupply(prev => ({
                      ...prev,
                      productName: value,
                      unitPrice: products.find(p => p.name.toLowerCase() === value.toLowerCase())?.price || prev.unitPrice
                    }));
                  }}
                  onFocus={() => setShowProductDropdown(true)}
                  onBlur={() => setTimeout(() => setShowProductDropdown(false), 200)}
                  placeholder="Type or select product name"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#4A90A4]"
                />
                {showProductDropdown && (
                  <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {products
                      .filter(p => p.name.toLowerCase().includes((productNameInput || editingSupply.productName || '').toLowerCase()))
                      .slice(0, 10)
                      .map(product => (
                        <button
                          key={product.id}
                          type="button"
                          onClick={() => {
                            setProductNameInput(product.name);
                            setEditingSupply(prev => ({
                              ...prev,
                              productName: product.name,
                              unitPrice: product.price || prev.unitPrice
                            }));
                            setShowProductDropdown(false);
                          }}
                          className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-900 dark:text-white"
                        >
                          {product.name}
                        </button>
                      ))}
                    {(productNameInput || editingSupply.productName) && 
                     !products.find(p => p.name.toLowerCase() === (productNameInput || editingSupply.productName || '').toLowerCase()) && (
                      <div className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-600">
                        Press Enter to use "{productNameInput || editingSupply.productName}"
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            <FormInput
              label="Quantity *"
              type="number"
              value={editingSupply.quantity?.toString() || '0'}
              onChange={(e) => {
                const qty = parseFloat(e.target.value) || 0;
                const price = editingSupply.unitPrice || 0;
                setEditingSupply(prev => ({
                  ...prev,
                  quantity: qty,
                  totalAmount: qty * price
                }));
              }}
            />
            <FormInput
              label="Unit Price (KSH) *"
              type="number"
              value={editingSupply.unitPrice?.toString() || '0'}
              onChange={(e) => {
                const price = parseFloat(e.target.value) || 0;
                const qty = editingSupply.quantity || 0;
                setEditingSupply(prev => ({
                  ...prev,
                  unitPrice: price,
                  totalAmount: qty * price
                }));
              }}
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Total Amount</label>
              <div className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-800">
                <p className="text-lg font-semibold text-gray-900 dark:text-white">
                  KSH {editingSupply.totalAmount?.toLocaleString() || '0'}
                </p>
              </div>
            </div>
            <FormInput
              label="Delivery Date *"
              type="date"
              value={editingSupply.deliveryDate || ''}
              onChange={(e) => setEditingSupply(prev => ({ ...prev, deliveryDate: e.target.value }))}
            />
            <FormInput
              label="Expected Date"
              type="date"
              value={editingSupply.expectedDate || ''}
              onChange={(e) => setEditingSupply(prev => ({ ...prev, expectedDate: e.target.value }))}
            />
            <div className="col-span-2">
              <FormInput
                label="Notes"
                value={editingSupply.notes || ''}
                onChange={(e) => setEditingSupply(prev => ({ ...prev, notes: e.target.value }))}
              />
            </div>
            <div className="col-span-2">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={editingSupply.isCleared || false}
                  onChange={(e) => setEditingSupply(prev => ({ ...prev, isCleared: e.target.checked }))}
                  className="rounded border-gray-300 text-[#4A90A4] focus:ring-[#4A90A4]"
                />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Mark as Cleared</span>
              </label>
            </div>
          </div>

          <div className="flex justify-end space-x-2">
            <Button variant="secondary" onClick={() => setShowSupplyModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddSupply}>
              Add Supply
            </Button>
          </div>
        </div>
      </Modal>

      {/* Supply Details Modal */}
      <Modal open={showSupplyDetailsModal} onClose={() => setShowSupplyDetailsModal(false)} title={`Supplies - ${selectedSupplier?.name}`} size="lg">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">All Supplies</h3>
            <Button
              onClick={() => {
                setShowSupplyDetailsModal(false);
                setShowSupplyModal(true);
              }}
              size="sm"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Supply
            </Button>
          </div>

          {selectedSupplier?.supplies && selectedSupplier.supplies.length > 0 ? (
            <div className="space-y-4">
              {selectedSupplier.supplies.map((supply) => (
                <Card key={supply.id} className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h4 className="font-semibold text-gray-900 dark:text-white">{supply.productName}</h4>
                        <button
                          onClick={() => handleToggleCleared(selectedSupplier.id, supply.id!, supply.isCleared)}
                          className={`p-1 rounded ${
                            supply.isCleared
                              ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                              : 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300'
                          }`}
                          title={supply.isCleared ? 'Mark as Uncleared' : 'Mark as Cleared'}
                        >
                          {supply.isCleared ? (
                            <CheckCircle className="w-5 h-5" />
                          ) : (
                            <XCircle className="w-5 h-5" />
                          )}
                        </button>
                        <span className={`px-2 py-1 rounded text-xs ${
                          supply.isCleared
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                            : 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
                        }`}>
                          {supply.isCleared ? 'Cleared' : 'Uncleared'}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm text-gray-600 dark:text-gray-400">
                        <div>
                          <span className="font-medium">Quantity:</span> {supply.quantity}
                        </div>
                        <div>
                          <span className="font-medium">Unit Price:</span> KSH {supply.unitPrice.toLocaleString()}
                        </div>
                        <div>
                          <span className="font-medium">Total:</span> KSH {supply.totalAmount.toLocaleString()}
                        </div>
                        <div>
                          <span className="font-medium">Delivery Date:</span> {new Date(supply.deliveryDate).toLocaleDateString()}
                        </div>
                        {supply.expectedDate && (
                          <div>
                            <span className="font-medium">Expected Date:</span> {new Date(supply.expectedDate).toLocaleDateString()}
                          </div>
                        )}
                        {supply.notes && (
                          <div className="col-span-2">
                            <span className="font-medium">Notes:</span> {supply.notes}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400">No supplies recorded for this supplier</p>
              <Button
                onClick={() => {
                  setShowSupplyDetailsModal(false);
                  setShowSupplyModal(true);
                }}
                className="mt-4"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add First Supply
              </Button>
            </div>
          )}
        </div>
      </Modal>

      <ConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={confirmDeleteSupplier}
        title="Delete Supplier"
        message="Are you sure you want to delete this supplier? This action cannot be undone."
        type="danger"
        confirmText="Delete"
        cancelText="Cancel"
      />
    </div>
  );
};

export default Suppliers;
