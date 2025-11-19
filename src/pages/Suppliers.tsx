import React, { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc, query, orderBy, where, Timestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Supplier } from '../types';
import Card from '../components/UI/Card';
import Button from '../components/UI/Button';
import FormInput from '../components/UI/FormInput';
import Table from '../components/UI/Table';
import Select from '../components/UI/Select';
import Modal from '../components/Modal';
import ConfirmationModal from '../components/UI/ConfirmationModal';
import { toast } from 'react-hot-toast';

const Suppliers: React.FC = () => {
  const { currentUser } = useAuth();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [supplierToDelete, setSupplierToDelete] = useState<string | null>(null);
  const [editingSupplier, setEditingSupplier] = useState<Partial<Supplier>>({
    name: '',
    email: '',
    phone: '',
    address: '',
    contactPerson: '',
    status: 'active'
  });

  useEffect(() => {
    if (currentUser?.shopId) {
      fetchSuppliers();
    }
  }, [currentUser?.shopId]);

  const fetchSuppliers = async () => {
    if (!currentUser?.shopId) return;
    
    try {
      const q = query(
        collection(db, `shops/${currentUser.shopId}/suppliers`),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(q);
      const suppliersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date()
      })) as Supplier[];
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

      await addDoc(collection(db, `shops/${currentUser.shopId}/suppliers`), supplierData);
      
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
      const supplierRef = doc(db, `shops/${currentUser.shopId}/suppliers`, selectedSupplier.id);
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

  const handleDeleteSupplier = (supplierId: string) => {
    setSupplierToDelete(supplierId);
    setShowDeleteModal(true);
  };

  const confirmDeleteSupplier = async () => {
    if (!currentUser?.shopId || !supplierToDelete) return;

    try {
      await deleteDoc(doc(db, `shops/${currentUser.shopId}/suppliers`, supplierToDelete));
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
      case 'active': return 'bg-green-100 text-green-800';
      case 'inactive': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const totalSuppliers = suppliers.length;
  const activeSuppliers = suppliers.filter(s => s.status === 'active').length;
  const inactiveSuppliers = suppliers.filter(s => s.status === 'inactive').length;

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
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Suppliers</h1>
        <Button onClick={() => setShowCreateModal(true)}>
          Add Supplier
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <div className="p-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">Total Suppliers</h3>
            <p className="text-3xl font-bold text-primary">{totalSuppliers}</p>
          </div>
        </Card>
        <Card>
          <div className="p-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">Active</h3>
            <p className="text-3xl font-bold text-green-600">{activeSuppliers}</p>
          </div>
        </Card>
        <Card>
          <div className="p-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">Inactive</h3>
            <p className="text-3xl font-bold text-red-600">{inactiveSuppliers}</p>
          </div>
        </Card>
      </div>

      <Card>
        <Table
          headers={['Name', 'Contact Person', 'Email', 'Phone', 'Status', 'Actions']}
          data={suppliers.map(supplier => [
            supplier.name,
            supplier.contactPerson || '-',
            supplier.email || '-',
            supplier.phone || '-',
            <span className={`px-2 py-1 rounded-full text-xs ${getStatusColor(supplier.status)} badge-text-dark`}>
              {supplier.status}
            </span>,
            <div className="flex space-x-2">
              <button
                onClick={() => {
                  setSelectedSupplier(supplier);
                  setEditingSupplier(supplier);
                  setShowEditModal(true);
                }}
                className="text-blue-600 hover:text-blue-800"
              >
                Edit
              </button>
              <button
                onClick={() => handleDeleteSupplier(supplier.id)}
                className="text-red-600 hover:text-red-800"
              >
                Delete
              </button>
            </div>
          ])}
        />
      </Card>

      {/* Create Supplier Modal */}
      <Modal open={showCreateModal} onClose={() => setShowCreateModal(false)} title="Add New Supplier">
        <div className="p-6">
          <h2 className="text-xl font-bold mb-4">Add New Supplier</h2>
          
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
            <Button variant="outline" onClick={() => setShowCreateModal(false)}>
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
          <h2 className="text-xl font-bold mb-4">Edit Supplier</h2>
          
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
            <Button variant="outline" onClick={() => setShowEditModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateSupplier}>
              Update Supplier
            </Button>
          </div>
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