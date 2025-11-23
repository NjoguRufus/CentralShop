import React from 'react';
import Card from '../UI/Card';

const SkeletonProductCard: React.FC = () => {
  return (
    <Card className="overflow-hidden bg-white dark:bg-[#111827] border border-black/5 dark:border-white/10 rounded-2xl transition-all duration-300 ease-out">
      {/* Image skeleton */}
      <div className="w-full h-[170px] bg-gray-200 dark:bg-gray-700 animate-pulse rounded-t-2xl" />
      
      {/* Content skeleton */}
      <div className="p-4 space-y-3">
        {/* Title skeleton - 2 lines */}
        <div className="space-y-2">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-3/4" />
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-1/2" />
        </div>
        
        {/* Price skeleton */}
        <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-1/3" />
        
        {/* Stock skeleton */}
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-1/4" />
      </div>
    </Card>
  );
};

export default SkeletonProductCard;

