import React from 'react';

interface FormInputProps {
  label?: string;
  name: string;
  type?: 'text' | 'email' | 'password' | 'number' | 'tel' | 'date' | 'file';
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  className?: string;
  required?: boolean;
  helpText?: string;
  error?: string;
}

const FormInput: React.FC<FormInputProps> = ({
  label,
  name,
  type = 'text',
  value,
  onChange,
  placeholder,
  className = '',
  required = false,
  helpText,
  error,
}) => {
  return (
    <div className="space-y-1">
      {label && (
        <label
          htmlFor={name}
          className="block text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <input
        id={name}
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        className={`
          w-full px-3 py-2 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-white
          border border-gray-200 dark:border-gray-800 shadow-sm
          focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent
          placeholder:text-gray-400 dark:placeholder:text-gray-500
          ${error ? 'border-red-500 focus:ring-red-500' : ''}
          ${className}
        `}
      />
      {helpText && (
        <p className="text-sm text-gray-500 dark:text-gray-400">{helpText}</p>
      )}
      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}
    </div>
  );
};

export default FormInput;







