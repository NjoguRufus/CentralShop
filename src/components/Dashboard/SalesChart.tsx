import React, { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import Card from '../UI/Card';
import Button from '../UI/Button';
import { BarChart3, Table } from 'lucide-react';

interface SalesData {
  name: string;
  sales: number;
  orders: number;
}

interface SalesChartProps {
  data: SalesData[];
  period: 'today' | 'week' | 'month';
  onPeriodChange: (period: 'today' | 'week' | 'month') => void;
}

const SalesChart: React.FC<SalesChartProps> = ({ data, period, onPeriodChange }) => {
  const [viewMode, setViewMode] = useState<'graph' | 'table'>('graph');
  const hasData = data && data.length > 0 && data.some(d => d.sales > 0);

  const periodLabels = {
    today: 'Today',
    week: 'This Week',
    month: 'This Month'
  };

  const totalSales = data.reduce((sum, d) => sum + d.sales, 0);
  const totalOrders = data.reduce((sum, d) => sum + d.orders, 0);

  return (
    <Card className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Sales Overview</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">{periodLabels[period]} performance</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden">
            <button
              onClick={() => onPeriodChange('today')}
              className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                period === 'today'
                  ? 'bg-[#4A90A4] text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              Today
            </button>
            <button
              onClick={() => onPeriodChange('week')}
              className={`px-3 py-1.5 text-sm font-medium transition-colors border-l border-gray-300 dark:border-gray-600 ${
                period === 'week'
                  ? 'bg-[#4A90A4] text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              Week
            </button>
            <button
              onClick={() => onPeriodChange('month')}
              className={`px-3 py-1.5 text-sm font-medium transition-colors border-l border-gray-300 dark:border-gray-600 ${
                period === 'month'
                  ? 'bg-[#4A90A4] text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              Month
            </button>
          </div>
          <div className="flex rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden">
            <button
              onClick={() => setViewMode('graph')}
              className={`p-2 transition-colors ${
                viewMode === 'graph'
                  ? 'bg-[#4A90A4] text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
              title="Graph View"
            >
              <BarChart3 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-2 transition-colors border-l border-gray-300 dark:border-gray-600 ${
                viewMode === 'table'
                  ? 'bg-[#4A90A4] text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
              title="Table View"
            >
              <Table className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
      
      {viewMode === 'graph' ? (
      <div className="h-80">
        {hasData ? (
          <ResponsiveContainer width="100%" height="100%">
              {period === 'today' ? (
                <BarChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                  <XAxis 
                    dataKey="name" 
                    stroke="#9CA3AF"
                    fontSize={12}
                  />
                  <YAxis 
                    stroke="#9CA3AF"
                    fontSize={12}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1F2937',
                      border: 'none',
                      borderRadius: '12px',
                      boxShadow: '0 10px 40px rgba(0, 0, 0, 0.3)',
                    }}
                    labelStyle={{ color: '#F9FAFB' }}
                  />
                  <Bar dataKey="sales" fill="#4A90A4" radius={[8, 8, 0, 0]} />
                </BarChart>
              ) : (
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
              <XAxis 
                dataKey="name" 
                stroke="#9CA3AF"
                fontSize={12}
              />
              <YAxis 
                stroke="#9CA3AF"
                fontSize={12}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1F2937',
                  border: 'none',
                  borderRadius: '12px',
                  boxShadow: '0 10px 40px rgba(0, 0, 0, 0.3)',
                }}
                labelStyle={{ color: '#F9FAFB' }}
              />
              <Line
                type="monotone"
                dataKey="sales"
                stroke="#4A90A4"
                strokeWidth={3}
                dot={{ fill: '#4A90A4', strokeWidth: 2, r: 6 }}
                activeDot={{ r: 8, stroke: '#4A90A4', strokeWidth: 2 }}
              />
            </LineChart>
              )}
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Sales Data</h4>
              <p className="text-gray-600 dark:text-gray-400">Start processing orders to see sales trends</p>
            </div>
          </div>
        )}
      </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Period</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Sales (KSH)</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Orders</th>
              </tr>
            </thead>
            <tbody>
              {hasData ? (
                <>
                  {data.map((item, index) => (
                    <tr key={index} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800">
                      <td className="py-3 px-4 text-sm text-gray-900 dark:text-white font-medium">{item.name}</td>
                      <td className="py-3 px-4 text-sm text-gray-900 dark:text-white text-right">{item.sales.toLocaleString()}</td>
                      <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400 text-right">{item.orders}</td>
                    </tr>
                  ))}
                  <tr className="bg-gray-50 dark:bg-gray-800 font-semibold">
                    <td className="py-3 px-4 text-sm text-gray-900 dark:text-white">Total</td>
                    <td className="py-3 px-4 text-sm text-gray-900 dark:text-white text-right">{totalSales.toLocaleString()}</td>
                    <td className="py-3 px-4 text-sm text-gray-900 dark:text-white text-right">{totalOrders}</td>
                  </tr>
                </>
              ) : (
                <tr>
                  <td colSpan={3} className="py-8 text-center text-gray-500 dark:text-gray-400">
                    No sales data available
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
};

export default SalesChart;