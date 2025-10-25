import { useState, useEffect } from "react";
import { FaPlus, FaTrash } from "react-icons/fa";

const POSTGRES_DATA_TYPES = [
  "VARCHAR(255)",
  "TEXT",
  "INT",
  "BIGINT",
  "SMALLINT",
  "DECIMAL",
  "NUMERIC",
  "REAL",
  "DOUBLE PRECISION",
  "BOOLEAN",
  "DATE",
  "TIME",
  "TIMESTAMP",
  "TIMESTAMPTZ",
  "JSON",
  "JSONB",
  "UUID",
];

const MARIADB_DATA_TYPES = [
  "VARCHAR(255)",
  "TEXT",
  "INT",
  "BIGINT",
  "SMALLINT",
  "TINYINT",
  "DECIMAL(10, 2)",
  "NUMERIC(10, 2)",
  "FLOAT",
  "DOUBLE",
  "BOOLEAN",
  "DATE",
  "TIME",
  "DATETIME",
  "TIMESTAMP",
  "JSON",
  "BLOB",
];

const CreateItemModal = ({ isOpen, onClose, onSave, dbType }) => {
  const [name, setName] = useState(""); // Table name for SQL, Collection name for Mongo
  const [key, setKey] = useState(""); // Redis key
  const [value, setValue] = useState(""); // Redis value
  const [columns, setColumns] = useState([]);
  const [generatedSql, setGeneratedSql] = useState("");

  useEffect(() => {
    // Reset state when modal opens or dbType changes
    if (isOpen) {
      setName("");
      setKey("");
      setValue("");
      setGeneratedSql("");
      setColumns([
        {
          id: 1,
          name: "id",
          type:
            dbType === "postgres"
              ? "SERIAL PRIMARY KEY"
              : "INT AUTO_INCREMENT PRIMARY KEY",
          isRemovable: false,
        },
        { id: 2, name: "", type: "VARCHAR(255)", isRemovable: true },
      ]);
    }
  }, [isOpen, dbType]);

  useEffect(() => {
    if (dbType === "postgres" || dbType === "mariadb") {
      if (!name) {
        setGeneratedSql("");
        return;
      }

      const quote = (str) => {
        if (!str) return "";
        if (dbType === "postgres") return `"${str}"`;
        if (dbType === "mariadb") return `\`${str}\``;
        return str;
      };

      const tableName = quote(name.trim());

      const cols = columns
        .map((c) => {
          if (!c.name.trim()) return null;
          // The primary key column type might already contain keywords, so only quote the name.
          return `  ${quote(c.name.trim())} ${c.type}`;
        })
        .filter(Boolean)
        .join(",\n");

      const sql = `CREATE TABLE ${tableName} (\n${cols}\n);`;
      setGeneratedSql(sql);
    }
  }, [name, columns, dbType]);

  if (!isOpen) {
    return null;
  }

  const handleAddColumn = () => {
    setColumns([
      ...columns,
      { id: Date.now(), name: "", type: "VARCHAR(255)", isRemovable: true },
    ]);
  };

  const handleRemoveColumn = (id) => {
    setColumns(columns.filter((col) => col.id !== id));
  };

  const handleColumnChange = (id, field, value) => {
    setColumns(
      columns.map((col) => (col.id === id ? { ...col, [field]: value } : col)),
    );
  };

  const handleSave = () => {
    let itemData;
    if (dbType === "redis") {
      itemData = { key, value };
    } else if (dbType === "postgres" || dbType === "mariadb") {
      itemData = { name, sql: generatedSql }; // Pass the generated SQL
    } else {
      // mongodb
      itemData = { name };
    }
    onSave(itemData);
    onClose();
  };

  const renderSqlForm = () => (
    <>
      <div className="mb-4">
        <label
          htmlFor="table-name"
          className="block text-gray-300 text-sm font-bold mb-2"
        >
          Nombre de la Tabla
        </label>
        <input
          id="table-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="shadow appearance-none border rounded w-full py-2 px-3 bg-primary text-white"
          required
        />
      </div>
      <h4 className="text-gray-200 font-bold mb-2">Columnas</h4>
      <div className="space-y-2 max-h-72 overflow-y-auto pr-2">
        {columns.map((col) => (
          <div key={col.id} className="flex items-center space-x-2">
            <input
              type="text"
              placeholder="Nombre de la columna"
              value={col.name}
              onChange={(e) =>
                handleColumnChange(col.id, "name", e.target.value)
              }
              className="flex-1 shadow appearance-none border rounded py-2 px-3 bg-primary text-white"
              disabled={!col.isRemovable}
            />
            <select
              value={col.type}
              onChange={(e) =>
                handleColumnChange(col.id, "type", e.target.value)
              }
              className="flex-1 shadow appearance-none border rounded py-2 px-3 bg-primary text-white"
              disabled={!col.isRemovable}
            >
              <option value={col.type}>{col.type}</option>
              {(dbType === "postgres"
                ? POSTGRES_DATA_TYPES
                : MARIADB_DATA_TYPES
              ).map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
            {col.isRemovable ? (
              <button
                type="button"
                onClick={() => handleRemoveColumn(col.id)}
                className="text-red-500 hover:text-red-400"
              >
                <FaTrash />
              </button>
            ) : (
              <div style={{ width: "28px" }}></div>
            )}
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={handleAddColumn}
        className="mt-2 flex items-center text-accent hover:text-accent-dark"
      >
        <FaPlus className="mr-2" /> Añadir Columna
      </button>
      <div className="mt-4">
        <h4 className="text-gray-200 font-bold mb-2">SQL Generado</h4>
        <pre className="bg-primary p-2 rounded-md text-sm text-yellow-300 whitespace-pre-wrap">
          {generatedSql}
        </pre>
      </div>
    </>
  );

  // ... (renderRedisForm and renderMongoForm remain the same)
  const renderRedisForm = () => (
    <>
      <div className="mb-4">
        <label
          htmlFor="redis-key"
          className="block text-gray-300 text-sm font-bold mb-2"
        >
          Clave (Key)
        </label>
        <input
          id="redis-key"
          type="text"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          className="shadow appearance-none border rounded w-full py-2 px-3 bg-primary text-white"
          required
        />
      </div>
      <div className="mb-4">
        <label
          htmlFor="redis-value"
          className="block text-gray-300 text-sm font-bold mb-2"
        >
          Valor (Value)
        </label>
        <input
          id="redis-value"
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="shadow appearance-none border rounded w-full py-2 px-3 bg-primary text-white"
          required
        />
      </div>
    </>
  );

  const renderMongoForm = () => (
    <div className="mb-4">
      <label
        htmlFor="collection-name"
        className="block text-gray-300 text-sm font-bold mb-2"
      >
        Nombre de la Colección
      </label>
      <input
        id="collection-name"
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="shadow appearance-none border rounded w-full py-2 px-3 bg-primary text-white"
        required
      />
    </div>
  );

  const renderForm = () => {
    switch (dbType) {
      case "postgres":
      case "mariadb":
        return renderSqlForm();
      case "redis":
        return renderRedisForm();
      case "mongodb":
        return renderMongoForm();
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-sidebar p-6 rounded-lg shadow-lg w-full max-w-lg">
        <h2 className="text-xl font-bold text-white mb-4">
          Crear Nuevo Elemento
        </h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSave();
          }}
        >
          {renderForm()}
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
              Crear
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateItemModal;
