import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export interface DropdownOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface DropdownProps {
  value: string;
  onChange: (value: string) => void;
  options: DropdownOption[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  searchable?: boolean;
  addNewLabel?: string;
  onAddNew?: () => void;
}

const Dropdown: React.FC<DropdownProps> = ({
  value,
  onChange,
  options,
  placeholder = "Select an option",
  className = "",
  disabled = false,
  searchable = false,
  addNewLabel,
  onAddNew
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const selectedOption = options.find(option => option.value === value);

  const filteredOptions = searchable 
    ? options.filter(option => 
        option.label.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : options;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && searchable && searchRef.current) {
      searchRef.current.focus();
    }
  }, [isOpen, searchable]);

  const handleOptionClick = (optionValue: string) => {
    if (optionValue === '__add_new__' && onAddNew) {
      onAddNew();
      setIsOpen(false);
      return;
    }
    
    onChange(optionValue);
    setIsOpen(false);
    setSearchQuery('');
  };

  return (
    <div className={`relative z-50 ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`
          w-full px-3 py-2 text-left border border-gray-300 dark:border-gray-600 
          rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-[#4A90A4] 
          focus:border-transparent dark:bg-gray-700 dark:text-white bg-white
          flex items-center justify-between
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-gray-400 dark:hover:border-gray-500'}
        `}
      >
        <span className={selectedOption ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown 
          className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} 
        />
      </button>

      {isOpen && (
        <div className="absolute z-[9999] w-full mt-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-hidden">
          {searchable && (
            <div className="p-2 border-b border-gray-200 dark:border-gray-600">
              <input
                ref={searchRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search options..."
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-[#4A90A4] dark:bg-gray-800 dark:text-white"
              />
            </div>
          )}
          
          <div className="max-h-48 overflow-y-auto">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
                No options found
              </div>
            ) : (
              filteredOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => !option.disabled && handleOptionClick(option.value)}
                  disabled={option.disabled}
                  className={`
                    w-full px-3 py-2 text-left text-sm flex items-center justify-between
                    hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors
                    ${option.disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                    ${value === option.value ? 'bg-[#4A90A4]/10 text-[#4A90A4] dark:text-[#4A90A4]' : 'text-gray-900 dark:text-white'}
                  `}
                >
                  <span>{option.label}</span>
                  {value === option.value && (
                    <Check className="w-4 h-4 text-[#4A90A4]" />
                  )}
                </button>
              ))
            )}
            
            {addNewLabel && onAddNew && (
              <button
                type="button"
                onClick={() => handleOptionClick('__add_new__')}
                className="w-full px-3 py-2 text-left text-sm text-[#4A90A4] hover:bg-[#4A90A4]/10 border-t border-gray-200 dark:border-gray-600 font-medium"
              >
                + {addNewLabel}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Dropdown;

