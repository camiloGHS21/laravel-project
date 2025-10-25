import { useState, useEffect } from "react";
import { FaInfoCircle } from "react-icons/fa";

const Dashboard = () => {
  const [servicesRunning, setServicesRunning] = useState(false);
  const [installedPhpVersions, setInstalledPhpVersions] = useState([]);
  const [activePhpVersion, setActivePhpVersion] = useState("");
  const [isRestarting, setIsRestarting] = useState(false);

  useEffect(() => {
    const fetchInitialData = async () => {
      const status = await window.electronAPI.getServicesStatus();
      setServicesRunning(status);

      const installed = await window.electronAPI.getAvailablePhpVersions();
      setInstalledPhpVersions(installed);

      const active = await window.electronAPI.getSetting("phpVersion");
      setActivePhpVersion(active);
    };

    fetchInitialData();

    const removeStatusListener = window.electronAPI.onServicesStatusChange(
      (status) => {
        setServicesRunning(status);
      },
    );

    return () => {
      removeStatusListener();
    };
  }, []);

  const toggleServices = () => {
    const newServicesRunning = !servicesRunning;
    window.electronAPI.toggleServices(newServicesRunning);
    setServicesRunning(newServicesRunning);
  };

  const handleVersionChange = async (event) => {
    const newVersion = event.target.value;
    setIsRestarting(true);
    try {
      await window.electronAPI.setSetting("phpVersion", newVersion);
      setActivePhpVersion(newVersion);
      await window.electronAPI.restartAllServices();
    } catch (error) {
      console.error("Failed to change PHP version:", error);
      // Optionally, show an error to the user
    }
    setIsRestarting(false);
  };

  const services = [
    { name: "Nginx", running: servicesRunning },
    { name: "PHP", running: servicesRunning },
  ];

  return (
    <div className="flex-1 p-8 bg-primary text-white">
      <h1 className="text-3xl font-bold mb-8">Dashboard</h1>

      <div className="grid grid-cols-3 gap-8">
        <div className="col-span-2">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">Active Services</h2>
            <button
              type="button"
              onClick={toggleServices}
              disabled={isRestarting}
              className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded disabled:bg-gray-500"
            >
              {isRestarting
                ? "Reiniciando..."
                : servicesRunning
                  ? "Stop all services"
                  : "Start all services"}
            </button>
          </div>
          <div className="bg-sidebar p-4 rounded-md">
            <ul>
              {services.map((service) => (
                <li
                  key={service.name}
                  className="flex items-center justify-between py-2"
                >
                  <div className="flex items-center">
                    <span
                      className={`w-3 h-3 rounded-full mr-3 ${service.running ? "bg-green-500" : "bg-red-500"}`}
                    ></span>
                    <span>{service.name}</span>
                  </div>
                  <FaInfoCircle className="text-gray-500" />
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-8">
            <h2 className="text-xl font-bold">Global PHP Version</h2>
            <p className="text-gray-400 mt-2">
              {activePhpVersion
                ? `Using bundled PHP ${activePhpVersion}`
                : "Loading..."}
            </p>
          </div>
        </div>
        <div>
          <div>
            <h2 className="text-xl font-bold">Herd Pro</h2>
            <div className="mt-4 space-y-2">
              <button
                type="button"
                className="w-full bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded"
              >
                Open Dumps
              </button>
              <button
                type="button"
                className="w-full bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded"
              >
                Open Mail
              </button>
              <button
                type="button"
                className="w-full bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded"
              >
                Open Log Viewer
              </button>
            </div>
          </div>
          <div className="mt-8">
            <h2 className="text-xl font-bold">Quick Access</h2>
            <div className="mt-4">
              <div className="relative">
                <select
                  value={activePhpVersion}
                  onChange={handleVersionChange}
                  disabled={isRestarting || !servicesRunning}
                  className="w-full bg-gray-700 text-white font-bold py-2 px-4 rounded appearance-none disabled:bg-gray-500 disabled:cursor-not-allowed"
                >
                  {installedPhpVersions.map((version) => (
                    <option
                      key={version}
                      value={version}
                    >{`PHP ${version}`}</option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-400">
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-hidden="true"
                  >
                    <title>Dropdown Arrow</title>
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M19 9l-7 7-7-7"
                    ></path>
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
