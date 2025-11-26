import React, { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc, query, orderBy, where, Timestamp, DocumentData, QuerySnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';
import { getShopCollectionName, BRANCHES } from '../config/shopConfig';
import { useAuth } from '../contexts/AuthContext';
import { Expense, ExpenseCategory, Supplier } from '../types';
import Card from '../components/UI/Card';
import Button from '../components/UI/Button';
import FormInput from '../components/UI/FormInput';
import Table from '../components/UI/Table';
import Select, { SelectOption } from '../components/UI/Select';
import Dropdown from '../components/UI/Dropdown';
import DateInput from '../components/UI/DateInput';
import Modal from '../components/Modal';
import ConfirmationModal from '../components/UI/ConfirmationModal';
import { toast } from 'react-hot-toast';

const Expenses: React.FC = () => {
  const { currentUser } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [totalRevenue, setTotalRevenue] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState<string>('');
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [expenseToDelete, setExpenseToDelete] = useState<string | null>(null);
  const [selectedBranch, setSelectedBranch] = useState<string>('CentralShop');
  const [editingExpense, setEditingExpense] = useState<Partial<Expense>>({
    description: '',
    amount: 0,
    date: new Date(),
    paymentMethod: 'cash',
    status: 'pending',
    notes: '',
    supplierId: '',
    supplierName: '',
    expenseType: 'regular',
    employeeId: '',
    employeeName: ''
  });
  const [editingCategory, setEditingCategory] = useState<Partial<ExpenseCategory>>({
    name: '',
    description: '',
    color: '#3B82F6',
    isActive: true
  });
  const [showAddCategoryInline, setShowAddCategoryInline] = useState<boolean>(false);
  const [newCategoryInline, setNewCategoryInline] = useState<string>('');

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

  // Determine if user can switch between shops
  const canSwitchBranches =
    (Array.isArray((currentUser as any)?.assignedShops) &&
      new Set(
        ((currentUser as any).assignedShops as string[]).map(s => s.replace(/\s+/g, '').toLowerCase())
      ).size > 1) ||
    currentUser?.role === 'mainAdmin' ||
    currentUser?.role === 'Admin' ||
    currentUser?.role === 'astraronix';

  // Revenue minus Expenses (Net) state for this page
  const [netRange, setNetRange] = useState<'day' | 'week' | 'month' | 'year' | 'custom-day'>('day');
  const [netSelectedDate, setNetSelectedDate] = useState<string>('');
  const [netLoading, setNetLoading] = useState<boolean>(false);
  const [netResult, setNetResult] = useState<{ revenue: number; expenses: number; net: number } | null>(null);

  const formatSelectedDayInfo = (dateStr: string): string => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    const weekdays = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    const monthsFull = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    // ISO week number
    const getISOWeek = (date: Date) => {
      const tmp = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
      const dayNum = tmp.getUTCDay() || 7; // 1..7
      tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
      const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(),0,1));
      const weekNo = Math.ceil((((tmp as any) - (yearStart as any)) / 86400000 + 1) / 7);
      return { week: weekNo, year: tmp.getUTCFullYear() };
    };
    const { week, year } = getISOWeek(d);
    const dayName = weekdays[d.getDay()];
    const monthName = monthsFull[d.getMonth()];
    const day = d.getDate();
    const y = d.getFullYear();
    return `${dayName}, ${day} ${monthName} ${y} • Week ${week} of ${year} (${monthName})`;
  };

  useEffect(() => {
    if (currentUser?.shopId) {
      fetchExpenses();
      fetchCategories();
      fetchSuppliers();
      fetchEmployees();
      fetchRevenueTotal();
    }
  }, [currentUser?.shopId]);

  const fetchExpenses = async () => {
    if (!currentUser?.shopId) return;
    
    try {
      const q = query(
        collection(db, `shops/${currentUser.shopId}/expenses`),
        orderBy('date', 'desc')
      );
      const snapshot = await getDocs(q);
      const expensesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date(),
        date: doc.data().date?.toDate() || new Date(),
        category: doc.data().category || { id: '', name: 'Uncategorized', color: '#6B7280' }
      })) as Expense[];
      setExpenses(expensesData);
    } catch (error) {
      console.error('Error fetching expenses:', error);
      toast.error('Failed to fetch expenses');
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    if (!currentUser?.shopId) return;
    
    try {
      const q = query(collection(db, `shops/${currentUser.shopId}/expenseCategories`));
      const snapshot = await getDocs(q);
      let categoriesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date()
      })) as ExpenseCategory[];
      
      // Check if Salary category exists, if not create it
      const salaryCategoryExists = categoriesData.some(c => c.name.toLowerCase() === 'salary');
      if (!salaryCategoryExists) {
        try {
          const salaryCategoryRef = await addDoc(collection(db, `shops/${currentUser.shopId}/expenseCategories`), {
            name: 'Salary',
            description: 'Employee salary payments',
            color: '#9333EA', // Purple color for salary
            isActive: true,
            createdAt: Timestamp.now()
          });
          categoriesData.push({
            id: salaryCategoryRef.id,
            name: 'Salary',
            description: 'Employee salary payments',
            color: '#9333EA',
            isActive: true,
            createdAt: new Date()
          });
        } catch (error) {
          console.error('Error creating Salary category:', error);
        }
      }
      
      setCategories(categoriesData);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const fetchSuppliers = async () => {
    if (!currentUser?.shopId) return;
    
    try {
      const suppliersCollectionName = getShopCollectionName('suppliers');
      const [globalSnapshot, legacySnapshot] = await Promise.all([
        getDocs(collection(db, suppliersCollectionName)),
        getDocs(collection(db, `shops/${currentUser.shopId}/suppliers`))
      ]);

      const mapDocs = (snapshot: QuerySnapshot<DocumentData>) =>
        snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date()
      })) as Supplier[];

      const combinedMap = new Map<string, Supplier>();
      mapDocs(globalSnapshot).forEach((supplier) => combinedMap.set(supplier.id, supplier));
      mapDocs(legacySnapshot).forEach((supplier) => combinedMap.set(supplier.id, supplier));

      setSuppliers(Array.from(combinedMap.values()));
    } catch (error) {
      console.error('Error fetching suppliers:', error);
    }
  };

  const fetchEmployees = async () => {
    if (!currentUser?.shopId) return;
    
    try {
      const employeesCollectionName = getShopCollectionName('employees');
      const q = query(collection(db, employeesCollectionName), orderBy('name'));
      const snapshot = await getDocs(q);
      const employeesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        name: doc.data().name || 'Unknown',
        email: doc.data().email || ''
      }));
      setEmployees(employeesData);
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
  };

  const fetchRevenueTotal = async () => {
    if (!currentUser?.shopId) return;
    try {
      const { getShopOrdersCollectionNameCached } = await import('../utils/orderCollectionHelper');
      const ordersCollectionName = await getShopOrdersCollectionNameCached(currentUser.shopId);
      const q = query(collection(db, ordersCollectionName));
      const snapshot = await getDocs(q);
      let sum = 0;
      snapshot.forEach(doc => {
        const data: any = doc.data();
        sum += data.total || 0;
      });
      setTotalRevenue(sum);
    } catch (error) {
      console.error('Error fetching total revenue:', error);
    }
  };

  const buildExpensePayload = (includeCreatedMeta = false) => {
    const supplierId = editingExpense.supplierId || '';
    const supplier = supplierId ? suppliers.find((s) => s.id === supplierId) : null;
    const employeeId = editingExpense.employeeId || '';
    const employee = employeeId ? employees.find((e) => e.id === employeeId) : null;

    const payload: Record<string, any> = {
      description: editingExpense.description?.trim() || '',
      amount: Number(editingExpense.amount) || 0,
      paymentMethod: editingExpense.paymentMethod || 'cash',
      status: editingExpense.status || 'pending',
      notes: editingExpense.notes?.trim() || '',
      category: editingExpense.category ?? null,
      expenseType: editingExpense.expenseType || 'regular',
      supplierId: supplierId || null,
      supplierName: supplier?.name || editingExpense.supplierName || null,
      employeeId: employeeId || null,
      employeeName: employee?.name || editingExpense.employeeName || null,
      date: Timestamp.fromDate(editingExpense.date || new Date()),
      updatedAt: Timestamp.now()
    };

    if (includeCreatedMeta && currentUser?.shopId) {
      payload.shopId = currentUser.shopId;
      payload.createdBy = currentUser.name || currentUser.email || 'Unknown';
      payload.createdAt = Timestamp.now();
    }

    Object.keys(payload).forEach((key) => {
      if (payload[key] === undefined || payload[key] === null) {
        delete payload[key];
      }
    });

    return payload;
  };

  const handleCreateExpense = async () => {
    if (!currentUser?.shopId || !editingExpense.description || !editingExpense.amount) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      const expenseData = buildExpensePayload(true);

      await addDoc(collection(db, `shops/${currentUser.shopId}/expenses`), expenseData);
      
      toast.success('Expense created successfully');
      setShowCreateModal(false);
      setEditingExpense({
        description: '',
        amount: 0,
        date: new Date(),
        paymentMethod: 'cash',
        status: 'pending',
        notes: '',
        supplierId: '',
        supplierName: '',
        expenseType: 'regular',
        employeeId: '',
        employeeName: ''
      });
      fetchExpenses();
    } catch (error) {
      console.error('Error creating expense:', error);
      toast.error('Failed to create expense');
    }
  };

  const handleUpdateExpense = async () => {
    if (!currentUser?.shopId || !selectedExpense) return;

    try {
      const expenseRef = doc(db, `shops/${currentUser.shopId}/expenses`, selectedExpense.id);
      const expenseData = buildExpensePayload();
      await updateDoc(expenseRef, expenseData);
      
      toast.success('Expense updated successfully');
      setShowEditModal(false);
      setSelectedExpense(null);
      fetchExpenses();
    } catch (error) {
      console.error('Error updating expense:', error);
      toast.error('Failed to update expense');
    }
  };

  const handleDeleteExpense = (expenseId: string) => {
    setExpenseToDelete(expenseId);
    setShowDeleteModal(true);
  };

  const confirmDeleteExpense = async () => {
    if (!currentUser?.shopId || !expenseToDelete) return;

    try {
      await deleteDoc(doc(db, `shops/${currentUser.shopId}/expenses`, expenseToDelete));
      toast.success('Expense deleted successfully');
      fetchExpenses();
      setShowDeleteModal(false);
      setExpenseToDelete(null);
    } catch (error) {
      console.error('Error deleting expense:', error);
      toast.error('Failed to delete expense');
    }
  };

  const handleCreateCategory = async () => {
    if (!currentUser?.shopId || !editingCategory.name) {
      toast.error('Please enter a category name');
      return;
    }

    try {
      const categoryData = {
        ...editingCategory,
        shopId: currentUser.shopId,
        createdAt: Timestamp.now()
      };

      await addDoc(collection(db, `shops/${currentUser.shopId}/expenseCategories`), categoryData);
      
      toast.success('Category created successfully');
      setShowCategoryModal(false);
      setEditingCategory({
        name: '',
        description: '',
        color: '#3B82F6',
        isActive: true
      });
      fetchCategories();
    } catch (error) {
      console.error('Error creating category:', error);
      toast.error('Failed to create category');
    }
  };

  const addExpenseCategoryInline = async (): Promise<void> => {
    if (!currentUser?.shopId || !newCategoryInline.trim()) return;
    try {
      const catRef = await addDoc(collection(db, `shops/${currentUser.shopId}/expenseCategories`), {
        name: newCategoryInline.trim(),
        description: '',
        color: '#3B82F6',
        isActive: true,
        createdAt: Timestamp.now()
      });
      await fetchCategories();
      const created = categories.find(c => c.id === catRef.id) || { id: catRef.id, name: newCategoryInline.trim(), color: '#3B82F6' } as ExpenseCategory;
      setEditingExpense(prev => ({ ...prev, category: created }));
      setShowAddCategoryInline(false);
      setNewCategoryInline('');
      toast.success('Category added');
    } catch (e) {
      console.error('Error adding category inline:', e);
      toast.error('Failed to add category');
    }
  };

  const quickAddCategory = async (): Promise<void> => {
    if (!currentUser?.shopId || !newCategoryName.trim()) return;
    try {
      await addDoc(collection(db, `shops/${currentUser.shopId}/expenseCategories`), {
        name: newCategoryName.trim(),
        description: '',
        color: '#3B82F6',
        isActive: true,
        createdAt: Timestamp.now()
      });
      setNewCategoryName('');
      fetchCategories();
      toast.success('Category added');
    } catch (e) {
      console.error('Error adding category:', e);
      toast.error('Failed to add category');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'approved': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPaymentMethodColor = (method: string) => {
    switch (method) {
      case 'cash': return 'bg-green-100 text-green-800';
      case 'card': return 'bg-blue-100 text-blue-800';
      case 'bank_transfer': return 'bg-purple-100 text-purple-800';
      case 'mobile_money': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Helpers for date ranges
  const computeDateRange = (range: 'day' | 'week' | 'month' | 'year' | 'custom-day', dateStr: string): { start: Date; end: Date } => {
    const now = new Date();
    let start = new Date();
    let end = new Date();
    switch (range) {
      case 'day':
      case 'custom-day': {
        const d = range === 'custom-day' && dateStr ? new Date(dateStr) : now;
        start = new Date(d);
        start.setHours(0, 0, 0, 0);
        end = new Date(start);
        end.setDate(end.getDate() + 1);
        break;
      }
      case 'week': {
        end = new Date(now);
        end.setHours(0, 0, 0, 0);
        start = new Date(end);
        start.setDate(start.getDate() - 7);
        break;
      }
      case 'month': {
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        break;
      }
      case 'year': {
        start = new Date(now.getFullYear(), 0, 1);
        end = new Date(now.getFullYear() + 1, 0, 1);
        break;
      }
      default: {
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      }
    }
    return { start, end };
  };

  const computeNetForRange = async () => {
    try {
      if (!currentUser?.shopId) return;
      setNetLoading(true);
      setNetResult(null);

      const { getShopOrdersCollectionNameCached } = await import('../utils/orderCollectionHelper');
      const ordersPath = await getShopOrdersCollectionNameCached(currentUser.shopId);
      const expensesPath = `shops/${currentUser.shopId}/expenses`;
      const { start, end } = computeDateRange(netRange, netSelectedDate);

      // Revenue sum
      const ordersQ = query(collection(db, ordersPath), where('createdAt', '>=', start), where('createdAt', '<', end));
      const ordersSnap = await getDocs(ordersQ);
      let revenue = 0;
      ordersSnap.forEach(d => { const v: any = d.data(); revenue += v.total || 0; });

      // Expenses sum
      const expensesQ = query(collection(db, expensesPath), where('date', '>=', start), where('date', '<', end));
      const expensesSnap = await getDocs(expensesQ);
      let totalExp = 0;
      expensesSnap.forEach(d => { const v: any = d.data(); totalExp += v.amount || 0; });

      setNetResult({ revenue, expenses: totalExp, net: revenue - totalExp });
    } catch (e) {
      console.error('Error computing net:', e);
      toast.error('Failed to compute revenue minus expenses');
    } finally {
      setNetLoading(false);
    }
  };

  const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const pendingExpenses = expenses.filter(e => e.status === 'pending').reduce((sum, expense) => sum + expense.amount, 0);
  const approvedExpenses = expenses.filter(e => e.status === 'approved').reduce((sum, expense) => sum + expense.amount, 0);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div className="h-6 md:h-8 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
          <div className="flex space-x-2">
            <div className="h-10 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
            <div className="h-10 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
          </div>
        </div>
        {/* Loading Skeleton for Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="aspect-square">
              <Card className="p-4 md:p-6 h-full flex flex-col justify-center">
                <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-2"></div>
                <div className="h-8 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
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
      {/* Net Revenue Container */}
      <Card>
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium text-gray-900">Revenue minus Expenses</h3>
              <p className="text-sm text-gray-600">Compute net for a period</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Range</label>
              <Select
                value={netRange}
                onChange={(v) => setNetRange(v as any)}
                options={[
                  { value: 'day', label: 'Today' },
                  { value: 'week', label: 'Last 7 days' },
                  { value: 'month', label: 'This month' },
                  { value: 'year', label: 'This year' },
                  { value: 'custom-day', label: 'Specific day' },
                ]}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Select date</label>
              <DateInput
                value={netSelectedDate}
                onChange={setNetSelectedDate}
              />
              {netSelectedDate && (
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  {formatSelectedDayInfo(netSelectedDate)}
                </p>
              )}
            </div>
            <div className="flex items-end">
              <Button className="w-full" onClick={computeNetForRange} disabled={netLoading}>
                {netLoading ? 'Computing...' : 'Compute'}
              </Button>
            </div>
          </div>

          {netResult && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <div className="p-4">
                  <h4 className="text-sm text-gray-600">Revenue</h4>
                  <p className="text-2xl font-semibold">KSH {netResult.revenue.toLocaleString()}</p>
                </div>
              </Card>
              <Card>
                <div className="p-4">
                  <h4 className="text-sm text-gray-600">Expenses</h4>
                  <p className="text-2xl font-semibold">KSH {netResult.expenses.toLocaleString()}</p>
                </div>
              </Card>
              <Card>
                <div className="p-4">
                  <h4 className="text-sm text-gray-600">Net</h4>
                  <p className="text-2xl font-bold">KSH {netResult.net.toLocaleString()}</p>
                </div>
              </Card>
            </div>
          )}
        </div>
      </Card>
      <div className="flex justify-between items-center">
        <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">Expenses</h1>
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
        <div className="flex space-x-2">
            <Button variant="secondary" onClick={() => setShowCategoryModal(true)}>
            Manage Categories
          </Button>
          <Button onClick={() => setShowCreateModal(true)}>
            Add Expense
          </Button>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 md:gap-4">
        <Card className="p-2 md:p-4 hover:shadow-xl transition-all duration-300">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-gray-600 dark:text-gray-400 truncate">Total Expenses</p>
              <p className="text-lg md:text-2xl font-bold text-gray-900 dark:text-white mt-1">KSH {totalExpenses.toLocaleString()}</p>
            </div>
          </div>
        </Card>
        <Card className="p-2 md:p-4 hover:shadow-xl transition-all duration-300">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-gray-600 dark:text-gray-400 truncate">Pending Approval</p>
              <p className="text-lg md:text-2xl font-bold text-gray-900 dark:text-white mt-1">KSH {pendingExpenses.toLocaleString()}</p>
            </div>
          </div>
        </Card>
        <Card className="p-2 md:p-4 hover:shadow-xl transition-all duration-300">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-gray-600 dark:text-gray-400 truncate">Approved</p>
              <p className="text-lg md:text-2xl font-bold text-gray-900 dark:text-white mt-1">KSH {approvedExpenses.toLocaleString()}</p>
            </div>
          </div>
        </Card>
        <Card className="p-2 md:p-4 hover:shadow-xl transition-all duration-300">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-gray-600 dark:text-gray-400 truncate">Revenue - Expenses</p>
              <p className="text-lg md:text-2xl font-bold text-gray-900 dark:text-white mt-1">KSH {(totalRevenue - totalExpenses).toLocaleString()}</p>
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <Table
          headers={['Description', 'Type', 'Category', 'Amount', 'Date', 'Payment Method', 'Status', 'Actions']}
          data={expenses.map(expense => [
            <div>
              <div className="font-medium">{expense.description}</div>
              {expense.expenseType === 'salary' && expense.employeeName && (
                <div className="text-xs text-gray-500 dark:text-gray-400">Employee: {expense.employeeName}</div>
              )}
              {expense.expenseType === 'regular' && expense.supplierName && (
                <div className="text-xs text-gray-500 dark:text-gray-400">Supplier: {expense.supplierName}</div>
              )}
            </div>,
            <span className={`px-2 py-1 rounded-full text-xs ${
              expense.expenseType === 'salary' 
                ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' 
                : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
            }`}>
              {expense.expenseType === 'salary' ? 'Salary' : 'Expense'}
            </span>,
            <span className="flex items-center">
              <div 
                className="w-3 h-3 rounded-full mr-2" 
                style={{ backgroundColor: expense.category.color }}
              ></div>
              {expense.category.name}
            </span>,
            `KSH ${expense.amount.toLocaleString()}`,
            expense.date.toLocaleDateString(),
            <span className={`px-2 py-1 rounded-full text-xs ${getPaymentMethodColor(expense.paymentMethod)} badge-text-dark`}>
              {expense.paymentMethod.replace('_', ' ').toUpperCase()}
            </span>,
            <span className={`px-2 py-1 rounded-full text-xs ${getStatusColor(expense.status)} badge-text-dark`}>
              {expense.status}
            </span>,
            <div className="flex space-x-2">
              <button
                onClick={() => {
                  setSelectedExpense(expense);
                  setEditingExpense(expense);
                  setShowEditModal(true);
                }}
                className="text-blue-600 hover:text-blue-800"
              >
                Edit
              </button>
              <button
                onClick={() => handleDeleteExpense(expense.id)}
                className="text-red-600 hover:text-red-800"
              >
                Delete
              </button>
            </div>
          ])}
        />
      </Card>

      {/* Create Expense Modal */}
      <Modal open={showCreateModal} onClose={() => setShowCreateModal(false)} title="Add New Expense">
        <div className="p-6">
          <h2 className="text-xl font-bold mb-4">Add New Expense</h2>
          
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Expense Type *</label>
              <Select
                value={editingExpense.expenseType || 'regular'}
                onChange={async (v) => {
                  const isSalary = v === 'salary';
                  // Auto-select Salary category when expense type is salary
                  let salaryCategory = categories.find(c => c.name.toLowerCase() === 'salary');
                  
                  // If salary category doesn't exist, create it
                  if (isSalary && !salaryCategory && currentUser?.shopId) {
                    try {
                      const salaryCategoryRef = await addDoc(collection(db, `shops/${currentUser.shopId}/expenseCategories`), {
                        name: 'Salary',
                        description: 'Employee salary payments',
                        color: '#9333EA',
                        isActive: true,
                        createdAt: Timestamp.now()
                      });
                      salaryCategory = {
                        id: salaryCategoryRef.id,
                        name: 'Salary',
                        description: 'Employee salary payments',
                        color: '#9333EA',
                        isActive: true,
                        createdAt: new Date()
                      };
                      setCategories(prev => [...prev, salaryCategory!]);
                    } catch (error) {
                      console.error('Error creating Salary category:', error);
                    }
                  }
                  
                  setEditingExpense(prev => ({ 
                    ...prev, 
                    expenseType: v as 'regular' | 'salary',
                    // Auto-select salary category
                    category: isSalary && salaryCategory ? salaryCategory : (isSalary ? undefined : prev.category),
                    // Clear employee/supplier when switching types
                    employeeId: isSalary ? prev.employeeId : '',
                    employeeName: isSalary ? prev.employeeName : '',
                    supplierId: !isSalary ? prev.supplierId : '',
                    supplierName: !isSalary ? prev.supplierName : ''
                  }));
                }}
                options={[
                  { value: 'regular', label: 'Regular Expense' },
                  { value: 'salary', label: 'Employee Salary' },
                ]}
              />
            </div>
            {editingExpense.expenseType === 'salary' && (
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Employee *</label>
                <Select
                  value={editingExpense.employeeId || ''}
                  onChange={(v) => {
                    const employee = employees.find(e => e.id === v);
                    setEditingExpense(prev => ({ 
                      ...prev, 
                      employeeId: v, 
                      employeeName: employee?.name || '',
                      description: employee ? `Salary - ${employee.name}` : prev.description
                    }));
                  }}
                  options={[
                    { value: '', label: 'Select Employee' },
                    ...employees.map(e => ({ value: e.id, label: `${e.name} (${e.email})` }))
                  ]}
                />
              </div>
            )}
            <FormInput
              name="description"
              label="Description *"
              value={editingExpense.description || ''}
              onChange={(e) => setEditingExpense(prev => ({ ...prev, description: e.target.value }))}
            />
            <FormInput
              name="amount"
              label="Amount *"
              type="number"
              value={String(editingExpense.amount || 0)}
              onChange={(e) => setEditingExpense(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))}
            />
            {editingExpense.expenseType === 'regular' && (
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Supplier</label>
                <Select
                  value={editingExpense.supplierId || ''}
                  onChange={(v) => {
                    const supplier = suppliers.find(s => s.id === v);
                    setEditingExpense(prev => ({ ...prev, supplierId: v, supplierName: supplier?.name }));
                  }}
                  options={[{ value: '', label: 'Select Supplier' }, ...suppliers.map(s => ({ value: s.id, label: s.name }))]}
                />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category</label>
              <Select
                value={editingExpense.category?.id || ''}
                onChange={(v) => {
                  if (v === '__add_new__') {
                    setShowAddCategoryInline(true);
                  } else {
                    const category = categories.find(c => c.id === v);
                    setEditingExpense(prev => ({ ...prev, category }));
                    setShowAddCategoryInline(false);
                  }
                }}
                options={[
                  { value: '', label: 'Select Category' },
                  ...categories.map(c => ({ value: c.id, label: c.name }))
                ] as SelectOption[]}
                addNewLabel="+ Add new category"
                onAddNew={() => setShowAddCategoryInline(true)}
                disabled={editingExpense.expenseType === 'salary'} // Disable category selection for salary
              />
              {editingExpense.expenseType === 'salary' && (
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Category automatically set to "Salary"
                </p>
              )}
              {showAddCategoryInline && editingExpense.expenseType !== 'salary' && (
                <div className="mt-2 flex">
                  <input
                    type="text"
                    placeholder="New category name"
                    value={newCategoryInline}
                    onChange={(e) => setNewCategoryInline(e.target.value)}
                    className="flex-1 rounded-l-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white px-3 py-2"
                  />
                  <button onClick={addExpenseCategoryInline} className="px-3 rounded-r-lg bg-[#4A90A4] text-white">Add</button>
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date</label>
              <DateInput
                value={editingExpense.date?.toISOString().split('T')[0] || ''}
                onChange={(v) => setEditingExpense(prev => ({ ...prev, date: new Date(v) }))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Payment Method</label>
              <Select
                value={editingExpense.paymentMethod || 'cash'}
                onChange={(v) => setEditingExpense(prev => ({ ...prev, paymentMethod: v as any }))}
                options={[
                  { value: 'cash', label: 'Cash' },
                  { value: 'card', label: 'Card' },
                  { value: 'bank_transfer', label: 'Bank Transfer' },
                  { value: 'mobile_money', label: 'Mobile Money' },
                ]}
              />
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={editingExpense.notes || ''}
              onChange={(e) => setEditingExpense(prev => ({ ...prev, notes: e.target.value }))}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              rows={3}
            />
          </div>

          <div className="flex justify-end space-x-2">
            <Button variant="secondary" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateExpense}>
              Create Expense
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit Expense Modal */}
      <Modal open={showEditModal} onClose={() => setShowEditModal(false)} title="Edit Expense">
        <div className="p-6">
          <h2 className="text-xl font-bold mb-4">Edit Expense</h2>
          
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Expense Type *</label>
              <Select
                value={editingExpense.expenseType || 'regular'}
                onChange={async (v) => {
                  const isSalary = v === 'salary';
                  // Auto-select Salary category when expense type is salary
                  let salaryCategory = categories.find(c => c.name.toLowerCase() === 'salary');
                  
                  // If salary category doesn't exist, create it
                  if (isSalary && !salaryCategory && currentUser?.shopId) {
                    try {
                      const salaryCategoryRef = await addDoc(collection(db, `shops/${currentUser.shopId}/expenseCategories`), {
                        name: 'Salary',
                        description: 'Employee salary payments',
                        color: '#9333EA',
                        isActive: true,
                        createdAt: Timestamp.now()
                      });
                      salaryCategory = {
                        id: salaryCategoryRef.id,
                        name: 'Salary',
                        description: 'Employee salary payments',
                        color: '#9333EA',
                        isActive: true,
                        createdAt: new Date()
                      };
                      setCategories(prev => [...prev, salaryCategory!]);
                    } catch (error) {
                      console.error('Error creating Salary category:', error);
                    }
                  }
                  
                  setEditingExpense(prev => ({ 
                    ...prev, 
                    expenseType: v as 'regular' | 'salary',
                    // Auto-select salary category
                    category: isSalary && salaryCategory ? salaryCategory : (isSalary ? undefined : prev.category),
                    // Clear employee/supplier when switching types
                    employeeId: isSalary ? prev.employeeId : '',
                    employeeName: isSalary ? prev.employeeName : '',
                    supplierId: !isSalary ? prev.supplierId : '',
                    supplierName: !isSalary ? prev.supplierName : ''
                  }));
                }}
                options={[
                  { value: 'regular', label: 'Regular Expense' },
                  { value: 'salary', label: 'Employee Salary' },
                ]}
              />
            </div>
            {editingExpense.expenseType === 'salary' && (
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Employee *</label>
                <Select
                  value={editingExpense.employeeId || ''}
                  onChange={(v) => {
                    const employee = employees.find(e => e.id === v);
                    setEditingExpense(prev => ({ 
                      ...prev, 
                      employeeId: v, 
                      employeeName: employee?.name || '',
                      description: employee ? `Salary - ${employee.name}` : prev.description
                    }));
                  }}
                  options={[
                    { value: '', label: 'Select Employee' },
                    ...employees.map(e => ({ value: e.id, label: `${e.name} (${e.email})` }))
                  ]}
                />
              </div>
            )}
            <FormInput
              name="description"
              label="Description *"
              value={editingExpense.description || ''}
              onChange={(e) => setEditingExpense(prev => ({ ...prev, description: e.target.value }))}
            />
            <FormInput
              name="amount"
              label="Amount *"
              type="number"
              value={String(editingExpense.amount || 0)}
              onChange={(e) => setEditingExpense(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))}
            />
            {editingExpense.expenseType === 'regular' && (
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Supplier</label>
                <Select
                  value={editingExpense.supplierId || ''}
                  onChange={(v) => {
                    const supplier = suppliers.find(s => s.id === v);
                    setEditingExpense(prev => ({ ...prev, supplierId: v, supplierName: supplier?.name }));
                  }}
                  options={[{ value: '', label: 'Select Supplier' }, ...suppliers.map(s => ({ value: s.id, label: s.name }))]}
                />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
              <Dropdown
                value={editingExpense.status || 'pending'}
                onChange={(value) => setEditingExpense(prev => ({ ...prev, status: value as any }))}
                options={[
                  { value: 'pending', label: 'Pending' },
                  { value: 'approved', label: 'Approved' },
                  { value: 'rejected', label: 'Rejected' }
                ]}
                placeholder="Select status"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date</label>
              <DateInput
                value={editingExpense.date ? (editingExpense.date instanceof Date ? editingExpense.date.toISOString().split('T')[0] : String(editingExpense.date)) : new Date().toISOString().split('T')[0]}
                onChange={(dateStr) => setEditingExpense(prev => ({ ...prev, date: new Date(dateStr) }))}
              />
            </div>
          </div>

          <div className="flex justify-end space-x-2">
            <Button variant="secondary" onClick={() => setShowEditModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateExpense}>
              Update Expense
            </Button>
          </div>
        </div>
      </Modal>

      {/* Category Management Modal */}
      <Modal open={showCategoryModal} onClose={() => setShowCategoryModal(false)} title="Manage Categories">
        <div className="p-6">
          <h2 className="text-xl font-bold mb-4">Manage Categories</h2>
          
          <div className="mb-4">
            <h3 className="text-lg font-medium mb-2">Add New Category</h3>
            <div className="grid grid-cols-2 gap-4">
              <FormInput
                name="categoryName"
                label="Category Name"
                value={editingCategory.name || ''}
                onChange={(e) => setEditingCategory(prev => ({ ...prev, name: e.target.value }))}
              />
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Color</label>
                <input
                type="color"
                value={editingCategory.color || '#3B82F6'}
                onChange={(e) => setEditingCategory(prev => ({ ...prev, color: e.target.value }))}
                  className="w-full h-10 border border-gray-300 dark:border-gray-600 rounded-lg"
              />
              </div>
            </div>
            <Button onClick={handleCreateCategory} className="mt-2">
              Add Category
            </Button>
            <div className="mt-4">
              <h4 className="text-sm font-medium mb-2">Quick add</h4>
              <div className="flex">
                <input
                  type="text"
                  placeholder="New category name"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  className="flex-1 rounded-l-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white px-3 py-2"
                />
                <button onClick={quickAddCategory} className="px-3 rounded-r-lg bg-[#4A90A4] text-white">Add</button>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-medium mb-2">Existing Categories</h3>
            <div className="space-y-2">
              {categories.map(category => (
                <div key={category.id} className="flex items-center justify-between p-2 border rounded">
                  <div className="flex items-center">
                    <div 
                      className="w-4 h-4 rounded-full mr-2" 
                      style={{ backgroundColor: category.color }}
                    ></div>
                    <span>{category.name}</span>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs ${category.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                    {category.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end mt-4">
            <Button variant="secondary" onClick={() => setShowCategoryModal(false)}>
              Close
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={confirmDeleteExpense}
        title="Delete Expense"
        message="Are you sure you want to delete this expense? This action cannot be undone."
        type="danger"
        confirmText="Delete"
        cancelText="Cancel"
      />
    </div>
  );
};

export default Expenses;





