import React, { Suspense, lazy, useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';
// Removed AI assistants
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import Layout from './components/Layout/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import RoleBasedRedirect from './components/RoleBasedRedirect';
import AppUpdatePrompt from './components/AppUpdatePrompt';
import OfflineNotifier from './components/OfflineNotifier';
import Updater from './components/Updater';
import SyncQueueManager from './components/SyncQueueManager';
import BarcodeListener from './components/BarcodeListener';
import { initializeOfflineSync } from './offline';
import { useOfflineSync } from './offline/useSync';
import { registerPushNotifications } from './services/pushNotifications';
import { useAppKeyboardShortcuts } from './hooks/useKeyboardShortcuts';

// Lazy load heavy pages for better performance
const Login = lazy(() => import('./pages/Login'));
const Setup = lazy(() => import('./pages/Setup'));
const DeveloperDashboard = lazy(() => import('./pages/DeveloperDashboard'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Inventory = lazy(() => import('./pages/Inventory'));
const POSSystem = lazy(() => import('./pages/POSSystem'));
const Customers = lazy(() => import('./pages/Customers'));
const Orders = lazy(() => import('./pages/Orders'));
const Invoicing = lazy(() => import('./pages/Invoicing'));
const Suppliers = lazy(() => import('./pages/Suppliers'));
const Expenses = lazy(() => import('./pages/Expenses'));
const StockReports = lazy(() => import('./pages/StockReports'));
const Employees = lazy(() => import('./pages/Employees'));
const Settings = lazy(() => import('./pages/Settings'));
const ViewInvoice = lazy(() => import('./pages/ViewInvoice'));

import AppLoader from './components/UI/AppLoader';

// Skeleton loader component
const PageSkeleton: React.FC = () => (
  <div className="min-h-screen bg-black flex flex-col items-center justify-center">
    {/* Logo */}
    <div className="mb-8">
      <img
        src="/icons/CentalDarkmode.png"
        alt="Central POS Logo"
        className="h-20 md:h-24 w-auto opacity-90"
      />
    </div>
    {/* New Loader */}
    <AppLoader />
  </div>
);

// Component to initialize keyboard shortcuts inside Router context
const RouterContent: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Initialize keyboard shortcuts (now inside Router context)
  useAppKeyboardShortcuts();
  return <>{children}</>;
};

const AppContent: React.FC = () => {
  const { user, currentUser, loading } = useAuth();
  const { theme } = useTheme();
  const [showLoading, setShowLoading] = useState(true);
  
  // Initialize offline sync hook
  useOfflineSync(5); // Sync every 5 minutes when online

  useEffect(() => {
    // Initialize offline sync
    initializeOfflineSync().catch(console.error);
    
    // Register push notifications
    if ('Notification' in window) {
      registerPushNotifications().catch(console.error);
    }
  }, []);

  // Minimum 2 second loading screen
  useEffect(() => {
    if (!loading) {
      const timer = setTimeout(() => {
        setShowLoading(false);
      }, 2000);
      return () => clearTimeout(timer);
    } else {
      setShowLoading(true);
    }
  }, [loading]);

  if (loading || showLoading) {
    return <PageSkeleton />;
  }

  return (
    <div className={theme}>
      <BarcodeListener 
        onBarcode={(code) => {
          // Handle barcode - dispatch event for pages to listen to
          window.dispatchEvent(new CustomEvent('barcode-scanned', { detail: { barcode: code } }));
        }}
        enabled={true}
      />
      <OfflineNotifier />
      <AppUpdatePrompt />
      <Updater />
      <SyncQueueManager />
      <Router>
        <RouterContent>
          <Routes>
            <Route path="/setup" element={<Setup />} />
            {/* Public invoice view route - format: /{customerName}/invoice */}
            <Route path="/:customerName/invoice" element={<ViewInvoice />} />
            {!user ? (
              <Route path="*" element={<Login />} />
            ) : (
              <>
                {/* Developer Dashboard - Only for astraronix role */}
                <Route path="/developer" element={
                  <ProtectedRoute requiredRole="astraronix">
                    <Suspense fallback={<PageSkeleton />}>
                    <DeveloperDashboard />
                    </Suspense>
                  </ProtectedRoute>
                } />
                
                {/* Regular Shop Dashboard */}
                <Route path="/" element={<Layout />}>
                <Route index element={<RoleBasedRedirect />} />
                <Route path="dashboard" element={
                  <ProtectedRoute requiredRole="Admin">
                    <Suspense fallback={<PageSkeleton />}>
                    <Dashboard />
                    </Suspense>
                  </ProtectedRoute>
                } />
                <Route path="inventory" element={
                  <ProtectedRoute requiredRole="Stock Manager">
                    <Suspense fallback={<PageSkeleton />}>
                    <Inventory />
                    </Suspense>
                  </ProtectedRoute>
                } />
                <Route path="pos" element={
                  <ProtectedRoute requiredRole="Cashier">
                    <Suspense fallback={<PageSkeleton />}>
                    <POSSystem />
                    </Suspense>
                  </ProtectedRoute>
                } />
                <Route path="customers" element={
                  <ProtectedRoute requiredRole="Admin">
                    <Suspense fallback={<PageSkeleton />}>
                    <Customers />
                    </Suspense>
                  </ProtectedRoute>
                } />
                <Route path="orders" element={
                  <ProtectedRoute requiredRole="Cashier">
                    <Suspense fallback={<PageSkeleton />}>
                    <Orders />
                    </Suspense>
                  </ProtectedRoute>
                } />
                <Route path="invoicing" element={
                  <ProtectedRoute requiredRole="Admin">
                    <Suspense fallback={<PageSkeleton />}>
                    <Invoicing />
                    </Suspense>
                  </ProtectedRoute>
                } />
                <Route path="suppliers" element={
                  <ProtectedRoute requiredRole="Admin">
                    <Suspense fallback={<PageSkeleton />}>
                    <Suppliers />
                    </Suspense>
                  </ProtectedRoute>
                } />
                <Route path="expenses" element={
                  <ProtectedRoute requiredRole="Admin">
                    <Suspense fallback={<PageSkeleton />}>
                    <Expenses />
                    </Suspense>
                  </ProtectedRoute>
                } />
                <Route path="stock-reports" element={
                  <ProtectedRoute requiredRole="Admin">
                    <Suspense fallback={<PageSkeleton />}>
                    <StockReports />
                    </Suspense>
                  </ProtectedRoute>
                } />
                <Route path="employees" element={
                  <ProtectedRoute requiredRole="Admin">
                    <Suspense fallback={<PageSkeleton />}>
                    <Employees />
                    </Suspense>
                  </ProtectedRoute>
                } />
                <Route path="settings" element={
                  <ProtectedRoute requiredRole="Admin">
                    <Suspense fallback={<PageSkeleton />}>
                    <Settings />
                    </Suspense>
                  </ProtectedRoute>
                } />
                </Route>
              </>
            )}
          </Routes>
        </RouterContent>
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
