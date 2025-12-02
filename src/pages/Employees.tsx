// src/pages/Employees.tsx
import React, { useState, useEffect } from 'react';
import { collection, getDocs, doc, query, orderBy, where } from 'firebase/firestore';
import { addDoc, updateDoc, deleteDoc } from '../offline/firestoreWrappers';
import { createUserWithEmailAndPassword, updateProfile, signOut, signInWithEmailAndPassword } from 'firebase/auth';
import { db, auth } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { getShopCollectionName, getUserCollectionName, BRANCHES, BranchName } from '../config/shopConfig';
import Dropdown from '../components/UI/Dropdown';
import Modal from '../components/Modal';
import Card from '../components/UI/Card';
import Table from '../components/UI/Table';
import FormInput from '../components/UI/FormInput';
import Button from '../components/UI/Button';
import ConfirmationModal from '../components/UI/ConfirmationModal';
import { toast } from 'react-toastify';
import Select from '../components/UI/Select';
import { generateEmployeeId } from '../utils/generateEmployeeId';

interface Employee {
  id?: string;
  name: string;
  email: string;
  password?: string;
  role: 'astraronix' | 'mainAdmin' | 'Admin' | 'Cashier' | 'Stock Manager';
  status: 'Active' | 'Inactive';
  avatar?: string;
  uid?: string; // Firebase Auth UID
  customId?: string; // Custom employee ID (CSH-00-001, MNG-00-001, ADM-00, etc.)
  shopId?: string; // For multi-tenant support
  shopName?: string; // For display purposes
  assignedShops?: string[]; // Shops the user can access (CentralShop, KamweneShop, or both)
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
  const { currentUser, ignoreAuthStateChange, clearIgnoreAuthStateChange } = useAuth();
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
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [showCredentialsModal, setShowCredentialsModal] = useState<boolean>(false);
  const [newEmployeeCredentials, setNewEmployeeCredentials] = useState<{ email: string; password: string } | null>(null);
  const [selectedBranch, setSelectedBranch] = useState<string>('CentralShop');

