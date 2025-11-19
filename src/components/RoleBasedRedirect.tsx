import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const RoleBasedRedirect: React.FC = () => {
  const { currentUser, loading } = useAuth();

  // Debug logging
  console.log('RoleBasedRedirect - loading:', loading);
  console.log('RoleBasedRedirect - currentUser:', currentUser);
  console.log('RoleBasedRedirect - user role:', currentUser?.role);

  // Show loading while user data is being fetched
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // If no user data, redirect to login
  if (!currentUser) {
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


