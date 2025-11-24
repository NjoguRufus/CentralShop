import React from 'react';
import Dropdown, { DropdownOption } from './Dropdown';

export interface SelectOption extends DropdownOption {}

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  addNewLabel?: string;
  onAddNew?: () => void;
  searchable?: boolean;
  dropdownClassName?: string;
}

const Select: React.FC<SelectProps> = ({
  value,
  onChange,
  options,
  placeholder = "Select an option",
  className = "",
  disabled = false,
  addNewLabel,
  onAddNew,
  searchable = false,
  dropdownClassName
}) => {
  return (
    <Dropdown
      value={value}
      onChange={onChange}
      options={options}
      placeholder={placeholder}
      className={className}
      disabled={disabled}
      addNewLabel={addNewLabel}
      onAddNew={onAddNew}
      searchable={searchable}
      menuClassName={dropdownClassName}
    />
  );
};

export default Select;

