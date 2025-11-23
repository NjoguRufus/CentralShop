import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
}

const Card: React.FC<CardProps> = ({ children, className = '', hover = false, ...props }) => {
  return (
    <div 
      className={`
        bg-white dark:bg-gray-900 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-800
        backdrop-blur-xl bg-opacity-95 dark:bg-opacity-90
        ${hover ? 'hover:shadow-xl hover:scale-105 transition-all duration-300' : ''}
        ${className}
      `}
      {...props}
    >
      {children}
    </div>
  );
};

export default Card;