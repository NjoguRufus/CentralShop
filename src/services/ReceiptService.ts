// src/services/ReceiptService.ts
import { PaymentSettings } from '../types';

export interface ReceiptData {
  orderId: string;
  items: Array<{
    name: string;
    quantity: number;
    price: number;
    total: number;
  }>;
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
  timestamp: Date;
  businessName: string;
  businessAddress: string;
  businessPhone: string;
}

export class ReceiptService {
  private static generateFileName(receiptData: ReceiptData): string {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const timeStr = date.toTimeString().slice(0, 8).replace(/:/g, '');
    const productName = receiptData.items[0]?.name || 'receipt';
    return `${productName}_${dateStr}_${timeStr}`;
  }

  private static generateReceiptHTML(receiptData: ReceiptData): string {
    const formatCurrency = (amount: number) => `KSH ${amount.toFixed(2)}`;
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Receipt - ${receiptData.orderId}</title>
        <style>
          body {
            font-family: 'Courier New', monospace;
            font-size: 12px;
            line-height: 1.4;
            margin: 0;
            padding: 20px;
            background: white;
            color: black;
          }
          .receipt {
            max-width: 300px;
            margin: 0 auto;
            border: 1px solid #ccc;
            padding: 15px;
          }
          .header {
            text-align: center;
            border-bottom: 1px dashed #ccc;
            padding-bottom: 10px;
            margin-bottom: 15px;
          }
          .business-name {
            font-size: 16px;
            font-weight: bold;
            margin-bottom: 5px;
          }
          .business-info {
            font-size: 10px;
            color: #666;
          }
          .order-info {
            margin-bottom: 15px;
          }
          .order-id {
            font-weight: bold;
            margin-bottom: 5px;
          }
          .date-time {
            font-size: 10px;
            color: #666;
          }
          .items {
            margin-bottom: 15px;
          }
          .item {
            display: flex;
            justify-content: space-between;
            margin-bottom: 5px;
            padding: 2px 0;
          }
          .item-name {
            flex: 1;
          }
          .item-qty {
            margin: 0 10px;
            text-align: center;
            min-width: 30px;
          }
          .item-price {
            text-align: right;
            min-width: 60px;
          }
          .divider {
            border-top: 1px dashed #ccc;
            margin: 10px 0;
          }
          .totals {
            margin-bottom: 15px;
          }
          .total-line {
            display: flex;
            justify-content: space-between;
            margin-bottom: 3px;
          }
          .total-label {
            font-weight: bold;
          }
          .payment-info {
            border-top: 1px dashed #ccc;
            padding-top: 10px;
            margin-bottom: 15px;
          }
          .payment-method {
            margin-bottom: 5px;
          }
          ${receiptData.amountReceived ? `
          .amount-received {
            margin-bottom: 5px;
          }
          .change {
            margin-bottom: 5px;
          }
          ` : ''}
          ${receiptData.debtAmount ? `
          .debt-amount {
            margin-bottom: 5px;
            color: #e74c3c;
          }
          ` : ''}
          ${receiptData.partialAmount ? `
          .partial-amount {
            margin-bottom: 5px;
            color: #f39c12;
          }
          .remaining-amount {
            margin-bottom: 5px;
            color: #e74c3c;
          }
          ` : ''}
          .footer {
            text-align: center;
            font-size: 10px;
            color: #666;
            border-top: 1px dashed #ccc;
            padding-top: 10px;
          }
          .employee {
            margin-bottom: 5px;
          }
          .thank-you {
            font-weight: bold;
            margin-top: 10px;
          }
        </style>
      </head>
      <body>
        <div class="receipt">
          <div class="header">
            <div style="margin-bottom: 10px; text-align: center;">
              <img src="/icons/CentalLightmode.png" alt="Central Shop Logo" style="max-width: 60px; max-height: 60px; object-fit: contain; margin: 0 auto; display: block;" onerror="this.style.display='none'" />
            </div>
            <div class="business-name">CENTRAL SHOP</div>
            <div class="business-info">
              ${receiptData.businessAddress}<br>
              ${receiptData.businessPhone}
            </div>
          </div>
          
          <div class="order-info">
            <div class="order-id">Order: ${receiptData.orderId}</div>
            <div class="date-time">${receiptData.timestamp.toLocaleString()}</div>
          </div>
          
          <div class="items">
            ${receiptData.items.map(item => `
              <div class="item">
                <div class="item-name">${item.name}</div>
                <div class="item-qty">${item.quantity}</div>
                <div class="item-price">${formatCurrency(item.total)}</div>
              </div>
            `).join('')}
          </div>
          
          <div class="divider"></div>
          
          <div class="totals">
            <div class="total-line">
              <span>Subtotal:</span>
              <span>${formatCurrency(receiptData.subtotal)}</span>
            </div>
            <div class="total-line">
              <span>Tax:</span>
              <span>${formatCurrency(receiptData.tax)}</span>
            </div>
            <div class="total-line">
              <span class="total-label">Total:</span>
              <span class="total-label">${formatCurrency(receiptData.total)}</span>
            </div>
          </div>
          
          <div class="payment-info">
            <div class="payment-method">Payment: ${receiptData.paymentMethod}</div>
            ${receiptData.amountReceived ? `
            <div class="amount-received">Amount Received: ${formatCurrency(receiptData.amountReceived)}</div>
            <div class="change">Change: ${formatCurrency(receiptData.change || 0)}</div>
            ` : ''}
            ${receiptData.debtAmount ? `
            <div class="debt-amount">Debt Amount: ${formatCurrency(receiptData.debtAmount)}</div>
            <div class="debt-amount">Due Date: ${receiptData.dueDate}</div>
            ` : ''}
            ${receiptData.partialAmount ? `
            <div class="partial-amount">Amount Paid: ${formatCurrency(receiptData.partialAmount)}</div>
            <div class="remaining-amount">Remaining: ${formatCurrency(receiptData.remainingAmount || 0)}</div>
            <div class="remaining-amount">Due Date: ${receiptData.dueDate}</div>
            ` : ''}
            ${receiptData.customerName ? `<div>Customer: ${receiptData.customerName}</div>` : ''}
            ${receiptData.customerPhone ? `<div>Phone: ${receiptData.customerPhone}</div>` : ''}
            ${receiptData.mpesaCode ? `<div>M-Pesa Code: ${receiptData.mpesaCode}</div>` : ''}
          </div>
          
          <div class="footer">
            <div class="employee">Served by: ${receiptData.employeeName}</div>
            <div class="thank-you">Thank you for your business!</div>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  static async handleReceiptFlow(
    receiptData: ReceiptData,
    paymentSettings: PaymentSettings,
    businessInfo: { name: string; address: string; phone: string }
  ): Promise<{ success: boolean; message: string }> {
    try {
      // Add business info to receipt data
      const fullReceiptData = {
        ...receiptData,
        businessName: 'CENTRAL SHOP', // Always use CENTRAL SHOP
        businessAddress: businessInfo.address,
        businessPhone: businessInfo.phone
      };

      if (paymentSettings.saveReceipt) {
        // Show save dialog only when saveReceipt is enabled
        const saveChoice = await this.showSaveDialog();
        
        if (saveChoice === 'save') {
          const fileName = this.generateFileName(fullReceiptData);
          const success = await this.saveReceipt(fullReceiptData, fileName, paymentSettings.receiptFormat);
          
          if (success) {
            return { success: true, message: `Receipt saved as ${fileName}.${paymentSettings.receiptFormat.toLowerCase()}` };
          } else {
            return { success: false, message: 'Failed to save receipt' };
          }
        } else {
          // User chose print only, so just print
          const printSuccess = await this.printReceipt(fullReceiptData);
          
          if (printSuccess) {
            return { success: true, message: 'Receipt sent to printer successfully' };
          } else {
            return { success: false, message: 'Failed to print receipt' };
          }
        }
      } else {
        // saveReceipt is disabled, just print in background
        const printSuccess = await this.printReceipt(fullReceiptData);
        
        if (printSuccess) {
          return { success: true, message: 'Receipt sent to printer successfully' };
        } else {
          return { success: false, message: 'Failed to print receipt' };
        }
      }
    } catch (error) {
      console.error('Receipt flow error:', error);
      return { success: false, message: 'Receipt processing failed' };
    }
  }

  private static async showSaveDialog(): Promise<'save' | 'print'> {
    return new Promise((resolve) => {
      // Create a custom modal instead of using confirm
      const modal = document.createElement('div');
      modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10000;
      `;
      
      const dialog = document.createElement('div');
      dialog.style.cssText = `
        background: white;
        padding: 20px;
        border-radius: 8px;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        text-align: center;
        max-width: 400px;
        width: 90%;
      `;
      
      dialog.innerHTML = `
        <h3 style="margin: 0 0 15px 0; color: #333;">Receipt Options</h3>
        <p style="margin: 0 0 20px 0; color: #666;">How would you like to handle the receipt?</p>
        <div style="display: flex; gap: 10px; justify-content: center;">
          <button id="save-btn" style="
            background: #4A90A4;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
          ">Save to Disk</button>
          <button id="print-btn" style="
            background: #6c757d;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
          ">Print Only</button>
        </div>
      `;
      
      modal.appendChild(dialog);
      document.body.appendChild(modal);
      
      const saveBtn = dialog.querySelector('#save-btn');
      const printBtn = dialog.querySelector('#print-btn');
      
      const cleanup = () => {
        document.body.removeChild(modal);
      };
      
      saveBtn?.addEventListener('click', () => {
        cleanup();
        resolve('save');
      });
      
      printBtn?.addEventListener('click', () => {
        cleanup();
        resolve('print');
      });
      
      // Close on backdrop click
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          cleanup();
          resolve('print'); // Default to print
        }
      });
    });
  }

  private static async saveReceipt(
    receiptData: ReceiptData,
    fileName: string,
    format: 'PDF' | 'TXT' | 'Image'
  ): Promise<boolean> {
    try {
      const html = this.generateReceiptHTML(receiptData);
      
      if (format === 'PDF') {
        return await this.saveAsPDF(html, fileName);
      } else if (format === 'TXT') {
        return await this.saveAsTXT(receiptData, fileName);
      } else if (format === 'Image') {
        return await this.saveAsImage(html, fileName);
      }
      
      return false;
    } catch (error) {
      console.error('Save receipt error:', error);
      return false;
    }
  }

  private static async saveAsPDF(html: string, fileName: string): Promise<boolean> {
    try {
      // Create a hidden iframe for PDF generation
      const iframe = document.createElement('iframe');
      iframe.style.position = 'absolute';
      iframe.style.left = '-9999px';
      iframe.style.top = '-9999px';
      iframe.style.width = '300px';
      iframe.style.height = '400px';
      document.body.appendChild(iframe);

      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!iframeDoc) return false;

      iframeDoc.open();
      iframeDoc.write(html);
      iframeDoc.close();

      // Wait for content to load
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Create a blob and download
      const printWindow = iframe.contentWindow;
      if (printWindow) {
        printWindow.focus();
        printWindow.print();
      }

      // Clean up
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 1000);

      return true;
    } catch (error) {
      console.error('PDF save error:', error);
      return false;
    }
  }

  private static async saveAsTXT(receiptData: ReceiptData, fileName: string): Promise<boolean> {
    try {
      const formatCurrency = (amount: number) => `KSH ${amount.toFixed(2)}`;
      
      let txtContent = `CENTRAL SHOP\n`;
      txtContent += `${receiptData.businessAddress}\n`;
      txtContent += `${receiptData.businessPhone}\n`;
      txtContent += `${'='.repeat(30)}\n\n`;
      txtContent += `Order: ${receiptData.orderId}\n`;
      txtContent += `Date: ${receiptData.timestamp.toLocaleString()}\n\n`;
      
      txtContent += `Items:\n`;
      receiptData.items.forEach(item => {
        txtContent += `${item.name} x${item.quantity} = ${formatCurrency(item.total)}\n`;
      });
      
      txtContent += `\n${'='.repeat(30)}\n`;
      txtContent += `Subtotal: ${formatCurrency(receiptData.subtotal)}\n`;
      txtContent += `Tax: ${formatCurrency(receiptData.tax)}\n`;
      txtContent += `Total: ${formatCurrency(receiptData.total)}\n\n`;
      
      txtContent += `Payment: ${receiptData.paymentMethod}\n`;
      if (receiptData.amountReceived) {
        txtContent += `Amount Received: ${formatCurrency(receiptData.amountReceived)}\n`;
        txtContent += `Change: ${formatCurrency(receiptData.change || 0)}\n`;
      }
      if (receiptData.debtAmount) {
        txtContent += `Debt Amount: ${formatCurrency(receiptData.debtAmount)}\n`;
        txtContent += `Due Date: ${receiptData.dueDate}\n`;
      }
      if (receiptData.partialAmount) {
        txtContent += `Amount Paid: ${formatCurrency(receiptData.partialAmount)}\n`;
        txtContent += `Remaining: ${formatCurrency(receiptData.remainingAmount || 0)}\n`;
        txtContent += `Due Date: ${receiptData.dueDate}\n`;
      }
      if (receiptData.customerName) {
        txtContent += `Customer: ${receiptData.customerName}\n`;
      }
      if (receiptData.customerPhone) {
        txtContent += `Phone: ${receiptData.customerPhone}\n`;
      }
      if (receiptData.mpesaCode) {
        txtContent += `M-Pesa Code: ${receiptData.mpesaCode}\n`;
      }
      
      txtContent += `\nServed by: ${receiptData.employeeName}\n`;
      txtContent += `\nThank you for your business!\n`;

      // Create and download the file
      const blob = new Blob([txtContent], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${fileName}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      return true;
    } catch (error) {
      console.error('TXT save error:', error);
      return false;
    }
  }

  private static async saveAsImage(html: string, fileName: string): Promise<boolean> {
    try {
      // Create a temporary element with the receipt HTML
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = html;
      tempDiv.style.position = 'absolute';
      tempDiv.style.left = '-9999px';
      tempDiv.style.top = '-9999px';
      document.body.appendChild(tempDiv);

      // Use html2canvas to convert to image (if available)
      if (typeof (window as any).html2canvas !== 'undefined') {
        const canvas = await (window as any).html2canvas(tempDiv.firstElementChild);
        const imgData = canvas.toDataURL('image/png');
        
        const a = document.createElement('a');
        a.href = imgData;
        a.download = `${fileName}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        document.body.removeChild(tempDiv);
        return true;
      } else {
        // Fallback to PDF if html2canvas is not available
        document.body.removeChild(tempDiv);
        return await this.saveAsPDF(html, fileName);
      }
    } catch (error) {
      console.error('Image save error:', error);
      return false;
    }
  }

  private static async printReceipt(receiptData: ReceiptData): Promise<boolean> {
    try {
      const html = this.generateReceiptHTML(receiptData);
      
      // Create a hidden iframe for printing
      const iframe = document.createElement('iframe');
      iframe.style.position = 'absolute';
      iframe.style.left = '-9999px';
      iframe.style.top = '-9999px';
      iframe.style.width = '300px';
      iframe.style.height = '400px';
      document.body.appendChild(iframe);

      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!iframeDoc) return false;

      iframeDoc.open();
      iframeDoc.write(html);
      iframeDoc.close();

      // Wait for content to load
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Trigger print dialog
      const printWindow = iframe.contentWindow;
      if (printWindow) {
        printWindow.focus();
        printWindow.print();
      }

      // Clean up
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 1000);
      
      return true;
    } catch (error) {
      console.error('Print receipt error:', error);
      return false;
    }
  }
}

