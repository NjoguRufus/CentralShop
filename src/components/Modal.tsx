// src/components/Modal.tsx
import React from "react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

export default function Modal({ open, onClose, title, children, size = 'md' }: ModalProps) {
  if (!open) return null;
  
  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-2xl',
    lg: 'max-w-4xl'
  };
  
  return (
    <div className="fixed inset-0 z-[12000] flex items-start justify-center bg-black/50 p-4 overflow-y-auto">
      <div
        className={`
          w-full ${sizeClasses[size]}
          bg-white dark:bg-slate-900 rounded-lg md:rounded-2xl shadow-2xl
          p-3 md:p-4 transform transition-all
          max-h-[90vh] overflow-y-auto
        `}
      >
        <div className="flex items-center justify-between mb-2 md:mb-3">
          <h3 className="text-base md:text-lg font-semibold">{title}</h3>
          <button 
            onClick={onClose} 
            className="text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
          >
            Close
          </button>
        </div>
        <div>{children}</div>
      </div>
    </div>
  );
}