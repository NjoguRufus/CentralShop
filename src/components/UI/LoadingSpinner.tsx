import React from 'react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  showText?: boolean;
  text?: string;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  size = 'md', 
  className = '',
  showText = false,
  text = 'Loading...'
}) => {
  const sizeClasses = {
    sm: {
      icon: 'w-8 h-8',
      bar: 'w-24 h-0.5'
    },
    md: {
      icon: 'w-12 h-12',
      bar: 'w-32 h-1'
    },
    lg: {
      icon: 'w-16 h-16',
      bar: 'w-40 h-1.5'
    }
  };

  const currentSize = sizeClasses[size];

  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      {/* Icon */}
      <div className={`${currentSize.icon} mb-3 flex items-center justify-center`}>
        <img
          src="/icons/CentalDarkmode.png"
          alt="Loading"
          className={`${currentSize.icon} opacity-70 animate-pulse`}
        />
      </div>
      {/* Loading Bar */}
      <div className={`${currentSize.bar} apple-loading-bar rounded-full`}></div>
      {/* Optional Text */}
      {showText && (
        <p className="text-gray-400 dark:text-gray-500 text-xs mt-3">{text}</p>
      )}
    </div>
  );
};

export default LoadingSpinner;


