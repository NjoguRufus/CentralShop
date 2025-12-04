import React, { useState, useEffect, useRef } from 'react';
import { collection, getDocs, doc, query, orderBy, Timestamp } from 'firebase/firestore';
import { addDoc, updateDoc, deleteDoc } from '../offline/firestoreWrappers';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { getShopCollectionName, BRANCHES, BranchName } from '../config/shopConfig';
import { Invoice, InvoiceItem, Customer, Product } from '../types';
import { BusinessSettingsService } from '../services/BusinessSettingsService';
import Card from '../components/UI/Card';
import Button from '../components/UI/Button';
import FormInput from '../components/UI/FormInput';
import Table from '../components/UI/Table';
import Select from '../components/UI/Select';
import DateInput from '../components/UI/DateInput';
import Modal from '../components/Modal';
import LoadingSpinner from '../components/UI/LoadingSpinner';
import Dropdown from '../components/UI/Dropdown';
import { Plus, Trash2, Eye, MessageCircle, Download, Edit } from 'lucide-react';
import { toast } from 'react-toastify';
import { getDefaultUnit } from '../constants/productUnits';
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

const DEFAULT_UNIT = getDefaultUnit();

const Invoicing: React.FC = () => {
  const { currentUser } = useAuth();
  const { theme } = useTheme();
  const invoiceModalRef = useRef<HTMLDivElement>(null);
  const [isCapturingPDF, setIsCapturingPDF] = useState(false);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [businessInfo, setBusinessInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const [newlyCreatedInvoice, setNewlyCreatedInvoice] = useState<Invoice | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [selectedBranch, setSelectedBranch] = useState<string>('CentralShop');
  const [editingInvoice, setEditingInvoice] = useState<Partial<Invoice & { customerPhone?: string }>>({
    invoiceNumber: '',
    customerId: '',
    items: [],
    subtotal: 0,
    tax: 0,
    total: 0,
    status: 'draft',
    dueDate: new Date(),
    notes: '',
    customerPhone: ''
  });
  const [newItem, setNewItem] = useState<Partial<InvoiceItem>>({
    description: '',
    quantity: 1,
    unitPrice: 0,
    total: 0,
    type: 'product'
  });

  useEffect(() => {
    if (currentUser?.shopId) {
      fetchData();
      fetchBusinessInfo();
    }
  }, [currentUser?.shopId, selectedBranch]);

  const fetchBusinessInfo = async () => {
    if (!currentUser?.shopId) return;
    try {
      const info = await BusinessSettingsService.getBusinessInfo(currentUser.shopId);
      setBusinessInfo(info);
    } catch (error) {
      console.error('Error fetching business info:', error);
    }
  };

  const fetchData = async () => {
    if (!currentUser?.shopId) return;
    
    try {
      // Fetch invoices
      const invoicesQuery = query(
        collection(db, getShopCollectionName('invoices', selectedBranch as BranchName)),
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
      const customersQuery = query(collection(db, getShopCollectionName('customers', selectedBranch as BranchName)));
      const customersSnapshot = await getDocs(customersQuery);
      const customersData = customersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date()
      })) as Customer[];
      setCustomers(customersData);

      // Fetch products
      const productsQuery = query(collection(db, getShopCollectionName('products', selectedBranch as BranchName)), orderBy('name'));
      const productsSnapshot = await getDocs(productsQuery);
      const productsData = productsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        unit: doc.data().unit || DEFAULT_UNIT,
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date()
      })) as Product[];
      setProducts(productsData);

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

  const addItemToInvoice = () => {
    if (!newItem.description || !newItem.quantity || !newItem.unitPrice) {
      toast.error('Please fill in all item fields');
      return;
    }

    const item: InvoiceItem = {
      id: Date.now().toString(),
      description: newItem.description!,
      quantity: newItem.quantity!,
      unitPrice: newItem.unitPrice!,
      total: newItem.quantity! * newItem.unitPrice!,
      type: newItem.type || 'product'
    };

    const updatedItems = [...(editingInvoice.items || []), item];
    const subtotal = updatedItems.reduce((sum, item) => sum + item.total, 0);
    const tax = subtotal * 0.16; // 16% VAT
    const total = subtotal + tax;

    setEditingInvoice(prev => ({
      ...prev,
      items: updatedItems,
      subtotal,
      tax,
      total
    }));

    setNewItem({
      description: '',
      quantity: 1,
      unitPrice: 0,
      total: 0,
      type: 'product'
    });
  };

  const removeItem = (itemId: string) => {
    const updatedItems = editingInvoice.items?.filter(item => item.id !== itemId) || [];
    const subtotal = updatedItems.reduce((sum, item) => sum + item.total, 0);
    const tax = subtotal * 0.16;
    const total = subtotal + tax;

    setEditingInvoice(prev => ({
      ...prev,
      items: updatedItems,
      subtotal,
      tax,
      total
    }));
  };

  const handleCreateInvoice = async () => {
    if (!currentUser?.shopId || !editingInvoice.invoiceNumber) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (!editingInvoice.items || editingInvoice.items.length === 0) {
      toast.error('Please add at least one item to the invoice');
      return;
    }

    try {
      const invoiceData: any = {
        invoiceNumber: editingInvoice.invoiceNumber,
        customerId: editingInvoice.customerId || null,
        items: editingInvoice.items,
        subtotal: editingInvoice.subtotal,
        tax: editingInvoice.tax,
        total: editingInvoice.total,
        status: editingInvoice.status,
        shopId: currentUser.shopId,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        dueDate: Timestamp.fromDate(editingInvoice.dueDate || new Date())
      };

      // Include customerPhone if walk-in customer
      if (!editingInvoice.customerId && editingInvoice.customerPhone) {
        invoiceData.customerPhone = editingInvoice.customerPhone;
      }
      
      // Include notes if provided
      if (editingInvoice.notes) {
        invoiceData.notes = editingInvoice.notes;
      }

      const docRef = await addDoc(collection(db, getShopCollectionName('invoices', selectedBranch as BranchName)), invoiceData);
      
      // Fetch the created invoice to show in send modal
      const createdInvoice = {
        id: docRef.id,
        ...invoiceData,
        createdAt: invoiceData.createdAt.toDate(),
        updatedAt: invoiceData.updatedAt.toDate(),
        dueDate: invoiceData.dueDate.toDate()
      } as Invoice;
      
      toast.success('Invoice created successfully');
      setShowCreateModal(false);
      setNewlyCreatedInvoice(createdInvoice);
      setShowSendModal(true);
      resetInvoiceForm();
      fetchData();
    } catch (error) {
      console.error('Error creating invoice:', error);
      toast.error('Failed to create invoice');
    }
  };

  const handleUpdateInvoice = async () => {
    if (!currentUser?.shopId || !selectedInvoice?.id) return;

    try {
      const invoiceRef = doc(db, getShopCollectionName('invoices', selectedBranch as BranchName), selectedInvoice.id);
      
      // Filter out undefined values and prepare update data
      const updateData: any = {
        invoiceNumber: editingInvoice.invoiceNumber,
        customerId: editingInvoice.customerId,
        items: editingInvoice.items,
        subtotal: editingInvoice.subtotal,
        tax: editingInvoice.tax,
        total: editingInvoice.total,
        status: editingInvoice.status,
        dueDate: Timestamp.fromDate(editingInvoice.dueDate || new Date()),
        updatedAt: Timestamp.now()
      };
      
      // Only include optional fields if they have values
      if (editingInvoice.notes !== undefined) updateData.notes = editingInvoice.notes;
      if (editingInvoice.customerPhone) updateData.customerPhone = editingInvoice.customerPhone;
      if (editingInvoice.customerEmail) updateData.customerEmail = editingInvoice.customerEmail;
      
      await updateDoc(invoiceRef, updateData);
      
      toast.success('Invoice updated successfully');
      setShowEditModal(false);
      setSelectedInvoice(null);
      resetInvoiceForm();
      fetchData();
    } catch (error) {
      console.error('Error updating invoice:', error);
      toast.error('Failed to update invoice');
    }
  };

  const resetInvoiceForm = () => {
      setEditingInvoice({
        invoiceNumber: '',
        customerId: '',
        items: [],
        subtotal: 0,
        tax: 0,
        total: 0,
        status: 'draft',
        dueDate: new Date(),
        notes: '',
        customerPhone: ''
      });
    setNewItem({
      description: '',
      quantity: 1,
      unitPrice: 0,
      total: 0,
      type: 'product'
    });
  };

  const sendViaWhatsApp = (invoice: Invoice) => {
    const customer = customers.find(c => c.id === invoice.customerId);
    const phone = customer?.phone || '';
    
    if (!phone) {
      toast.error('Customer phone number not available');
      return;
    }

    const message = generateInvoiceMessage(invoice, customer);
    const whatsappUrl = `https://wa.me/${phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  const sendViaEmail = (invoice: Invoice) => {
    const customer = customers.find(c => c.id === invoice.customerId);
    const email = customer?.email || '';
    
    if (!email) {
      toast.error('Customer email not available');
      return;
    }

    const subject = `Invoice ${invoice.invoiceNumber} from ${businessInfo?.name || 'Central Shop'}`;
    const body = generateInvoiceMessage(invoice, customer);
    const mailtoUrl = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailtoUrl;
  };

  const generateInvoiceMessage = (invoice: Invoice & { customerPhone?: string; id?: string; invoiceUrl?: string }, customer: Customer | undefined): string => {
    const business = businessInfo || { name: 'CENTRAL SHOP', address: '', phone: '' };
    const businessName = 'CENTRAL SHOP';
    
    // Use provided invoiceUrl or generate one
    let invoiceUrl = (invoice as any).invoiceUrl;
    if (!invoiceUrl) {
      const customerName = customer?.name || (invoice as any).customerPhone || 'customer';
      const customerSlug = customerName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
      invoiceUrl = `${window.location.origin}/${customerSlug}/invoice?shopId=${currentUser?.shopId}`;
    }
    
    // Format dates safely
    const invoiceDate = invoice.createdAt instanceof Date 
      ? invoice.createdAt.toLocaleDateString() 
      : (invoice.createdAt?.toDate ? invoice.createdAt.toDate().toLocaleDateString() : new Date(invoice.createdAt).toLocaleDateString());
    const dueDate = invoice.dueDate instanceof Date 
      ? invoice.dueDate.toLocaleDateString() 
      : (invoice.dueDate?.toDate ? invoice.dueDate.toDate().toLocaleDateString() : new Date(invoice.dueDate).toLocaleDateString());
    
    let message = `──── CENTRAL SHOP ───\n\n`;
    message += `──── INVOICE DETAILS ────\n\n`;
    message += `Invoice #: ${invoice.invoiceNumber}\n\n`;
    message += `Date: ${invoiceDate}\n\n`;
    message += `Due: ${dueDate}\n\n`;
    message += `Total: KSH ${invoice.total.toLocaleString()}\n\n`;
    message += `───── ITEMS ORDERED ──────\n\n`;
    invoice.items.forEach((item, idx) => {
      message += `• ${item.description}\n\n`;
      message += `  ${item.quantity} × KSH ${item.unitPrice.toLocaleString()} = KSH ${item.total.toLocaleString()}\n\n`;
    });
    message += `─── VIEW / DOWNLOAD INVOICE ───\n\n`;
    message += `${invoiceUrl}\n\n`;
    message += `──── THANK YOU! ────\n\n`;
    message += `Thank you for choosing CENTRAL SHOP.\n`;
    
    return message;
  };

  const generateInvoiceHTML = (invoice: Invoice & { customerPhone?: string }): string => {
    const customer = invoice.customerId ? customers.find(c => c.id === invoice.customerId) : null;
    const businessName = "CENTRAL SHOP";
    const logoUrl = "/icons/CentalLightmode.png";

    // Format dates safely
    const invoiceDate = invoice.createdAt instanceof Date 
      ? invoice.createdAt.toLocaleDateString() 
      : (invoice.createdAt && typeof invoice.createdAt === 'object' && 'toDate' in invoice.createdAt 
          ? invoice.createdAt.toDate().toLocaleDateString() 
          : new Date(invoice.createdAt as any).toLocaleDateString());
    const dueDate = invoice.dueDate instanceof Date 
      ? invoice.dueDate.toLocaleDateString() 
      : (invoice.dueDate && typeof invoice.dueDate === 'object' && 'toDate' in invoice.dueDate 
          ? invoice.dueDate.toDate().toLocaleDateString() 
          : new Date(invoice.dueDate as any).toLocaleDateString());

    return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="UTF-8" />
    <title>Invoice ${invoice.invoiceNumber}</title>

    <style>
      body {
        font-family: 'Inter', sans-serif;
        background: #ffffff;
        padding: 40px;
        max-width: 800px;
        margin: 0 auto;
        border: 2px solid #D8B980;
        border-radius: 16px;
      }
      h1, h2, h3 {
        font-family: 'Playfair Display', serif;
      }
      .gold { color: #D8B980; }
      .header {
        display:flex;
        justify-content:space-between;
        padding-bottom:20px;
        margin-bottom:30px;
        border-bottom:1px solid #eaeaea;
      }
      .logo {
        width:60px;
        height:60px;
        object-fit:contain;
      }
      .section-title {
        font-size:18px;
        margin-top:30px;
        margin-bottom:10px;
        color:#D8B980;
      }
      .bill-box {
        background:#fafafa;
        padding:16px;
        border-radius:12px;
        border:1px solid #eee;
      }
      table {
        width:100%;
        border-collapse:collapse;
        margin-top:20px;
      }
      th {
        background:#fafafa;
        padding:12px;
        font-size:14px;
        border-bottom:1px solid #eaeaea;
      }
      td {
        padding:12px;
        font-size:14px;
        border-bottom:1px solid #f0f0f0;
      }
      .right { text-align:right; }
      .totals-table {
        float:right;
        width:300px;
        margin-top:20px;
      }
      .totals-final {
        font-size:20px;
        font-weight:700;
        color:#D8B980;
        border-top:1px solid #D8B980;
        padding-top:10px !important;
      }
      .notes {
        margin-top:40px;
        padding:15px;
        background:#fafafa;
        border-radius:12px;
        border-left:3px solid #D8B980;
      }
    </style>
  </head>

  <body>

    <div class="header">
      <div style="display:flex; gap:12px; align-items:center;">
        <img src="${logoUrl}" class="logo" />
        <h1>${businessName}</h1>
      </div>

      <div style="text-align:right;">
        <div class="gold">Invoice #</div>
        <div style="font-size:18px; font-weight:600;">${invoice.invoiceNumber}</div>
        <div>Date: ${invoiceDate}</div>
        <div>Due: ${dueDate}</div>
      </div>
    </div>

    <h3 class="section-title">Bill To</h3>
    <div class="bill-box">
      <div style="font-weight:600; font-size:16px;">
        ${customer?.name || "Walk-in Customer"}
      </div>
      ${customer?.email ? `<div>${customer.email}</div>` : ""}
      ${(customer?.phone || invoice.customerPhone) ? `<div>${customer?.phone || invoice.customerPhone}</div>` : ""}
    </div>

    <h3 class="section-title">Items</h3>
    <table>
      <thead>
        <tr>
          <th>Description</th>
          <th class="right">Qty</th>
          <th class="right">Unit Price</th>
          <th class="right">Total</th>
        </tr>
      </thead>
      <tbody>
        ${invoice.items
          .map(
            (item) => `
        <tr>
          <td>${item.description}</td>
          <td class="right">${item.quantity}</td>
          <td class="right">KSH ${item.unitPrice.toLocaleString()}</td>
          <td class="right">KSH ${item.total.toLocaleString()}</td>
        </tr>`
          )
          .join("")}
      </tbody>
    </table>

    <table class="totals-table">
      <tr>
        <td>Subtotal:</td>
        <td class="right">KSH ${invoice.subtotal.toLocaleString()}</td>
      </tr>
      <tr>
        <td>Tax (16%):</td>
        <td class="right">KSH ${invoice.tax.toLocaleString()}</td>
      </tr>
      <tr>
        <td class="totals-final">Total:</td>
        <td class="right totals-final">KSH ${invoice.total.toLocaleString()}</td>
      </tr>
    </table>

    ${
      invoice.notes
        ? `
      <div class="notes">
        <h3 class="gold" style="font-size:16px;">Notes</h3>
        <div>${invoice.notes}</div>
      </div>`
        : ""
    }

  </body>
  </html>`;
  };

  const downloadInvoice = async (invoice: Invoice) => {
    try {
      // Ensure the modal is open and the invoice is selected
      if (!showDetailModal || selectedInvoice?.id !== invoice.id) {
        setSelectedInvoice(invoice);
        setShowDetailModal(true);
        // Wait for modal to render
        await new Promise(resolve => setTimeout(resolve, 300));
      }

      toast.info('Generating PDF...');

      // Set capturing state to hide buttons and notes
      setIsCapturingPDF(true);

      // Wait a bit more to ensure everything is rendered
      await new Promise(resolve => setTimeout(resolve, 500));

      // Get the modal content element
      const modalContent = invoiceModalRef.current;
      if (!modalContent) {
        throw new Error('Invoice modal content not found');
      }

      // Wait for images to load
      const images = modalContent.getElementsByTagName('img');
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
      await html2pdf().set(opt).from(modalContent).save();
      
      // Reset capturing state
      setIsCapturingPDF(false);
      toast.success('Invoice downloaded as PDF');
    } catch (error) {
      console.error('Error generating PDF:', error);
      setIsCapturingPDF(false);
      toast.error('Failed to generate PDF');
    }
  };

  const generatePDFBlob = async (invoice: Invoice): Promise<Blob> => {
    try {
      const html = generateInvoiceHTML(invoice);
      
      // Create iframe for proper rendering (hidden but with proper dimensions)
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '210mm'; // A4 width
      iframe.style.height = '297mm'; // A4 height
      iframe.style.border = 'none';
      iframe.style.opacity = '0';
      iframe.style.pointerEvents = 'none';
      iframe.style.visibility = 'hidden';
      document.body.appendChild(iframe);

      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!iframeDoc) {
        throw new Error('Could not access iframe document');
      }

      iframeDoc.open();
      iframeDoc.write(html);
      iframeDoc.close();

      // Wait for images to load
      await new Promise<void>((resolve) => {
        const images = iframeDoc.getElementsByTagName('img');
        let loadedCount = 0;
        const totalImages = images.length;

        if (totalImages === 0) {
          resolve();
          return;
        }

        const checkComplete = () => {
          loadedCount++;
          if (loadedCount === totalImages) {
            setTimeout(resolve, 500);
          }
        };

        Array.from(images).forEach((img) => {
          if (img.complete) {
            checkComplete();
          } else {
            img.onload = checkComplete;
            img.onerror = checkComplete;
          }
        });
      });

      const element = iframeDoc.body;

      const opt = {
        margin: [10, 10, 10, 10],
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { 
          scale: 2, 
          useCORS: true,
          logging: false,
          windowWidth: element.scrollWidth,
          windowHeight: element.scrollHeight
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };

      const html2pdf = await getHtml2Pdf();
      if (!html2pdf) {
        throw new Error('PDF generation library not available');
      }
      const pdfBlob = await html2pdf().set(opt).from(element).outputPdf('blob');
      document.body.removeChild(iframe);
      return pdfBlob;
    } catch (error) {
      console.error('Error generating PDF blob:', error);
      // Fallback to HTML blob if PDF generation fails
      const html = generateInvoiceHTML(invoice);
      return new Blob([html], { type: 'text/html' });
    }
  };

  const convertHTMLToPDF = async (html: string): Promise<Blob> => {
    try {
      // Create iframe for proper rendering (hidden but with proper dimensions)
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '210mm'; // A4 width
      iframe.style.height = '297mm'; // A4 height
      iframe.style.border = 'none';
      iframe.style.opacity = '0';
      iframe.style.pointerEvents = 'none';
      iframe.style.visibility = 'hidden';
      document.body.appendChild(iframe);

      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!iframeDoc) {
        throw new Error('Could not access iframe document');
      }

      iframeDoc.open();
      iframeDoc.write(html);
      iframeDoc.close();

      // Wait for images to load
      await new Promise<void>((resolve) => {
        const images = iframeDoc.getElementsByTagName('img');
        let loadedCount = 0;
        const totalImages = images.length;

        if (totalImages === 0) {
          resolve();
          return;
        }

        const checkComplete = () => {
          loadedCount++;
          if (loadedCount === totalImages) {
            setTimeout(resolve, 500);
          }
        };

        Array.from(images).forEach((img) => {
          if (img.complete) {
            checkComplete();
          } else {
            img.onload = checkComplete;
            img.onerror = checkComplete;
          }
        });
      });

      const element = iframeDoc.body;

      const opt = {
        margin: [10, 10, 10, 10],
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { 
          scale: 2, 
          useCORS: true,
          logging: false,
          windowWidth: element.scrollWidth,
          windowHeight: element.scrollHeight
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };

      const html2pdf = await getHtml2Pdf();
      if (!html2pdf) {
        throw new Error('PDF generation library not available');
      }
      const pdfBlob = await html2pdf().set(opt).from(element).outputPdf('blob');
      document.body.removeChild(iframe);
      return pdfBlob;
    } catch (error) {
      console.error('Error converting HTML to PDF:', error);
      // Fallback to HTML blob if PDF generation fails
      return new Blob([html], { type: 'text/html' });
    }
  };

  const sendPDFViaWhatsApp = async (invoice: Invoice & { customerPhone?: string }) => {
    // Get phone from customer or invoice's customerPhone field
    const customer = invoice.customerId ? customers.find(c => c.id === invoice.customerId) : null;
    const phone = customer?.phone || invoice.customerPhone || '';
    
    if (!phone) {
      toast.error('Phone number is required to send via WhatsApp');
      return;
    }

    try {
      // Generate HTML and convert to blob
      const html = generateInvoiceHTML(invoice);
      const blob = await convertHTMLToPDF(html);
      
      // Format phone number (remove all non-digits, ensure it starts with country code)
      let formattedPhone = phone.replace(/[^0-9]/g, '');
      
      // If phone doesn't start with country code, assume it's Kenyan (254)
      if (!formattedPhone.startsWith('254') && formattedPhone.length === 9) {
        formattedPhone = '254' + formattedPhone;
      } else if (formattedPhone.startsWith('0')) {
        formattedPhone = '254' + formattedPhone.substring(1);
      }
      
      // Generate invoice URL with customer name
      const customerName = customer?.name || invoice.customerPhone || 'customer';
      const customerSlug = customerName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
      const invoiceUrl = `${window.location.origin}/${customerSlug}/invoice?shopId=${currentUser?.shopId}`;
      
      // Generate message with invoice URL
      const message = generateInvoiceMessage({ ...invoice, invoiceUrl }, customer);
      
      // Open WhatsApp Web/App directly to customer's chat in a new tab
      // Use wa.me with phone number and message
      const whatsappUrl = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`;
      
      // Open in new tab to avoid disrupting the current process
      window.open(whatsappUrl, '_blank');
      
      toast.success('WhatsApp opened with invoice link!');
    } catch (error) {
      console.error('Error sending PDF via WhatsApp:', error);
      // Fallback to simple download
      downloadInvoice(invoice);
      toast.error('Failed to send via WhatsApp. Invoice downloaded instead.');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
      case 'sent': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'paid': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'overdue': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'cancelled': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
  };

  // Helper function to get customer name from invoice
  const getCustomerName = (invoice: Invoice & { customerPhone?: string }): string => {
    if (invoice.customerId) {
      const customer = customers.find(c => c.id === invoice.customerId);
      return customer?.name || 'Unknown Customer';
    }
    // For walk-in customers, show phone if available, otherwise "Walk-in Customer"
    return (invoice as any).customerPhone || 'Walk-in Customer';
  };

  const totalInvoices = invoices.length;
  const draftInvoices = invoices.filter(i => i.status === 'draft').length;
  const paidInvoices = invoices.filter(i => i.status === 'paid').length;
  const overdueInvoices = invoices.filter(i => i.status === 'overdue').length;
  const totalValue = invoices.reduce((sum, invoice) => sum + invoice.total, 0);

  if (loading) {
    return (
      <div className="space-y-3 md:space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <div className="h-6 md:h-8 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
            <div className="h-4 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mt-2"></div>
          </div>
          <div className="h-10 w-40 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
        </div>
        {/* Loading Skeleton for Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4">
          {[...Array(5)].map((_, i) => (
            <Card key={i} className="p-2 md:p-4">
              <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-2"></div>
              <div className="h-8 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
            </Card>
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
    <div className="space-y-3 md:space-y-4">
      <div className="flex justify-between items-center">
        <div>
        <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">Invoicing</h1>
          <p className="text-xs md:text-sm text-gray-600 dark:text-gray-300">Create and manage invoices</p>
        </div>
        <div className="flex items-center gap-3">
          {(currentUser?.shopName === 'CentralShop' || currentUser?.role === 'mainAdmin' || currentUser?.role === 'Admin') && (
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
        <Button onClick={() => {
          resetInvoiceForm();
          setEditingInvoice(prev => ({ ...prev, invoiceNumber: generateInvoiceNumber() }));
          setShowCreateModal(true);
        }}>
          <Plus className="w-4 h-4 mr-2" />
          Create Invoice
        </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4">
        <Card className="p-2 md:p-4 hover:shadow-xl transition-all duration-300">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-gray-600 dark:text-gray-400 truncate">Total Invoices</p>
              <p className="text-lg md:text-2xl font-bold text-gray-900 dark:text-white mt-1">{totalInvoices}</p>
            </div>
          </div>
        </Card>
        <Card className="p-2 md:p-4 hover:shadow-xl transition-all duration-300">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-gray-600 dark:text-gray-400 truncate">Draft</p>
              <p className="text-lg md:text-2xl font-bold text-gray-900 dark:text-white mt-1">{draftInvoices}</p>
            </div>
          </div>
        </Card>
        <Card className="p-2 md:p-4 hover:shadow-xl transition-all duration-300">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-gray-600 dark:text-gray-400 truncate">Paid</p>
              <p className="text-lg md:text-2xl font-bold text-gray-900 dark:text-white mt-1">{paidInvoices}</p>
            </div>
          </div>
        </Card>
        <Card className="p-2 md:p-4 hover:shadow-xl transition-all duration-300">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-gray-600 dark:text-gray-400 truncate">Overdue</p>
              <p className="text-lg md:text-2xl font-bold text-gray-900 dark:text-white mt-1">{overdueInvoices}</p>
            </div>
          </div>
        </Card>
        <Card className="p-2 md:p-4 hover:shadow-xl transition-all duration-300">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-gray-600 dark:text-gray-400 truncate">Total Value</p>
              <p className="text-lg md:text-2xl font-bold text-gray-900 dark:text-white mt-1">KSH {totalValue.toLocaleString()}</p>
            </div>
          </div>
        </Card>
      </div>

      <Card className="p-3 md:p-4">
        {invoices.length === 0 ? (
          <div className="py-10 text-center text-gray-600 dark:text-gray-400">
            <h3 className="text-sm md:text-base font-medium">No invoices found</h3>
            <p className="text-xs md:text-sm mt-1">
              Create an invoice to see it listed here.
            </p>
          </div>
        ) : (
          <Table
            headers={['Invoice #', 'Customer', 'Amount', 'Status', 'Due Date', 'Actions']}
            data={invoices.map(invoice => [
              invoice.invoiceNumber,
              getCustomerName(invoice),
              `KSH ${invoice.total.toLocaleString()}`,
              <span className={`px-2 py-1 rounded-full text-xs ${getStatusColor(invoice.status)}`}>
                {invoice.status}
              </span>,
              invoice.dueDate.toLocaleDateString(),
              <div className="flex space-x-2">
                <button
                  onClick={() => {
                    setSelectedInvoice(invoice);
                    setShowDetailModal(true);
                  }}
                  className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                  title="View Details"
                >
                  <Eye className="w-4 h-4" />
                </button>
                <button
                  onClick={() => {
                    setSelectedInvoice(invoice);
                    setEditingInvoice(invoice);
                    setShowEditModal(true);
                  }}
                  className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                  title="Edit"
                >
                  <Edit className="w-4 h-4" />
                </button>
              </div>
            ])}
          />
        )}
      </Card>

      {/* Create/Edit Invoice Modal */}
      <Modal 
        open={showCreateModal || showEditModal} 
        onClose={() => {
          setShowCreateModal(false);
          setShowEditModal(false);
          resetInvoiceForm();
        }} 
        title={showEditModal ? 'Edit Invoice' : 'Create New Invoice'} 
        size="lg"
      >
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormInput
              label="Invoice Number *"
              value={editingInvoice.invoiceNumber || ''}
              onChange={(e) => setEditingInvoice(prev => ({ ...prev, invoiceNumber: e.target.value }))}
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Customer</label>
              <Select
                value={editingInvoice.customerId || ''}
                onChange={(v) => setEditingInvoice(prev => ({ ...prev, customerId: v, customerPhone: v ? '' : prev.customerPhone }))}
                options={[
                  { value: '', label: 'Walk-in Customer' },
                  ...customers.map(customer => ({ value: customer.id, label: `${customer.name}${customer.phone ? ` - ${customer.phone}` : ''}` }))
                ]}
              />
              {editingInvoice.customerId && (
                <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-800 rounded text-sm text-gray-700 dark:text-gray-300">
                  <span className="font-medium">Selected: </span>
                  {(() => {
                    const selectedCustomer = customers.find(c => c.id === editingInvoice.customerId);
                    return selectedCustomer?.name || 'Unknown Customer';
                  })()}
                </div>
              )}
              {!editingInvoice.customerId && (
                <FormInput
                  label="Phone Number *"
                  type="tel"
                  value={editingInvoice.customerPhone || ''}
                  onChange={(e) => setEditingInvoice(prev => ({ ...prev, customerPhone: e.target.value }))}
                  placeholder="Enter phone number for WhatsApp"
                  className="mt-2"
                />
              )}
            </div>
            <DateInput
              label="Due Date *"
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
          </div>

          {/* Add Items Section */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Invoice Items</h3>
            
            <div className="grid grid-cols-5 gap-2 mb-2">
            <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Product/Service</label>
                <Dropdown
                  value={newItem.description || ''}
                  onChange={(value) => {
                    const product = products.find(p => p.name === value);
                    setNewItem(prev => ({
                      ...prev,
                      description: value,
                      unitPrice: product?.price || prev.unitPrice || 0
                    }));
                  }}
                  options={products.map(p => ({ value: p.name, label: p.name }))}
                  placeholder="Select or type product"
                />
              </div>
              <FormInput
                label="Qty"
                type="number"
                value={newItem.quantity?.toString() || '1'}
                onChange={(e) => {
                  const qty = parseFloat(e.target.value) || 1;
                  const price = newItem.unitPrice || 0;
                  setNewItem(prev => ({
                    ...prev,
                    quantity: qty,
                    total: qty * price
                  }));
                }}
              />
              <FormInput
                label="Unit Price"
                type="number"
                value={newItem.unitPrice?.toString() || '0'}
                onChange={(e) => {
                  const price = parseFloat(e.target.value) || 0;
                  const qty = newItem.quantity || 1;
                  setNewItem(prev => ({
                    ...prev,
                    unitPrice: price,
                    total: qty * price
                  }));
                }}
              />
              <div className="flex items-end">
                <Button
                  type="button"
                  onClick={addItemToInvoice}
                  size="sm"
                  className="w-full"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {editingInvoice.items && editingInvoice.items.length > 0 && (
              <div className="mt-4 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-800">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 dark:text-gray-300">Description</th>
                      <th className="px-4 py-2 text-center text-xs font-medium text-gray-700 dark:text-gray-300">Qty</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-700 dark:text-gray-300">Unit Price</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-700 dark:text-gray-300">Total</th>
                      <th className="px-4 py-2 text-center text-xs font-medium text-gray-700 dark:text-gray-300">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {editingInvoice.items.map((item) => (
                      <tr key={item.id}>
                        <td className="px-4 py-2 text-sm text-gray-900 dark:text-white">{item.description}</td>
                        <td className="px-4 py-2 text-sm text-center text-gray-600 dark:text-gray-400">{item.quantity}</td>
                        <td className="px-4 py-2 text-sm text-right text-gray-600 dark:text-gray-400">KSH {item.unitPrice.toLocaleString()}</td>
                        <td className="px-4 py-2 text-sm text-right font-medium text-gray-900 dark:text-white">KSH {item.total.toLocaleString()}</td>
                        <td className="px-4 py-2 text-center">
                          <button
                            onClick={() => removeItem(item.id)}
                            className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50 dark:bg-gray-800">
                    <tr>
                      <td colSpan={3} className="px-4 py-2 text-right text-sm font-medium text-gray-700 dark:text-gray-300">Subtotal:</td>
                      <td className="px-4 py-2 text-right text-sm font-medium text-gray-900 dark:text-white">KSH {editingInvoice.subtotal?.toLocaleString() || '0'}</td>
                      <td></td>
                    </tr>
                    <tr>
                      <td colSpan={3} className="px-4 py-2 text-right text-sm font-medium text-gray-700 dark:text-gray-300">Tax (16%):</td>
                      <td className="px-4 py-2 text-right text-sm font-medium text-gray-900 dark:text-white">KSH {editingInvoice.tax?.toLocaleString() || '0'}</td>
                      <td></td>
                    </tr>
                    <tr>
                      <td colSpan={3} className="px-4 py-2 text-right text-lg font-bold text-gray-900 dark:text-white">Total:</td>
                      <td className="px-4 py-2 text-right text-lg font-bold text-[#4A90A4]">KSH {editingInvoice.total?.toLocaleString() || '0'}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

              <FormInput
                label="Notes"
                value={editingInvoice.notes || ''}
                onChange={(e) => setEditingInvoice(prev => ({ ...prev, notes: e.target.value }))}
              className="mt-4"
              />
          </div>

          <div className="flex justify-end space-x-2 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button variant="secondary" onClick={() => {
              setShowCreateModal(false);
              setShowEditModal(false);
              resetInvoiceForm();
            }}>
              Cancel
            </Button>
            <Button onClick={showEditModal ? handleUpdateInvoice : handleCreateInvoice}>
              {showEditModal ? 'Update' : 'Create'} Invoice
            </Button>
          </div>
        </div>
      </Modal>

      {/* Invoice Detail Modal */}
      <Modal 
        open={showDetailModal} 
        onClose={() => {
          setShowDetailModal(false);
          setSelectedInvoice(null);
        }} 
        title={`Invoice ${selectedInvoice?.invoiceNumber}`} 
        size="lg"
      >
        {selectedInvoice && (
          <div ref={invoiceModalRef} className="p-3 md:p-6">
            <div className="mb-4 md:mb-6 p-3 md:p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center gap-2 md:gap-3 mb-2">
                    <img 
                      src={theme === 'dark' ? '/icons/CentalDarkmode.png' : '/icons/CentalLightmode.png'} 
                      alt="CENTRAL SHOP Logo" 
                      className="w-10 h-10 md:w-12 md:h-12 object-contain scale-[2]"
                    />
                    <h3 className="text-base md:text-lg font-semibold text-gray-900 dark:text-white">CENTRAL SHOP</h3>
                  </div>
                  {businessInfo?.address && <p className="text-xs md:text-sm text-gray-600 dark:text-gray-400">{businessInfo.address}</p>}
                  {businessInfo?.phone && <p className="text-xs md:text-sm text-gray-600 dark:text-gray-400">Phone: {businessInfo.phone}</p>}
                </div>
                <div className="text-left md:text-right mt-3 md:mt-0">
                  <p className="text-xs md:text-sm text-gray-600 dark:text-gray-400">Invoice #</p>
                  <p className="text-base md:text-lg font-bold text-gray-900 dark:text-white">{selectedInvoice.invoiceNumber}</p>
                  <p className="text-xs md:text-sm text-gray-600 dark:text-gray-400 mt-1 md:mt-2">Date: {new Date(selectedInvoice.createdAt).toLocaleDateString()}</p>
                  <p className="text-xs md:text-sm text-gray-600 dark:text-gray-400">Due: {selectedInvoice.dueDate.toLocaleDateString()}</p>
                </div>
              </div>
            </div>

            <div className="mb-4 md:mb-6">
              <h4 className="text-sm md:text-base font-semibold text-gray-900 dark:text-white mb-2">Bill To:</h4>
              {selectedInvoice.customerId ? (
                (() => {
                  const customer = customers.find(c => c.id === selectedInvoice.customerId);
                  return (
                    <div className="text-xs md:text-sm text-gray-600 dark:text-gray-400">
                      <p className="font-medium text-gray-900 dark:text-white">{customer?.name || 'Unknown'}</p>
                      {customer?.email && <p>{customer.email}</p>}
                      {customer?.phone && <p>{customer.phone}</p>}
                    </div>
                  );
                })()
              ) : (
                <div className="text-xs md:text-sm text-gray-600 dark:text-gray-400">
                  <p className="font-medium text-gray-900 dark:text-white">Walk-in Customer</p>
                  {(selectedInvoice as any).customerPhone && (
                    <p>{(selectedInvoice as any).customerPhone}</p>
                  )}
                </div>
              )}
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
                    {selectedInvoice.items.map((item, idx) => (
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
                      <td className="px-2 md:px-4 py-2 md:py-3 text-right text-xs md:text-sm font-medium text-gray-900 dark:text-white">KSH {selectedInvoice.subtotal.toLocaleString()}</td>
                    </tr>
                    <tr>
                      <td colSpan={3} className="px-2 md:px-4 py-2 md:py-3 text-right text-xs md:text-sm font-medium text-gray-700 dark:text-gray-300">Tax (16%):</td>
                      <td className="px-2 md:px-4 py-2 md:py-3 text-right text-xs md:text-sm font-medium text-gray-900 dark:text-white">KSH {selectedInvoice.tax.toLocaleString()}</td>
                    </tr>
                    <tr>
                      <td colSpan={3} className="px-2 md:px-4 py-2 md:py-3 text-right text-base md:text-lg font-bold text-gray-900 dark:text-white">Total:</td>
                      <td className="px-2 md:px-4 py-2 md:py-3 text-right text-base md:text-lg font-bold text-[#4A90A4]">KSH {selectedInvoice.total.toLocaleString()}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {selectedInvoice.notes && !isCapturingPDF && (
              <div className="mb-4 md:mb-6 p-3 md:p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <h4 className="text-sm md:text-base font-semibold text-gray-900 dark:text-white mb-2">Notes:</h4>
                <p className="text-xs md:text-sm text-gray-600 dark:text-gray-400">{selectedInvoice.notes}</p>
              </div>
            )}

            {!isCapturingPDF && (
              <div className="flex flex-col sm:flex-row justify-end gap-2 sm:space-x-2 pt-4 border-t border-gray-200 dark:border-gray-700">
                <Button
                  variant="secondary"
                  onClick={() => downloadInvoice(selectedInvoice)}
                  className="w-full sm:w-auto"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download
                </Button>
                {((selectedInvoice.customerId && customers.find(c => c.id === selectedInvoice.customerId)?.phone) || 
                  (selectedInvoice as any).customerPhone) && (
                  <Button
                    onClick={() => sendPDFViaWhatsApp(selectedInvoice as Invoice & { customerPhone?: string })}
                    className="w-full sm:w-auto"
                  >
                    <MessageCircle className="w-4 h-4 mr-2" />
                    <span className="hidden sm:inline">Send PDF via WhatsApp</span>
                    <span className="sm:hidden">Send via WhatsApp</span>
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Send Invoice Modal - Shows after creating invoice */}
      <Modal
        open={showSendModal}
        onClose={() => {
          setShowSendModal(false);
          setNewlyCreatedInvoice(null);
        }}
        title="Invoice Created Successfully!"
        size="md"
      >
        {newlyCreatedInvoice && (
          <div className="p-6">
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Invoice <strong>{newlyCreatedInvoice.invoiceNumber}</strong> has been created. Would you like to send it now?
            </p>
            <div className="flex flex-col space-y-3">
              {((newlyCreatedInvoice.customerId && customers.find(c => c.id === newlyCreatedInvoice.customerId)?.phone) || 
                (newlyCreatedInvoice as any).customerPhone) ? (
                <>
                  <Button
                    onClick={() => {
                      sendPDFViaWhatsApp(newlyCreatedInvoice as Invoice & { customerPhone?: string });
                      setShowSendModal(false);
                      setNewlyCreatedInvoice(null);
                    }}
                    className="w-full flex items-center justify-center"
                  >
                    <MessageCircle className="w-4 h-4 mr-2" />
                    Send to WhatsApp
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowSendModal(false);
                      setNewlyCreatedInvoice(null);
                    }}
                    className="w-full"
                  >
                    Not Now
                  </Button>
                </>
              ) : (
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowSendModal(false);
                    setNewlyCreatedInvoice(null);
                  }}
                  className="w-full"
                >
                  Close
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Invoicing;

