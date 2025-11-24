import React, { useState, useMemo, useCallback } from 'react';
import { FixedSizeList } from 'react-window';
import Card from './UI/Card';
import Button from './UI/Button';
import Select from './UI/Select';
import { StockReportData } from '../types';
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';

interface ReportsTableProps {
  data: StockReportData;
  reportType: 'inventory_summary' | 'low_stock' | 'out_of_stock' | 'movement' | 'valuation';
  products?: Array<{ id: string; name: string; category: string; stock: number; price: number }>;
  onRowClick?: (row: any) => void;
}

type SortField = 'name' | 'category' | 'stock' | 'price' | 'quantitySold' | 'revenue';
type SortDirection = 'asc' | 'desc';

interface TableRow {
  productId: string;
  name: string;
  category: string;
  stock: number;
  price: number;
  quantitySold?: number;
  revenue?: number;
}

const ReportsTable: React.FC<ReportsTableProps> = ({ data, reportType, products = [], onRowClick }) => {
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  // Prepare table data based on report type
  const tableData = useMemo<TableRow[]>(() => {
    let rows: TableRow[] = [];

    if (reportType === 'movement' || reportType === 'inventory_summary') {
      // Combine top and slow movers with product details
      const allItems = [
        ...data.topMovingItems.map(item => {
          const product = products.find(p => p.id === item.productId);
          return {
            productId: item.productId,
            name: item.name,
            category: product?.category || '',
            stock: product?.stock || 0,
            price: product?.price || 0,
            quantitySold: item.quantitySold,
            revenue: item.revenue
          };
        }),
        ...data.slowMovingItems.map(item => {
          const product = products.find(p => p.id === item.productId);
          return {
            productId: item.productId,
            name: item.name,
            category: product?.category || '',
            stock: product?.stock || 0,
            price: product?.price || 0,
            quantitySold: item.quantitySold,
            revenue: 0
          };
        })
      ];
      rows = allItems;
    } else if (reportType === 'valuation') {
      // Use category breakdown
      rows = data.categoryBreakdown.map(cat => ({
        productId: '',
        name: cat.category,
        category: cat.category,
        stock: cat.itemCount,
        price: 0,
        quantitySold: undefined,
        revenue: cat.totalValue
      }));
    } else {
      // For low_stock and out_of_stock, we'd need product data
      // This is a simplified version - in production, merge with product data
      rows = [];
    }

    return rows;
  }, [data, reportType, products]);

  // Sort data
  const sortedData = useMemo(() => {
    const sorted = [...tableData].sort((a, b) => {
      let aVal: any = a[sortField];
      let bVal: any = b[sortField];

      if (sortField === 'name' || sortField === 'category') {
        aVal = (aVal || '').toLowerCase();
        bVal = (bVal || '').toLowerCase();
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return sorted;
  }, [tableData, sortField, sortDirection]);

  // Paginate data
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    return sortedData.slice(start, end);
  }, [sortedData, currentPage, pageSize]);

  const totalPages = Math.ceil(sortedData.length / pageSize);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? (
      <ChevronUp className="w-4 h-4 inline ml-1" />
    ) : (
      <ChevronDown className="w-4 h-4 inline ml-1" />
    );
  };

  const formatCurrency = (value: number) => `KSH ${value.toLocaleString()}`;

  const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => {
    const row = paginatedData[index];
    if (!row) return null;

    return (
      <div
        style={style}
        className={`flex items-center border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer ${
          index % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-800'
        }`}
        onClick={() => onRowClick?.(row)}
      >
        <div className="flex-1 px-4 py-3 text-sm text-gray-900 dark:text-white">
          {row.name}
        </div>
        <div className="flex-1 px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
          {row.category || '-'}
        </div>
        <div className="w-24 px-4 py-3 text-sm text-gray-900 dark:text-white text-right">
          {row.stock !== undefined ? row.stock.toLocaleString() : '-'}
        </div>
        <div className="w-32 px-4 py-3 text-sm text-gray-900 dark:text-white text-right">
          {row.price > 0 ? formatCurrency(row.price) : '-'}
        </div>
        {reportType === 'movement' && (
          <>
            <div className="w-32 px-4 py-3 text-sm text-gray-900 dark:text-white text-right">
              {row.quantitySold?.toLocaleString() || '0'}
            </div>
            <div className="w-32 px-4 py-3 text-sm text-gray-900 dark:text-white text-right">
              {row.revenue ? formatCurrency(row.revenue) : '-'}
            </div>
          </>
        )}
      </div>
    );
  };

  if (tableData.length === 0) {
    return (
      <Card className="p-6">
        <p className="text-center text-gray-500 dark:text-gray-400">No data available</p>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Report Details
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600 dark:text-gray-400">Page size:</span>
          <Select
            value={pageSize.toString()}
            onChange={(v) => {
              setPageSize(parseInt(v));
              setCurrentPage(1);
            }}
            options={[
              { value: '25', label: '25' },
              { value: '50', label: '50' },
              { value: '100', label: '100' },
              { value: '200', label: '200' }
            ]}
            className="w-20"
          />
        </div>
      </div>

      {/* Table Header */}
      <div className="flex items-center bg-gray-50 dark:bg-gray-700 border-b-2 border-gray-200 dark:border-gray-600 font-medium text-xs text-gray-700 dark:text-gray-300 uppercase">
        <div
          className="flex-1 px-4 py-3 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
          onClick={() => handleSort('name')}
        >
          Product <SortIcon field="name" />
        </div>
        <div
          className="flex-1 px-4 py-3 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
          onClick={() => handleSort('category')}
        >
          Category <SortIcon field="category" />
        </div>
        <div
          className="w-24 px-4 py-3 text-right cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
          onClick={() => handleSort('stock')}
        >
          Stock <SortIcon field="stock" />
        </div>
        <div
          className="w-32 px-4 py-3 text-right cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
          onClick={() => handleSort('price')}
        >
          Price <SortIcon field="price" />
        </div>
        {reportType === 'movement' && (
          <>
            <div
              className="w-32 px-4 py-3 text-right cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
              onClick={() => handleSort('quantitySold')}
            >
              Qty Sold <SortIcon field="quantitySold" />
            </div>
            <div
              className="w-32 px-4 py-3 text-right cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
              onClick={() => handleSort('revenue')}
            >
              Revenue <SortIcon field="revenue" />
            </div>
          </>
        )}
      </div>

      {/* Virtualized List */}
      <div className="border border-gray-200 dark:border-gray-700 rounded-b-lg overflow-hidden">
        <FixedSizeList
          key={`${currentPage}-${pageSize}`}
          height={Math.min(400, paginatedData.length * 50)}
          itemCount={paginatedData.length}
          itemSize={50}
          width="100%"
        >
          {Row}
        </FixedSizeList>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between mt-4">
        <div className="text-sm text-gray-600 dark:text-gray-400">
          Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, sortedData.length)} of {sortedData.length} items
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm text-gray-700 dark:text-gray-300">
            Page {currentPage} of {totalPages}
          </span>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
};

export default ReportsTable;

