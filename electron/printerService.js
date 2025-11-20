/**
 * Printer Service (CommonJS)
 * Handles receipt printing via thermal printers or fallback methods
 */
const { BrowserWindow } = require('electron');
const log = require('electron-log');
const path = require('path');
const fs = require('fs');
const os = require('os');

/**
 * Format receipt as ESC/POS commands
 */
function formatReceiptEscPos(order) {
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
  
  // Date
  receipt += ESC + 'a' + '\x00'; // Left align
  receipt += `Date: ${order.date}\n`;
  receipt += `Order #: ${order.id}\n`;
  if (order.customerName) {
    receipt += `Customer: ${order.customerName}\n`;
  }
  receipt += '-------------------\n';
  
  // Items
  order.items.forEach(item => {
    const line = `${item.name} x${item.quantity}`;
    const price = `KSH ${(item.price * item.quantity).toLocaleString()}`;
    receipt += line.padEnd(20) + price.padStart(15) + '\n';
  });
  
  receipt += '-------------------\n';
  
  // Totals
  receipt += `Subtotal:`.padEnd(20) + `KSH ${order.subtotal.toLocaleString()}`.padStart(15) + '\n';
  receipt += `Tax:`.padEnd(20) + `KSH ${order.tax.toLocaleString()}`.padStart(15) + '\n';
  receipt += ESC + '!' + '\x08'; // Double height
  receipt += `Total:`.padEnd(20) + `KSH ${order.total.toLocaleString()}`.padStart(15) + '\n';
  receipt += ESC + '!' + '\x00'; // Normal
  
  receipt += '-------------------\n';
  receipt += `Payment: ${order.paymentMethod}\n`;
  receipt += '\n\n\n';
  
  // Cut paper
  receipt += GS + 'V' + '\x41' + '\x03';
  
  return receipt;
}

/**
 * Format receipt as HTML
 */
function formatReceiptHTML(order) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    @media print {
      @page { margin: 0; size: 80mm auto; }
      body { margin: 0; padding: 10px; }
    }
    body {
      font-family: 'Courier New', monospace;
      font-size: 12px;
      width: 80mm;
      margin: 0 auto;
      padding: 10px;
    }
    .header {
      text-align: center;
      font-weight: bold;
      font-size: 16px;
      margin-bottom: 10px;
    }
    .divider {
      border-top: 1px dashed #000;
      margin: 10px 0;
    }
    .item-row {
      display: flex;
      justify-content: space-between;
      margin: 5px 0;
    }
    .total {
      font-weight: bold;
      font-size: 14px;
    }
    .footer {
      margin-top: 20px;
      text-align: center;
      font-size: 10px;
    }
  </style>
</head>
<body>
  <div class="header">CENTRAL SHOP</div>
  <div class="divider"></div>
  <div>Date: ${order.date}</div>
  <div>Order #: ${order.id}</div>
  ${order.customerName ? `<div>Customer: ${order.customerName}</div>` : ''}
  <div class="divider"></div>
  ${order.items.map(item => `
    <div class="item-row">
      <span>${item.name} x${item.quantity}</span>
      <span>KSH ${(item.price * item.quantity).toLocaleString()}</span>
    </div>
  `).join('')}
  <div class="divider"></div>
  <div class="item-row">
    <span>Subtotal:</span>
    <span>KSH ${order.subtotal.toLocaleString()}</span>
  </div>
  <div class="item-row">
    <span>Tax:</span>
    <span>KSH ${order.tax.toLocaleString()}</span>
  </div>
  <div class="item-row total">
    <span>Total:</span>
    <span>KSH ${order.total.toLocaleString()}</span>
  </div>
  <div class="divider"></div>
  <div>Payment: ${order.paymentMethod}</div>
  <div class="footer">
    Thank you for your business!<br>
    Central Shop POS
  </div>
</body>
</html>
  `;
}

/**
 * Print receipt using available method
 */
async function printReceipt(orderData, window) {
  try {
    // Try thermal printer first (if available)
    let printed = false;
    
    try {
      // Attempt to use node-thermal-printer
      const { ThermalPrinter, PrinterTypes, CharacterSet, BreakLine } = require('node-thermal-printer');
      const printer = new ThermalPrinter({
        type: PrinterTypes.EPSON,
        interface: 'tcp://192.168.1.100', // TODO: Make configurable
        characterSet: CharacterSet.PC852_LATIN2,
        removeSpecialCharacters: false,
        lineCharacter: '-',
        breakLine: BreakLine.WORD
      });
      
      const escPosData = formatReceiptEscPos(orderData);
      await printer.print(escPosData);
      printed = true;
      log.info('Receipt printed via thermal printer');
    } catch (thermalError) {
      log.warn('Thermal printer not available, trying fallback:', thermalError);
    }
    
    // Fallback: Print via browser print dialog
    if (!printed && window) {
      const html = formatReceiptHTML(orderData);
      
      // Create temporary HTML file
      const tempDir = os.tmpdir();
      const tempFile = path.join(tempDir, `receipt-${Date.now()}.html`);
      fs.writeFileSync(tempFile, html);
      
      // Open in new window and print
      const printWindow = new BrowserWindow({
        show: false,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true
        }
      });
      
      await printWindow.loadFile(tempFile);
      
      printWindow.webContents.once('did-finish-load', () => {
        printWindow.webContents.print({ silent: false, printBackground: true }, (success) => {
          if (success) {
            log.info('Receipt printed via browser print dialog');
          } else {
            log.error('Print dialog cancelled or failed');
          }
          printWindow.close();
          // Clean up temp file
          setTimeout(() => {
            try {
              fs.unlinkSync(tempFile);
            } catch (e) {
              // Ignore cleanup errors
            }
          }, 1000);
        });
      });
    }
  } catch (error) {
    log.error('Print receipt error:', error);
    throw error;
  }
}

module.exports = { printReceipt };

