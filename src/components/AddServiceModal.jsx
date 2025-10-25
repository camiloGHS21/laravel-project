import { useState, useEffect } from "react";

const AddServiceModal = ({ isOpen, onClose, setServices }) => {
  const [category, setCategory] = useState("Database");
  const [service, setService] = useState("");
  const [name, setName] = useState("");
  const [port, setPort] = useState("");
  const [isInstalling, setIsInstalling] = useState(false);
  const [installationLog, setInstallationLog] = useState([]);

  const servicesByCategory = {
    Broadcasting: ["Reverb (beta)"],
    Database: ["PostgreSQL (16)", "MariaDB", "MongoDB", "Redis"],
    Search: ["Meilisearch (1.6.2)"],
    Storage: ["MinIO (RELEASE.2024-03-05)"],
  };

  useEffect(() => {
    const defaultService = servicesByCategory[category][0];
    setService(defaultService);
  }, [category]);

  useEffect(() => {
    if (!service) return;

    setName(service.split(" ")[0]);

    switch (service) {
      case "PostgreSQL (16)":
        setPort("5432");
        break;
      case "MariaDB":
        setPort("3307");
        break;
      case "MongoDB":
        setPort("27017");
        break;
      case "Redis":
        setPort("6379");
        break;
      case "Meilisearch (1.6.2)":
        setPort("7700");
        break;
      case "MinIO (RELEASE.2024-03-05)":
        setPort("9000");
        break;
      default:
        setPort("");
    }
  }, [service]);

  useEffect(() => {
    if (!isOpen) {
      setIsInstalling(false);
      setInstallationLog([]);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsInstalling(true);
    setInstallationLog([]);

    const newService = {
      name,
      version: service.match(/\((.*)\)/)?.[1] || "-",
      port,
      status: "stopped",
      category,
    };

    const unsubscribe = window.electronAPI.onServiceInstallLog((log) => {
      setInstallationLog((prev) => [...prev, log]);
    });

    const result = await window.electronAPI.addService(newService);

    unsubscribe();
    setIsInstalling(false);

    if (result.success) {
      setServices((prevServices) => ({
        ...prevServices,
        [category]: [
          ...(prevServices[category] || []),
          { ...result.service, installed: true },
        ],
      }));
      onClose();
    } else {
      setInstallationLog((prev) => [...prev, `Error: ${result.error}`]);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
      <div className="bg-gray-800 p-8 rounded-lg w-full max-w-md">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-2xl font-bold">Create a new service</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            &times;
          </button>
        </div>

        {isInstalling ? (
          <div>
            <h3 className="text-xl font-bold mb-4">Installing {name}...</h3>
            <div className="bg-gray-900 p-4 rounded-lg h-64 overflow-y-auto">
              {installationLog.map((line, index) => (
                <div
                  key={`log-${Date.now()}-${index}`}
                  className="text-sm text-gray-300 font-mono"
                >
                  {line}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label
                htmlFor="category"
                className="block text-sm font-medium mb-2"
              >
                Category
              </label>
              <select
                id="category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 rounded py-2 px-3"
              >
                {Object.keys(servicesByCategory).map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div className="mb-4">
              <label
                htmlFor="service"
                className="block text-sm font-medium mb-2"
              >
                Service
              </label>
              <select
                id="service"
                value={service}
                onChange={(e) => setService(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 rounded py-2 px-3"
              >
                {servicesByCategory[category].map((serv) => (
                  <option key={serv} value={serv}>
                    {serv}
                  </option>
                ))}
              </select>
            </div>

            <div className="mb-4">
              <label htmlFor="name" className="block text-sm font-medium mb-2">
                Name
              </label>
              <input
                type="text"
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 rounded py-2 px-3"
              />
            </div>

            <div className="mb-4">
              <label htmlFor="port" className="block text-sm font-medium mb-2">
                Port
              </label>
              <input
                type="text"
                id="port"
                value={port}
                onChange={(e) => setPort(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 rounded py-2 px-3"
              />
            </div>

            <div className="mb-6">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  className="form-checkbox bg-gray-700 border-gray-600"
                />
                <span className="ml-2">Automatically start with Herd</span>
              </label>
              <label className="flex items-center mt-2">
                <input
                  type="checkbox"
                  className="form-checkbox bg-gray-700 border-gray-600"
                />
                <span className="ml-2">Serve over HTTPS</span>
              </label>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded mr-2"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-4 rounded"
              >
                Save
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default AddServiceModal;
