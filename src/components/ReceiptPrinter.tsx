import React from 'react';

interface Product {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

interface ReceiptData {
  orderId: string;
  items: Product[];
  subtotal: number;
  tax: number;
  total: number;
  paymentMethod: string;
  amountReceived?: number;
  change?: number;
  customerName?: string;
  customerPhone?: string;
  mpesaCode?: string;
  debtAmount?: number;
  partialAmount?: number;
  remainingAmount?: number;
  dueDate?: string;
  employeeName: string;
  shopName: string;
  timestamp: Date;
}

interface ReceiptPrinterProps {
  data: ReceiptData;
  onPrintComplete?: () => void;
}

const ReceiptPrinter: React.FC<ReceiptPrinterProps> = ({ data, onPrintComplete }) => {
  const formatCurrency = (amount: number) => `KSH ${amount.toFixed(2)}`;
  const formatDate = (date: Date) => date.toLocaleString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  const printReceipt = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const receiptHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Receipt - ${data.orderId}</title>
        <style>
          body {
            font-family: 'Courier New', monospace;
            font-size: 12px;
            line-height: 1.4;
            margin: 0;
            padding: 10px;
            width: 300px;
          }
          .header {
            text-align: center;
            border-bottom: 1px dashed #000;
            padding-bottom: 10px;
            margin-bottom: 10px;
          }
          .shop-name {
            font-size: 16px;
            font-weight: bold;
            margin-bottom: 5px;
          }
          .order-info {
            font-size: 10px;
            margin-bottom: 10px;
          }
          .items {
            margin-bottom: 10px;
          }
          .item {
            display: flex;
            justify-content: space-between;
            margin-bottom: 3px;
          }
          .item-name {
            flex: 1;
          }
          .item-qty {
            margin: 0 10px;
          }
          .item-price {
            text-align: right;
            min-width: 60px;
          }
          .totals {
            border-top: 1px dashed #000;
            padding-top: 10px;
            margin-top: 10px;
          }
          .total-line {
            display: flex;
            justify-content: space-between;
            margin-bottom: 3px;
          }
          .total-final {
            font-weight: bold;
            font-size: 14px;
            border-top: 1px solid #000;
            padding-top: 5px;
            margin-top: 5px;
          }
          .payment-info {
            margin-top: 10px;
            padding-top: 10px;
            border-top: 1px dashed #000;
          }
          .customer-info {
            margin-top: 10px;
            padding-top: 10px;
            border-top: 1px dashed #000;
          }
          .footer {
            text-align: center;
            margin-top: 20px;
            font-size: 10px;
          }
          @media print {
            body { margin: 0; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div style="margin-bottom: 10px; text-align: center;">
            <img src="/icons/central.png" alt="Central Shop Logo" style="max-width: 60px; max-height: 60px; object-fit: contain; margin: 0 auto;" onerror="this.style.display='none'" />
          </div>
          <div class="shop-name">CENTRAL SHOP</div>
          <div class="order-info">
            Order: ${data.orderId}<br>
            Date: ${formatDate(data.timestamp)}<br>
            Cashier: ${data.employeeName}
          </div>
        </div>

        <div class="items">
          ${data.items.map(item => `
            <div class="item">
              <div class="item-name">${item.name}</div>
              <div class="item-qty">${item.quantity}x</div>
              <div class="item-price">${formatCurrency(item.price * item.quantity)}</div>
            </div>
          `).join('')}
        </div>

        <div class="totals">
          <div class="total-line">
            <span>Subtotal:</span>
            <span>${formatCurrency(data.subtotal)}</span>
          </div>
          <div class="total-line">
            <span>Tax (10%):</span>
            <span>${formatCurrency(data.tax)}</span>
          </div>
          <div class="total-line total-final">
            <span>TOTAL:</span>
            <span>${formatCurrency(data.total)}</span>
          </div>
        </div>

        <div class="payment-info">
          <div><strong>Payment Method:</strong> ${data.paymentMethod.toUpperCase()}</div>
          ${data.amountReceived ? `<div><strong>Amount Received:</strong> ${formatCurrency(data.amountReceived)}</div>` : ''}
          ${data.change ? `<div><strong>Change:</strong> ${formatCurrency(data.change)}</div>` : ''}
          ${data.mpesaCode ? `<div><strong>M-Pesa Code:</strong> ${data.mpesaCode}</div>` : ''}
          ${data.partialAmount ? `<div><strong>Amount Paid:</strong> ${formatCurrency(data.partialAmount)}</div>` : ''}
          ${data.remainingAmount ? `<div><strong>Remaining Amount:</strong> ${formatCurrency(data.remainingAmount)}</div>` : ''}
          ${data.debtAmount ? `<div><strong>Debt Amount:</strong> ${formatCurrency(data.debtAmount)}</div>` : ''}
          ${data.dueDate ? `<div><strong>Due Date:</strong> ${new Date(data.dueDate).toLocaleDateString()}</div>` : ''}
        </div>

        ${data.customerName || data.customerPhone ? `
          <div class="customer-info">
            <div><strong>Customer Details:</strong></div>
            ${data.customerName ? `<div>Name: ${data.customerName}</div>` : ''}
            ${data.customerPhone ? `<div>Phone: ${data.customerPhone}</div>` : ''}
          </div>
        ` : ''}

        <div class="footer">
          Thank you for your business!<br>
          Please keep this receipt for your records.
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(receiptHTML);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.close();

    if (onPrintComplete) {
      onPrintComplete();
    }
  };

  // Auto-print when component mounts
  React.useEffect(() => {
    printReceipt();
  }, []);

  return null;
};

export default ReceiptPrinter;
