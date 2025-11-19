import React from 'react';

interface Column {
  header: string;
  accessor: string;
  render?: (row: any) => React.ReactNode;
}

interface TableProps {
  columns?: Column[];
  headers?: string[];
  data: any[];
  className?: string;
}

const Table: React.FC<TableProps> = ({ columns, headers, data, className = '' }) => {
  // Support both interfaces for backward compatibility
  const tableHeaders = headers || columns?.map(col => col.header) || [];
  const tableData = data || [];

  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-600">
        <thead className="bg-gray-50 dark:bg-gray-700">
          <tr>
            {tableHeaders.map((header, index) => (
              <th
                key={index}
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-300"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200 dark:bg-gray-800 dark:divide-gray-700">
          {tableData.map((row, rowIndex) => (
            <tr key={rowIndex} className="hover:bg-gray-50 dark:hover:bg-gray-700">
              {Array.isArray(row) ? (
                // Handle array data (headers/data format)
                row.map((cell, colIndex) => (
                  <td
                    key={colIndex}
                    className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white"
                  >
                    {cell}
                  </td>
                ))
              ) : (
                // Handle object data (columns format)
                columns?.map((column, colIndex) => (
                  <td
                    key={colIndex}
                    className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white"
                  >
                    {column.render ? column.render(row) : row[column.accessor]}
                  </td>
                )) || []
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default Table;

































