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
    <Card className="p-3 md:p-6 hover:shadow-xl transition-all duration-300">
      <div className="flex items-center justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-xs md:text-sm font-medium text-gray-600 dark:text-gray-400 truncate">{title}</p>
          <p className="text-xl md:text-3xl font-bold text-gray-900 dark:text-white mt-1 md:mt-2">{value}</p>
          {change && (
            <div className={`flex items-center mt-1 md:mt-2 text-xs md:text-sm ${
              change.trend === 'up' ? 'text-green-600' : 'text-red-600'
            }`}>
              <span>{change.trend === 'up' ? '+' : '-'}{Math.abs(change.value)}%</span>
              <span className="text-gray-500 ml-1 md:ml-2 hidden md:inline">vs last month</span>
            </div>
          )}
        </div>
        
        <div className={`p-2 md:p-4 rounded-xl md:rounded-2xl bg-gradient-to-br ${colorClasses[color]} shrink-0 ml-2`}>
          <Icon className="w-4 h-4 md:w-8 md:h-8 text-white" />
        </div>
      </div>
    </Card>
  );
};

export default StatsCard;