import React, { useState, useEffect } from 'react';
import Card from './UI/Card';
import Button from './UI/Button';
import Select from './UI/Select';
import DateInput from './UI/DateInput';
import { getProductCategories } from '../utils/reportUtils';
import { useAuth } from '../contexts/AuthContext';
import { Download, FileText, FileSpreadsheet, File, Printer } from 'lucide-react';

interface ReportFiltersProps {
  reportType: 'inventory_summary' | 'low_stock' | 'out_of_stock' | 'movement' | 'valuation';
  period: 'daily' | 'weekly' | 'monthly' | 'custom';
  startDate: string;
  endDate: string;
  selectedCategories: string[];
  searchTerm: string;
  lowStockThreshold: number;
  onReportTypeChange: (type: 'inventory_summary' | 'low_stock' | 'out_of_stock' | 'movement' | 'valuation') => void;
  onPeriodChange: (period: 'daily' | 'weekly' | 'monthly' | 'custom') => void;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  onCategoriesChange: (categories: string[]) => void;
  onSearchChange: (term: string) => void;
  onThresholdChange: (threshold: number) => void;
  onGenerate: () => void;
  onExport: (format: 'csv' | 'xlsx' | 'pdf' | 'print') => void;
  isGenerating: boolean;
  canExport: boolean;
}

const ReportFilters: React.FC<ReportFiltersProps> = ({
  reportType,
  period,
  startDate,
  endDate,
  selectedCategories,
  searchTerm,
  lowStockThreshold,
  onReportTypeChange,
  onPeriodChange,
  onStartDateChange,
  onEndDateChange,
  onCategoriesChange,
  onSearchChange,
  onThresholdChange,
  onGenerate,
  onExport,
  isGenerating,
  canExport
}) => {
  const { currentUser } = useAuth();
  const [categories, setCategories] = useState<string[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(false);

  useEffect(() => {
    if (currentUser?.shopId) {
      loadCategories();
    }
  }, [currentUser?.shopId]);

  const loadCategories = async () => {
    setLoadingCategories(true);
    try {
      const cats = await getProductCategories(currentUser!.shopId!);
      setCategories(cats);
    } catch (error) {
      console.error('Error loading categories:', error);
    } finally {
      setLoadingCategories(false);
    }
  };

  const handlePeriodPreset = (preset: 'daily' | 'weekly' | 'monthly' | 'custom') => {
    const now = new Date();
    let start: Date;
    let end: Date = now;

    switch (preset) {
      case 'daily':
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'weekly':
        start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'monthly':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      default:
        return;
    }

    onPeriodChange(preset);
    onStartDateChange(start.toISOString().split('T')[0]);
    onEndDateChange(end.toISOString().split('T')[0]);
  };

  const handleCategoryToggle = (category: string) => {
    if (selectedCategories.includes(category)) {
      onCategoriesChange(selectedCategories.filter(c => c !== category));
    } else {
      onCategoriesChange([...selectedCategories, category]);
    }
  };

  return (
    <Card className="p-4 space-y-4">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Report Configuration</h3>

      {/* Report Type */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Report Type
        </label>
        <Select
          value={reportType}
          onChange={(v) => onReportTypeChange(v as any)}
          options={[
            { value: 'inventory_summary', label: 'Inventory Summary' },
            { value: 'low_stock', label: 'Low Stock Report' },
            { value: 'out_of_stock', label: 'Out of Stock Report' },
            { value: 'movement', label: 'Movement Report' },
            { value: 'valuation', label: 'Valuation Report' }
          ]}
        />
      </div>

      {/* Period Presets */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Period
        </label>
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant={period === 'daily' ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => handlePeriodPreset('daily')}
            className="w-full"
          >
            Today
          </Button>
          <Button
            variant={period === 'weekly' ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => handlePeriodPreset('weekly')}
            className="w-full"
          >
            Last 7 Days
          </Button>
          <Button
            variant={period === 'monthly' ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => handlePeriodPreset('monthly')}
            className="w-full"
          >
            This Month
          </Button>
          <Button
            variant={period === 'custom' ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => onPeriodChange('custom')}
            className="w-full"
          >
            Custom
          </Button>
        </div>
      </div>

      {/* Custom Date Range */}
      {period === 'custom' && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Start Date
            </label>
            <DateInput
              value={startDate}
              onChange={onStartDateChange}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              End Date
            </label>
            <DateInput
              value={endDate}
              onChange={onEndDateChange}
            />
          </div>
        </div>
      )}

      {/* Category Filter */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Categories
        </label>
        {loadingCategories ? (
          <p className="text-xs text-gray-500">Loading...</p>
        ) : (
          <div className="max-h-32 overflow-y-auto space-y-1">
            {categories.map(cat => (
              <label key={cat} className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedCategories.includes(cat)}
                  onChange={() => handleCategoryToggle(cat)}
                  className="rounded border-gray-300 text-[#4A90A4] focus:ring-[#4A90A4]"
                />
                <span className="text-xs text-gray-700 dark:text-gray-300">{cat}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Search */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Search Products
        </label>
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search by name..."
          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#4A90A4] focus:border-transparent"
        />
      </div>

      {/* Low Stock Threshold */}
      {(reportType === 'low_stock' || reportType === 'inventory_summary') && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Low Stock Threshold
          </label>
          <input
            type="number"
            value={lowStockThreshold}
            onChange={(e) => onThresholdChange(parseInt(e.target.value) || 5)}
            min="1"
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#4A90A4] focus:border-transparent"
          />
        </div>
      )}

      {/* Generate Button */}
      <Button
        variant="primary"
        onClick={onGenerate}
        disabled={isGenerating}
        className="w-full"
      >
        {isGenerating ? 'Generating...' : 'Generate Report'}
      </Button>

      {/* Export Options */}
      {canExport && (
        <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Export
          </label>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onExport('csv')}
              className="w-full flex items-center justify-center gap-1"
            >
              <FileText className="w-4 h-4" />
              CSV
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onExport('xlsx')}
              className="w-full flex items-center justify-center gap-1"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Excel
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onExport('pdf')}
              className="w-full flex items-center justify-center gap-1"
            >
              <File className="w-4 h-4" />
              PDF
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onExport('print')}
              className="w-full flex items-center justify-center gap-1"
            >
              <Printer className="w-4 h-4" />
              Print
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
};

export default ReportFilters;

