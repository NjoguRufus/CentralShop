// src/pages/Employees.tsx
import React, { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy, where } from 'firebase/firestore';
import { createUserWithEmailAndPassword, updateProfile, signOut, signInWithEmailAndPassword } from 'firebase/auth';
import { db, auth } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { getShopCollectionName } from '../config/shopConfig';
import Modal from '../components/Modal';
import Card from '../components/UI/Card';
import Table from '../components/UI/Table';
import FormInput from '../components/UI/FormInput';
import Button from '../components/UI/Button';
import ConfirmationModal from '../components/UI/ConfirmationModal';
import { toast } from 'react-toastify';
import Select from '../components/UI/Select';

interface Employee {
  id?: string;
  name: string;
  email: string;
  password?: string;
  role: 'astraronix' | 'mainAdmin' | 'Admin' | 'Cashier' | 'Stock Manager';
  status: 'Active' | 'Inactive';
  avatar?: string;
  uid?: string; // Firebase Auth UID
  shopId?: string; // For multi-tenant support
  shopName?: string; // For display purposes
  createdAt?: Date;
  updatedAt?: Date;
  workingHours?: {
    startTime: string; // Format: "09:00"
    endTime: string;   // Format: "17:00"
    workingDays: string[]; // ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
  };
  lastLogin?: Date;
  lastLogout?: Date;
  isCurrentlyActive?: boolean;
}

interface EmployeeActivity {
  id: string;
  employeeId: string;
  employeeName: string;
  action: 'login' | 'logout';
  timestamp: Date;
  ipAddress?: string;
  userAgent?: string;
}

interface EmployeeStats {
  totalOrders: number;
  totalSales: number;
  averageOrderValue: number;
  lastOrderDate?: Date;
}

