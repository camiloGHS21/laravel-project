import { useState, useEffect } from "react";

const AddConnectionModal = ({ isOpen, onClose, onSave }) => {
  const [connectionName, setConnectionName] = useState("");
  const [dbType, setDbType] = useState("postgres");
  const [host, setHost] = useState("localhost");
  const [port, setPort] = useState("5432");
  const [user, setUser] = useState("postgres");
  const [password, setPassword] = useState("");
  const [database, setDatabase] = useState("");

  useEffect(() => {
    if (dbType === "postgres") {
      setPort("5432");
      setUser("postgres");
    } else if (dbType === "mariadb") {
      setPort("3306");
      setUser("root");
    } else if (dbType === "mongodb") {
      setPort("27017");
      setUser("");
      setPassword("");
    } else if (dbType === "redis") {
      setPort("6379");
      setUser("");
      setPassword("");
      setDatabase("");
    }
  }, [dbType]);

  if (!isOpen) {
    return null;
  }

  const handleSave = () => {
    onSave({
      name: connectionName,
      type: dbType,
      host,
      port,
      user,
      password,
      database,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-sidebar p-6 rounded-lg shadow-lg w-full max-w-md">
        <h2 className="text-xl font-bold text-white mb-4">Nueva Conexión</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSave();
          }}
        >
          <div className="mb-4">
            <label
              className="block text-gray-300 text-sm font-bold mb-2"
              htmlFor="connectionName"
            >
              Nombre de la Conexión
            </label>
            <input
              type="text"
              id="connectionName"
              value={connectionName}
              onChange={(e) => setConnectionName(e.target.value)}
              className="shadow appearance-none border rounded w-full py-2 px-3 bg-primary text-white leading-tight focus:outline-none focus:shadow-outline"
              required
            />
          </div>
          <div className="mb-4">
            <label
              className="block text-gray-300 text-sm font-bold mb-2"
              htmlFor="dbType"
            >
              Tipo de Base de Datos
            </label>
            <select
              id="dbType"
              value={dbType}
              onChange={(e) => setDbType(e.target.value)}
              className="shadow appearance-none border rounded w-full py-2 px-3 bg-primary text-white leading-tight focus:outline-none focus:shadow-outline"
            >
              <option value="postgres">PostgreSQL</option>
              <option value="mariadb">MariaDB</option>
              <option value="mongodb">MongoDB</option>
              <option value="redis">Redis</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label
                className="block text-gray-300 text-sm font-bold mb-2"
                htmlFor="host"
              >
                Host
              </label>
              <input
                type="text"
                id="host"
                value={host}
                onChange={(e) => setHost(e.target.value)}
                className="shadow appearance-none border rounded w-full py-2 px-3 bg-primary text-white"
              />
            </div>
            <div>
              <label
                className="block text-gray-300 text-sm font-bold mb-2"
                htmlFor="port"
              >
                Puerto
              </label>
              <input
                type="text"
                id="port"
                value={port}
                onChange={(e) => setPort(e.target.value)}
                className="shadow appearance-none border rounded w-full py-2 px-3 bg-primary text-white"
              />
            </div>
          </div>
          {dbType !== "redis" && (
            <>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label
                    className="block text-gray-300 text-sm font-bold mb-2"
                    htmlFor="user"
                  >
                    Usuario
                  </label>
                  <input
                    type="text"
                    id="user"
                    value={user}
                    onChange={(e) => setUser(e.target.value)}
                    className="shadow appearance-none border rounded w-full py-2 px-3 bg-primary text-white"
                  />
                </div>
                <div>
                  <label
                    className="block text-gray-300 text-sm font-bold mb-2"
                    htmlFor="password"
                  >
                    Contraseña
                  </label>
                  <input
                    type="password"
                    id="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="shadow appearance-none border rounded w-full py-2 px-3 bg-primary text-white"
                  />
                </div>
              </div>
              <div className="mb-4">
                <label
                  className="block text-gray-300 text-sm font-bold mb-2"
                  htmlFor="database"
                >
                  Base de Datos
                </label>
                <input
                  type="text"
                  id="database"
                  value={database}
                  onChange={(e) => setDatabase(e.target.value)}
                  className="shadow appearance-none border rounded w-full py-2 px-3 bg-primary text-white leading-tight focus:outline-none focus:shadow-outline"
                  required={dbType !== "mongodb"}
                />
              </div>
            </>
          )}
          <div className="flex items-center justify-end">
            <button
              type="button"
              onClick={onClose}
              className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline mr-2"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="bg-accent hover:bg-accent-dark text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
            >
              Guardar Conexión
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddConnectionModal;
