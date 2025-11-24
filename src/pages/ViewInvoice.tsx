import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { Invoice, Customer } from '../types';
import { Download } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import LoadingSpinner from '../components/UI/LoadingSpinner';
// html2pdf.js import - using dynamic import for better compatibility
const getHtml2Pdf = async () => {
  if (typeof window === 'undefined') return null;
  try {
    const html2pdfModule = await import('html2pdf.js');
    return html2pdfModule.default;
  } catch (error) {
    console.error('Failed to load html2pdf.js:', error);
    return null;
  }
};
import { toast } from 'react-toastify';
import { getShopCollectionName } from '../config/shopConfig';

const ViewInvoice: React.FC = () => {
  const { customerName } = useParams<{ customerName: string }>();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const invoiceContentRef = useRef<HTMLDivElement>(null);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [generatingPDF, setGeneratingPDF] = useState(false);
  const [isCapturingPDF, setIsCapturingPDF] = useState(false);
  const [_shopId, setShopId] = useState<string | null>(null);

  useEffect(() => {
    if (customerName) {
      fetchInvoiceByCustomer();
    }
  }, [customerName]);

  const fetchInvoiceByCustomer = async () => {
    if (!customerName) {
      setLoading(false);
      return;
    }

    try {
      // We need to find the invoice by customer name
      // First, try to find shops and search for invoices
      // Since we don't have shopId, we'll need to search across shops
      // For now, let's use a URL parameter or search by customer name in all shops
      
      // Get shopId from URL search params or localStorage
      const urlParams = new URLSearchParams(window.location.search);
      const shopIdParam = urlParams.get('shopId');
      
      if (shopIdParam) {
        setShopId(shopIdParam);
        // Search for customer by name (slugified)
        const customersRef = collection(db, getShopCollectionName('customers'));
        const customersQuery = query(customersRef);
        const customersSnapshot = await getDocs(customersQuery);
        
        let foundCustomer: Customer | null = null;
        customersSnapshot.forEach((doc) => {
          const customerData = { id: doc.id, ...doc.data() } as Customer;
          const customerSlug = customerData.name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '');
          
          if (customerSlug === customerName) {
            foundCustomer = customerData;
          }
        });
        
        if (foundCustomer) {
          const customer = foundCustomer; // Store in const for type narrowing
          setCustomer(customer);
          // Get the most recent invoice for this customer
          const customerId = (foundCustomer as Customer).id;
          const invoicesRef = collection(db, getShopCollectionName('invoices'));
          const invoicesQuery = query(
            invoicesRef,
            where('customerId', '==', customerId),
            orderBy('createdAt', 'desc')
          );
          const invoicesSnapshot = await getDocs(invoicesQuery);
          
          if (!invoicesSnapshot.empty) {
            const latestInvoice = invoicesSnapshot.docs[0];
            const invoiceData = { 
              id: latestInvoice.id, 
              ...latestInvoice.data(),
              createdAt: latestInvoice.data().createdAt?.toDate ? latestInvoice.data().createdAt.toDate() : new Date(latestInvoice.data().createdAt),
              updatedAt: latestInvoice.data().updatedAt?.toDate ? latestInvoice.data().updatedAt.toDate() : new Date(latestInvoice.data().updatedAt),
              dueDate: latestInvoice.data().dueDate?.toDate ? latestInvoice.data().dueDate.toDate() : new Date(latestInvoice.data().dueDate)
            } as Invoice;
            setInvoice(invoiceData);
          } else {
            toast.error('No invoice found for this customer');
          }
        } else {
          // Try searching by phone number (for walk-in customers)
          const phoneNumber = customerName.replace(/-/g, '');
          const invoicesRef = collection(db, getShopCollectionName('invoices'));
          const invoicesQuery = query(
            invoicesRef,
            where('customerPhone', '==', phoneNumber),
            orderBy('createdAt', 'desc')
          );
          const invoicesSnapshot = await getDocs(invoicesQuery);
          
          if (!invoicesSnapshot.empty) {
            const latestInvoice = invoicesSnapshot.docs[0];
            const invoiceData = { 
              id: latestInvoice.id, 
              ...latestInvoice.data(),
              createdAt: latestInvoice.data().createdAt?.toDate ? latestInvoice.data().createdAt.toDate() : new Date(latestInvoice.data().createdAt),
              updatedAt: latestInvoice.data().updatedAt?.toDate ? latestInvoice.data().updatedAt.toDate() : new Date(latestInvoice.data().updatedAt),
              dueDate: latestInvoice.data().dueDate?.toDate ? latestInvoice.data().dueDate.toDate() : new Date(latestInvoice.data().dueDate)
            } as Invoice;
            setInvoice(invoiceData);
          } else {
            toast.error('Invoice not found');
          }
        }
      } else {
        toast.error('Shop ID is required');
      }
    } catch (error) {
      console.error('Error fetching invoice:', error);
      toast.error('Failed to load invoice');
    } finally {
      setLoading(false);
    }
  };

  const downloadInvoice = async () => {
    if (!invoice) return;

    try {
      setGeneratingPDF(true);
      setIsCapturingPDF(true);
      toast.info('Generating PDF...');

      // Wait a bit to ensure state update is rendered
      await new Promise(resolve => setTimeout(resolve, 500));

      // Get the invoice content element
      const invoiceContent = invoiceContentRef.current;
      if (!invoiceContent) {
        throw new Error('Invoice content not found');
      }

      // Wait for images to load
      const images = invoiceContent.getElementsByTagName('img');
      if (images.length > 0) {
        await Promise.all(
          Array.from(images).map((img: HTMLImageElement) => {
            if (img.complete) return Promise.resolve();
            return new Promise((resolve) => {
              img.onload = resolve;
              img.onerror = resolve;
            });
          })
        );
        // Extra time for rendering
        await new Promise(resolve => setTimeout(resolve, 300));
      }

      const opt = {
        margin: [10, 10, 10, 10] as [number, number, number, number],
        filename: `Invoice-${invoice.invoiceNumber}.pdf`,
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: { 
          scale: 2, 
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff'
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' as const }
      };

      const html2pdf = await getHtml2Pdf();
      if (!html2pdf) {
        throw new Error('PDF generation library not available');
      }
      await html2pdf().set(opt).from(invoiceContent).save();
      
      setIsCapturingPDF(false);
      toast.success('Invoice downloaded as PDF');
    } catch (error) {
      console.error('Error generating PDF:', error);
      setIsCapturingPDF(false);
      toast.error('Failed to generate PDF');
    } finally {
      setGeneratingPDF(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Invoice Not Found</h1>
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2 bg-[#4A90A4] text-white rounded-lg hover:bg-[#3a7a8a]"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  const displayCustomerName = customer?.name || 'Walk-in Customer';
  const displayCustomerPhone = customer?.phone || (invoice as any).customerPhone || '';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-4 md:py-8 px-3 md:px-4">
      <div className="max-w-4xl mx-auto">
        <div ref={invoiceContentRef} className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 md:p-8 mb-4 md:mb-6">
          {!isCapturingPDF && (
            <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-4 md:mb-6">
              <div className="flex items-center gap-2 md:gap-3">
                <img 
                  src={theme === 'dark' ? '/icons/CentalDarkmode.png' : '/icons/CentalLightmode.png'} 
                  alt="CENTRAL SHOP Logo" 
                  className="w-10 h-10 md:w-12 md:h-12 object-contain scale-[2]"
                />
                <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">CENTRAL SHOP</h1>
              </div>
              <button
                onClick={downloadInvoice}
                disabled={generatingPDF}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-[#4A90A4] text-white rounded-lg hover:bg-[#3a7a8a] disabled:opacity-50 text-sm md:text-base"
              >
                <Download className="w-4 h-4" />
                {generatingPDF ? 'Generating...' : 'Download PDF'}
              </button>
            </div>
          )}
          {isCapturingPDF && (
            <div className="flex items-center gap-2 md:gap-3 mb-4 md:mb-6">
              <img 
                src="/icons/CentalLightmode.png" 
                alt="CENTRAL SHOP Logo" 
                className="w-10 h-10 md:w-12 md:h-12 object-contain"
              />
              <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">CENTRAL SHOP</h1>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mb-4 md:mb-6">
            <div>
              <h3 className="text-xs md:text-sm font-medium text-gray-500 dark:text-gray-400 mb-1 md:mb-2">Invoice #</h3>
              <p className="text-base md:text-lg font-bold text-gray-900 dark:text-white">{invoice.invoiceNumber}</p>
            </div>
            <div className="text-left md:text-right">
              <h3 className="text-xs md:text-sm font-medium text-gray-500 dark:text-gray-400 mb-1 md:mb-2">Date</h3>
              <p className="text-xs md:text-sm text-gray-900 dark:text-white">{invoice.createdAt instanceof Date ? invoice.createdAt.toLocaleDateString() : new Date(invoice.createdAt).toLocaleDateString()}</p>
              <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400 mt-1">Due: {invoice.dueDate instanceof Date ? invoice.dueDate.toLocaleDateString() : new Date(invoice.dueDate).toLocaleDateString()}</p>
            </div>
          </div>

          <div className="mb-4 md:mb-6">
            <h3 className="text-xs md:text-sm font-medium text-gray-500 dark:text-gray-400 mb-1 md:mb-2">Bill To:</h3>
            <p className="text-sm md:text-base font-medium text-gray-900 dark:text-white">{displayCustomerName}</p>
            {customer?.email && <p className="text-xs md:text-sm text-gray-600 dark:text-gray-400">{customer.email}</p>}
            {displayCustomerPhone && <p className="text-xs md:text-sm text-gray-600 dark:text-gray-400">{displayCustomerPhone}</p>}
          </div>

          <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden mb-4 md:mb-6">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px]">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="px-2 md:px-4 py-2 md:py-3 text-left text-xs md:text-sm font-medium text-gray-700 dark:text-gray-300">Description</th>
                    <th className="px-2 md:px-4 py-2 md:py-3 text-center text-xs md:text-sm font-medium text-gray-700 dark:text-gray-300">Qty</th>
                    <th className="px-2 md:px-4 py-2 md:py-3 text-right text-xs md:text-sm font-medium text-gray-700 dark:text-gray-300">Unit Price</th>
                    <th className="px-2 md:px-4 py-2 md:py-3 text-right text-xs md:text-sm font-medium text-gray-700 dark:text-gray-300">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {invoice.items.map((item, idx) => (
                    <tr key={item.id || idx}>
                      <td className="px-2 md:px-4 py-2 md:py-3 text-xs md:text-sm text-gray-900 dark:text-white">{item.description}</td>
                      <td className="px-2 md:px-4 py-2 md:py-3 text-xs md:text-sm text-center text-gray-600 dark:text-gray-400">{item.quantity}</td>
                      <td className="px-2 md:px-4 py-2 md:py-3 text-xs md:text-sm text-right text-gray-600 dark:text-gray-400">KSH {item.unitPrice.toLocaleString()}</td>
                      <td className="px-2 md:px-4 py-2 md:py-3 text-xs md:text-sm text-right font-medium text-gray-900 dark:text-white">KSH {item.total.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <td colSpan={3} className="px-2 md:px-4 py-2 md:py-3 text-right text-xs md:text-sm font-medium text-gray-700 dark:text-gray-300">Subtotal:</td>
                    <td className="px-2 md:px-4 py-2 md:py-3 text-right text-xs md:text-sm font-medium text-gray-900 dark:text-white">KSH {invoice.subtotal.toLocaleString()}</td>
                  </tr>
                  <tr>
                    <td colSpan={3} className="px-2 md:px-4 py-2 md:py-3 text-right text-xs md:text-sm font-medium text-gray-700 dark:text-gray-300">Tax (16%):</td>
                    <td className="px-2 md:px-4 py-2 md:py-3 text-right text-xs md:text-sm font-medium text-gray-900 dark:text-white">KSH {invoice.tax.toLocaleString()}</td>
                  </tr>
                  <tr>
                    <td colSpan={3} className="px-2 md:px-4 py-2 md:py-3 text-right text-base md:text-lg font-bold text-gray-900 dark:text-white">Total:</td>
                    <td className="px-2 md:px-4 py-2 md:py-3 text-right text-base md:text-lg font-bold text-[#4A90A4]">KSH {invoice.total.toLocaleString()}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {invoice.notes && !isCapturingPDF && (
            <div className="p-3 md:p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <h3 className="text-sm md:text-base font-semibold text-gray-900 dark:text-white mb-1 md:mb-2">Notes:</h3>
              <p className="text-xs md:text-sm text-gray-600 dark:text-gray-400">{invoice.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ViewInvoice;

