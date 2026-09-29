import { ReactNode } from 'react';

interface Column {
  key: string;
  label: string;
  width?: string;
}

interface DataTableProps {
  columns: Column[];
  data: any[];
  renderCell?: (column: Column, row: any, rowIndex: number) => ReactNode;
}

export function DataTable({ columns, data, renderCell }: DataTableProps) {
  return (
    <div className="bg-card border border-border rounded-[14px] overflow-hidden transition-colors duration-300">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[600px]">
          <thead>
            <tr className="border-b border-border">
              {columns.map((column) => (
                <th
                  key={column.key}
                  className="px-3 lg:px-6 py-3 lg:py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap"
                  style={{ width: column.width }}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {data.map((row, rowIndex) => (
              <tr
                key={rowIndex}
                className="hover:bg-secondary/30 transition-colors"
              >
                {columns.map((column) => (
                  <td key={column.key} className="px-3 lg:px-6 py-3 lg:py-4 text-sm text-foreground whitespace-nowrap">
                    {renderCell ? renderCell(column, row, rowIndex) : row[column.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
