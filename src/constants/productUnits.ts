import { ProductUnit } from '../types';

export const PRODUCT_UNIT_OPTIONS: { value: ProductUnit; label: string; shortLabel: string }[] = [
  { value: 'pieces', label: 'Pieces', shortLabel: 'pcs' },
  { value: 'meters', label: 'Meters', shortLabel: 'm' },
  { value: 'litres', label: 'Litres', shortLabel: 'L' }
];

export const getUnitOption = (unit?: string | null) => {
  return PRODUCT_UNIT_OPTIONS.find(option => option.value === unit) ?? PRODUCT_UNIT_OPTIONS[0];
};

export const getUnitLabel = (unit?: string | null) => getUnitOption(unit).label;

export const getUnitShortLabel = (unit?: string | null) => getUnitOption(unit).shortLabel;

export const getDefaultUnit = (): ProductUnit => PRODUCT_UNIT_OPTIONS[0].value;

