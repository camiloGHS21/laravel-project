import { useState, useEffect } from "react";

// Helper to map SQL types to input types
const mapColumnToInput = (column, value, handleChange) => {
  const { name, type } = column;
  const inputType = type.toLowerCase();

  if (inputType.includes("char") || inputType.includes("text")) {
    return (
      <input
        type="text"
        name={name}
        value={value}
        onChange={handleChange}
        className="shadow appearance-none border rounded w-full py-2 px-3 bg-primary text-white"
      />
    );
  }
  if (
    inputType.includes("int") ||
    inputType.includes("decimal") ||
    inputType.includes("numeric") ||
    inputType.includes("real") ||
    inputType.includes("double")
  ) {
    return (
      <input
        type="number"
        name={name}
        value={value}
        onChange={handleChange}
        className="shadow appearance-none border rounded w-full py-2 px-3 bg-primary text-white"
      />
    );
  }
  if (inputType.includes("bool")) {
    // Using a checkbox for boolean
    return (
      <input
        type="checkbox"
        name={name}
        checked={!!value}
        onChange={handleChange}
        className="h-6 w-6 bg-primary border-gray-600 rounded text-accent focus:ring-accent"
      />
    );
  }
  if (inputType.includes("date") && !inputType.includes("time")) {
    return (
      <input
        type="date"
        name={name}
        value={value}
        onChange={handleChange}
        className="shadow appearance-none border rounded w-full py-2 px-3 bg-primary text-white"
      />
    );
  }
  if (inputType.includes("time")) {
    return (
      <input
        type="datetime-local"
        name={name}
        value={value}
        onChange={handleChange}
        className="shadow appearance-none border rounded w-full py-2 px-3 bg-primary text-white"
      />
    );
  }
  // Default to text input
  return (
    <input
      type="text"
      name={name}
      value={value}
      onChange={handleChange}
      className="shadow appearance-none border rounded w-full py-2 px-3 bg-primary text-white"
    />
  );
};

const RowModal = ({
  isOpen,
  onClose,
  columns,
  onSave,
  tableName,
  initialData,
}) => {
  const [formData, setFormData] = useState({});
  const isEditMode = initialData != null;

  useEffect(() => {
    if (isOpen) {
      if (columns.length > 0) {
        if (isEditMode) {
          setFormData(initialData);
        } else {
          const initial = {};
          columns.forEach((col) => {
            if (
              col.name.toLowerCase() === "id" &&
              (col.type.toLowerCase().includes("serial") ||
                col.type.toLowerCase().includes("auto_increment"))
            ) {
              initial[col.name] = null;
            } else {
              initial[col.name] = "";
            }
          });
          setFormData(initial);
        }
      }
    } else {
      setFormData({}); // Clear form data when modal is closed
    }
  }, [isOpen, columns, initialData, isEditMode]);

  if (!isOpen) {
    return null;
  }

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSave = (e) => {
    e.preventDefault();
    const dataToSave = { ...formData };
    if (!isEditMode) {
      Object.keys(dataToSave).forEach((key) => {
        if (dataToSave[key] === null) {
          delete dataToSave[key];
        }
      });
    }
    onSave(dataToSave);
    onClose();
  };

  const renderableColumns = columns.filter((col) => {
    if (isEditMode) return true; // Show all columns in edit mode
    return !(
      col.name.toLowerCase() === "id" &&
      (col.type.toLowerCase().includes("serial") ||
        col.type.toLowerCase().includes("auto_increment"))
    );
  });

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-sidebar p-6 rounded-lg shadow-lg w-full max-w-2xl">
        <h2 className="text-xl font-bold text-white mb-4">
          {isEditMode
            ? `Editando Fila en "${tableName}"`
            : `Insertar Fila en "${tableName}"`}
        </h2>
        <form onSubmit={handleSave}>
          <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
            {renderableColumns.map((col) => (
              <div key={col.name}>
                <label
                  htmlFor={col.name}
                  className="block text-gray-300 text-sm font-bold mb-2 capitalize"
                >
                  {col.name}{" "}
                  <span className="text-gray-500 text-xs">({col.type})</span>
                  {!col.isNullable && (
                    <span className="text-red-500 ml-2">*</span>
                  )}
                </label>
                {mapColumnToInput(col, formData[col.name] || "", handleChange)}
              </div>
            ))}
          </div>
          <div className="flex items-center justify-end mt-6">
            <button
              type="button"
              onClick={onClose}
              className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded mr-2"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="bg-accent hover:bg-accent-dark text-white font-bold py-2 px-4 rounded"
            >
              Guardar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RowModal;
