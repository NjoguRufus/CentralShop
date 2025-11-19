import React from 'react';
import { DivideIcon as LucideIcon } from 'lucide-react';
import Card from '../UI/Card';

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  change?: {
    value: number;
    trend: 'up' | 'down';
  };
  color?: 'blue' | 'green' | 'purple' | 'orange';
}

const StatsCard: React.FC<StatsCardProps> = ({ 
  title, 
  value, 
  icon: Icon, 
  change,
  color = 'blue' 
}) => {
  const colorClasses = {
    blue: 'from-[#4A90A4] to-[#9DC3E6]',
    green: 'from-green-500 to-emerald-500',
    purple: 'from-purple-500 to-violet-500',
    orange: 'from-[#D8B980] to-orange-500'
  };

  return (
    <Card className="p-6 hover:shadow-xl transition-all duration-300">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{title}</p>
          <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">{value}</p>
          {change && (
            <div className={`flex items-center mt-2 text-sm ${
              change.trend === 'up' ? 'text-green-600' : 'text-red-600'
            }`}>
              <span>{change.trend === 'up' ? '+' : '-'}{Math.abs(change.value)}%</span>
              <span className="text-gray-500 ml-2">vs last month</span>
            </div>
          )}
        </div>
        
        <div className={`p-4 rounded-2xl bg-gradient-to-br ${colorClasses[color]}`}>
          <Icon className="w-8 h-8 text-white" />
        </div>
      </div>
    </Card>
  );
};

export default StatsCard;