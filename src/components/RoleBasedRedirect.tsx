import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import LoadingSpinner from './UI/LoadingSpinner';

const RoleBasedRedirect: React.FC = () => {
  const { currentUser, user, loading } = useAuth();

  // Debug logging
  console.log('RoleBasedRedirect - loading:', loading);
  console.log('RoleBasedRedirect - user:', user);
  console.log('RoleBasedRedirect - currentUser:', currentUser);
  console.log('RoleBasedRedirect - user role:', currentUser?.role);

  // Show loading while user data is being fetched
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="md" />
      </div>
    );
  }

  // If Firebase user exists but Firestore user data is not loaded yet
  if (user && !currentUser) {
    // Wait a bit for currentUser to load (in case it's still fetching)
    // After a reasonable timeout, show an error message
    const [showError, setShowError] = React.useState(false);
    
    React.useEffect(() => {
      const timer = setTimeout(() => {
        setShowError(true);
      }, 3000); // Show error after 3 seconds
      
      return () => clearTimeout(timer);
    }, []);
    
    if (showError) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center max-w-md p-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Account Not Found
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Your account is authenticated but no user record was found in the database.
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-500 mb-4">
              Email: {user?.email || 'Not available'}<br />
              UID: {user?.uid || 'Not available'}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-500">
              Please contact an administrator to set up your account.
            </p>
          </div>
        </div>
      );
    }
    
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="md" showText text="Loading user data..." />
      </div>
    );
  }

  // If no user at all, redirect to login
  if (!user && !currentUser) {
    console.log('No user data, redirecting to login');
    return <Navigate to="/login" replace />;
  }

  // Redirect based on user role
  switch (currentUser.role) {
    case 'astraronix':
      console.log('Redirecting to developer dashboard');
      return <Navigate to="/developer" replace />;
    case 'Cashier':
      console.log('Redirecting to POS (cashier dashboard)');
      return <Navigate to="/pos" replace />;
    case 'Stock Manager':
      console.log('Redirecting to inventory (stock manager dashboard)');
      return <Navigate to="/inventory" replace />;
    case 'Admin':
    case 'mainAdmin':
      console.log('Redirecting to admin dashboard');
      return <Navigate to="/dashboard" replace />;
    default:
      console.log('Default redirect to admin dashboard for role:', currentUser.role);
      return <Navigate to="/dashboard" replace />;
  }
};

export default RoleBasedRedirect;


