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
  // Split payment fields
  cashAmount?: number;
  mpesaAmount?: number;
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

  static buildReceiptHTML(receiptData: ReceiptData): string {
    const formatCurrency = (amount: number) => `KSH ${amount.toFixed(2)}`;
    const accent = '#4A90A4';
    const brandName = receiptData.businessName || 'CENTRAL SHOP';
    const brandAddress = receiptData.businessAddress || '';
    const brandPhone = receiptData.businessPhone || '';
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
          <meta charset="utf-8" />
        <title>Receipt - ${receiptData.orderId}</title>
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
              padding: 0;
          }
          .receipt {
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

            .badge {
              display: inline-flex;
              align-items: center;
              justify-content: center;
              font-size: 9px;
              padding: 2px 6px;
              border-radius: 999px;
              text-transform: uppercase;
              letter-spacing: 1px;
              border: 1px solid ${accent};
              color: ${accent};
              margin-top: 4px;
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
            .item-total {
            text-align: right;
              font-weight: 600;
            min-width: 55px;
          }

            .stat-grid {
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: 6px;
              margin-top: 10px;
              font-size: 9.5px;
            }
            .stat-card {
              border: 1px solid rgba(0,0,0,0.08);
              border-radius: 8px;
              padding: 6px;
            }
            .stat-label {
              color: #777;
              text-transform: uppercase;
              letter-spacing: 1px;
              font-size: 8px;
              margin-bottom: 2px;
            }
            .stat-value {
              font-weight: 600;
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

            .signature-block {
              margin-top: 14px;
              padding: 10px;
              border: 1px dashed rgba(0,0,0,0.2);
              border-radius: 10px;
              text-align: center;
              font-size: 9px;
              color: #555;
          }
            .signature-label {
              text-transform: uppercase;
              letter-spacing: 2px;
              color: #999;
              font-size: 8px;
            }

          .footer {
              margin-top: 14px;
            text-align: center;
            font-size: 9px;
              color: #777;
          }
            .footer strong {
              display: block;
              margin-bottom: 3px;
              letter-spacing: 1px;
          }
        </style>
      </head>
      <body>
        <div class="receipt">
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
                <span>#${receiptData.orderId}</span>
              </div>
              <div class="meta-row">
                <span>Date</span>
                <span>${receiptData.timestamp.toLocaleDateString()} ${receiptData.timestamp.toLocaleTimeString()}</span>
          </div>
              ${receiptData.customerName ? `
              <div class="meta-row">
                <span>Customer</span>
                <span>${receiptData.customerName}</span>
              </div>` : ''}
              ${receiptData.employeeName ? `
              <div class="meta-row">
                <span>Served By</span>
                <span>${receiptData.employeeName}</span>
              </div>` : ''}
              <div class="badge">${receiptData.paymentMethod.toUpperCase()}</div>
          </div>
          
          <div class="items">
            ${receiptData.items.map(item => `
                <div class="item-row">
                  <span class="item-name">${item.name}</span>
                  <span class="item-qty">× ${item.quantity}</span>
                  <span class="item-total">${formatCurrency(item.total)}</span>
              </div>
            `).join('')}
          </div>
          
            <div class="stat-grid">
              <div class="stat-card">
                <div class="stat-label">Amount Received</div>
                <div class="stat-value">${receiptData.amountReceived ? formatCurrency(receiptData.amountReceived) : '—'}</div>
              </div>
              <div class="stat-card">
                <div class="stat-label">Change</div>
                <div class="stat-value">${receiptData.change ? formatCurrency(receiptData.change) : '—'}</div>
              </div>
            </div>

            ${receiptData.paymentMethod === 'split' && receiptData.cashAmount !== undefined && receiptData.mpesaAmount !== undefined ? `
            <div class="stat-grid" style="margin-top:8px;">
              <div class="stat-card" style="border-color:#3b82f6;">
                <div class="stat-label">Cash Paid</div>
                <div class="stat-value" style="color:#3b82f6;">${formatCurrency(receiptData.cashAmount)}</div>
              </div>
              <div class="stat-card" style="border-color:#10b981;">
                <div class="stat-label">M-Pesa Paid</div>
                <div class="stat-value" style="color:#10b981;">${formatCurrency(receiptData.mpesaAmount)}</div>
              </div>
              ${receiptData.mpesaCode ? `
              <div class="stat-card">
                <div class="stat-label">M-Pesa Code</div>
                <div class="stat-value" style="font-size:10px;">${receiptData.mpesaCode}</div>
              </div>` : ''}
            </div>` : ''}
            ${receiptData.debtAmount || receiptData.partialAmount ? `
            <div class="stat-grid" style="margin-top:8px;">
              ${receiptData.debtAmount ? `
              <div class="stat-card" style="border-color:#b45309;">
                <div class="stat-label">Debt Amount</div>
                <div class="stat-value" style="color:#b45309;">${formatCurrency(receiptData.debtAmount)}</div>
              </div>
              <div class="stat-card">
                <div class="stat-label">Due Date</div>
                <div class="stat-value">${receiptData.dueDate || '—'}</div>
              </div>` : ''}
              ${receiptData.partialAmount ? `
              <div class="stat-card" style="border-color:#f97316;">
                <div class="stat-label">Partial Paid</div>
                <div class="stat-value" style="color:#c2410c;">${formatCurrency(receiptData.partialAmount)}</div>
              </div>
              <div class="stat-card">
                <div class="stat-label">Balance</div>
                <div class="stat-value" style="color:#b91c1c;">${formatCurrency(receiptData.remainingAmount || 0)}</div>
              </div>` : ''}
            </div>` : ''}
          
          <div class="totals">
              <div class="total-line grand-total">
                <span>Total Due</span>
                <span>${formatCurrency(receiptData.total)}</span>
              </div>
            </div>

            <div class="signature-block">
              <div class="signature-label">Signature</div>
              <div style="margin: 8px 0 4px;">__________________________</div>
              <div style="font-size: 8px;">Thank you for choosing Central Shop</div>
            </div>

            <div class="footer">
              <strong>${brandAddress}</strong>
              ${brandPhone}<br/>
              Powered By Astraronix Solutions
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
        businessName: businessInfo.name || 'CENTRAL SHOP',
        businessAddress: businessInfo.address || '',
        businessPhone: businessInfo.phone || ''
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
      const html = this.buildReceiptHTML(receiptData);
      
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

  private static renderMobileReceiptPreview(html: string, receiptData: ReceiptData): void {
    if (typeof document === 'undefined') return;

    const fileName = this.generateFileName(receiptData);

    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      inset: 0;
      background: rgba(15, 23, 42, 0.65);
      z-index: 12000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
    `;

    const dialog = document.createElement('div');
    dialog.style.cssText = `
      background: #ffffff;
      color: #0f172a;
      width: min(420px, 100%);
      max-height: 90vh;
      border-radius: 18px;
      box-shadow: 0 25px 65px rgba(15, 23, 42, 0.35);
      display: flex;
      flex-direction: column;
      overflow: hidden;
    `;

    const header = document.createElement('div');
    header.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 18px;
      border-bottom: 1px solid rgba(15, 23, 42, 0.08);
      font-weight: 600;
    `;
    header.textContent = 'Receipt Preview';

    const closeHeaderBtn = document.createElement('button');
    closeHeaderBtn.textContent = 'Close';
    closeHeaderBtn.style.cssText = `
      font-size: 13px;
      font-weight: 500;
      color: #4A90A4;
      background: transparent;
      border: none;
      cursor: pointer;
    `;
    header.appendChild(closeHeaderBtn);

    const body = document.createElement('div');
    body.style.cssText = `
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      background: #f8fafc;
    `;

    const helper = document.createElement('p');
    helper.textContent = 'Long-press to share or tap download to keep a copy.';
    helper.style.cssText = `
      font-size: 12px;
      color: #475569;
      text-align: center;
      margin-bottom: 12px;
    `;

    // Use iframe to render the complete receipt HTML with all styles
    const receiptIframe = document.createElement('iframe');
    receiptIframe.style.cssText = `
      width: 100%;
      min-height: 400px;
      border: none;
      border-radius: 14px;
      background: #ffffff;
      box-shadow: 0 10px 35px rgba(15, 23, 42, 0.12);
    `;
    receiptIframe.srcdoc = html;

    const actions = document.createElement('div');
    actions.style.cssText = `
      display: flex;
      gap: 10px;
      padding: 14px 18px;
      border-top: 1px solid rgba(15, 23, 42, 0.08);
      background: #ffffff;
    `;

    const downloadBtn = document.createElement('button');
    downloadBtn.textContent = 'Download PDF';
    downloadBtn.style.cssText = `
      flex: 1;
      background: #4A90A4;
      color: #ffffff;
      border: none;
      border-radius: 12px;
      padding: 10px;
      font-weight: 600;
      font-size: 14px;
      cursor: pointer;
    `;

    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Close';
    closeBtn.style.cssText = `
      flex: 1;
      background: #e2e8f0;
      color: #0f172a;
      border: none;
      border-radius: 12px;
      padding: 10px;
      font-weight: 600;
      font-size: 14px;
      cursor: pointer;
    `;

    const cleanup = () => {
      if (document.body.contains(overlay)) {
        document.body.removeChild(overlay);
      }
    };

    closeHeaderBtn.addEventListener('click', cleanup);
    closeBtn.addEventListener('click', cleanup);
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) {
        cleanup();
      }
    });

    downloadBtn.addEventListener('click', async (event) => {
      event.stopPropagation();
      downloadBtn.disabled = true;
      const originalText = downloadBtn.textContent;
      downloadBtn.textContent = 'Preparing...';
      await this.saveAsPDF(html, fileName);
      downloadBtn.textContent = originalText || 'Download PDF';
      downloadBtn.disabled = false;
    });

    body.appendChild(helper);
    body.appendChild(receiptIframe);
    dialog.appendChild(header);
    dialog.appendChild(body);
    actions.appendChild(downloadBtn);
    actions.appendChild(closeBtn);
    dialog.appendChild(actions);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
  }

  private static async printReceipt(receiptData: ReceiptData): Promise<boolean> {
    try {
      const html = this.buildReceiptHTML(receiptData);
      const isMobile =
        typeof window !== 'undefined' &&
        typeof window.matchMedia !== 'undefined' &&
        window.matchMedia('(max-width: 640px)').matches;

      if (isMobile) {
        this.renderMobileReceiptPreview(html, receiptData);
        return true;
      }
      
      // Create a hidden iframe for printing
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '80mm'; // Thermal printer width
      iframe.style.height = '1px';
      iframe.style.border = 'none';
      iframe.style.opacity = '0';
      iframe.style.pointerEvents = 'none';
      document.body.appendChild(iframe);

      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!iframeDoc) return false;

      iframeDoc.open();
      iframeDoc.write(html);
      iframeDoc.close();

      // Wait for content to load (reduced delay for faster printing)
      await new Promise(resolve => {
        const checkReady = () => {
          if (iframeDoc.readyState === 'complete') {
            resolve(true);
          } else {
            setTimeout(checkReady, 50);
          }
        };
        checkReady();
      });

      // Small additional delay for images if any
      await new Promise(resolve => setTimeout(resolve, 200));

      // Trigger print immediately (thermal printers handle this fast)
      const printWindow = iframe.contentWindow;
      if (printWindow) {
        printWindow.focus();
        // Use requestAnimationFrame for immediate print
        requestAnimationFrame(() => {
          printWindow.print();
        });
      }

      // Clean up after print dialog appears
      setTimeout(() => {
        try {
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
          }
        } catch (e) {
          // Ignore cleanup errors
        }
      }, 500);
      
      return true;
    } catch (error) {
      console.error('Print receipt error:', error);
      return false;
    }
  }
}

