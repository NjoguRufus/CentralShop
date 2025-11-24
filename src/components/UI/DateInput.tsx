import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  format,
  parseISO,
  isValid,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay
} from 'date-fns';

interface DateInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

const DateInput: React.FC<DateInputProps> = ({
  value,
  onChange,
  placeholder = "Select date",
  className = "",
  disabled = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [viewDate, setViewDate] = useState(() => (value ? parseValue(value) : new Date()));
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0, width: 0 });
  const selectedDate = value ? parseValue(value) : null;

  function parseValue(dateValue: string) {
    const parsed = parseISO(dateValue);
    return isValid(parsed) ? parsed : new Date();
  }

  useEffect(() => {
    if (value) {
      setViewDate(parseValue(value));
    }
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        containerRef.current &&
        menuRef.current &&
        !containerRef.current.contains(target) &&
        !menuRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const updatePosition = () => {
      if (!triggerRef.current) return;
      const rect = triggerRef.current.getBoundingClientRect();
      setMenuPosition({
        top: rect.bottom + window.scrollY + 8,
        left: rect.left + window.scrollX,
        width: rect.width
      });
    };

    updatePosition();
    const handleScroll = () => updatePosition();
    window.addEventListener('resize', handleScroll);
    window.addEventListener('scroll', handleScroll, true);
    return () => {
      window.removeEventListener('resize', handleScroll);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [isOpen]);

  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(viewDate));
    const end = endOfWeek(endOfMonth(viewDate));
    const days = [];
    let current = start;

    while (current <= end) {
      days.push(current);
      current = addDays(current, 1);
    }

    return days;
  }, [viewDate]);

  const handleDateSelect = (date: Date) => {
    onChange(format(date, 'yyyy-MM-dd'));
    setIsOpen(false);
  };

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-[#4A90A4] focus:border-transparent dark:bg-gray-700 dark:text-white bg-white text-left flex items-center justify-between ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <span className={selectedDate ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}>
          {selectedDate ? format(selectedDate, 'dd MMM yyyy') : placeholder}
        </span>
        <Calendar className="w-4 h-4 text-gray-400" />
      </button>

      {isOpen && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] pointer-events-none">
          <div
            ref={menuRef}
            className="pointer-events-auto mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg p-4 min-w-[260px]"
            style={{
              position: 'absolute',
              top: menuPosition.top,
              left: menuPosition.left,
              minWidth: Math.max(menuPosition.width, 260)
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <button
                type="button"
                onClick={() => setViewDate((prev) => subMonths(prev, 1))}
                className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <ChevronLeft className="w-4 h-4 text-gray-600 dark:text-gray-200" />
              </button>
              <span className="text-sm font-semibold text-gray-900 dark:text-white">
                {format(viewDate, 'MMMM yyyy')}
              </span>
              <button
                type="button"
                onClick={() => setViewDate((prev) => addMonths(prev, 1))}
                className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <ChevronRight className="w-4 h-4 text-gray-600 dark:text-gray-200" />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1 text-xs text-gray-500 dark:text-gray-400 mb-2">
              {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day) => (
                <span key={day} className="text-center">
                  {day}
                </span>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1 text-sm">
              {calendarDays.map((day) => {
                const isCurrentMonth = isSameMonth(day, viewDate);
                const isSelected = selectedDate ? isSameDay(day, selectedDate) : false;

                return (
                  <button
                    key={day.toISOString()}
                    type="button"
                    onClick={() => handleDateSelect(day)}
                    className={`h-9 rounded-lg flex items-center justify-center transition-colors ${
                      isSelected
                        ? 'bg-[#4A90A4] text-white'
                        : isCurrentMonth
                          ? 'text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700'
                          : 'text-gray-400 dark:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    {format(day, 'd')}
                  </button>
                );
              })}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default DateInput;

