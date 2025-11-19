// src/pages/Customers.tsx
import React, { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import Card from '../components/UI/Card';
import Table from '../components/UI/Table';
import Modal from '../components/Modal';
import FormInput from '../components/UI/FormInput';
import Button from '../components/UI/Button';
import ConfirmationModal from '../components/UI/ConfirmationModal';
import { toast } from 'react-toastify';

interface Customer {
  id?: string;
  name: string;
  email: string;
  phone: string;
  loyaltyPoints: number;
  avatar?: string;
}

const Customers: React.FC = () => {
  const { currentUser } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState<string | null>(null);
  const [formData, setFormData] = useState<Omit<Customer, 'id'>>({
    name: '',
    email: '',
    phone: '',
    loyaltyPoints: 0,
    avatar: ''
  });

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async (): Promise<void> => {
    try {
      setLoading(true);
      
      if (!currentUser?.shopId) {
        console.error('No shop ID found for current user');
        toast.error('No shop assigned to your account');
        return;
      }

      const q = query(collection(db, `shops/${currentUser.shopId}/customers`), orderBy('name'));
      const querySnapshot = await getDocs(q);
      const customersData: Customer[] = [];
      querySnapshot.forEach((doc) => {
        customersData.push({ id: doc.id, ...doc.data() } as Customer);
      });
      setCustomers(customersData);
    } catch (error) {
      toast.error('Failed to fetch customers');
      console.error('Error fetching customers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>): void => {
    setSearchTerm(e.target.value);
  };

  const filteredCustomers = customers.filter(customer => 
    customer.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    customer.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    
    if (!currentUser?.shopId) {
      toast.error('No shop assigned to your account');
      return;
    }
    
    try {
      if (editingCustomer && editingCustomer.id) {
        await updateDoc(doc(db, `shops/${currentUser.shopId}/customers`, editingCustomer.id), formData);
        toast.success('Customer updated successfully');
      } else {
        await addDoc(collection(db, `shops/${currentUser.shopId}/customers`), formData);
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
      await deleteDoc(doc(db, `shops/${currentUser.shopId}/customers`, customerToDelete));
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
      email: customer.email,
      phone: customer.phone,
      loyaltyPoints: customer.loyaltyPoints,
      avatar: customer.avatar || ''
    });
    setIsModalOpen(true);
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

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Customers</h1>
        <Button onClick={() => setIsModalOpen(true)}>Add Customer</Button>
      </div>

      <Card className="p-6">
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

        {loading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 bg-gray-200 dark:bg-gray-700 animate-pulse rounded"></div>
            ))}
          </div>
        ) : (
          <Table
            columns={[
              { header: 'Name', accessor: 'name' },
              { header: 'Email', accessor: 'email' },
              { header: 'Phone', accessor: 'phone' },
              { header: 'Loyalty Points', accessor: 'loyaltyPoints' },
              {
                header: 'Actions',
                accessor: 'actions',
                render: (row: Customer) => (
                  <div className="flex space-x-2">
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
        )}
      </Card>

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
            required
          />
          <FormInput
            label="Phone"
            name="phone"
            type="tel"
            value={formData.phone}
            onChange={handleInputChange}
            required
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