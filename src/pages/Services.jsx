import { useEffect, useRef, useState } from "react";
import AddServiceModal from "../components/AddServiceModal";

// --- Componente de Detalles del Servicio ---
const ServiceDetails = ({
  service,
  category,
  toggleServiceStatus,
  deleteService,
  installService,
}) => {
  if (!service) {
    return (
      <div className="bg-gray-800 rounded-lg p-8 flex-1 flex items-center justify-center">
        <p className="text-gray-400">Select a service to see details</p>
      </div>
    );
  }

  const { name, version, port, status, installed } = service;

  // Placeholder para variables de entorno y logs
  const environmentVariables = `DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=${port}
DB_DATABASE=laravel
DB_USERNAME=root
DB_PASSWORD=`;

  const logs = `Starting ${name} (MySQL) on port ${port} with data...\n[INFO] Service started successfully.\n[LOG] Listening on port ${port}.\n[WARN] A new version ${version + 0.1} is available.\n`;

  return (
    <div className="bg-gray-800 rounded-lg p-8 flex-1">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">{name}</h2>
        <div className="flex items-center space-x-4">
          <button
            type="button"
            onClick={() => deleteService(category, name)}
            className="bg-red-700 hover:bg-red-600 text-white font-bold py-2 px-4 rounded"
          >
            Delete
          </button>
          {installed ? (
            <button
              type="button"
              onClick={() => toggleServiceStatus(category, name)}
              className={`w-24 text-white font-bold py-2 px-4 rounded ${
                status === "running"
                  ? "bg-yellow-600 hover:bg-yellow-500"
                  : "bg-green-600 hover:bg-green-500"
              }`}
            >
              {status === "running" ? "Stop" : "Start"}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => installService(category, name)}
              className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-4 rounded"
            >
              Install
            </button>
          )}
        </div>
      </div>

      {/* Herramientas de Base de Datos */}
      <div className="space-y-4 mb-6">
        <div className="flex justify-between items-center bg-gray-900 p-3 rounded-md">
          <p>DBGate</p>
          <button
            type="button"
            onClick={() => window.electronAPI.openDbgate()}
            className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-1 px-4 rounded"
          >
            Open
          </button>
        </div>
        <div className="flex justify-between items-center bg-gray-900 p-3 rounded-md">
          <p>Adminer</p>
          <button
            type="button"
            onClick={() => window.electronAPI.openAdminer()}
            className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-1 px-4 rounded"
          >
            Open
          </button>
        </div>
      </div>

      {/* Variables de Entorno */}
      <div className="mb-6">
        <h3 className="font-bold mb-2">Environment Variables</h3>
        <pre className="bg-gray-900 p-4 rounded-md text-sm text-gray-300 whitespace-pre-wrap">
          {environmentVariables}
        </pre>
      </div>

      {/* Logs */}
      <div>
        <h3 className="font-bold mb-2">Logs</h3>
        <pre className="bg-gray-900 p-4 rounded-md text-sm text-gray-300 h-48 overflow-y-auto">
          {logs}
        </pre>
      </div>
    </div>
  );
};

// --- Componente de Item de la Lista de Servicios ---
const ServiceListItem = ({ service, onSelect, isSelected }) => {
  const { name, version, port, status } = service;

  const handleKeyDown = (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect();
    }
  };

  return (
    <button
      type="button"
      onClick={onSelect}
      onKeyDown={handleKeyDown}
      className={`p-4 rounded-lg flex items-center justify-between cursor-pointer w-full text-left ${
        isSelected ? "bg-black" : "bg-gray-800 hover:bg-gray-700"
      }`}
    >
      <div className="flex items-center">
        <div
          className={`w-3 h-3 rounded-full mr-4 ${
            status === "running" ? "bg-green-500" : "bg-red-500"
          }`}
        ></div>
        <div>
          <h3 className="font-bold">{name}</h3>
          <p className="text-sm text-gray-400">
            {version} Port: {port}
          </p>
        </div>
      </div>
    </button>
  );
};