  // Determine if user can switch between shops
  const canSwitchBranches =
    (Array.isArray((currentUser as any)?.assignedShops) &&
      new Set(
        ((currentUser as any).assignedShops as string[]).map(s => s.replace(/\s+/g, '').toLowerCase())
      ).size > 1) ||
    currentUser?.role === 'mainAdmin' ||
    currentUser?.role === 'Admin' ||
    currentUser?.role === 'astraronix';
  const [formData, setFormData] = useState<Omit<Employee, 'id'>>({
    name: '',
    email: '',
    password: '',
    role: 'mainAdmin',
    status: 'Active',
    avatar: '',
    assignedShops: [BRANCHES.CENTRAL], // Default to CentralShop
    workingHours: {
      startTime: '09:00',
      endTime: '17:00',
      workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
    }
  });

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
    fetchEmployees();
  }, [selectedBranch]);


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
      const employeesCollectionName = getShopCollectionName('employees', selectedBranch as BranchName);
      const q = query(collection(db, employeesCollectionName), orderBy('name'));
      const querySnapshot = await getDocs(q);
      const employeesData: Employee[] = [];
      querySnapshot.forEach((doc) => {
        const userData = doc.data() as Employee;
        // Normalize shop name for comparison (handle legacy records)
        const recordShopName = (userData.shopName || '').replace(/\s+/g, '');
        const selectedShopName = selectedBranch.replace(/\s+/g, '');

        // Filter out astraronix users and ensure employees belong to the selected branch
        const isAstraronix = userData.role === 'astraronix';
        const isInSelectedBranch =
          !recordShopName // legacy records without shopName – treat as CentralShop
            ? selectedShopName === BRANCHES.CENTRAL
            : recordShopName === selectedShopName ||
              (Array.isArray(userData.assignedShops) &&
                userData.assignedShops
                  .map(s => s.replace(/\s+/g, ''))
                  .includes(selectedShopName));

        if (!isAstraronix && isInSelectedBranch) {
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
    setIsSubmitting(true);
    try {
      if (editingEmployee && editingEmployee.id) {
        // Update existing employee and move them between shops if needed
        const { password, ...updateData } = formData;

        // Preserve existing fields like uid, customId, createdAt, etc.
        const { id: _ignoreId, ...existingData } = editingEmployee;

        // Determine updated assigned shops
        const assignedShops =
          updateData.assignedShops && updateData.assignedShops.length > 0
            ? updateData.assignedShops
            : [selectedBranch];
        
        // Ensure at least one shop is assigned
        if (assignedShops.length === 0) {
          toast.error('Please select at least one shop for this employee');
          setIsSubmitting(false);
          return;
        }

        // Normalize previous and new primary shop to known branches
        const normalizeBranch = (value: string | undefined): BranchName => {
          const key = (value || '').toLowerCase().replace(/\s+/g, '');
          if (key.includes('kamwene')) return BRANCHES.KAMWENE;
          return BRANCHES.CENTRAL;
        };

        const previousPrimaryShop = normalizeBranch(editingEmployee.shopName);
        const previousAssignedShops = editingEmployee.assignedShops || [previousPrimaryShop];
        const primaryFromAssigned = normalizeBranch(
          assignedShops.length > 0 ? assignedShops[0] : previousPrimaryShop
        );
        const newPrimaryShop = primaryFromAssigned;

        // Build final data to store on employee docs
        const updateDataWithPassword = password ? { ...updateData, password } : updateData;
        const mergedEmployeeData = {
          ...existingData,
          ...updateDataWithPassword,
          assignedShops,
          shopName: newPrimaryShop,
          updatedAt: new Date(),
        };

        // === Update ALL shop collections where employee exists or should exist ===
        const allShops = [...new Set([...previousAssignedShops, ...assignedShops])];
        const updatePromises: Promise<any>[] = [];
        
        for (const shop of allShops) {
          const normalizedShop = normalizeBranch(shop);
          const userCollectionName = getUserCollectionName(currentUser?.shopId, normalizedShop);
          const employeesCollectionName = getShopCollectionName('employees', normalizedShop);
          
          // Check if employee exists in this shop's user collection
          const userQuery = query(
            collection(db, userCollectionName),
            where('uid', '==', editingEmployee.uid || '')
          );
          const userSnapshot = await getDocs(userQuery);
          
          // Check if employee exists in this shop's employees collection
          const employeesQuery = query(
            collection(db, employeesCollectionName),
            where('uid', '==', editingEmployee.uid || '')
          );
          const employeesSnapshot = await getDocs(employeesQuery);
          
          if (assignedShops.includes(shop) || assignedShops.includes(normalizedShop)) {
            // Employee should exist in this shop - create or update
            const shopSpecificData = {
              ...mergedEmployeeData,
              shopName: normalizedShop // Set shopName to the specific shop for this collection
            };
            
            if (!userSnapshot.empty) {
              // Update existing user document
              updatePromises.push(
                updateDoc(userSnapshot.docs[0].ref, shopSpecificData)
              );
            } else {
              // Create new user document in this shop
              updatePromises.push(
                addDoc(collection(db, userCollectionName), shopSpecificData)
              );
            }
            
            if (!employeesSnapshot.empty) {
              // Update existing employee document
              updatePromises.push(
                updateDoc(employeesSnapshot.docs[0].ref, shopSpecificData)
              );
            } else {
              // Create new employee document in this shop
              updatePromises.push(
                addDoc(collection(db, employeesCollectionName), shopSpecificData)
              );
            }
          } else {
            // Employee should NOT exist in this shop - delete if exists
            if (!userSnapshot.empty) {
              updatePromises.push(
                deleteDoc(userSnapshot.docs[0].ref)
              );
            }
            if (!employeesSnapshot.empty) {
              updatePromises.push(
                deleteDoc(employeesSnapshot.docs[0].ref)
              );
            }
          }
        }
        
        // Wait for all updates to complete
        await Promise.all(updatePromises);
        
        console.log(`✅ Employee updated in ${assignedShops.length} shop(s): ${assignedShops.join(', ')}`);

        toast.success(`Employee updated successfully in ${assignedShops.length} shop(s)`);
        setIsModalOpen(false);
        setEditingEmployee(null);
        setFormData({ 
          name: '', 
          email: '', 
          password: '', 
          role: 'mainAdmin', 
          status: 'Active', 
          avatar: '',
          assignedShops: [selectedBranch as any], // Reset to selected branch
          workingHours: {
            startTime: '09:00',
            endTime: '17:00',
            workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
          }
        });
      } else {
        // Create new employee with Firebase Auth
        if (!formData.password) {
          toast.error('Password is required for new employees');
          setIsSubmitting(false);
          return;
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const trimmedEmail = formData.email?.trim();
        
        if (!trimmedEmail) {
          toast.error('Email is required');
          setIsSubmitting(false);
          return;
        }
        
        if (!emailRegex.test(trimmedEmail)) {
          toast.error('Please enter a valid email address');
          setIsSubmitting(false);
          return;
        }

        // Validate password length
        if (formData.password.length < 6) {
          toast.error('Password must be at least 6 characters');
          setIsSubmitting(false);
          return;
        }

        // Store current admin info before creating employee
        const currentAdminEmail = currentUser?.email;
        const currentAdminUid = currentUser?.uid;
        const currentAdminPassword = adminPasswordForReauth;
        
        // Store the employee password before creating (we'll show it in modal)
        const employeePassword = formData.password;
        
        // IMPORTANT: If admin password is not provided, require it to prevent logout
        if (!currentAdminPassword) {
          toast.error('Please enter your admin password to stay logged in after creating the employee');
          setIsSubmitting(false);
          return;
        }
        
        // CRITICAL: Tell AuthContext to ignore temporary auth state changes during employee creation
        // This prevents the logout that happens when createUserWithEmailAndPassword signs in the new user
        ignoreAuthStateChange(10000); // Ignore for 10 seconds (should be enough)
        
        // Create Firebase Auth user (this will automatically sign in the new user)
        const userCredential = await createUserWithEmailAndPassword(
          auth, 
          trimmedEmail, 
          employeePassword
        );
        
        // Update the user's display name
        await updateProfile(userCredential.user, {
          displayName: formData.name
        });

        // Determine which shops this employee should be saved to
        // Use assignedShops from form, or default to selectedBranch
        const assignedShops = formData.assignedShops && formData.assignedShops.length > 0
          ? formData.assignedShops
          : [selectedBranch];
        
        // Ensure at least one shop is assigned
        if (assignedShops.length === 0) {
          toast.error('Please select at least one shop for this employee');
          setIsSubmitting(false);
          return;
        }

        // Generate custom employee ID based on role (check all assigned shops for existing IDs)
        const allExistingCustomIds: string[] = [];
        for (const shop of assignedShops) {
          const employeesCollectionName = getShopCollectionName('employees', shop as BranchName);
          const existingEmployeesQuery = query(collection(db, employeesCollectionName));
          const existingEmployeesSnapshot = await getDocs(existingEmployeesQuery);
          const customIds = existingEmployeesSnapshot.docs
            .map(doc => doc.data().customId)
            .filter((id): id is string => !!id);
          allExistingCustomIds.push(...customIds);
        }
        
        const { customId } = generateEmployeeId(formData.role, allExistingCustomIds);

        // Prepare employee data
        const employeeData = {
          ...formData,
          email: trimmedEmail, // Use trimmed email
          uid: userCredential.user.uid,
          customId: customId, // Add custom ID
          shopId: currentUser?.shopId,
          shopName: assignedShops[0], // Primary shop (first in list)
          assignedShops: assignedShops, // All shops this employee can access
          createdAt: new Date(),
          updatedAt: new Date()
        };
        
        // Check for duplicate user across ALL assigned shops before creating
        for (const shop of assignedShops) {
          const userCollectionName = getUserCollectionName(currentUser?.shopId, shop);
          
          // Check by email
          const existingUsersQuery = query(
            collection(db, userCollectionName),
            where('email', '==', trimmedEmail)
          );
          const existingUsersSnapshot = await getDocs(existingUsersQuery);
          
          if (!existingUsersSnapshot.empty) {
            toast.error(`A user with this email already exists in ${shop}`);
            setIsSubmitting(false);
            return;
          }
          
          // Check by UID
          const existingUidQuery = query(
            collection(db, userCollectionName),
            where('uid', '==', userCredential.user.uid)
          );
          const existingUidSnapshot = await getDocs(existingUidQuery);
          
          if (!existingUidSnapshot.empty) {
            toast.error(`A user with this account already exists in ${shop}`);
            setIsSubmitting(false);
            return;
          }
        }
        
        // Save employee to ALL assigned shop collections
        const savePromises: Promise<any>[] = [];
        
        for (const shop of assignedShops) {
          const userCollectionName = getUserCollectionName(currentUser?.shopId, shop);
          const employeesCollectionName = getShopCollectionName('employees', shop as BranchName);
          
          // Save to user collection (e.g., CentralShopStaff, KamweneStaff)
          savePromises.push(
            addDoc(collection(db, userCollectionName), {
              ...employeeData,
              shopName: shop // Set shopName to the specific shop for this collection
            })
          );
          
          // Also save to employees collection for backward compatibility
          savePromises.push(
            addDoc(collection(db, employeesCollectionName), {
              ...employeeData,
              shopName: shop // Set shopName to the specific shop for this collection
            })
          );
        }
        
        // Wait for all saves to complete
        await Promise.all(savePromises);
        
        console.log(`✅ Employee created in ${assignedShops.length} shop(s): ${assignedShops.join(', ')}`);

        // CRITICAL: Sign out the newly created user and immediately sign admin back in
        // This must happen in rapid succession to prevent the auth state change from propagating
        // We do this in a single try-catch to ensure atomicity
        try {
          // Step 1: Sign out the newly created user (if they're still signed in)
          if (auth.currentUser && auth.currentUser.uid === userCredential.user.uid) {
          await signOut(auth);
          }
          
          // Step 2: Immediately sign the admin back in (no delay, no await between operations)
          // This must happen right after signOut to minimize the auth state change window
          await signInWithEmailAndPassword(auth, currentAdminEmail!, currentAdminPassword!);
          
          // Step 3: Clear the ignore flag so the admin's sign-in is properly processed
          // This ensures the final auth state change (admin signing back in) is handled normally
          clearIgnoreAuthStateChange();
          
          // Success - admin session restored
          toast.success(`Employee created successfully in ${assignedShops.length} shop(s): ${assignedShops.join(', ')}`);
          // Clear the password from state for security
          setAdminPasswordForReauth(null);
        } catch (reauthError: any) {
          console.error('Error during auth restoration:', reauthError);
          toast.error('Employee created, but failed to restore your session. Please sign back in.');
          // Clear the password from state for security
          setAdminPasswordForReauth(null);
          setIsSubmitting(false);
          return;
        }

        // Store credentials to show in modal
        setNewEmployeeCredentials({
          email: trimmedEmail,
          password: employeePassword
        });
        setShowCredentialsModal(true);
      }
      // Reset form but keep modal open (like add products)
      if (!editingEmployee) {
        setFormData({ 
          name: '', 
          email: '', 
          password: '', 
          role: 'mainAdmin', 
          status: 'Active', 
          avatar: '',
          assignedShops: [selectedBranch as any], // Reset to selected branch
          workingHours: {
            startTime: '09:00',
            endTime: '17:00',
            workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
          }
        });
        setAdminPasswordForReauth(null);
      }
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
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyCredentials = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copied to clipboard!');
    } catch (error) {
      console.error('Failed to copy:', error);
      toast.error('Failed to copy to clipboard');
    }
  };

  const handleDelete = (id: string): void => {
    setEmployeeToDelete(id);
    setShowDeleteModal(true);
  };

  const confirmDeleteEmployee = async (): Promise<void> => {
    if (!employeeToDelete) return;

    try {
      await deleteDoc(doc(db, getShopCollectionName('employees', selectedBranch as BranchName), employeeToDelete));
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
      password: '', // Don't pre-fill password
      role: employee.role,
      status: employee.status,
      avatar: employee.avatar || '',
      assignedShops: employee.assignedShops || [BRANCHES.CENTRAL],
      workingHours: employee.workingHours || {
        startTime: '09:00',
        endTime: '17:00',
        workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
      }
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
        assignedShops: [BRANCHES.CENTRAL],
        workingHours: {
          startTime: '09:00',
          endTime: '17:00',
          workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
        }
      });
          setAdminPasswordForReauth(null);
        }}
        title={editingEmployee ? 'Edit Employee' : 'Add Employee'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
            <div className="flex flex-col justify-end">
              {formData.avatar && (
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  Avatar preview
                </div>
              )}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
          </div>
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
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                <p className="text-xs text-blue-800 dark:text-blue-200 mb-2">
                  <strong>Required:</strong> Enter your admin password below to stay logged in after creating the employee. This is required to maintain your session.
                </p>
                <FormInput
                  label="Your Admin Password"
                  name="adminPassword"
                  type="password"
                  value={adminPasswordForReauth || ''}
                  onChange={(e) => setAdminPasswordForReauth(e.target.value)}
                  placeholder="Enter your password to stay logged in"
                  required
                />
              </div>
            </>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
          </div>
          
          {/* Shop Assignment - Only for Central Shop admins */}
          {(currentUser?.shopName === 'CentralShop' || currentUser?.role === 'mainAdmin' || currentUser?.role === 'Admin') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Assigned Shops
              </label>
              <div className="space-y-2">
                {Object.values(BRANCHES).map((shop) => (
                  <label key={shop} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={formData.assignedShops?.includes(shop) || false}
                      onChange={(e) => {
                        const currentShops = formData.assignedShops || [];
                        if (e.target.checked) {
                          setFormData(prev => ({
                            ...prev,
                            assignedShops: [...currentShops, shop]
                          }));
                        } else {
                          setFormData(prev => ({
                            ...prev,
                            assignedShops: currentShops.filter(s => s !== shop)
                          }));
                        }
                      }}
                      className="h-4 w-4 rounded border-gray-300 text-[#4A90A4] focus:ring-[#4A90A4]"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {shop === BRANCHES.CENTRAL ? 'Central Shop' : 'Kamwene Shop'}
                    </span>
                  </label>
                ))}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Select which shop(s) this user can access. Users with both shops selected can switch between them.
              </p>
            </div>
          )}
          
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
            <Button 
              type="submit" 
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <div className="flex items-center justify-center space-x-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Adding Employee...</span>
                </div>
              ) : (
                `${editingEmployee ? 'Update' : 'Add'} Employee`
              )}
            </Button>
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

      {/* Employee Credentials Modal */}
      <Modal
        open={showCredentialsModal}
        onClose={() => {
          setShowCredentialsModal(false);
          setNewEmployeeCredentials(null);
          setIsModalOpen(false);
        }}
        title="Employee Created Successfully"
        size="md"
      >
        {newEmployeeCredentials && (
          <div className="space-y-4">
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <p className="text-sm text-green-800 dark:text-green-200">
                Employee has been created successfully. Please copy the login credentials below and provide them to the employee.
              </p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Login Credentials (Copy All)
              </label>
              <div className="flex items-center space-x-2">
                <textarea
                  value={`Email: ${newEmployeeCredentials.email}\nPassword: ${newEmployeeCredentials.password}`}
                  readOnly
                  rows={3}
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white font-mono text-sm resize-none"
                  onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                />
                <Button
                  onClick={() => handleCopyCredentials(`Email: ${newEmployeeCredentials.email}\nPassword: ${newEmployeeCredentials.password}`)}
                  variant="secondary"
                  size="sm"
                  className="whitespace-nowrap"
                >
                  Copy All
                </Button>
              </div>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
              <p className="text-xs text-blue-800 dark:text-blue-200">
                <strong>Tip:</strong> Click on the text above or use the "Copy All" button to copy both email and password at once.
              </p>
            </div>

            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
              <p className="text-xs text-yellow-800 dark:text-yellow-200">
                <strong>Important:</strong> Make sure to securely share these credentials with the employee. They will need these to log in to the system.
              </p>
            </div>

            <div className="flex justify-end pt-4">
              <Button
                onClick={() => {
                  setShowCredentialsModal(false);
                  setNewEmployeeCredentials(null);
                  setIsModalOpen(false);
                }}
                variant="primary"
              >
                Done
              </Button>
            </div>
          </div>
        )}
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