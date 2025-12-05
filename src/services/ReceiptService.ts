// src/services/ReceiptService.ts
import { PaymentSettings } from '../types';

type PrinterWidthPreset = { label: string; mm: number; px: number };

const PRINTER_WIDTH_PRESETS: PrinterWidthPreset[] = [
  { label: '80mm', mm: 80, px: 302 },
  { label: '58mm', mm: 58, px: 227 }
];

const DEFAULT_PRINTER_WIDTH_PX = PRINTER_WIDTH_PRESETS[0].px;
const PRINTER_WIDTH_TOLERANCE_PX = 24;

const UNIT_SHORT_LABELS: Record<string, string> = {
  pieces: 'pcs',
  meters: 'm',
  metres: 'm',
  litres: 'L',
  liters: 'L'
};

const formatUnitSuffix = (unit?: string) => {
  if (!unit) return '';
  const normalized = unit.toLowerCase();
  const label = UNIT_SHORT_LABELS[normalized] || unit;
  return ` ${label}`;
};

interface ReceiptFlowOptions {
  autoDetectPrinter?: boolean;
}

export interface ReceiptData {
  orderId: string;
  items: Array<{
    name: string;
    quantity: number;
    price: number;
    total: number;
    unit?: string;
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

  private static formatPaymentMethod(paymentMethod: string): string {
    // Format payment method for display
    if (paymentMethod === 'mobile') {
      return 'M-PESA';
    }
    return paymentMethod.toUpperCase();
  }

  static buildReceiptHTML(receiptData: ReceiptData, widthPx: number = DEFAULT_PRINTER_WIDTH_PX): string {
    const formatCurrency = (amount: number) => `KSH ${amount.toFixed(2)}`;
    const brandName = receiptData.businessName || 'CENTRAL SHOP';
    const brandAddress = receiptData.businessAddress || '';
    const brandPhone = receiptData.businessPhone || '';
    const safeWidthPx = Number.isFinite(widthPx) ? Math.max(200, Math.round(widthPx)) : DEFAULT_PRINTER_WIDTH_PX;
    
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
              size: ${safeWidthPx}px auto;
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
            background: #ffffff;
            color: #000000;
            width: ${safeWidthPx}px;
              margin: 0 auto;
              padding: 0;
          }
          .receipt {
            padding: 12px 14px 20px;
          }
            .brand {
            text-align: center;
            padding-bottom: 12px;
            border-bottom: 2px solid #000000;
            }
            .brand-logo {
              display: flex;
              justify-content: center;
              margin-bottom: 6px;
          }
            .brand-logo img {
              width: 64px;
              height: 64px;
              object-fit: contain;
          }
            .brand-name {
            font-size: 18px;
              letter-spacing: 2px;
              font-weight: 700;
              color: #000000;
          }
            .tagline {
            font-size: 10px;
              text-transform: uppercase;
            letter-spacing: 2px;
            color: #000000;
              margin-top: 2px;
          }
            .meta {
            margin: 12px 0 14px;
              font-size: 10px;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              color: #000000;
          }
            .meta-row {
            display: flex;
            justify-content: space-between;
            margin: 3px 0;
            color: #000000;
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
              border: 2px solid #000000;
              color: #000000;
              background: #ffffff;
              margin-top: 4px;
            }

            .items {
              margin-top: 12px;
              border: 2px solid #000000;
              border-radius: 10px;
              padding: 10px;
              background: #ffffff;
            }
            .item-row {
              display: grid;
              grid-template-columns: 1fr auto auto;
              gap: 6px;
            font-size: 10px;
              padding: 4px 0;
              border-bottom: 1px solid #000000;
            }
            .item-row:last-child {
              border-bottom: none;
          }
          .item-name {
              font-weight: 600;
              color: #000000;
          }
          .item-qty {
              text-align: right;
              color: #000000;
              min-width: 28px;
          }
            .item-total {
            text-align: right;
              font-weight: 600;
            min-width: 55px;
              color: #000000;
          }

            .stat-grid {
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: 6px;
              margin-top: 10px;
              font-size: 9.5px;
            }
            .stat-card {
            border: 2px solid #000000;
              border-radius: 8px;
              padding: 6px;
            background: #ffffff;
            }
            .stat-label {
            color: #000000;
              text-transform: uppercase;
              letter-spacing: 1px;
              font-size: 8px;
              margin-bottom: 2px;
              font-weight: 600;
            }
            .stat-value {
              font-weight: 700;
              color: #000000;
          }

          .totals {
              margin-top: 14px;
            border-top: 2px solid #000000;
              padding-top: 10px;
          }
          .total-line {
            display: flex;
            justify-content: space-between;
            font-size: 10px;
              margin: 2px 0;
              color: #000000;
            }
            .grand-total {
              font-size: 12px;
              font-weight: 700;
              color: #000000;
              margin-top: 6px;
          }

            .signature-block {
              margin-top: 14px;
              padding: 10px;
            border: 2px solid #000000;
              border-radius: 10px;
              text-align: center;
              font-size: 9px;
            color: #000000;
          }
            .signature-label {
              text-transform: uppercase;
              letter-spacing: 2px;
            color: #000000;
              font-size: 8px;
              font-weight: 600;
            }

          .footer {
              margin-top: 14px;
            text-align: center;
            font-size: 9px;
            color: #000000;
          }
            .footer strong {
              display: block;
              margin-bottom: 3px;
              letter-spacing: 1px;
              font-weight: 700;
          }
          .cut-line {
            border-top: 2px solid #000000;
            margin-top: 8px;
            padding-top: 6px;
            font-size: 10px;
            color: #000000;
            text-align: center;
            letter-spacing: 2px;
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
              <div class="badge">${ReceiptService.formatPaymentMethod(receiptData.paymentMethod)}</div>
          </div>
          
          <div class="items">
            ${receiptData.items.map(item => `
                <div class="item-row">
                  <span class="item-name">${item.name}</span>
                  <span class="item-qty">× ${item.quantity}${formatUnitSuffix(item.unit)}</span>
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
              <div class="stat-card" style="border-color:#000000;">
                <div class="stat-label">Cash Paid</div>
                <div class="stat-value" style="color:#000000;">${formatCurrency(receiptData.cashAmount)}</div>
              </div>
              <div class="stat-card" style="border-color:#000000;">
                <div class="stat-label">M-Pesa Paid</div>
                <div class="stat-value" style="color:#000000;">${formatCurrency(receiptData.mpesaAmount)}</div>
              </div>
              ${receiptData.mpesaCode ? `
              <div class="stat-card">
                <div class="stat-label">M-Pesa Code</div>
                <div class="stat-value" style="font-size:10px; color:#000000;">${receiptData.mpesaCode}</div>
              </div>` : ''}
            </div>` : ''}
            ${receiptData.debtAmount || receiptData.partialAmount ? `
            <div class="stat-grid" style="margin-top:8px;">
              ${receiptData.debtAmount ? `
              <div class="stat-card" style="border-color:#000000;">
                <div class="stat-label">Debt Amount</div>
                <div class="stat-value" style="color:#000000;">${formatCurrency(receiptData.debtAmount)}</div>
              </div>
              <div class="stat-card">
                <div class="stat-label">Due Date</div>
                <div class="stat-value" style="color:#000000;">${receiptData.dueDate || '—'}</div>
              </div>` : ''}
              ${receiptData.partialAmount ? `
              <div class="stat-card" style="border-color:#000000;">
                <div class="stat-label">Partial Paid</div>
                <div class="stat-value" style="color:#000000;">${formatCurrency(receiptData.partialAmount)}</div>
              </div>
              <div class="stat-card">
                <div class="stat-label">Balance</div>
                <div class="stat-value" style="color:#000000;">${formatCurrency(receiptData.remainingAmount || 0)}</div>
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
              <div class="cut-line">✂︎ --------------------------------------</div>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  static async handleReceiptFlow(
    receiptData: ReceiptData,
    paymentSettings: PaymentSettings,
    businessInfo: { name: string; address: string; phone: string },
    options?: ReceiptFlowOptions
  ): Promise<{ success: boolean; message: string }> {
    try {
      // Add business info to receipt data
      const fullReceiptData = {
        ...receiptData,
        businessName: businessInfo.name || 'CENTRAL SHOP',
        businessAddress: businessInfo.address || '',
        businessPhone: businessInfo.phone || ''
      };

      const shouldAutoDetect = options?.autoDetectPrinter ?? true;
      let widthPx = DEFAULT_PRINTER_WIDTH_PX;
      if (shouldAutoDetect) {
        try {
          widthPx = await this.detectPrinterWidthPx();
        } catch (error) {
          widthPx = DEFAULT_PRINTER_WIDTH_PX;
        }
      }
      const receiptHtml = this.buildReceiptHTML(fullReceiptData, widthPx);

      if (paymentSettings.saveReceipt) {
        // Show save dialog only when saveReceipt is enabled
        const saveChoice = await this.showSaveDialog();
        
        if (saveChoice === 'save') {
          const fileName = this.generateFileName(fullReceiptData);
          const success = await this.saveReceipt(fullReceiptData, fileName, paymentSettings.receiptFormat, widthPx, receiptHtml);
          
          if (success) {
            return { success: true, message: `Receipt saved as ${fileName}.${paymentSettings.receiptFormat.toLowerCase()}` };
          } else {
            return { success: false, message: 'Failed to save receipt' };
          }
        } else {
          // User chose print only, so just print
          const printSuccess = await this.printReceipt(fullReceiptData, widthPx, receiptHtml);
          
          if (printSuccess) {
            return { success: true, message: 'Receipt sent to printer successfully' };
          } else {
            return { success: false, message: 'Failed to print receipt' };
          }
        }
      } else {
        // saveReceipt is disabled, just print in background
        const printSuccess = await this.printReceipt(fullReceiptData, widthPx, receiptHtml);
        
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
    format: 'PDF' | 'TXT' | 'Image',
    widthPx: number,
    prebuiltHtml?: string
  ): Promise<boolean> {
    try {
      const html = prebuiltHtml ?? this.buildReceiptHTML(receiptData, widthPx);
      if (format === 'PDF') {
        return await this.saveAsPDF(html, fileName, widthPx);
      } else if (format === 'TXT') {
        return await this.saveAsTXT(receiptData, fileName);
      } else if (format === 'Image') {
        return await this.saveAsImage(html, fileName, widthPx);
      }
      
      return false;
    } catch (error) {
      console.error('Save receipt error:', error);
      return false;
    }
  }

  private static async saveAsPDF(html: string, fileName: string, widthPx: number): Promise<boolean> {
    try {
      // Create a hidden iframe for PDF generation
      const iframe = document.createElement('iframe');
      iframe.style.position = 'absolute';
      iframe.style.left = '-9999px';
      iframe.style.top = '-9999px';
      iframe.style.width = `${Math.round(widthPx)}px`;
      iframe.style.height = '400px';
      document.body.appendChild(iframe);

      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!iframeDoc) return false;

      iframeDoc.open();
      iframeDoc.title = fileName;
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
        txtContent += `${item.name} x${item.quantity}${formatUnitSuffix(item.unit)} = ${formatCurrency(item.total)}\n`;
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

  private static async saveAsImage(html: string, fileName: string, widthPx: number): Promise<boolean> {
    try {
      // Create a temporary element with the receipt HTML
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = html;
      tempDiv.style.position = 'absolute';
      tempDiv.style.left = '-9999px';
      tempDiv.style.top = '-9999px';
      tempDiv.style.width = `${Math.round(widthPx)}px`;
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
        return await this.saveAsPDF(html, fileName, widthPx);
      }
    } catch (error) {
      console.error('Image save error:', error);
      return false;
    }
  }

  private static renderMobileReceiptPreview(html: string, receiptData: ReceiptData, widthPx: number): void {
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
    helper.textContent = 'Tap Print to open print dialog, or Share to send via apps.';
    helper.style.cssText = `
      font-size: 12px;
      color: #475569;
      text-align: center;
      margin-bottom: 12px;
    `;

    // Use iframe to render the complete receipt HTML with all styles
    const receiptIframe = document.createElement('iframe');
    receiptIframe.style.cssText = `
      width: ${Math.round(widthPx)}px;
      max-width: 100%;
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

    const printBtn = document.createElement('button');
    printBtn.textContent = 'Print';
    printBtn.style.cssText = `
      flex: 1;
      background: #4A90A4;
      color: #ffffff;
      border: none;
      border-radius: 12px;
      padding: 12px;
      font-weight: 600;
      font-size: 15px;
      cursor: pointer;
      min-height: 44px;
    `;

    const shareBtn = document.createElement('button');
    shareBtn.textContent = 'Share';
    shareBtn.style.cssText = `
      flex: 1;
      background: #10b981;
      color: #ffffff;
      border: none;
      border-radius: 12px;
      padding: 12px;
      font-weight: 600;
      font-size: 15px;
      cursor: pointer;
      min-height: 44px;
    `;
    // Hide share button if Web Share API is not available
    if (!navigator.share) {
      shareBtn.style.display = 'none';
    }

    const downloadBtn = document.createElement('button');
    downloadBtn.textContent = 'Download PDF';
    downloadBtn.style.cssText = `
      flex: 1;
      background: #64748b;
      color: #ffffff;
      border: none;
      border-radius: 12px;
      padding: 12px;
      font-weight: 600;
      font-size: 15px;
      cursor: pointer;
      min-height: 44px;
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

    printBtn.addEventListener('click', async (event) => {
      event.stopPropagation();
      printBtn.disabled = true;
      const originalText = printBtn.textContent;
      printBtn.textContent = 'Opening print dialog...';
      
      try {
        // For mobile, open print dialog in a new window for better compatibility
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(html);
          printWindow.document.close();
          
          // Wait for content to load
          await new Promise(resolve => {
            const checkReady = () => {
              if (printWindow.document.readyState === 'complete') {
                resolve(true);
              } else {
                setTimeout(checkReady, 100);
              }
            };
            checkReady();
          });
          
          // Small delay for images
          await new Promise(resolve => setTimeout(resolve, 300));
          
          // Trigger print dialog
          printWindow.focus();
          requestAnimationFrame(() => {
            printWindow.print();
            // Close window after print dialog is dismissed (user can cancel)
            setTimeout(() => {
              if (!printWindow.closed) {
                printWindow.close();
              }
            }, 500);
          });
        } else {
          // Fallback to iframe method if popup is blocked
          const printIframe = document.createElement('iframe');
          printIframe.style.cssText = `
            position: fixed;
            right: 0;
            bottom: 0;
            width: ${Math.round(widthPx)}px;
            height: 1px;
            border: none;
            opacity: 0;
            pointer-events: none;
          `;
          document.body.appendChild(printIframe);
          
          const printIframeDoc = printIframe.contentDocument || printIframe.contentWindow?.document;
          if (printIframeDoc) {
            printIframeDoc.open();
            printIframeDoc.write(html);
            printIframeDoc.close();
            
            await new Promise(resolve => {
              const checkReady = () => {
                if (printIframeDoc.readyState === 'complete') {
                  resolve(true);
                } else {
                  setTimeout(checkReady, 50);
                }
              };
              checkReady();
            });
            
            await new Promise(resolve => setTimeout(resolve, 200));
            
            const iframeWindow = printIframe.contentWindow;
            if (iframeWindow) {
              iframeWindow.focus();
              requestAnimationFrame(() => {
                iframeWindow.print();
              });
            }
            
            setTimeout(() => {
              if (document.body.contains(printIframe)) {
                document.body.removeChild(printIframe);
              }
            }, 1000);
          }
        }
      } catch (error) {
        console.error('Print error:', error);
        alert('Failed to open print dialog. Please try downloading the PDF instead.');
      }
      
      printBtn.textContent = originalText || 'Print';
      printBtn.disabled = false;
    });

    // Add share functionality for mobile
    shareBtn.addEventListener('click', async (event) => {
      event.stopPropagation();
      shareBtn.disabled = true;
      const originalText = shareBtn.textContent;
      shareBtn.textContent = 'Preparing...';
      
      try {
        // Try to share as PDF
        const pdfBlob = await this.generatePDFBlob(html, widthPx);
        const file = new File([pdfBlob], `${fileName}.pdf`, { type: 'application/pdf' });
        
        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: `Receipt - ${receiptData.orderId}`,
            text: `Receipt for order ${receiptData.orderId}`,
            files: [file]
          });
        } else {
          // Fallback: download PDF
          const url = URL.createObjectURL(pdfBlob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${fileName}.pdf`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }
      } catch (error: any) {
        // If share fails or is cancelled, try download
        if (error.name !== 'AbortError') {
          console.error('Share error:', error);
          await this.saveAsPDF(html, fileName, widthPx);
        }
      }
      
      shareBtn.textContent = originalText || 'Share';
      shareBtn.disabled = false;
    });

    downloadBtn.addEventListener('click', async (event) => {
      event.stopPropagation();
      downloadBtn.disabled = true;
      const originalText = downloadBtn.textContent;
      downloadBtn.textContent = 'Preparing...';
      await this.saveAsPDF(html, fileName, widthPx);
      downloadBtn.textContent = originalText || 'Download PDF';
      downloadBtn.disabled = false;
    });

    body.appendChild(helper);
    body.appendChild(receiptIframe);
    dialog.appendChild(header);
    dialog.appendChild(body);
    actions.appendChild(printBtn);
    if (navigator.share) {
      actions.appendChild(shareBtn);
    }
    actions.appendChild(downloadBtn);
    actions.appendChild(closeBtn);
    dialog.appendChild(actions);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
  }

  private static async generatePDFBlob(html: string, widthPx: number): Promise<Blob> {
    // Use html2pdf.js to generate PDF blob
    const html2pdf = (await import('html2pdf.js')).default;
    const element = document.createElement('div');
    element.innerHTML = html;
    element.style.width = `${widthPx}px`;
    document.body.appendChild(element);
    
    const opt = {
      margin: [0, 0, 0, 0] as [number, number, number, number],
      filename: 'receipt.pdf',
      image: { type: 'jpeg' as 'jpeg', quality: 0.98 },
      html2canvas: { 
        scale: 2, 
        useCORS: true,
        logging: false,
        width: widthPx,
        windowWidth: widthPx
      },
      jsPDF: { unit: 'mm' as 'mm', format: [widthPx * 0.264583, 200] as [number, number], orientation: 'portrait' as 'portrait' }
    };
    
    try {
      const pdfBlob = await html2pdf().set(opt).from(element).outputPdf('blob');
      document.body.removeChild(element);
      return pdfBlob;
    } catch (error) {
      document.body.removeChild(element);
      throw error;
    }
  }

  private static async detectPrinterWidthPx(): Promise<number> {
    if (typeof document === 'undefined' || typeof window === 'undefined') {
      return DEFAULT_PRINTER_WIDTH_PX;
    }

    let bestWidth = DEFAULT_PRINTER_WIDTH_PX;
    let smallestDiff = Number.POSITIVE_INFINITY;

    for (const preset of PRINTER_WIDTH_PRESETS) {
      try {
        const measuredWidth = await this.measurePrinterWidth(preset.mm);
        if (measuredWidth != null) {
          const diff = Math.abs(measuredWidth - preset.px);
          if (diff < smallestDiff) {
            smallestDiff = diff;
            bestWidth = preset.px;
          }
        }
      } catch (error) {
        // Ignore measurement errors and continue
      }
    }

    if (smallestDiff === Number.POSITIVE_INFINITY || smallestDiff > PRINTER_WIDTH_TOLERANCE_PX) {
      return DEFAULT_PRINTER_WIDTH_PX;
    }

    return bestWidth;
  }

  private static measurePrinterWidth(mm: number): Promise<number | null> {
    return new Promise((resolve) => {
      if (typeof document === 'undefined' || !document.body) {
        resolve(null);
        return;
      }

      const iframe = document.createElement('iframe');
      iframe.style.cssText = 'position:absolute;left:-10000px;top:-10000px;width:0;height:0;border:none;opacity:0;';
      document.body.appendChild(iframe);

      const cleanup = () => {
        if (iframe.parentNode) {
          iframe.parentNode.removeChild(iframe);
        }
      };

      const measure = () => {
        try {
          const doc = iframe.contentDocument || iframe.contentWindow?.document;
          if (!doc) {
            cleanup();
            resolve(null);
            return;
          }

          doc.open();
          doc.write(`
            <html>
              <head>
                <style>
                  @page { size: ${mm}mm auto; margin: 0; }
                  html, body { margin: 0; padding: 0; }
                  .probe {
                    width: ${mm}mm;
                    height: 10mm;
                  }
                </style>
              </head>
              <body>
                <div class="probe"></div>
              </body>
            </html>
          `);
          doc.close();

          setTimeout(() => {
            try {
              const probe = doc.querySelector('.probe') as HTMLElement | null;
              const rect = probe?.getBoundingClientRect();
              const measured = rect?.width ?? null;
              cleanup();
              resolve(measured);
            } catch (error) {
              cleanup();
              resolve(null);
            }
          }, 60);
        } catch (error) {
          cleanup();
          resolve(null);
        }
      };

      if (iframe.contentDocument?.readyState === 'complete') {
        measure();
      } else {
        iframe.onload = measure;
        setTimeout(measure, 100);
      }
    });
  }

  private static isMobileDevice(): boolean {
    if (typeof window === 'undefined') return false;
    
    // Check screen width
    const isSmallScreen = window.matchMedia('(max-width: 768px)').matches;
    
    // Check user agent for mobile devices
    const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
    const isMobileUA = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent.toLowerCase());
    
    // Check for touch support
    const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    
    return isSmallScreen || (isMobileUA && hasTouch);
  }

  private static async printReceipt(
    receiptData: ReceiptData,
    widthPx: number,
    prebuiltHtml?: string
  ): Promise<boolean> {
    try {
      const html = prebuiltHtml ?? this.buildReceiptHTML(receiptData, widthPx);
      const isMobile = this.isMobileDevice();

      if (isMobile) {
        this.renderMobileReceiptPreview(html, receiptData, widthPx);
        return true;
      }
      
      // Create a hidden iframe for printing
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = `${Math.round(widthPx)}px`;
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