// --- Componente Principal de la Página de Servicios ---
const Services = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [services, setServices] = useState({});
  const [selectedService, setSelectedService] = useState(null);
  const isInitialMount = useRef(true);

  useEffect(() => {
    const loadServices = async () => {
      const storedServices = await window.electronAPI.getServices();
      if (storedServices && Object.keys(storedServices).length > 0) {
        const servicesWithStatus = {};
        for (const category in storedServices) {
          servicesWithStatus[category] = await Promise.all(
            storedServices[category].map(async (service) => {
              const installed = await window.electronAPI.checkServiceInstalled(
                service.name,
              );
              return { ...service, installed };
            }),
          );
        }
        setServices(servicesWithStatus);
      }
    };
    loadServices();
  }, []);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    // We don't want to save the `installed` status to the store
    const servicesToSave = { ...services };
    for (const category in servicesToSave) {
      servicesToSave[category] = servicesToSave[category].map(
        ({ installed, ...rest }) => rest,
      );
    }
    window.electronAPI.setServices(servicesToSave);
  }, [services]);

  const handleSelectService = (service, category) => {
    setSelectedService({ ...service, category });
  };

  const installService = async (category, serviceName) => {
    const service = services[category].find((s) => s.name === serviceName);
    if (!service) return;

    // This will trigger the installation process in the main process
    const result = await window.electronAPI.addService(service);

    if (result.success) {
      // After successful installation, update the service status
      setServices((prevServices) => {
        const newServices = { ...prevServices };
        const serviceIndex = newServices[category].findIndex(
          (s) => s.name === serviceName,
        );
        if (serviceIndex !== -1) {
          newServices[category][serviceIndex].installed = true;
        }
        return newServices;
      });
      alert(`Service ${serviceName} installed successfully!`);
    } else {
      alert(`Error installing service: ${result.error}`);
    }
  };

  const toggleServiceStatus = async (category, serviceName) => {
    const serviceList = services[category];
    if (!serviceList) return;

    const serviceIndex = serviceList.findIndex((s) => s.name === serviceName);
    if (serviceIndex === -1) return;

    const service = serviceList[serviceIndex];
    const newStatus = service.status === "running" ? "stopped" : "running";

    let result;
    if (newStatus === "running") {
      result = await window.electronAPI.startService(category, serviceName);
    } else {
      result = await window.electronAPI.stopService(category, serviceName);
    }

    if (result.success) {
      setServices((prevServices) => {
        const newServices = { ...prevServices };
        const updatedService = {
          ...newServices[category][serviceIndex],
          status: newStatus,
        };
        newServices[category][serviceIndex] = updatedService;

        if (selectedService && selectedService.name === serviceName) {
          setSelectedService(updatedService);
        }
        return newServices;
      });
    } else {
      alert(`Error: ${result.message}`);
      console.error(`Service operation failed: ${result.message}`);
    }
  };

  const deleteService = async (category, serviceName) => {
    const result = await window.electronAPI.deleteService(
      category,
      serviceName,
    );
    if (result.success) {
      setServices((prevServices) => {
        const newServices = { ...prevServices };
        newServices[category] = newServices[category].filter(
          (s) => s.name !== serviceName,
        );
        if (newServices[category].length === 0) {
          delete newServices[category];
        }
        return newServices;
      });
      setSelectedService(null); // Deseleccionar al borrar
    } else {
      console.error(`Failed to delete service: ${result.message}`);
    }
  };

  const haveServices = Object.keys(services).length > 0;

  return (
    <div className="p-8 text-white h-full flex flex-col">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Services</h1>
        {haveServices && (
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="bg-gray-800 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded"
          >
            Add Service
          </button>
        )}
      </div>

      {haveServices ? (
        <div className="flex-1 flex space-x-8">
          {/* Columna de la Lista de Servicios */}
          <div className="w-1/3 space-y-6">
            {Object.entries(services).map(([category, serviceList]) => (
              <div key={category}>
                <h2 className="text-xl font-bold mb-4">{category}</h2>
                <div className="space-y-4">
                  {serviceList.map((service) => (
                    <ServiceListItem
                      key={service.name}
                      service={service}
                      isSelected={selectedService?.name === service.name}
                      onSelect={() => handleSelectService(service, category)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Columna de Detalles del Servicio */}
          <div className="w-2/3">
            <ServiceDetails
              service={selectedService}
              category={selectedService?.category}
              toggleServiceStatus={toggleServiceStatus}
              deleteService={deleteService}
              installService={installService}
            />
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <h2 className="text-5xl font-bold mb-4">Services</h2>
          <p className="text-lg text-gray-400 mb-8 max-w-md">
            Manage additional services for your local development environment.
            Databases, queues, search engines, and more.
          </p>
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="bg-red-600 hover:bg-red-500 text-white font-bold py-3 px-6 rounded-lg text-lg"
          >
            Add Service
          </button>
        </div>
      )}

      <AddServiceModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        setServices={setServices}
      />
    </div>
  );
};

export default Services;
