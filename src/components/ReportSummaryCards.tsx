import React from 'react';
import Card from './UI/Card';
import { StockReportData } from '../types';
import { Package, DollarSign, AlertTriangle, XCircle } from 'lucide-react';

interface ReportSummaryCardsProps {
  data: StockReportData;
  previousData?: StockReportData;
}

const ReportSummaryCards: React.FC<ReportSummaryCardsProps> = ({ data, previousData }) => {
  const formatCurrency = (value: number) => `KSH ${value.toLocaleString()}`;
  
  const calculateChange = (current: number, previous?: number) => {
    if (!previous || previous === 0) return null;
    const change = ((current - previous) / previous) * 100;
    return {
      value: Math.abs(change).toFixed(1),
      isPositive: change >= 0
    };
  };

  const totalItemsChange = calculateChange(data.totalItems, previousData?.totalItems);
  const totalValueChange = calculateChange(data.totalValue, previousData?.totalValue);
  const lowStockChange = calculateChange(data.lowStockItems, previousData?.lowStockItems);
  const outOfStockChange = calculateChange(data.outOfStockItems, previousData?.outOfStockItems);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Total Items */}
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Items</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
              {data.totalItems.toLocaleString()}
            </p>
            {totalItemsChange && (
              <p className={`text-xs mt-1 ${totalItemsChange.isPositive ? 'text-green-600' : 'text-red-600'}`}>
                {totalItemsChange.isPositive ? '+' : '-'}{totalItemsChange.value}%
                {previousData && ` vs previous`}
              </p>
            )}
          </div>
          <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-lg">
            <Package className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          </div>
        </div>
      </Card>

      {/* Total Value */}
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Value</p>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">
              {formatCurrency(data.totalValue)}
            </p>
            {totalValueChange && (
              <p className={`text-xs mt-1 ${totalValueChange.isPositive ? 'text-green-600' : 'text-red-600'}`}>
                {totalValueChange.isPositive ? '+' : '-'}{totalValueChange.value}%
                {previousData && ` vs previous`}
              </p>
            )}
          </div>
          <div className="p-3 bg-green-100 dark:bg-green-900 rounded-lg">
            <DollarSign className="w-6 h-6 text-green-600 dark:text-green-400" />
          </div>
        </div>
      </Card>

      {/* Low Stock */}
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Low Stock</p>
            <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400 mt-1">
              {data.lowStockItems}
            </p>
            {lowStockChange && (
              <p className={`text-xs mt-1 ${lowStockChange.isPositive ? 'text-red-600' : 'text-green-600'}`}>
                {lowStockChange.isPositive ? '+' : '-'}{lowStockChange.value}%
                {previousData && ` vs previous`}
              </p>
            )}
          </div>
          <div className="p-3 bg-yellow-100 dark:bg-yellow-900 rounded-lg">
            <AlertTriangle className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
          </div>
        </div>
      </Card>

      {/* Out of Stock */}
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Out of Stock</p>
            <p className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">
              {data.outOfStockItems}
            </p>
            {outOfStockChange && (
              <p className={`text-xs mt-1 ${outOfStockChange.isPositive ? 'text-red-600' : 'text-green-600'}`}>
                {outOfStockChange.isPositive ? '+' : '-'}{outOfStockChange.value}%
                {previousData && ` vs previous`}
              </p>
            )}
          </div>
          <div className="p-3 bg-red-100 dark:bg-red-900 rounded-lg">
            <XCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
          </div>
        </div>
      </Card>
    </div>
  );
};

export default ReportSummaryCards;

