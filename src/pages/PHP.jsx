import { useEffect, useState } from "react";

const PHP = () => {
  const [downloadStatus, setDownloadStatus] = useState({});
  const [versions, setVersions] = useState([]);
  const [installedVersions, setInstalledVersions] = useState([]);
  const [activePhpVersion, setActivePhpVersion] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const refreshInstalledVersions = async () => {
    const installed = await window.electronAPI.getAvailablePhpVersions();
    setInstalledVersions(installed);
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: fetches data only once
  useEffect(() => {
    const removeListener = window.electronAPI.onPhpDownloadStatus((status) => {
      setDownloadStatus((prev) => ({ ...prev, [status.version]: status }));
      if (status.status === "complete") {
        refreshInstalledVersions();
      }
    });

    const fetchData = async () => {
      try {
        const [versionsResult, installedResult, activeVersionResult] =
          await Promise.all([
            window.electronAPI.fetchPhpVersions(),
            window.electronAPI.getAvailablePhpVersions(),
            window.electronAPI.getSetting("phpVersion"),
          ]);

        if (versionsResult.success) {
          setVersions(versionsResult.versions);
        } else {
          throw new Error(versionsResult.error);
        }

        setInstalledVersions(installedResult);
        setActivePhpVersion(activeVersionResult);
      } catch (err) {
        setError(err.message);
      }
      setIsLoading(false);
    };

    fetchData();

    return () => {
      removeListener();
    };
  }, []);

  const handleDownload = (version) => {
    window.electronAPI.downloadPhpVersion(version);
  };

  const handleDelete = async (version) => {
    if (
      window.confirm(
        `¿Estás seguro de que quieres eliminar PHP ${version}? Esta acción no se puede deshacer.`,
      )
    ) {
      const result = await window.electronAPI.deletePhpVersion(version);
      if (result.success) {
        refreshInstalledVersions();
      } else {
        setError(`Error al eliminar la versión ${version}: ${result.error}`);
      }
    }
  };

  const getButtonState = (version) => {
    if (installedVersions.includes(version)) {
      return { text: "Instalado", disabled: true, installed: true };
    }
    const status = downloadStatus[version];
    if (status) {
      if (status.status === "downloading")
        return { text: "Descargando...", disabled: true };
      if (status.status === "extracting")
        return { text: "Extrayendo...", disabled: true };
      if (status.status === "error") return { text: "Error", disabled: false };
    }
    return { text: "Descargar", disabled: false };
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-200">
        Administrar PHP
      </h1>
      <p className="mt-2 text-gray-600 dark:text-gray-400">
        Aquí puedes descargar y administrar tus versiones de PHP.
      </p>

      <div className="mt-6">
        <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-300">
          Versiones Disponibles
        </h2>
        {isLoading ? (
          <p className="text-gray-500 dark:text-gray-400">
            Cargando versiones...
          </p>
        ) : error ? (
          <p className="text-red-500">Error al cargar versiones: {error}</p>
        ) : (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {versions.map((version) => {
              const { text, disabled, installed } = getButtonState(version);
              const isActive = version === activePhpVersion;
              return (
                <div
                  key={version}
                  className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow flex flex-col justify-between"
                >
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                      PHP {version}
                    </h3>
                    {installed && isActive && (
                      <span className="text-xs bg-green-200 text-green-800 font-semibold px-2 py-1 rounded-full ml-2">
                        Activa
                      </span>
                    )}
                  </div>
                  <div className="flex items-center mt-4">
                    <button
                      type="button"
                      onClick={() => handleDownload(version)}
                      disabled={disabled}
                      className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                      {text}
                    </button>
                    {installed && (
                      <button
                        type="button"
                        onClick={() => handleDelete(version)}
                        disabled={isActive}
                        className="ml-2 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
                        title={
                          isActive
                            ? "No se puede eliminar la versión activa"
                            : "Eliminar versión"
                        }
                      >
                        Eliminar
                      </button>
                    )}
                  </div>
                  {downloadStatus[version] &&
                    downloadStatus[version].status === "error" && (
                      <p className="text-red-500 text-sm mt-2">
                        {downloadStatus[version].error}
                      </p>
                    )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default PHP;
