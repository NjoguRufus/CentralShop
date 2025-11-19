import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';
// Removed AI assistants
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import Login from './pages/Login';
import Setup from './pages/Setup';
import DeveloperDashboard from './pages/DeveloperDashboard';
import Layout from './components/Layout/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import RoleBasedRedirect from './components/RoleBasedRedirect';
import Dashboard from './pages/Dashboard';
import Inventory from './pages/Inventory';
import POSSystem from './pages/POSSystem';
import Customers from './pages/Customers';
import Orders from './pages/Orders';
import Invoicing from './pages/Invoicing';
import Suppliers from './pages/Suppliers';
import Expenses from './pages/Expenses';
import StockReports from './pages/StockReports';
import Employees from './pages/Employees';
import Settings from './pages/Settings';

const AppContent: React.FC = () => {
  const { user, currentUser, loading } = useAuth();
  const { theme } = useTheme();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-black flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-[#4A90A4] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className={theme}>
      <Router>
        <Routes>
          <Route path="/setup" element={<Setup />} />
          {!user ? (
            <Route path="*" element={<Login />} />
          ) : (
            <>
              {/* Developer Dashboard - Only for astraronix role */}
              <Route path="/developer" element={
                <ProtectedRoute requiredRole="astraronix">
                  <DeveloperDashboard />
                </ProtectedRoute>
              } />
              
              {/* Regular Shop Dashboard */}
              <Route path="/" element={<Layout />}>
                <Route index element={<RoleBasedRedirect />} />
                <Route path="dashboard" element={
                  <ProtectedRoute requiredRole="Admin">
                    <Dashboard />
                  </ProtectedRoute>
                } />
                <Route path="inventory" element={
                  <ProtectedRoute requiredRole="Stock Manager">
                    <Inventory />
                  </ProtectedRoute>
                } />
                <Route path="pos" element={
                  <ProtectedRoute requiredRole="Cashier">
                    <POSSystem />
                  </ProtectedRoute>
                } />
                <Route path="customers" element={
                  <ProtectedRoute requiredRole="Admin">
                    <Customers />
                  </ProtectedRoute>
                } />
                <Route path="orders" element={
                  <ProtectedRoute requiredRole="Cashier">
                    <Orders />
                  </ProtectedRoute>
                } />
                <Route path="invoicing" element={
                  <ProtectedRoute requiredRole="Admin">
                    <Invoicing />
                  </ProtectedRoute>
                } />
                <Route path="suppliers" element={
                  <ProtectedRoute requiredRole="Admin">
                    <Suppliers />
                  </ProtectedRoute>
                } />
                <Route path="expenses" element={
                  <ProtectedRoute requiredRole="Admin">
                    <Expenses />
                  </ProtectedRoute>
                } />
                <Route path="stock-reports" element={
                  <ProtectedRoute requiredRole="Admin">
                    <StockReports />
                  </ProtectedRoute>
                } />
                <Route path="employees" element={
                  <ProtectedRoute requiredRole="Admin">
                    <Employees />
                  </ProtectedRoute>
                } />
                <Route path="settings" element={
                  <ProtectedRoute requiredRole="Admin">
                    <Settings />
                  </ProtectedRoute>
                } />
              </Route>
            </>
          )}
        </Routes>
        <Toaster 
          position="top-right"
          toastOptions={{
            className: 'dark:bg-gray-800 dark:text-white',
            duration: 3000,
          }}
        />
        <ToastContainer
          position="top-right"
          autoClose={3000}
          hideProgressBar={false}
          newestOnTop={false}
          closeOnClick
          rtl={false}
          pauseOnFocusLoss
          draggable
          pauseOnHover
          theme="colored"
        />
      </Router>
    </div>
  );
};

function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <NotificationProvider>
          <AppContent />
        </NotificationProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}

export default App;
