/**
 * Receipt Template Generator
 * Creates HTML/PDF-ready receipt templates
 */

export interface ReceiptData {
  orderId: string;
  date: string;
  items: Array<{
    name: string;
    quantity: number;
    price: number;
  }>;
  subtotal: number;
  tax: number;
  total: number;
  paymentMethod: string;
  customerName?: string;
  employeeName?: string;
  change?: number;
}

/**
 * Generate HTML receipt template
 */
export function generateReceiptHTML(data: ReceiptData): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Receipt - ${data.orderId}</title>
  <style>
    @media print {
      @page {
        margin: 0;
        size: 80mm auto;
      }
      body {
        margin: 0;
        padding: 10px;
      }
      .no-print {
        display: none;
      }
    }
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: 'Courier New', monospace;
      font-size: 12px;
      width: 80mm;
      margin: 0 auto;
      padding: 10px;
      background: white;
      color: black;
    }
    .header {
      text-align: center;
      margin-bottom: 15px;
    }
    .logo {
      font-size: 20px;
      font-weight: bold;
      margin-bottom: 5px;
    }
    .business-info {
      font-size: 10px;
      color: #666;
    }
    .divider {
      border-top: 1px dashed #000;
      margin: 10px 0;
    }
    .section {
      margin: 10px 0;
    }
    .item-row {
      display: flex;
      justify-content: space-between;
      margin: 5px 0;
      font-size: 11px;
    }
    .item-name {
      flex: 1;
    }
    .item-quantity {
      margin: 0 5px;
    }
    .item-price {
      text-align: right;
      min-width: 60px;
    }
    .totals {
      margin-top: 10px;
    }
    .total-row {
      display: flex;
      justify-content: space-between;
      margin: 5px 0;
      font-weight: bold;
    }
    .grand-total {
      font-size: 14px;
      border-top: 2px solid #000;
      padding-top: 5px;
      margin-top: 5px;
    }
    .footer {
      margin-top: 20px;
      text-align: center;
      font-size: 10px;
      color: #666;
    }
    .payment-info {
      margin-top: 10px;
      padding-top: 10px;
      border-top: 1px dashed #000;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">CENTRAL SHOP</div>
    <div class="business-info">
      Point of Sale System<br>
      ${data.date}
    </div>
  </div>
  
  <div class="divider"></div>
  
  <div class="section">
    <div><strong>Order #:</strong> ${data.orderId}</div>
    ${data.customerName ? `<div><strong>Customer:</strong> ${data.customerName}</div>` : ''}
    ${data.employeeName ? `<div><strong>Cashier:</strong> ${data.employeeName}</div>` : ''}
  </div>
  
  <div class="divider"></div>
  
  <div class="section">
    ${data.items.map(item => `
      <div class="item-row">
        <span class="item-name">${item.name}</span>
        <span class="item-quantity">x${item.quantity}</span>
        <span class="item-price">KSH ${(item.price * item.quantity).toLocaleString()}</span>
      </div>
    `).join('')}
  </div>
  
  <div class="divider"></div>
  
  <div class="totals">
    <div class="total-row">
      <span>Subtotal:</span>
      <span>KSH ${data.subtotal.toLocaleString()}</span>
    </div>
    <div class="total-row">
      <span>Tax:</span>
      <span>KSH ${data.tax.toLocaleString()}</span>
    </div>
    <div class="total-row grand-total">
      <span>TOTAL:</span>
      <span>KSH ${data.total.toLocaleString()}</span>
    </div>
  </div>
  
  <div class="payment-info">
    <div><strong>Payment Method:</strong> ${data.paymentMethod}</div>
    ${data.change !== undefined && data.change > 0 ? `<div><strong>Change:</strong> KSH ${data.change.toLocaleString()}</div>` : ''}
  </div>
  
  <div class="footer">
    Thank you for your business!<br>
    Central Shop POS
  </div>
</body>
</html>
  `;
}

/**
 * Generate ESC/POS receipt commands
 */
export function generateReceiptEscPos(data: ReceiptData): string {
  const ESC = '\x1B';
  const GS = '\x1D';
  
  let receipt = '';
  
  // Initialize printer
  receipt += ESC + '@';
  
  // Center align
  receipt += ESC + 'a' + '\x01';
  
  // Title
  receipt += ESC + '!' + '\x08'; // Double height
  receipt += 'CENTRAL SHOP\n';
  receipt += ESC + '!' + '\x00'; // Normal
  receipt += '-------------------\n';
  
  // Left align
  receipt += ESC + 'a' + '\x00';
  
  // Order info
  receipt += `Date: ${data.date}\n`;
  receipt += `Order #: ${data.orderId}\n`;
  if (data.customerName) {
    receipt += `Customer: ${data.customerName}\n`;
  }
  if (data.employeeName) {
    receipt += `Cashier: ${data.employeeName}\n`;
  }
  receipt += '-------------------\n';
  
  // Items
  data.items.forEach(item => {
    const name = item.name.substring(0, 20).padEnd(20);
    const qty = `x${item.quantity}`.padStart(4);
    const price = `KSH ${(item.price * item.quantity).toLocaleString()}`.padStart(15);
    receipt += `${name} ${qty}${price}\n`;
  });
  
  receipt += '-------------------\n';
  
  // Totals
  receipt += `Subtotal:`.padEnd(20) + `KSH ${data.subtotal.toLocaleString()}`.padStart(15) + '\n';
  receipt += `Tax:`.padEnd(20) + `KSH ${data.tax.toLocaleString()}`.padStart(15) + '\n';
  receipt += ESC + '!' + '\x08'; // Double height
  receipt += `TOTAL:`.padEnd(20) + `KSH ${data.total.toLocaleString()}`.padStart(15) + '\n';
  receipt += ESC + '!' + '\x00'; // Normal
  
  receipt += '-------------------\n';
  receipt += `Payment: ${data.paymentMethod}\n`;
  if (data.change !== undefined && data.change > 0) {
    receipt += `Change: KSH ${data.change.toLocaleString()}\n`;
  }
  receipt += '\n\n\n';
  
  // Cut paper
  receipt += GS + 'V' + '\x41' + '\x03';
  
  return receipt;
}

