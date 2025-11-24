import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
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
  menuClassName?: string;
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
  onAddNew,
  menuClassName = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0, width: 0 });
  const searchRef = useRef<HTMLInputElement>(null);

  const selectedOption = options.find(option => option.value === value);

  const filteredOptions = searchable 
    ? options.filter(option => 
        option.label.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : options;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        dropdownRef.current &&
        menuRef.current &&
        !dropdownRef.current.contains(target) &&
        !menuRef.current.contains(target)
      ) {
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

  const updateMenuPosition = () => {
    if (!isOpen || !dropdownRef.current) return;
    const rect = dropdownRef.current.getBoundingClientRect();
    setMenuPosition({
      top: rect.bottom + window.scrollY + 4,
      left: rect.left + window.scrollX,
      width: rect.width
    });
  };

  useEffect(() => {
    if (!isOpen) return;
    updateMenuPosition();

    const handleScroll = () => updateMenuPosition();
    window.addEventListener('resize', handleScroll);
    window.addEventListener('scroll', handleScroll, true);
    return () => {
      window.removeEventListener('resize', handleScroll);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [isOpen]);

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

  const dropdownContent = (
    <div
      ref={menuRef}
      className={`pointer-events-auto w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-56 overflow-hidden ${menuClassName}`}
      style={{
        top: menuPosition.top,
        left: menuPosition.left,
        minWidth: menuPosition.width,
        maxWidth: menuPosition.width,
        position: 'absolute'
      }}
    >
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
  );

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`
          w-full px-2.5 py-1.5 text-sm text-left border border-gray-300 dark:border-gray-600 
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
          className={`w-4 h-4 text-gray-900 dark:text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} 
        />
      </button>

      {isOpen && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[12000] pointer-events-none">
          {dropdownContent}
        </div>,
        document.body
      )}
    </div>
  );
};

export default Dropdown;

