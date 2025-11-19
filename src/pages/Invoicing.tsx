import React, { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc, query, orderBy, where, Timestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Invoice, InvoiceItem, Customer, Product, Service } from '../types';
import Card from '../components/UI/Card';
import Button from '../components/UI/Button';
import FormInput from '../components/UI/FormInput';
import Table from '../components/UI/Table';
import Select from '../components/UI/Select';
import DateInput from '../components/UI/DateInput';
import Modal from '../components/Modal';
import { toast } from 'react-hot-toast';

const Invoicing: React.FC = () => {
  const { currentUser } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Partial<Invoice>>({
    invoiceNumber: '',
    customerId: '',
    items: [],
    subtotal: 0,
    tax: 0,
    total: 0,
    status: 'draft',
    dueDate: new Date(),
    notes: ''
  });

  useEffect(() => {
    if (currentUser?.shopId) {
      fetchData();
    }
  }, [currentUser?.shopId]);

  const fetchData = async () => {
    if (!currentUser?.shopId) return;
    
    try {
      // Fetch invoices
      const invoicesQuery = query(
        collection(db, `shops/${currentUser.shopId}/invoices`),
        orderBy('createdAt', 'desc')
      );
      const invoicesSnapshot = await getDocs(invoicesQuery);
      const invoicesData = invoicesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date(),
        dueDate: doc.data().dueDate?.toDate() || new Date(),
        paidDate: doc.data().paidDate?.toDate()
      })) as Invoice[];
      setInvoices(invoicesData);

      // Fetch customers
      const customersQuery = query(collection(db, `shops/${currentUser.shopId}/customers`));
      const customersSnapshot = await getDocs(customersQuery);
      const customersData = customersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date()
      })) as Customer[];
      setCustomers(customersData);

    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const generateInvoiceNumber = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `INV-${year}${month}${day}-${random}`;
  };

  const handleCreateInvoice = async () => {
    if (!currentUser?.shopId || !editingInvoice.invoiceNumber) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      const invoiceData = {
        ...editingInvoice,
        shopId: currentUser.shopId,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        dueDate: Timestamp.fromDate(editingInvoice.dueDate || new Date())
      };

      await addDoc(collection(db, `shops/${currentUser.shopId}/invoices`), invoiceData);
      
      toast.success('Invoice created successfully');
      setShowCreateModal(false);
      setEditingInvoice({
        invoiceNumber: '',
        customerId: '',
        items: [],
        subtotal: 0,
        tax: 0,
        total: 0,
        status: 'draft',
        dueDate: new Date(),
        notes: ''
      });
      fetchData();
    } catch (error) {
      console.error('Error creating invoice:', error);
      toast.error('Failed to create invoice');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-800';
      case 'sent': return 'bg-blue-100 text-blue-800';
      case 'paid': return 'bg-green-100 text-green-800';
      case 'overdue': return 'bg-red-100 text-red-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const totalInvoices = invoices.length;
  const draftInvoices = invoices.filter(i => i.status === 'draft').length;
  const paidInvoices = invoices.filter(i => i.status === 'paid').length;
  const overdueInvoices = invoices.filter(i => i.status === 'overdue').length;
  const totalValue = invoices.reduce((sum, invoice) => sum + invoice.total, 0);

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
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Invoicing</h1>
        <Button onClick={() => {
          setEditingInvoice({
            invoiceNumber: generateInvoiceNumber(),
            customerId: '',
            items: [],
            subtotal: 0,
            tax: 0,
            total: 0,
            status: 'draft',
            dueDate: new Date(),
            notes: ''
          });
          setShowCreateModal(true);
        }}>
          Create Invoice
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        <Card>
          <div className="p-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">Total Invoices</h3>
            <p className="text-3xl font-bold text-primary">{totalInvoices}</p>
          </div>
        </Card>
        <Card>
          <div className="p-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">Draft</h3>
            <p className="text-3xl font-bold text-gray-600">{draftInvoices}</p>
          </div>
        </Card>
        <Card>
          <div className="p-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">Paid</h3>
            <p className="text-3xl font-bold text-green-600">{paidInvoices}</p>
          </div>
        </Card>
        <Card>
          <div className="p-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">Overdue</h3>
            <p className="text-3xl font-bold text-red-600">{overdueInvoices}</p>
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
          headers={['Invoice #', 'Customer', 'Amount', 'Status', 'Due Date', 'Actions']}
          data={invoices.map(invoice => [
            invoice.invoiceNumber,
            invoice.customer?.name || 'Walk-in Customer',
            `KSH ${invoice.total.toLocaleString()}`,
            <span className={`px-2 py-1 rounded-full text-xs ${getStatusColor(invoice.status)} badge-text-dark`}>
              {invoice.status}
            </span>,
            invoice.dueDate.toLocaleDateString(),
            <div className="flex space-x-2">
              <button className="text-blue-600 hover:text-blue-800">Edit</button>
              <button className="text-red-600 hover:text-red-800">Delete</button>
            </div>
          ])}
        />
      </Card>

      {/* Create Invoice Modal */}
      <Modal open={showCreateModal} onClose={() => setShowCreateModal(false)} title="Create New Invoice" size="lg">
        <div className="p-6">
          <h2 className="text-xl font-bold mb-4">Create New Invoice</h2>
          
          <div className="grid grid-cols-2 gap-4 mb-6">
            <FormInput
              label="Invoice Number"
              value={editingInvoice.invoiceNumber || ''}
              onChange={(e) => setEditingInvoice(prev => ({ ...prev, invoiceNumber: e.target.value }))}
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Customer</label>
              <Select
                value={editingInvoice.customerId || ''}
                onChange={(v) => setEditingInvoice(prev => ({ ...prev, customerId: v }))}
                options={[
                  { value: '', label: 'Walk-in Customer' },
                  ...customers.map(customer => ({ value: customer.id, label: customer.name }))
                ]}
              />
            </div>
            <DateInput
              label="Due Date"
              value={editingInvoice.dueDate?.toISOString().split('T')[0] || ''}
              onChange={(value) => setEditingInvoice(prev => ({ ...prev, dueDate: new Date(value) }))}
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
              <Select
                value={editingInvoice.status || 'draft'}
                onChange={(v) => setEditingInvoice(prev => ({ ...prev, status: v as any }))}
                options={[
                  { value: 'draft', label: 'Draft' },
                  { value: 'sent', label: 'Sent' },
                  { value: 'paid', label: 'Paid' },
                  { value: 'overdue', label: 'Overdue' },
                  { value: 'cancelled', label: 'Cancelled' }
                ]}
              />
            </div>
            <div className="col-span-2">
              <FormInput
                label="Notes"
                value={editingInvoice.notes || ''}
                onChange={(e) => setEditingInvoice(prev => ({ ...prev, notes: e.target.value }))}
              />
            </div>
          </div>

          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateInvoice}>
              Create Invoice
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Invoicing;