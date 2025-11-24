import React from 'react';
import { StockReport, StockReportData } from '../types';

interface PrintViewProps {
  report: StockReport;
  data: StockReportData;
  logoUrl?: string;
  includeWatermark?: boolean;
}

const PrintView: React.FC<PrintViewProps> = ({
  report,
  data,
  logoUrl = '/mnt/data/A_logo_in_solid_black_is_displayed_on_a_white_back.png',
  includeWatermark = true
}) => {
  const formatCurrency = (value: number) => `KSH ${value.toLocaleString()}`;
  const formatDate = (date: Date) => date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return (
    <div className="print-view bg-white text-black p-8" style={{ fontFamily: 'Arial, sans-serif' }}>
      {/* Watermark */}
      {includeWatermark && (
        <div
          className="fixed inset-0 pointer-events-none opacity-10"
          style={{
            backgroundImage: `url(${logoUrl})`,
            backgroundRepeat: 'repeat',
            backgroundSize: '200px 200px',
            zIndex: 0
          }}
        />
      )}

      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-8 border-b-2 border-gray-300 pb-4">
          <div className="flex items-center gap-4">
            {logoUrl && (
              <img
                src={logoUrl}
                alt="Logo"
                className="h-16 w-auto"
                onError={(e) => {
                  // Fallback if logo fails to load
                  e.currentTarget.style.display = 'none';
                }}
              />
            )}
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Stock Report</h1>
              <p className="text-sm text-gray-600 mt-1">
                {report.reportType.replace('_', ' ').toUpperCase()}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-600">Generated: {formatDate(report.generatedAt)}</p>
            <p className="text-sm text-gray-600">Period: {formatDate(report.startDate)} - {formatDate(report.endDate)}</p>
            <p className="text-sm text-gray-600">By: {report.generatedBy}</p>
          </div>
        </div>

        {/* Summary Section */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-4 text-gray-900">Summary</h2>
          <div className="grid grid-cols-4 gap-4">
            <div className="border border-gray-300 p-4 rounded">
              <p className="text-sm text-gray-600 mb-1">Total Items</p>
              <p className="text-2xl font-bold text-gray-900">{data.totalItems.toLocaleString()}</p>
            </div>
            <div className="border border-gray-300 p-4 rounded">
              <p className="text-sm text-gray-600 mb-1">Total Value</p>
              <p className="text-2xl font-bold text-green-600">{formatCurrency(data.totalValue)}</p>
            </div>
            <div className="border border-gray-300 p-4 rounded">
              <p className="text-sm text-gray-600 mb-1">Low Stock</p>
              <p className="text-2xl font-bold text-yellow-600">{data.lowStockItems}</p>
            </div>
            <div className="border border-gray-300 p-4 rounded">
              <p className="text-sm text-gray-600 mb-1">Out of Stock</p>
              <p className="text-2xl font-bold text-red-600">{data.outOfStockItems}</p>
            </div>
          </div>
        </div>

        {/* Top Moving Items */}
        {data.topMovingItems.length > 0 && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold mb-4 text-gray-900">Top Moving Items</h2>
            <table className="w-full border-collapse border border-gray-300">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-300 px-4 py-2 text-left">Product</th>
                  <th className="border border-gray-300 px-4 py-2 text-right">Quantity Sold</th>
                  <th className="border border-gray-300 px-4 py-2 text-right">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {data.topMovingItems.map((item, idx) => (
                  <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="border border-gray-300 px-4 py-2">{item.name}</td>
                    <td className="border border-gray-300 px-4 py-2 text-right">{item.quantitySold.toLocaleString()}</td>
                    <td className="border border-gray-300 px-4 py-2 text-right">{formatCurrency(item.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Slow Moving Items */}
        {data.slowMovingItems.length > 0 && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold mb-4 text-gray-900">Slow Moving Items</h2>
            <table className="w-full border-collapse border border-gray-300">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-300 px-4 py-2 text-left">Product</th>
                  <th className="border border-gray-300 px-4 py-2 text-right">Days in Stock</th>
                  <th className="border border-gray-300 px-4 py-2 text-right">Quantity Sold</th>
                </tr>
              </thead>
              <tbody>
                {data.slowMovingItems.map((item, idx) => (
                  <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="border border-gray-300 px-4 py-2">{item.name}</td>
                    <td className="border border-gray-300 px-4 py-2 text-right">{item.daysInStock}</td>
                    <td className="border border-gray-300 px-4 py-2 text-right">{item.quantitySold.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Category Breakdown */}
        {data.categoryBreakdown.length > 0 && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold mb-4 text-gray-900">Category Breakdown</h2>
            <table className="w-full border-collapse border border-gray-300">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-300 px-4 py-2 text-left">Category</th>
                  <th className="border border-gray-300 px-4 py-2 text-right">Item Count</th>
                  <th className="border border-gray-300 px-4 py-2 text-right">Total Value</th>
                </tr>
              </thead>
              <tbody>
                {data.categoryBreakdown.map((cat, idx) => (
                  <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="border border-gray-300 px-4 py-2">{cat.category}</td>
                    <td className="border border-gray-300 px-4 py-2 text-right">{cat.itemCount}</td>
                    <td className="border border-gray-300 px-4 py-2 text-right">{formatCurrency(cat.totalValue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 pt-4 border-t border-gray-300 text-center text-sm text-gray-600">
          <p>Generated by Central Shop POS System</p>
          <p className="mt-1">Report ID: {report.id}</p>
        </div>
      </div>

      <style>{`
        @media print {
          .print-view {
            margin: 0;
            padding: 20px;
          }
          @page {
            margin: 1cm;
          }
        }
      `}</style>
    </div>
  );
};

export default PrintView;