const Employees: React.FC = () => {
  const { currentUser } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [employeeToDelete, setEmployeeToDelete] = useState<string | null>(null);
  const [showManageModal, setShowManageModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [employeeStats, setEmployeeStats] = useState<EmployeeStats | null>(null);
  const [employeeOrders, setEmployeeOrders] = useState<any[]>([]);
  const [employeeChats, setEmployeeChats] = useState<any[]>([]);
  const [employeeActivities, setEmployeeActivities] = useState<EmployeeActivity[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'orders' | 'chats' | 'activity'>('overview');
  const [selectedChat, setSelectedChat] = useState<any>(null);
  const [showChatViewer, setShowChatViewer] = useState(false);
  const [adminPasswordForReauth, setAdminPasswordForReauth] = useState<string | null>(null);
  const [formData, setFormData] = useState<Omit<Employee, 'id'>>({
    name: '',
    email: '',
    password: '',
    role: 'mainAdmin',
    status: 'Active',
    avatar: '',
    workingHours: {
      startTime: '09:00',
      endTime: '17:00',
      workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
    }
  });

  useEffect(() => {
    fetchEmployees();
  }, []);

  // Fetch employee statistics
  const fetchEmployeeStats = async (employeeId: string) => {
    try {
      if (!currentUser?.shopId) return;

      // Fetch orders for this employee
      const { getShopOrdersCollectionNameCached } = await import('../utils/orderCollectionHelper');
      const ordersCollectionName = await getShopOrdersCollectionNameCached(currentUser.shopId);
      const ordersQuery = query(
        collection(db, ordersCollectionName)
      );
      const ordersSnapshot = await getDocs(ordersQuery);
      const orders = ordersSnapshot.docs
        .map(doc => ({ 
          id: doc.id, 
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate ? doc.data().createdAt.toDate() : (doc.data().createdAt || new Date())
        }))
        .filter((order: any) => order.employeeId === selectedEmployee?.uid)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      const totalOrders = orders.length;
      const totalSales = orders.reduce((sum, order: any) => sum + (order.total || 0), 0);
      const averageOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0;
      const lastOrderDate = orders.length > 0 ? orders[0].createdAt : undefined;

      setEmployeeStats({
        totalOrders,
        totalSales,
        averageOrderValue,
        lastOrderDate
      });

      setEmployeeOrders(orders);
    } catch (error) {
      console.error('Error fetching employee stats:', error);
      toast.error('Failed to fetch employee statistics');
    }
  };

  // Migrate old chats to include employeeId
  const migrateChats = async () => {
    try {
      if (!currentUser?.shopId) return;

      const chatsQuery = query(
        collection(db, `shops/${currentUser.shopId}/ai_chats`)
      );
      const chatsSnapshot = await getDocs(chatsQuery);
      
      const migrationPromises = chatsSnapshot.docs.map(async (doc) => {
        const data = doc.data();
        if (!data.employeeId) {
          // Update chat with current user's info
          await updateDoc(doc.ref, {
            employeeId: currentUser.uid,
            employeeName: currentUser.name
          });
        }
      });

      await Promise.all(migrationPromises);
      console.log('Chat migration completed');
    } catch (error) {
      console.error('Error migrating chats:', error);
    }
  };

  // Fetch employee AI chats
  const fetchEmployeeChats = async (employeeId: string) => {
    try {
      if (!currentUser?.shopId) return;

      // First, migrate any old chats
      await migrateChats();

      const chatsQuery = query(
        collection(db, `shops/${currentUser.shopId}/ai_chats`)
      );
      const chatsSnapshot = await getDocs(chatsQuery);
      const chats = chatsSnapshot.docs
        .map(doc => ({ 
          id: doc.id, 
          ...doc.data(),
          updatedAt: doc.data().updatedAt?.toDate ? doc.data().updatedAt.toDate() : (doc.data().updatedAt || new Date())
        }))
        .filter((chat: any) => chat.employeeId === selectedEmployee?.uid)
        .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

      setEmployeeChats(chats);
    } catch (error) {
      console.error('Error fetching employee chats:', error);
      toast.error('Failed to fetch employee chats');
    }
  };

  // Fetch employee activities
  const fetchEmployeeActivities = async (employeeId: string) => {
    try {
      if (!currentUser?.shopId || !selectedEmployee?.id) return;

      const activitiesQuery = query(
        collection(db, `shops/${currentUser.shopId}/employee_activities`),
        where('employeeId', '==', selectedEmployee.id)
      );
      const activitiesSnapshot = await getDocs(activitiesQuery);
      const activities = activitiesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate ? doc.data().timestamp.toDate() : (doc.data().timestamp || new Date())
      })) as EmployeeActivity[];

      // Sort by timestamp in descending order (most recent first)
      activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

      setEmployeeActivities(activities);
    } catch (error) {
      console.error('Error fetching employee activities:', error);
      toast.error('Failed to fetch employee activities');
    }
  };

  // Handle employee selection for management
  const handleManageEmployee = async (employee: Employee) => {
    setSelectedEmployee(employee);
    setShowManageModal(true);
    setActiveTab('overview');
    await Promise.all([
      fetchEmployeeStats(employee.id!),
      fetchEmployeeChats(employee.id!),
      fetchEmployeeActivities(employee.id!)
    ]);
  };

  // Handle chat selection for viewing
  const handleViewChat = (chat: any) => {
    setSelectedChat(chat);
    setShowChatViewer(true);
  };

  const fetchEmployees = async (): Promise<void> => {
    try {
      setLoading(true);
      
      if (!currentUser?.shopId) {
        console.error('No shop ID found for current user');
        toast.error('No shop assigned to your account');
        return;
      }

      // Fetch from shop-prefixed employees collection
      const employeesCollectionName = getShopCollectionName('employees');
      const q = query(collection(db, employeesCollectionName), orderBy('name'));
      const querySnapshot = await getDocs(q);
      const employeesData: Employee[] = [];
      querySnapshot.forEach((doc) => {
        const userData = doc.data() as Employee;
        // Filter out astraronix users
        if (userData.role !== 'astraronix') {
          employeesData.push({ 
            id: doc.id, 
            ...userData,
            createdAt: userData.createdAt || new Date(),
            updatedAt: userData.updatedAt || new Date()
          } as Employee);
        }
      });
      setEmployees(employeesData);
    } catch (error) {
      toast.error('Failed to fetch employees');
      console.error('Error fetching employees:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>): void => {
    setSearchTerm(e.target.value);
  };

  const filteredEmployees = employees.filter(employee => 
    employee.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    employee.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    try {
      if (editingEmployee && editingEmployee.id) {
        // Update existing employee (don't create new auth user)
        const { password, ...updateData } = formData;
        // Store password if provided for admin visibility
        const updateDataWithPassword = password ? { ...updateData, password } : updateData;
        await updateDoc(doc(db, getShopCollectionName('employees'), editingEmployee.id), {
          ...updateDataWithPassword,
          updatedAt: new Date()
        });
        toast.success('Employee updated successfully');
      } else {
        // Create new employee with Firebase Auth
        if (!formData.password) {
          toast.error('Password is required for new employees');
          return;
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const trimmedEmail = formData.email?.trim();
        
        if (!trimmedEmail) {
          toast.error('Email is required');
          return;
        }
        
        if (!emailRegex.test(trimmedEmail)) {
          toast.error('Please enter a valid email address');
          return;
        }

        // Validate password length
        if (formData.password.length < 6) {
          toast.error('Password must be at least 6 characters');
          return;
        }

        // Validate admin password is provided
        if (!adminPasswordForReauth) {
          toast.error('Please enter your admin password to remain logged in');
          return;
        }

        // Store current admin info before creating employee
        const currentAdminEmail = currentUser?.email;
        const currentAdminUid = currentUser?.uid;
        
        // Create Firebase Auth user (this will automatically sign in the new user)
        const userCredential = await createUserWithEmailAndPassword(
          auth, 
          trimmedEmail, 
          formData.password
        );
        
        // Update the user's display name
        await updateProfile(userCredential.user, {
          displayName: formData.name
        });

        // Save employee data to shop-prefixed employees collection with UID, password, and shop info
        const employeeData = {
          ...formData,
          email: trimmedEmail, // Use trimmed email
          uid: userCredential.user.uid,
          shopId: currentUser?.shopId,
          shopName: currentUser?.shopName,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        await addDoc(collection(db, getShopCollectionName('employees')), employeeData);

        // Check if the newly signed-in user is different from the admin
        // If so, sign out and sign the admin back in
        if (auth.currentUser && auth.currentUser.uid !== currentAdminUid) {
          await signOut(auth);
          
          // Sign the admin back in using stored password
          if (currentAdminEmail && adminPasswordForReauth) {
            try {
              await signInWithEmailAndPassword(auth, currentAdminEmail, adminPasswordForReauth);
              // Clear the stored password immediately after use
              setAdminPasswordForReauth(null);
              toast.success('Employee created successfully');
            } catch (reauthError: any) {
              console.error('Error signing admin back in:', reauthError);
              toast.warning('Employee created successfully. Please sign back in manually.');
              setAdminPasswordForReauth(null);
            }
          } else {
            toast.warning('Employee created successfully. Please sign back in.');
          }
        } else {
        toast.success('Employee created successfully with login credentials');
        }
      }
      setIsModalOpen(false);
      setEditingEmployee(null);
      setFormData({ 
        name: '', 
        email: '', 
        password: '', 
        role: 'mainAdmin', 
        status: 'Active', 
        avatar: '',
        workingHours: {
          startTime: '09:00',
          endTime: '17:00',
          workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
        }
      });
      fetchEmployees();
    } catch (error: any) {
      console.error('Error saving employee:', error);
      if (error.code === 'auth/email-already-in-use') {
        toast.error('Email is already in use');
      } else if (error.code === 'auth/weak-password') {
        toast.error('Password should be at least 6 characters');
      } else if (error.code === 'auth/invalid-email') {
        toast.error('Invalid email address. Please check the email format.');
      } else if (error.code === 'auth/operation-not-allowed') {
        toast.error('Email/password accounts are not enabled. Please contact support.');
      } else {
        toast.error(`Failed to save employee: ${error.message || 'Unknown error'}`);
      }
    }
  };

  const handleDelete = (id: string): void => {
    setEmployeeToDelete(id);
    setShowDeleteModal(true);
  };

  const confirmDeleteEmployee = async (): Promise<void> => {
    if (!employeeToDelete) return;

    try {
      await deleteDoc(doc(db, getShopCollectionName('employees'), employeeToDelete));
      toast.success('Employee deleted successfully');
      fetchEmployees();
      setShowDeleteModal(false);
      setEmployeeToDelete(null);
    } catch (error) {
      toast.error('Failed to delete employee');
      console.error('Error deleting employee:', error);
    }
  };

  const handleEdit = (employee: Employee): void => {
    setEditingEmployee(employee);
    setFormData({
      name: employee.name,
      email: employee.email,
      role: employee.role,
      status: employee.status,
      avatar: employee.avatar || ''
    });
    setIsModalOpen(true);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = e.target.files?.[0];
    if (file) {
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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>): void => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-xl md:text-2xl font-bold text-gray-800 dark:text-white">Employees</h1>
        <div className="flex space-x-3">
          <Button 
            variant="secondary" 
            onClick={() => setShowManageModal(true)}
          >
            Manage Employees
          </Button>
          <Button onClick={() => setIsModalOpen(true)}>Add Employee</Button>
        </div>
      </div>

      <Card className="p-6">
        <div className="mb-4">
          <FormInput
            name="search"
            type="text"
            placeholder="Search employees..."
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
              { header: 'Role', accessor: 'role' },
              {
                header: 'Password',
                accessor: 'password',
                render: (row: Employee) => (
                  <span className="font-mono text-sm text-gray-600 dark:text-gray-400">
                    {row.password || 'N/A'}
                  </span>
                )
              },
              { 
                header: 'Status', 
                accessor: 'status',
                render: (row: Employee) => (
                  <span className={`px-2 py-1 rounded-full text-xs ${
                    row.status === 'Active' 
                      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                      : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                  }`}>
                    {row.status}
                  </span>
                )
              },
              {
                header: 'Actions',
                accessor: 'actions',
                render: (row: Employee) => (
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
            data={filteredEmployees}
          />
        )}
      </Card>

      <Modal
        open={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingEmployee(null);
          setFormData({ 
        name: '', 
        email: '', 
        password: '', 
        role: 'mainAdmin', 
        status: 'Active', 
        avatar: '',
        workingHours: {
          startTime: '09:00',
          endTime: '17:00',
          workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
        }
      });
          setAdminPasswordForReauth(null);
        }}
        title={editingEmployee ? 'Edit Employee' : 'Add Employee'}
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
          {!editingEmployee && (
            <>
            <FormInput
              label="Password"
              name="password"
              type="password"
              value={formData.password || ''}
              onChange={handleInputChange}
              required
              placeholder="Minimum 6 characters"
            />
              <FormInput
                label="Your Admin Password (to remain logged in)"
                name="adminPassword"
                type="password"
                value={adminPasswordForReauth || ''}
                onChange={(e) => setAdminPasswordForReauth(e.target.value)}
                required
                placeholder="Enter your password to stay logged in"
              />
            </>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Role</label>
            <Select
              value={formData.role}
              onChange={(v) => setFormData(prev => ({ ...prev, role: v as any }))}
              options={[
                { value: 'mainAdmin', label: 'Main Admin' },
                { value: 'Admin', label: 'Admin' },
                { value: 'Cashier', label: 'Cashier' },
                { value: 'Stock Manager', label: 'Stock Manager' },
              ]}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
            <Select
              value={formData.status}
              onChange={(v) => setFormData(prev => ({ ...prev, status: v as any }))}
              options={[
                { value: 'Active', label: 'Active' },
                { value: 'Inactive', label: 'Inactive' },
              ]}
            />
          </div>
          
          {/* Working Hours Section */}
          <div className="col-span-2">
            <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-3">Working Hours</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Start Time</label>
                <input
                  type="time"
                  value={formData.workingHours?.startTime || '09:00'}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    workingHours: {
                      ...prev.workingHours!,
                      startTime: e.target.value
                    }
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#4A90A4] focus:border-transparent dark:bg-gray-700 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">End Time</label>
                <input
                  type="time"
                  value={formData.workingHours?.endTime || '17:00'}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    workingHours: {
                      ...prev.workingHours!,
                      endTime: e.target.value
                    }
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#4A90A4] focus:border-transparent dark:bg-gray-700 dark:text-white"
                />
              </div>
            </div>
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Working Days</label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => (
                  <label key={day} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={formData.workingHours?.workingDays?.includes(day) || false}
                      onChange={(e) => {
                        const currentDays = formData.workingHours?.workingDays || [];
                        const newDays = e.target.checked
                          ? [...currentDays, day]
                          : currentDays.filter(d => d !== day);
                        setFormData(prev => ({
                          ...prev,
                          workingHours: {
                            ...prev.workingHours!,
                            workingDays: newDays
                          }
                        }));
                      }}
                      className="w-4 h-4 text-[#4A90A4] bg-gray-100 border-gray-300 rounded focus:ring-[#4A90A4] dark:focus:ring-[#4A90A4] dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">{day}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <div className="flex justify-end space-x-2 pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setIsModalOpen(false);
                setEditingEmployee(null);
                setFormData({ 
        name: '', 
        email: '', 
        password: '', 
        role: 'mainAdmin', 
        status: 'Active', 
        avatar: '',
        workingHours: {
          startTime: '09:00',
          endTime: '17:00',
          workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
        }
      });
          setAdminPasswordForReauth(null);
              }}
            >
              Cancel
            </Button>
            <Button type="submit">{editingEmployee ? 'Update' : 'Add'} Employee</Button>
          </div>
        </form>
      </Modal>

      <ConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={confirmDeleteEmployee}
        title="Delete Employee"
        message="Are you sure you want to delete this employee? This action cannot be undone."
        type="danger"
        confirmText="Delete"
        cancelText="Cancel"
      />

      {/* Employee Management Modal */}
      <Modal
        open={showManageModal}
        onClose={() => {
          setShowManageModal(false);
          setSelectedEmployee(null);
          setEmployeeStats(null);
          setEmployeeOrders([]);
          setEmployeeChats([]);
          setEmployeeActivities([]);
        }}
        title="Manage Employees"
        size="lg"
      >
        <div className="space-y-6">
          {/* Employee Selection */}
          {!selectedEmployee ? (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Select Employee to Manage</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-96 overflow-y-auto">
                {employees.map((employee) => (
                  <div
                    key={employee.id}
                    onClick={() => handleManageEmployee(employee)}
                    className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-[#4A90A4] rounded-full flex items-center justify-center text-white font-semibold">
                        {employee.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900 dark:text-white">{employee.name}</h4>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{employee.email}</p>
                        <div className="flex items-center space-x-2 mt-1">
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            employee.status === 'Active' 
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                              : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400'
                          }`}>
                            {employee.status}
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">{employee.role}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div>
              {/* Employee Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-[#4A90A4] rounded-full flex items-center justify-center text-white font-semibold text-lg">
                    {selectedEmployee.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white">{selectedEmployee.name}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{selectedEmployee.email} • {selectedEmployee.role}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={async () => {
                      if (selectedEmployee?.id) {
                        await Promise.all([
                          fetchEmployeeStats(selectedEmployee.id),
                          fetchEmployeeChats(selectedEmployee.id),
                          fetchEmployeeActivities(selectedEmployee.id)
                        ]);
                      }
                    }}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    title="Refresh Data"
                  >
                    <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </button>
                  <button
                    onClick={() => {
                      setSelectedEmployee(null);
                      setEmployeeStats(null);
                      setEmployeeOrders([]);
                      setEmployeeChats([]);
                      setEmployeeActivities([]);
                    }}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    title="Close"
                  >
                    <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex space-x-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
                {[
                  { id: 'overview', label: 'Overview' },
                  { id: 'orders', label: 'Orders' },
                  { id: 'chats', label: 'AI Chats' },
                  { id: 'activity', label: 'Activity' }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                      activeTab === tab.id
                        ? 'bg-white dark:bg-gray-700 text-[#4A90A4] shadow-sm'
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Tab Content */}
              <div className="mt-6">
                {activeTab === 'overview' && (
                  <div className="space-y-6">
                    {/* Stats Cards */}
                    {employeeStats && (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                          <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Orders</h4>
                          <p className="text-2xl font-bold text-gray-900 dark:text-white">{employeeStats.totalOrders}</p>
                        </div>
                        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                          <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Sales</h4>
                          <p className="text-2xl font-bold text-gray-900 dark:text-white">KSH {employeeStats.totalSales.toLocaleString()}</p>
                        </div>
                        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                          <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">Avg Order Value</h4>
                          <p className="text-2xl font-bold text-gray-900 dark:text-white">KSH {employeeStats.averageOrderValue.toLocaleString()}</p>
                        </div>
                      </div>
                    )}

                    {/* Working Hours */}
                    {selectedEmployee.workingHours && (
                      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                        <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Working Hours</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Schedule</p>
                            <p className="font-medium text-gray-900 dark:text-white">
                              {selectedEmployee.workingHours.startTime} - {selectedEmployee.workingHours.endTime}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Working Days</p>
                            <p className="font-medium text-gray-900 dark:text-white">
                              {selectedEmployee.workingHours.workingDays.join(', ')}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Status */}
                    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                      <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Current Status</h4>
                      <div className="flex items-center space-x-2">
                        <div className={`w-3 h-3 rounded-full ${
                          (() => {
                            // Check if employee has recent login without logout
                            const recentLogin = employeeActivities.find(activity => 
                              activity.action === 'login' && 
                              activity.timestamp > new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
                            );
                            const recentLogout = employeeActivities.find(activity => 
                              activity.action === 'logout' && 
                              activity.timestamp > new Date(Date.now() - 24 * 60 * 60 * 1000) &&
                              activity.timestamp > (recentLogin?.timestamp || new Date(0))
                            );
                            return recentLogin && !recentLogout;
                          })() ? 'bg-green-500' : 'bg-gray-400'
                        }`}></div>
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          {(() => {
                            const recentLogin = employeeActivities.find(activity => 
                              activity.action === 'login' && 
                              activity.timestamp > new Date(Date.now() - 24 * 60 * 60 * 1000)
                            );
                            const recentLogout = employeeActivities.find(activity => 
                              activity.action === 'logout' && 
                              activity.timestamp > new Date(Date.now() - 24 * 60 * 60 * 1000) &&
                              activity.timestamp > (recentLogin?.timestamp || new Date(0))
                            );
                            return recentLogin && !recentLogout ? 'Currently Active' : 'Not Active';
                          })()}
                        </span>
                      </div>
                      {employeeActivities.length > 0 && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Last activity: {employeeActivities[0].timestamp.toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {activeTab === 'orders' && (
                  <div className="space-y-4">
                    <h4 className="text-lg font-semibold text-gray-900 dark:text-white">Recent Orders</h4>
                    {employeeOrders.length > 0 ? (
                      <div className="space-y-2">
                        {employeeOrders.slice(0, 10).map((order: any) => (
                          <div key={order.id} className="bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="font-medium text-gray-900 dark:text-white">Order #{order.id.slice(-8)}</p>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                  {order.createdAt?.toLocaleString()}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="font-semibold text-gray-900 dark:text-white">KSH {order.total?.toLocaleString() || '0'}</p>
                                <p className="text-sm text-gray-500 dark:text-gray-400">{order.status}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-500 dark:text-gray-400 text-center py-8">No orders found</p>
                    )}
                  </div>
                )}

                {activeTab === 'chats' && (
                  <div className="space-y-4">
                    <h4 className="text-lg font-semibold text-gray-900 dark:text-white">AI Assistant Chats</h4>
                    {employeeChats.length > 0 ? (
                      <div className="space-y-4">
                        {(() => {
                          // Group chats by date
                          const groupedChats = employeeChats.reduce((groups: any, chat) => {
                            const date = chat.updatedAt?.toDateString() || 'Unknown Date';
                            if (!groups[date]) {
                              groups[date] = [];
                            }
                            groups[date].push(chat);
                            return groups;
                          }, {});

                          return Object.entries(groupedChats).map(([date, chats]: [string, any]) => (
                            <div key={date} className="space-y-2">
                              {/* Day Ribbon */}
                              <div className="flex items-center space-x-2">
                                <div className="h-px bg-gray-300 dark:bg-gray-600 flex-1"></div>
                                <div className="bg-[#4A90A4] text-white px-3 py-1 rounded-full text-sm font-medium">
                                  {date}
                                </div>
                                <div className="h-px bg-gray-300 dark:bg-gray-600 flex-1"></div>
                              </div>
                              
                              {/* Chats for this day */}
                              <div className="space-y-2">
                                {chats.map((chat: any) => (
                                  <div 
                                    key={chat.id} 
                                    onClick={() => handleViewChat(chat)}
                                    className="bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                                  >
                                    <div className="flex justify-between items-start">
                                      <div>
                                        <p className="font-medium text-gray-900 dark:text-white">{chat.title || 'Untitled Chat'}</p>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">
                                          {chat.updatedAt?.toLocaleTimeString() || 'Unknown time'}
                                        </p>
                                        {chat.topic && (
                                          <span className="inline-block px-2 py-1 text-xs bg-[#4A90A4]/10 text-[#4A90A4] rounded-full mt-1">
                                            {chat.topic}
                                          </span>
                                        )}
                                      </div>
                                      <div className="text-right">
                                        <p className="text-sm text-gray-500 dark:text-gray-400">
                                          {chat.messageCount || 0} messages
                                        </p>
                                        <p className="text-xs text-[#4A90A4] mt-1">Click to view</p>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ));
                        })()}
                      </div>
                    ) : (
                      <p className="text-gray-500 dark:text-gray-400 text-center py-8">No AI chats found</p>
                    )}
                  </div>
                )}

                {activeTab === 'activity' && (
                  <div className="space-y-4">
                    <h4 className="text-lg font-semibold text-gray-900 dark:text-white">Login/Logout Activity</h4>
                    {employeeActivities.length > 0 ? (
                      <div className="space-y-2">
                        {employeeActivities.map((activity) => (
                          <div key={activity.id} className="bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                            <div className="flex justify-between items-start">
                              <div className="flex items-center space-x-3">
                                <div className={`w-3 h-3 rounded-full ${
                                  activity.action === 'login' ? 'bg-green-500' : 'bg-red-500'
                                }`}></div>
                                <div>
                                  <p className="font-medium text-gray-900 dark:text-white">
                                    {activity.action === 'login' ? 'Logged In' : 'Logged Out'}
                                  </p>
                                  <p className="text-sm text-gray-500 dark:text-gray-400">
                                    {activity.timestamp.toLocaleString()}
                                  </p>
                                </div>
                              </div>
                              <div className="text-right">
                                {activity.ipAddress && (
                                  <p className="text-xs text-gray-500 dark:text-gray-400">
                                    IP: {activity.ipAddress}
                                  </p>
                                )}
                                {activity.userAgent && (
                                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-32">
                                    {activity.userAgent.split(' ')[0]}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-500 dark:text-gray-400 text-center py-8">No activity found</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Chat Viewer Modal */}
      <Modal
        open={showChatViewer}
        onClose={() => {
          setShowChatViewer(false);
          setSelectedChat(null);
        }}
        title={`Chat: ${selectedChat?.title || 'Untitled Chat'}`}
        size="lg"
      >
        {selectedChat && (
          <div className="space-y-4">
            {/* Chat Header */}
            <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {selectedChat.title || 'Untitled Chat'}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {selectedChat.topic && `Topic: ${selectedChat.topic}`}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    {selectedChat.updatedAt?.toLocaleString() || 'Unknown date'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {selectedChat.messageCount || 0} messages
                  </p>
                  {selectedChat.category && (
                    <span className={`inline-block px-2 py-1 text-xs rounded-full mt-1 ${
                      selectedChat.category === 'sales' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                      selectedChat.category === 'inventory' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                      selectedChat.category === 'customer' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' :
                      'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                    }`}>
                      {selectedChat.category}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Chat Messages */}
            <div className="max-h-96 overflow-y-auto space-y-3">
              {selectedChat.messages && selectedChat.messages.length > 0 ? (
                selectedChat.messages.map((message: any, index: number) => (
                  <div key={index} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] px-4 py-2 rounded-lg ${
                      message.role === 'user' 
                        ? 'bg-[#4A90A4] text-white' 
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
                    }`}>
                      <div className="flex items-start space-x-2">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold ${
                          message.role === 'user' 
                            ? 'bg-white/20 text-white' 
                            : 'bg-[#4A90A4] text-white'
                        }`}>
                          {message.role === 'user' ? 'U' : 'AI'}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium mb-1">
                            {message.role === 'user' ? 'You' : 'AI Assistant'}
                          </p>
                          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                          {message.ts && (
                            <p className="text-xs opacity-70 mt-1">
                              {new Date(message.ts).toLocaleTimeString()}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <p>No messages found in this chat.</p>
                </div>
              )}
            </div>

            {/* Chat Footer */}
            <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
              <div className="flex justify-between items-center text-sm text-gray-500 dark:text-gray-400">
                <span>Chat ID: {selectedChat.id}</span>
                <span>Employee: {selectedEmployee?.name}</span>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Employees;