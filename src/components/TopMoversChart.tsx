import React from 'react';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import Card from './UI/Card';
import { StockReportData } from '../types';

interface TopMoversChartProps {
  data: StockReportData;
}

const COLORS = ['#4A90A4', '#50C878', '#FF6B6B', '#FFD93D', '#6BCF7F', '#4ECDC4', '#95E1D3', '#F38181', '#AA96DA', '#FCBAD3'];

const TopMoversChart: React.FC<TopMoversChartProps> = ({ data }) => {
  const topMoversData = data.topMovingItems.slice(0, 10).map(item => ({
    name: item.name.length > 15 ? item.name.substring(0, 15) + '...' : item.name,
    fullName: item.name,
    quantity: item.quantitySold,
    revenue: item.revenue
  }));

  const categoryData = data.categoryBreakdown.map(cat => ({
    name: cat.category,
    value: cat.totalValue
  }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Top Movers Bar Chart */}
      <Card className="p-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Top Moving Items (Quantity Sold)
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={topMoversData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="name" 
              angle={-45}
              textAnchor="end"
              height={80}
              tick={{ fontSize: 10 }}
            />
            <YAxis />
            <Tooltip 
              formatter={(value: number) => value.toLocaleString()}
              labelFormatter={(label) => topMoversData.find(d => d.name === label)?.fullName || label}
            />
            <Bar dataKey="quantity" fill="#4A90A4" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* Category Valuation Pie Chart */}
      {categoryData.length > 0 && (
        <Card className="p-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Inventory Value by Category
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={categoryData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {categoryData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip 
                formatter={(value: number) => `KSH ${value.toLocaleString()}`}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      )}
    </div>
  );
};

export default TopMoversChart;

