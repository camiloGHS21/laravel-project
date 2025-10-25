import { useEffect, useState } from "react";
import { VscAdd, VscFolder, VscNewFile, VscSearch } from "react-icons/vsc";
import SiteCardSkeleton from "../components/SiteCardSkeleton";
import SiteDetails from "../components/SiteDetails";
import SiteListItem from "../components/SiteListItem";

const api = window.electronAPI;

const Sites = () => {
  const [sites, setSites] = useState([]);
  const [selectedSite, setSelectedSite] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalStep, setModalStep] = useState(1);
  const [selectedStarter, setSelectedStarter] = useState("React");
  const [isLoading, setIsLoading] = useState(true); // Add isLoading state

  // Form state
  const [projectName, setProjectName] = useState("laravel-app");
  const [targetLocation, setTargetLocation] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    const fetchSitesPath = async () => {
      const path = await api.getSitesPath();
      setTargetLocation(path);
    };
    fetchSitesPath();
  }, []);

  const loadSites = async () => {
    setIsLoading(true);
    try {
      const existingSites = await api.getSites();
      setSites(existingSites);
    } catch (error) {
      console.error("Failed to load sites:", error);
      // Optionally set an error state here
    } finally {
      setIsLoading(false);
    }
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: use loadSites
  useEffect(() => {
    loadSites();

    const removeStatusListener = api.onSiteStatusChanged(
      ({ siteName, isRunning }) => {
        setSites((prevSites) =>
          prevSites.map((site) =>
            site.name === siteName ? { ...site, running: isRunning } : site,
          ),
        );
        setSelectedSite((prev) =>
          prev && prev.name === siteName
            ? { ...prev, running: isRunning }
            : prev,
        );
      },
    );

    return () => {
      removeStatusListener();
    };
  }, []);

  useEffect(() => {
    if (sites.length > 0 && !selectedSite) {
      setSelectedSite(sites[0]);
    }
    if (sites.length === 0) {
      setSelectedSite(null);
    }
  }, [sites, selectedSite]);

  const openModal = () => {
    setIsModalOpen(true);
    setModalStep(1);
    setProjectName("laravel-app");
  };

  const closeModal = () => {
    setIsModalOpen(false);
  };

  const nextStep = () => {
    setModalStep((prevStep) => prevStep + 1);
  };

  const prevStep = () => {
    setModalStep((prevStep) => prevStep - 1);
  };

  const handleCreateProject = async () => {
    setIsCreating(true);
    setModalStep(4); // Move to the creating view

    // Map the starter name to the template name
    let templateName = selectedStarter.toLowerCase();
    if (templateName === "no starter kit") {
      templateName = "none";
    }

    try {
      const result = await api.copyTemplate({
        templateName,
        targetLocation,
        projectName,
      });

      if (result.success) {
        const restartResult = await api.restartAllServices();
        if (restartResult.success) {
          setSites(restartResult.sites);
        } else {
          // Handle restart failure
          console.error("Failed to restart services:", restartResult.error);
        }
        setTimeout(() => {
          closeModal();
        }, 1000);
      } else {
        // Handle error - maybe show an error message in the modal
        console.error("Failed to copy template:", result.error);
        // For now, just closing the modal
        setTimeout(() => {
          closeModal();
        }, 1000);
      }
    } catch (error) {
      // Handle error
      console.error("An error occurred during template copy:", error);
      setTimeout(() => {
        closeModal();
      }, 1000);
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteSite = async (site) => {
    const confirmDelete = window.confirm(
      `Are you sure you want to delete "${site.name}"? This will delete the project folder and cannot be undone.`,
    );
    if (confirmDelete) {
      const result = await api.deleteSite(site);
      if (result.success) {
        await loadSites();
      } else {
        // TODO: Show a proper error to the user
        console.error("Failed to delete site:", result.error);
      }
    }
  };

  const renderModalContent = () => {
    // ... (modal content remains largely the same, but with button states tied to isCreating)
    // For brevity, I'll just show the last step's button change
    switch (modalStep) {
      case 1:
        return (
          <div className="bg-secondary rounded-lg shadow-lg w-full max-w-2xl">
            <div className="p-8">
              <h2 className="text-2xl font-bold mb-6 text-text">
                Create New Site
              </h2>
              <div className="flex justify-center items-center space-x-6 mb-8">
                <button
                  type="button"
                  onClick={nextStep}
                  className="flex flex-col items-center justify-center p-8 border-2 border-button rounded-lg hover:bg-button/10 transition-colors duration-200 w-60 h-40"
                >
                  <VscNewFile className="w-16 h-16 mb-2 text-text/80" />
                  <span className="text-text text-lg">New Laravel project</span>
                </button>
                <button
                  type="button"
                  className="flex flex-col items-center justify-center p-8 border-2 border-secondary rounded-lg hover:border-button transition-colors duration-200 w-60 h-40"
                >
                  <VscFolder className="w-16 h-16 mb-2 text-text/80" />
                  <span className="text-text text-lg">
                    Link existing project
                  </span>
                </button>
              </div>
              <p className="text-center text-text/60 mb-8">
                Start a fresh Laravel project.
              </p>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={closeModal}
                  className="bg-transparent text-text/80 font-bold py-2 px-6 mr-2 rounded"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={nextStep}
                  className="bg-button hover:bg-button/80 text-text font-bold py-2 px-6 rounded"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        );
      case 2: {
        const starters = ["No starter kit", "React", "Vue", "Livewire"];
        return (
          <div className="bg-secondary rounded-lg shadow-lg w-full max-w-3xl">
            <div className="p-8">
              <h2 className="text-2xl font-bold mb-6 text-text">
                Create New Site
              </h2>
              <div className="grid grid-cols-5 gap-4 mb-8">
                {starters.map((starter) => (
                  <button
                    type="button"
                    key={starter}
                    onClick={() => setSelectedStarter(starter)}
                    className={`flex flex-col items-center justify-center p-6 border-2 rounded-lg transition-colors duration-200 h-32 ${selectedStarter === starter ? "border-button" : "border-secondary hover:border-button"}`}
                  >
                    <span className="text-text">{starter}</span>
                  </button>
                ))}
              </div>
              <div className="flex justify-between">
                <button
                  type="button"
                  onClick={prevStep}
                  className="bg-transparent text-text/80 font-bold py-2 px-6 rounded"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={nextStep}
                  className="bg-button hover:bg-button/80 text-text font-bold py-2 px-6 rounded"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        );
      }
      case 3:
        return (
          <div className="bg-secondary rounded-lg shadow-lg w-full max-w-2xl">
            <div className="p-8">
              <h2 className="text-2xl font-bold mb-6 text-text">
                Create New Site
              </h2>
              <div className="space-y-5">
                <div className="flex flex-col">
                  <label
                    htmlFor="projectName"
                    className="text-text/80 text-sm font-bold mb-2"
                  >
                    Project Name:
                  </label>
                  <input
                    type="text"
                    id="projectName"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    className="bg-input border border-secondary rounded w-full py-3 px-4 text-text leading-tight focus:outline-none focus:border-button"
                  />
                </div>
                <div className="flex flex-col">
                  <label
                    htmlFor="targetLocation"
                    className="text-text/80 text-sm font-bold mb-2"
                  >
                    Target Location:
                  </label>
                  <input
                    type="text"
                    id="targetLocation"
                    value={targetLocation}
                    onChange={(e) => setTargetLocation(e.target.value)}
                    className="bg-input border border-secondary rounded w-full py-3 px-4 text-text leading-tight focus:outline-none focus:border-button"
                  />
                  <p className="text-text/60 text-xs mt-2">
                    Your project will be created in this folder.
                  </p>
                </div>
              </div>
              <div className="flex justify-between mt-10">
                <button
                  type="button"
                  onClick={prevStep}
                  className="bg-transparent text-text/80 font-bold py-2 px-6 rounded"
                  disabled={isCreating}
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={handleCreateProject}
                  className="bg-button hover:bg-button/80 text-text font-bold py-2 px-6 rounded"
                  disabled={isCreating}
                >
                  {isCreating ? "Creating..." : "Create Site"}
                </button>
              </div>
            </div>
          </div>
        );
      case 4:
        return (
          <div className="bg-secondary rounded-lg shadow-lg w-full max-w-2xl">
            <div className="p-12 text-center">
              <h2 className="text-2xl font-bold mb-4 text-text">
                Creating your project...
              </h2>
              <p className="text-text/60 mb-6">
                Creating a "{projectName}" project at "{targetLocation}"
              </p>
              <div className="flex justify-center items-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-text"></div>
              </div>
              <div className="flex justify-between mt-10">
                <button
                  type="button"
                  className="bg-transparent text-text/60 font-bold py-2 px-6 rounded"
                  disabled
                >
                  Previous
                </button>
                <button
                  type="button"
                  className="bg-button text-text font-bold py-2 px-6 rounded opacity-50"
                  disabled
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-full bg-background text-text">
        <div className="w-1/3 max-w-xs p-4 bg-sidebar overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">Sites</h2>
            <div className="flex items-center">
              <button type="button" className="p-2 rounded-md hover:bg-active">
                <VscSearch />
              </button>
              <button type="button" className="p-2 rounded-md hover:bg-active">
                <VscAdd />
              </button>
            </div>
          </div>
          {/* Skeleton for site list */}
          <ul>
            {[...Array(3)].map((_, i) => (
              <li
                // biome-ignore lint/suspicious/noArrayIndexKey: false
                key={i}
                className="p-3 mb-2 rounded-md bg-primary animate-pulse"
              >
                <div className="h-4 bg-secondary rounded w-3/4"></div>
                <div className="h-3 mt-2 bg-secondary rounded w-1/2"></div>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex-1 p-8">
          <SiteCardSkeleton />
        </div>
      </div>
    );
  }

  if (sites.length === 0) {
    return (
      <div className="h-full w-full bg-background text-text flex flex-col items-center justify-center">
        <div className="text-center">
          <h1 className="text-5xl font-bold mb-4 text-text">Sites</h1>
          <p className="text-lg text-text/60 mb-8 max-w-md">Manage your sites for your local development environment.</p>
          <button
            type="button"
            onClick={openModal}
            className="bg-[var(--accent)] hover:bg-[var(--accent)]/80 text-white font-bold py-3 px-6 rounded-lg text-lg"
          >
            Add Site
          </button>
        </div>
        {isModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
            {renderModalContent()}
          </div>
        )}
        <div className="absolute bottom-0 left-0 w-full h-1/3 bg-gradient-to-t from-accent/20 via-transparent to-transparent"></div>
      </div>
    );
  }

  return (
    <div className="flex h-full bg-background text-text">
      <div className="w-1/3 max-w-xs p-4 bg-sidebar overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Sites</h2>
          <div className="flex items-center">
            <button type="button" className="p-2 rounded-md hover:bg-active">
              <VscSearch />
            </button>
            <button
              type="button"
              onClick={openModal}
              className="p-2 rounded-md hover:bg-active"
            >
              <VscAdd />
            </button>
          </div>
        </div>
        <ul>
          {sites.map((site) => (
            <SiteListItem
              key={site.name}
              site={site}
              isSelected={selectedSite?.name === site.name}
              onSelect={setSelectedSite}
              onDelete={handleDeleteSite}
            />
          ))}
        </ul>
      </div>
      <SiteDetails site={selectedSite} />
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
          {renderModalContent()}
        </div>
      )}
    </div>
  );
};

export default Sites;
