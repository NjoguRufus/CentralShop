import React, { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc, query, orderBy, where, Timestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Service } from '../types';
import Card from '../components/UI/Card';
import Button from '../components/UI/Button';
import FormInput from '../components/UI/FormInput';
import Table from '../components/UI/Table';
import Select from '../components/UI/Select';
import Modal from '../components/Modal';
import ConfirmationModal from '../components/UI/ConfirmationModal';
import { toast } from 'react-hot-toast';

const Services: React.FC = () => {
  const { currentUser } = useAuth();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [serviceToDelete, setServiceToDelete] = useState<string | null>(null);
  const [editingService, setEditingService] = useState<Partial<Service>>({
    name: '',
    description: '',
    price: 0,
    duration: 0,
    category: '',
    isActive: true
  });

  const serviceCategories = [
    'Consultation',
    'Repair',
    'Installation',
    'Maintenance',
    'Training',
    'Support',
    'Other'
  ];

  useEffect(() => {
    if (currentUser?.shopId) {
      fetchServices();
    }
  }, [currentUser?.shopId]);

  const fetchServices = async () => {
    if (!currentUser?.shopId) return;
    
    try {
      const q = query(
        collection(db, `shops/${currentUser.shopId}/services`),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(q);
      const servicesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date()
      })) as Service[];
      setServices(servicesData);
    } catch (error) {
      console.error('Error fetching services:', error);
      toast.error('Failed to fetch services');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateService = async () => {
    if (!currentUser?.shopId || !editingService.name || editingService.price === undefined) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      const serviceData = {
        ...editingService,
        shopId: currentUser.shopId,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      };

      await addDoc(collection(db, `shops/${currentUser.shopId}/services`), serviceData);
      
      toast.success('Service created successfully');
      setShowCreateModal(false);
      setEditingService({
        name: '',
        description: '',
        price: 0,
        duration: 0,
        category: '',
        isActive: true
      });
      fetchServices();
    } catch (error) {
      console.error('Error creating service:', error);
      toast.error('Failed to create service');
    }
  };

  const handleUpdateService = async () => {
    if (!currentUser?.shopId || !selectedService) return;

    try {
      const serviceRef = doc(db, `shops/${currentUser.shopId}/services`, selectedService.id);
      await updateDoc(serviceRef, {
        ...editingService,
        updatedAt: Timestamp.now()
      });
      
      toast.success('Service updated successfully');
      setShowEditModal(false);
      setSelectedService(null);
      fetchServices();
    } catch (error) {
      console.error('Error updating service:', error);
      toast.error('Failed to update service');
    }
  };

  const handleDeleteService = (serviceId: string) => {
    setServiceToDelete(serviceId);
    setShowDeleteModal(true);
  };

  const confirmDeleteService = async () => {
    if (!currentUser?.shopId || !serviceToDelete) return;

    try {
      await deleteDoc(doc(db, `shops/${currentUser.shopId}/services`, serviceToDelete));
      toast.success('Service deleted successfully');
      fetchServices();
      setShowDeleteModal(false);
      setServiceToDelete(null);
    } catch (error) {
      console.error('Error deleting service:', error);
      toast.error('Failed to delete service');
    }
  };

  const getStatusColor = (isActive: boolean) => {
    return isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
  };

  const totalServices = services.length;
  const activeServices = services.filter(s => s.isActive).length;
  const inactiveServices = services.filter(s => !s.isActive).length;
  const totalValue = services.reduce((sum, service) => sum + service.price, 0);

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
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Services</h1>
        <Button onClick={() => setShowCreateModal(true)}>
          Add Service
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <div className="p-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">Total Services</h3>
            <p className="text-3xl font-bold text-primary">{totalServices}</p>
          </div>
        </Card>
        <Card>
          <div className="p-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">Active</h3>
            <p className="text-3xl font-bold text-green-600">{activeServices}</p>
          </div>
        </Card>
        <Card>
          <div className="p-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">Inactive</h3>
            <p className="text-3xl font-bold text-red-600">{inactiveServices}</p>
          </div>
        </Card>
        <Card>
          <div className="p-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">Total Value</h3>
            <p className="text-3xl font-bold text-blue-600">KSH {totalValue.toLocaleString()}</p>
          </div>
        </Card>
      </div>

      <Card>
        <Table
          headers={['Name', 'Category', 'Price', 'Duration', 'Status', 'Actions']}
          data={services.map(service => [
            <div>
              <div className="font-medium">{service.name}</div>
              {service.description && (
                <div className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-xs">
                  {service.description}
                </div>
              )}
            </div>,
            service.category || '-',
            `KSH ${service.price.toLocaleString()}`,
            service.duration ? formatDuration(service.duration) : '-',
            <span className={`px-2 py-1 rounded-full text-xs ${getStatusColor(service.isActive)} badge-text-dark`}>
              {service.isActive ? 'Active' : 'Inactive'}
            </span>,
            <div className="flex space-x-2">
              <button
                onClick={() => {
                  setSelectedService(service);
                  setEditingService(service);
                  setShowEditModal(true);
                }}
                className="text-blue-600 hover:text-blue-800"
              >
                Edit
              </button>
              <button
                onClick={() => handleDeleteService(service.id)}
                className="text-red-600 hover:text-red-800"
              >
                Delete
              </button>
            </div>
          ])}
        />
      </Card>

      {/* Create Service Modal */}
      <Modal open={showCreateModal} onClose={() => setShowCreateModal(false)} title="Add New Service">
        <div className="p-6">
          <h2 className="text-xl font-bold mb-4">Add New Service</h2>
          
          <div className="grid grid-cols-2 gap-4 mb-4">
            <FormInput
              label="Service Name *"
              value={editingService.name || ''}
              onChange={(e) => setEditingService(prev => ({ ...prev, name: e.target.value }))}
            />
            <FormInput
              label="Price (KSH) *"
              type="number"
              value={editingService.price || ''}
              onChange={(e) => setEditingService(prev => ({ ...prev, price: parseFloat(e.target.value) || 0 }))}
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category</label>
              <Select
                value={editingService.category || ''}
                onChange={(v) => setEditingService(prev => ({ ...prev, category: v }))}
                options={[
                  { value: '', label: 'Select Category' },
                  ...serviceCategories.map(cat => ({ value: cat, label: cat }))
                ]}
                addNewLabel="+ Add New Category"
                onAddNew={() => {
                  const newCategory = prompt('Enter new category name:');
                  if (newCategory) {
                    setEditingService(prev => ({ ...prev, category: newCategory }));
                  }
                }}
              />
            </div>
            <FormInput
              label="Duration (minutes)"
              type="number"
              value={editingService.duration || ''}
              onChange={(e) => setEditingService(prev => ({ ...prev, duration: parseInt(e.target.value) || 0 }))}
            />
            <div className="col-span-2">
              <FormInput
                label="Description"
                value={editingService.description || ''}
                onChange={(e) => setEditingService(prev => ({ ...prev, description: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
              <Select
                value={editingService.isActive ? 'active' : 'inactive'}
                onChange={(v) => setEditingService(prev => ({ ...prev, isActive: v === 'active' }))}
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
            <Button onClick={handleCreateService}>
              Create Service
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit Service Modal */}
      <Modal open={showEditModal} onClose={() => setShowEditModal(false)} title="Edit Service">
        <div className="p-6">
          <h2 className="text-xl font-bold mb-4">Edit Service</h2>
          
          <div className="grid grid-cols-2 gap-4 mb-4">
            <FormInput
              label="Service Name *"
              value={editingService.name || ''}
              onChange={(e) => setEditingService(prev => ({ ...prev, name: e.target.value }))}
            />
            <FormInput
              label="Price (KSH) *"
              type="number"
              value={editingService.price || ''}
              onChange={(e) => setEditingService(prev => ({ ...prev, price: parseFloat(e.target.value) || 0 }))}
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category</label>
              <Select
                value={editingService.category || ''}
                onChange={(v) => setEditingService(prev => ({ ...prev, category: v }))}
                options={[
                  { value: '', label: 'Select Category' },
                  ...serviceCategories.map(cat => ({ value: cat, label: cat }))
                ]}
                addNewLabel="+ Add New Category"
                onAddNew={() => {
                  const newCategory = prompt('Enter new category name:');
                  if (newCategory) {
                    setEditingService(prev => ({ ...prev, category: newCategory }));
                  }
                }}
              />
            </div>
            <FormInput
              label="Duration (minutes)"
              type="number"
              value={editingService.duration || ''}
              onChange={(e) => setEditingService(prev => ({ ...prev, duration: parseInt(e.target.value) || 0 }))}
            />
            <div className="col-span-2">
              <FormInput
                label="Description"
                value={editingService.description || ''}
                onChange={(e) => setEditingService(prev => ({ ...prev, description: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
              <Select
                value={editingService.isActive ? 'active' : 'inactive'}
                onChange={(v) => setEditingService(prev => ({ ...prev, isActive: v === 'active' }))}
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
            <Button onClick={handleUpdateService}>
              Update Service
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={confirmDeleteService}
        title="Delete Service"
        message="Are you sure you want to delete this service? This action cannot be undone."
        type="danger"
        confirmText="Delete"
        cancelText="Cancel"
      />
    </div>
  );
};

export default Services;