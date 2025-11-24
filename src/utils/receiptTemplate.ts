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
  const accent = '#4A90A4';
  const format = (value: number) => `KSH ${value.toFixed(2)}`;
  const brandName = 'CENTRAL SHOP';

  return `
  <!DOCTYPE html>
  <html>
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Receipt - ${data.orderId}</title>
      <style>
        @media print {
          @page {
            margin: 0;
            size: 80mm auto;
          }
          body {
            margin: 0;
            padding: 0;
          }
        }
        * {
          box-sizing: border-box;
        }
        body {
          font-family: 'Space Grotesk', 'Inter', 'Courier New', monospace;
          background: #fff;
          color: #111;
          width: 80mm;
          margin: 0 auto;
        }
        .wrap {
          padding: 10px 12px 16px;
        }
        .brand {
          text-align: center;
          padding-bottom: 10px;
          border-bottom: 1px solid rgba(0,0,0,0.1);
        }
        .brand-logo {
          display: flex;
          justify-content: center;
          margin-bottom: 6px;
        }
        .brand-logo img {
          width: 42px;
          height: 42px;
          object-fit: contain;
        }
        .brand-name {
          font-size: 16px;
          letter-spacing: 2px;
          font-weight: 700;
          color: ${accent};
        }
        .tagline {
          font-size: 9px;
          text-transform: uppercase;
          letter-spacing: 3px;
          color: #666;
          margin-top: 2px;
        }
        .meta {
          margin: 10px 0 12px;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .meta-row {
          display: flex;
          justify-content: space-between;
          margin: 2px 0;
        }
        .items {
          margin-top: 12px;
          border: 1px solid rgba(0,0,0,0.08);
          border-radius: 10px;
          padding: 8px;
        }
        .item-row {
          display: grid;
          grid-template-columns: 1fr auto auto;
          gap: 6px;
          font-size: 10px;
          padding: 4px 0;
          border-bottom: 1px dashed rgba(0,0,0,0.08);
        }
        .item-row:last-child {
          border-bottom: none;
        }
        .item-name {
          font-weight: 600;
          color: #222;
        }
        .item-qty {
          text-align: right;
          color: #666;
          min-width: 28px;
        }
        .item-price {
          text-align: right;
          font-weight: 600;
          min-width: 55px;
        }
        .totals {
          margin-top: 14px;
          border-top: 1px dashed rgba(0,0,0,0.2);
          padding-top: 10px;
        }
        .total-line {
          display: flex;
          justify-content: space-between;
          font-size: 10px;
          margin: 2px 0;
        }
        .grand-total {
          font-size: 12px;
          font-weight: 700;
          color: #111;
          margin-top: 6px;
        }
        .footer {
          margin-top: 14px;
          text-align: center;
          font-size: 9px;
          color: #777;
        }
      </style>
    </head>
    <body>
      <div class="wrap">
        <div class="brand">
              <div class="brand-logo">
                <img src="/icons/CentalLightmode.png" alt="${brandName} Logo" onerror="this.style.display='none'" />
              </div>
              <div class="brand-name">${brandName}</div>
          <div class="tagline">Boutique Retail Experience</div>
        </div>

        <div class="meta">
          <div class="meta-row">
            <span>Order</span>
            <span>#${data.orderId}</span>
          </div>
          <div class="meta-row">
            <span>Date</span>
            <span>${data.date}</span>
          </div>
          ${data.customerName ? `
          <div class="meta-row">
            <span>Customer</span>
            <span>${data.customerName}</span>
          </div>` : ''}
          ${data.employeeName ? `
          <div class="meta-row">
            <span>Served By</span>
            <span>${data.employeeName}</span>
          </div>` : ''}
        </div>

        <div class="items">
          ${data.items.map(item => `
            <div class="item-row">
              <span class="item-name">${item.name}</span>
              <span class="item-qty">× ${item.quantity}</span>
              <span class="item-price">${format(item.price * item.quantity)}</span>
            </div>
          `).join('')}
        </div>

        <div class="totals">
          <div class="total-line">
            <span>Subtotal</span>
            <span>${format(data.subtotal)}</span>
          </div>
          <div class="total-line">
            <span>Tax</span>
            <span>${format(data.tax)}</span>
          </div>
          <div class="total-line grand-total">
            <span>Total</span>
            <span>${format(data.total)}</span>
          </div>
          <div class="total-line" style="margin-top:6px;">
            <span>Paid via</span>
            <span>${data.paymentMethod}</span>
          </div>
          ${data.change !== undefined && data.change > 0 ? `
          <div class="total-line">
            <span>Change</span>
            <span>${format(data.change)}</span>
          </div>` : ''}
        </div>

        <div class="footer">
          <strong>Modern Luxury Retail</strong>
          Powered By Astraronix Solutions
        </div>
      </div>
    </body>
  </html>`;
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

