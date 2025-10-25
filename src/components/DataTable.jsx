import React from "react";

const DataTable = ({ data, onRowDoubleClick, onDeleteRow }) => {
  if (!data || data.length === 0) {
    return <p className="text-gray-400">No hay datos para mostrar.</p>;
  }

  // Handle non-array data, for Redis strings
  if (!Array.isArray(data)) {
    if (typeof data === "object" && data !== null) {
      // For Redis Hashes
      return (
        <div className="grid grid-cols-2 gap-4 p-4 bg-primary rounded-md">
          {Object.entries(data).map(([key, value]) => (
            <React.Fragment key={key}>
              <div className="font-bold text-gray-300">{key}</div>
              <div>{value}</div>
            </React.Fragment>
          ))}
        </div>
      );
    }
    // For Redis Strings or other primitives
    return (
      <pre className="p-4 bg-primary rounded-md whitespace-pre-wrap">
        {data}
      </pre>
    );
  }

  const headers = Object.keys(data[0]);

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full bg-primary rounded-md">
        <thead>
          <tr className="bg-sidebar-dark">
            <th className="p-3 text-left text-sm font-bold text-gray-300"></th>
            {headers.map((header) => (
              <th
                key={header}
                className="p-3 text-left text-sm font-bold text-gray-300"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, rowIndex) => (
            <tr
              key={row.id || `row-${rowIndex}`}
              className="border-t border-gray-700 hover:bg-sidebar-dark cursor-pointer group"
              onDoubleClick={() =>
                onRowDoubleClick ? onRowDoubleClick(row) : null
              }
            >
              <td className="p-3 text-sm text-gray-200 whitespace-nowrap">
                <div className="opacity-0 group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={() => onDeleteRow?.(row)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                      className="w-5 h-5"
                      aria-label="Delete row"
                    >
                      <title>Delete row</title>
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
                      />
                    </svg>
                  </button>
                </div>
              </td>
              {headers.map((header) => (
                <td
                  key={`${rowIndex}-${header}`}
                  className="p-3 text-sm text-gray-200 whitespace-nowrap"
                >
                  {typeof row[header] === "object"
                    ? JSON.stringify(row[header])
                    : row[header]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default DataTable;
