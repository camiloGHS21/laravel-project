import { useState, useEffect, useRef, memo, useCallback } from "react";
import {
  VscTerminal,
  VscCode,
  VscVm,
  VscDatabase,
  VscPlay,
  VscDebugStop,
  VscSync,
  VscLoading,
} from "react-icons/vsc";

const api = window.electronAPI;

const SiteDetails = memo(({ site }) => {
  const [showPreview, setShowPreview] = useState(false);
  const [projectType, setProjectType] = useState("other");
  const [npmOutput, setNpmOutput] = useState("");
  const [isNpmInstallRunning, setIsNpmInstallRunning] = useState(false);
  const [isNpmDevRunning, setIsNpmDevRunning] = useState(false);
  const outputRef = useRef(null);

  // New state for the preview image
  const [previewImage, setPreviewImage] = useState(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  const [isReverbInstalled, setIsReverbInstalled] = useState(false);
  const [isReverbRunning, setIsReverbRunning] = useState(false);
  const [isInstallingReverb, setIsInstallingReverb] = useState(false);
  const [reverbOutput, setReverbOutput] = useState("");

  const checkReverbStatus = useCallback(async () => {
    if (!site) return;
    const status = await api.checkReverbStatus(site.path);
    setIsReverbInstalled(status.installed);
    setIsReverbRunning(status.running);
  }, [site]);

  useEffect(() => {
    if (site) {
      api.getSiteProjectType(site.path).then(setProjectType);
      // Reset states when site changes
      setNpmOutput("");
      setIsNpmInstallRunning(false);
      setIsNpmDevRunning(false);
      // Reset preview state as well
      setShowPreview(false);
      setPreviewImage(null);
      setIsLoadingPreview(false);
      checkReverbStatus();
    }
  }, [site, checkReverbStatus]);

  // Effect to capture the page when showPreview is toggled
  useEffect(() => {
    if (showPreview && site && !previewImage) {
      setIsLoadingPreview(true);
      api
        .capturePage(`http://${site.name}.test`)
        .then((dataUrl) => {
          setPreviewImage(dataUrl);
        })
        .catch((error) => {
          console.error("Failed to capture page:", error);
          setPreviewImage(null); // Ensure no old image is shown
        })
        .finally(() => {
          setIsLoadingPreview(false);
        });
    } else if (!showPreview) {
      // Clear image when preview is turned off
      setPreviewImage(null);
    }
  }, [showPreview, site, previewImage]);

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  });

  useEffect(() => {
    if (!site) return;

    const commandKeyInstall = `${site.name}-install`;
    const commandKeyStart = `${site.name}-start`;

    const listeners = [
      api.onNpmCommandOutput(commandKeyInstall, (output) => {
        setNpmOutput((prev) => prev + output);
      }),
      api.onNpmCommandExit(commandKeyInstall, (code) => {
        setNpmOutput((prev) => `${prev}\nProcess exited with code ${code}\n`);
        setIsNpmInstallRunning(false);
      }),
      api.onNpmCommandOutput(commandKeyStart, (output) => {
        setNpmOutput((prev) => prev + output);
      }),
      api.onNpmCommandExit(commandKeyStart, (code) => {
        setNpmOutput((prev) => `${prev}\nProcess exited with code ${code}\n`);
        setIsNpmDevRunning(false);
      }),
    ];

    return () => {
      listeners.forEach((remove) => {
        remove();
      });
    };
  }, [site]);

  if (!site) {
    return (
      <div className="flex-1 p-8 text-gray-400">
        Select a site to view details.
      </div>
    );
  }

  const openInVsCode = () => {
    api.runShellCommand(`code "${site.path}"`);
  };

  const openInTerminal = () => {
    api.runShellCommand(`start cmd.exe /K "cd /d ${site.path}"`);
  };

  const openUrl = () => {
    api.openExternalLink(`http://${site.name}.test`);
  };

  const handleNpmInstall = () => {
    setNpmOutput("Starting npm install...\n");
    setIsNpmInstallRunning(true);
    api.runNpmCommand({
      sitePath: site.path,
      command: "install",
      siteName: site.name,
    });
  };

  const handleNpmDev = () => {
    setNpmOutput("Starting npm run dev...\n");
    setIsNpmDevRunning(true);
    api.runNpmCommand({
      sitePath: site.path,
      command: "dev",
      siteName: site.name,
    });
  };

  const handleStopNpmDev = () => {
    api.stopNpmCommand({ command: "dev", siteName: site.name });
    setIsNpmDevRunning(false);
    setNpmOutput((prev) => `${prev}\nStopping npm run dev...\n`);
  };

  const handleInstallReverb = async () => {
    setIsInstallingReverb(true);
    setReverbOutput("Installing Reverb...\n");
    const unsubscribe = api.onReverbInstallLog((log) => {
      setReverbOutput((prev) => prev + log);
    });
    await api.installReverb(site.path);
    unsubscribe();
    setIsInstallingReverb(false);
    checkReverbStatus();
  };

  const handleStartReverb = async () => {
    await api.startReverb(site.path);
    checkReverbStatus();
  };

  const handleStopReverb = async () => {
    await api.stopReverb(site.path);
    checkReverbStatus();
  };

  const renderNpmActions = () => {
    if (projectType === "react" || projectType === "vue") {
      return (
        <>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handleNpmInstall}
              disabled={isNpmInstallRunning || isNpmDevRunning}
              className="w-full flex items-center justify-between p-3 bg-input hover:bg-gray-700 rounded-lg disabled:opacity-50"
            >
              <span className="flex items-center">
                <VscSync
                  className={`mr-3 ${isNpmInstallRunning ? "animate-spin" : ""}`}
                />{" "}
                NPM Install
              </span>
            </button>

            <button
              type="button"
              onClick={handleNpmDev}
              disabled={isNpmDevRunning || isNpmInstallRunning}
              className="w-full flex items-center justify-between p-3 bg-input hover:bg-gray-700 rounded-lg disabled:opacity-50"
            >
              <span className="flex items-center">
                <VscPlay className="mr-3" /> NPM Dev
              </span>
            </button>
            {isNpmDevRunning && (
              <button
                type="button"
                onClick={handleStopNpmDev}
                className="p-3 bg-red-500 hover:bg-red-600 rounded-lg"
              >
                <VscDebugStop />
              </button>
            )}
          </div>

          {(isNpmInstallRunning || isNpmDevRunning || npmOutput) && (
            <div className="mt-4">
              <p className="text-sm text-gray-400">NPM Output</p>
              <div
                ref={outputRef}
                className="bg-black text-white font-mono text-xs rounded p-4 h-48 overflow-y-auto whitespace-pre-wrap"
              >
                {npmOutput}
              </div>
            </div>
          )}
        </>
      );
    }
    return null;
  };

  const renderReverbActions = () => {
    if (projectType !== "laravel" && projectType !== "livewire") {
      return null;
    }

    return (
      <div className="mt-4">
        <h3 className="text-lg font-bold text-white mb-2">Reverb</h3>
        {isReverbInstalled ? (
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={isReverbRunning ? handleStopReverb : handleStartReverb}
              className={`w-full flex items-center justify-between p-3 rounded-lg ${isReverbRunning ? "bg-red-500 hover:bg-red-600" : "bg-green-500 hover:bg-green-600"}`}
            >
              <span className="flex items-center">
                {isReverbRunning ? (
                  <VscDebugStop className="mr-3" />
                ) : (
                  <VscPlay className="mr-3" />
                )}
                {isReverbRunning ? "Stop Reverb" : "Start Reverb"}
              </span>
            </button>
            {/* Add uninstall button later */}
          </div>
        ) : (
          <button
            type="button"
            onClick={handleInstallReverb}
            disabled={isInstallingReverb}
            className="w-full flex items-center justify-between p-3 bg-input hover:bg-gray-700 rounded-lg disabled:opacity-50"
          >
            <span className="flex items-center">
              <VscSync
                className={`mr-3 ${isInstallingReverb ? "animate-spin" : ""}`}
              />{" "}
              Install Reverb
            </span>
          </button>
        )}
        {(isInstallingReverb || reverbOutput) && (
          <div className="mt-4">
            <p className="text-sm text-gray-400">Reverb Output</p>
            <div className="bg-black text-white font-mono text-xs rounded p-4 h-48 overflow-y-auto whitespace-pre-wrap">
              {reverbOutput}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderPreview = () => {
    if (!showPreview) {
      return (
        <div className="mb-4 border border-gray-700 rounded-lg bg-input flex-grow flex items-center justify-center min-h-[450px]">
          <p className="text-gray-400">Preview disabled</p>
        </div>
      );
    }

    if (isLoadingPreview) {
      return (
        <div className="mb-4 border border-gray-700 rounded-lg bg-input flex-grow flex items-center justify-center min-h-[450px]">
          <VscLoading className="animate-spin h-8 w-8 text-white" />
          <p className="text-gray-400 ml-4">Loading Preview...</p>
        </div>
      );
    }

    if (previewImage) {
      return (
        <div className="mb-4 border border-gray-700 rounded-lg bg-black flex-grow min-h-[450px] flex items-center justify-center p-2">
          <img
            src={previewImage}
            className="max-w-full max-h-full object-contain"
            alt={`Preview of ${site.name}`}
          />
        </div>
      );
    }

    return (
      <div className="mb-4 border border-gray-700 rounded-lg bg-input flex-grow flex items-center justify-center min-h-[450px]">
        <p className="text-red-400">
          Failed to load preview. Is the site running?
        </p>
      </div>
    );
  };

  return (
    <div className="flex-1 p-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-3xl font-bold text-white">{site.name}</h2>
          <button
            type="button"
            onClick={openUrl}
            className="text-blue-400 hover:text-blue-300"
          >
            {site.name}.test
          </button>
        </div>
        <div className="flex items-center px-3 py-1 bg-green-500/10 text-green-400 rounded-full text-sm">
          <span
            className={`w-2 h-2 rounded-full mr-2 ${site.running ? "bg-green-500" : "bg-red-500"}`}
          ></span>
          {site.running ? "Running" : "Stopped"}
        </div>
      </div>

      {/* Main Card */}
      <div className="bg-secondary rounded-lg shadow-lg p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Left side */}
          <div className="flex flex-col">
            {renderPreview()}

            <div className="flex items-center">
              <input
                type="checkbox"
                id="preview-toggle"
                className="form-checkbox h-5 w-5 text-blue-600 bg-gray-800 border-gray-600 rounded focus:ring-blue-500"
                checked={showPreview}
                onChange={() => setShowPreview(!showPreview)}
              />
              <label htmlFor="preview-toggle" className="ml-2 text-white">
                Preview
              </label>
            </div>
          </div>

          {/* Right side */}
          <div className="space-y-3">
            <button
              type="button"
              onClick={openInTerminal}
              className="w-full flex items-center justify-between p-3 bg-input hover:bg-gray-700 rounded-lg"
            >
              <span className="flex items-center">
                <VscTerminal className="mr-3" /> Terminal
              </span>
              <span className="text-gray-400">Open</span>
            </button>

            <button
              type="button"
              onClick={openInVsCode}
              className="w-full flex items-center justify-between p-3 bg-input hover:bg-gray-700 rounded-lg"
            >
              <span className="flex items-center">
                <VscCode className="mr-3" /> VS Code
              </span>
              <span className="text-gray-400">Open</span>
            </button>

            {renderNpmActions()}

            {renderReverbActions()}

            <button
              type="button"
              className="w-full flex items-center justify-between p-3 bg-input hover:bg-gray-700 rounded-lg"
            >
              <span className="flex items-center">
                <VscVm className="mr-3" /> Tinker
              </span>
              <span className="text-gray-400">Open</span>
            </button>

            <button
              type="button"
              className="w-full flex items-center justify-between p-3 bg-input hover:bg-gray-700 rounded-lg"
            >
              <span className="flex items-center">
                <VscDatabase className="mr-3" /> Adminer
              </span>
              <span className="text-gray-400">Open</span>
            </button>

            <div className="pt-4">
              <p className="text-sm text-gray-400">Path</p>
              <p className="text-white">{site.path}</p>
            </div>

            <div className="pt-2">
              <p className="text-sm text-gray-400">URL</p>
              <button
                type="button"
                onClick={openUrl}
                className="text-blue-400 hover:text-blue-300"
              >
                http://{site.name}.test
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

export default SiteDetails;
