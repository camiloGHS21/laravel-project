import { useState, useEffect } from "react";

const Settings = () => {
  const [sitesPath, setSitesPath] = useState("");
  const [phpVersions, setPhpVersions] = useState([]);
  const [selectedPhpVersion, setSelectedPhpVersion] = useState("");
  const [isRestarting, setIsRestarting] = useState(false);
  const [googleAiApiKey, setGoogleAiApiKey] = useState("");

  useEffect(() => {
    const getSitesPath = async () => {
      const path = await window.electronAPI.getSetting("sitesPath");
      setSitesPath(path);
    };
    const getPhpVersions = async () => {
      const versions = await window.electronAPI.getAvailablePhpVersions();
      setPhpVersions(versions);
      const currentVersion = await window.electronAPI.getSetting("phpVersion");
      setSelectedPhpVersion(currentVersion);
    };
    const getApiKey = async () => {
      const key = await window.electronAPI.getSetting("googleAiApiKey");
      setGoogleAiApiKey(key || "");
    };
    getSitesPath();
    getPhpVersions();
    getApiKey();
  }, []);

  const handleSelectDirectory = async () => {
    const path = await window.electronAPI.selectDirectory();
    if (path) {
      await window.electronAPI.setSetting("sitesPath", path);
      setSitesPath(path);
    }
  };

  const handlePhpVersionChange = async (event) => {
    const version = event.target.value;
    setIsRestarting(true);
    try {
      setSelectedPhpVersion(version);
      await window.electronAPI.setSetting("phpVersion", version);
      await window.electronAPI.restartAllServices();
    } catch (error) {
      console.error("Failed to change PHP version on settings page:", error);
    }
    setIsRestarting(false);
  };

  const handleSaveApiKey = async () => {
    await window.electronAPI.setSetting("googleAiApiKey", googleAiApiKey);
    alert("API Key guardada.");
  };

  return (
    <div className="flex-1 p-8 bg-primary text-white">
      <h1 className="text-3xl font-bold mb-8">General</h1>{" "}
      {/* Changed from Settings to General */}
      <div className="bg-sidebar p-4 rounded-md">
        <h2 className="text-xl font-bold mb-4">Sites Path</h2>
        <div className="flex items-center">
          <input
            type="text"
            readOnly
            value={sitesPath}
            className="bg-gray-700 text-white p-2 rounded-md w-full mr-4"
          />
          <button
            type="button"
            Click={handleSelectDirectory}
            className="bg-accent hover:bg-accent-dark text-white font-bold py-2 px-4 rounded"
          >
            Change
          </button>
        </div>
      </div>
      <div className="bg-sidebar p-4 rounded-md mt-8">
        <h2 className="text-xl font-bold mb-4">PHP Version</h2>
        <select
          value={selectedPhpVersion}
          onChange={handlePhpVersionChange}
          disabled={isRestarting}
          className="bg-gray-700 text-white p-2 rounded-md w-full disabled:bg-gray-500 disabled:cursor-not-allowed"
        >
          {phpVersions.map((version) => (
            <option key={version} value={version}>
              {version}
            </option>
          ))}
        </select>
        {isRestarting && (
          <p className="text-sm text-gray-400 mt-2">Reiniciando servicios...</p>
        )}
      </div>
      <div className="bg-sidebar p-4 rounded-md mt-8">
        <h2 className="text-xl font-bold mb-4">Google AI API Key</h2>
        <div className="flex items-center">
          <input
            type="password"
            value={googleAiApiKey}
            onChange={(e) => setGoogleAiApiKey(e.target.value)}
            className="bg-gray-700 text-white p-2 rounded-md w-full mr-4"
            placeholder="Introduce tu clave de API de Google AI"
          />
          <button
            type="button"
            onClick={handleSaveApiKey}
            className="bg-accent hover:bg-accent-dark text-white font-bold py-2 px-4 rounded"
          >
            Guardar
          </button>
        </div>
      </div>
      {/* New sections start here */}
      {/* Herd paths */}
      <div className="bg-sidebar p-4 rounded-md mt-8">
        <h2 className="text-xl font-bold mb-4">Herd paths</h2>
        <p className="text-gray-400 mb-4">
          All sub-folders in these directories will be available via Herd.
        </p>
        <button
          type="button"
          className="bg-accent hover:bg-accent-dark text-white font-bold py-2 px-4 rounded mb-4"
        >
          Add path
        </button>
        <div className="bg-gray-700 p-3 rounded flex items-center justify-between">
          <input
            type="text"
            className="bg-transparent outline-none w-full"
            value="C:\Users\Administrator\Herd"
            readOnly
          />
          <span className="text-gray-500 text-sm"></span>
        </div>
      </div>
      {/* Startup */}
      <div className="bg-sidebar p-4 rounded-md mt-8">
        <h2 className="text-xl font-bold mb-4">Startup</h2>
        <div className="flex items-center mb-2">
          <input
            type="checkbox"
            id="launchAtLogin"
            className="form-checkbox h-4 w-4 text-blue-600"
          />
          <label htmlFor="launchAtLogin" className="ml-2 text-gray-300">
            Launch Herd at login
          </label>
        </div>
        <div className="flex items-center">
          <input
            type="checkbox"
            id="startMinimized"
            className="form-checkbox h-4 w-4 text-blue-600"
          />
          <label htmlFor="startMinimized" className="ml-2 text-gray-300">
            Start minimized as system tray application
          </label>
        </div>
      </div>
      {/* Updates */}
      <div className="bg-sidebar p-4 rounded-md mt-8">
        <h2 className="text-xl font-bold mb-4">Updates</h2>
        <div className="flex items-center">
          <input
            type="checkbox"
            id="updateAutomatically"
            className="form-checkbox h-4 w-4 text-blue-600"
          />
          <label htmlFor="updateAutomatically" className="ml-2 text-gray-300">
            Update Herd automatically
          </label>
        </div>
      </div>
      {/* Default IDE */}
      <div className="bg-sidebar p-4 rounded-md mt-8">
        <h2 className="text-xl font-bold mb-4">Default IDE</h2>
        <p className="text-gray-400 mb-4">
          The default IDE to open (e.g. dump locations and sites list). You can
          learn more about compatibility in the .
        </p>
        <div className="mb-6">
          <h3 className="text-lg font-medium mb-2">Application</h3>
          <select className="bg-gray-700 text-white p-2 rounded">
            <option>VS Code</option>
            <option>PhpStorm</option>
            <option>Sublime Text</option>
          </select>
        </div>
      </div>
      {/* Internal API Port */}
      <div className="bg-sidebar p-4 rounded-md mt-8">
        <h2 className="text-xl font-bold mb-4">Internal API Port</h2>
        <div className="flex items-center mb-2">
          <span className="h-3 w-3 bg-green-500 rounded-full mr-2"></span>
          <span className="text-gray-300">Status</span>
        </div>
        <p className="text-gray-400 mb-4">
          Herd exposes an internal API for the CLI component and other features.
          Please make sure that the port is open on your firewall.
        </p>
        <input
          type="text"
          className="bg-gray-700 p-2 rounded w-32"
          value="9001"
          readOnly
        />
      </div>
      {/* HerdHelper */}
      <div className="bg-sidebar p-4 rounded-md mt-8">
        <h2 className="text-xl font-bold mb-4">HerdHelper</h2>
        <div className="flex items-center mb-2">
          <span className="h-3 w-3 bg-green-500 rounded-full mr-2"></span>
          <span className="text-gray-300">Status</span>
        </div>
        <p className="text-gray-400 mb-2">
          The HerdHelper is a Windows Service that manages the sites in your
          hosts file and communicates with the Herd app via a HTTP API.
        </p>
        <p className="text-gray-400 mb-4">
          Changing these settings requires admin access to restart the service.
        </p>
        <input
          type="text"
          className="bg-gray-700 p-2 rounded w-32"
          value="5000"
          readOnly
        />
      </div>
      {/* Debug Mode */}
      <div className="bg-sidebar p-4 rounded-md mt-8">
        <h2 className="text-xl font-bold mb-4">Debug Mode</h2>
        <div className="flex items-center mb-2">
          <input
            type="checkbox"
            id="enableDebugMode"
            className="form-checkbox h-4 w-4 text-blue-600"
          />
          <label htmlFor="enableDebugMode" className="ml-2 text-gray-300">
            Enable HerdHelper Debug Mode
          </label>
        </div>
        <p className="text-gray-400">
          You can access the logs at{" "}
          <span className="text-blue-500">C:\Windows\System32\Logs</span>
        </p>
      </div>
    </div>
  );
};

export default Settings;
