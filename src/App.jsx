import { useState, useEffect, Suspense, lazy } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import Sidebar from "@/components/Sidebar";
import ErrorBoundary from "./components/ErrorBoundary";

const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Settings = lazy(() => import("@/pages/Settings"));
const Sites = lazy(() => import("@/pages/Sites"));
const PHP = lazy(() => import("@/pages/PHP"));
const Services = lazy(() => import("@/pages/Services"));
const Databases = lazy(() => import("@/pages/Databases"));

function App() {
  const location = useLocation();
  const [error, setError] = useState(null);

  useEffect(() => {
    const removeListener = window.electronAPI.onError((errorMessage) => {
      setError(errorMessage);
      console.error("Caught error from main process:", errorMessage);
    });

    // Cleanup the listener when the component unmounts
    return () => {
      removeListener();
    };
  }, []);

  return (
    <div className="flex bg-background h-screen">
      <Sidebar />
      <div
        className={`flex-1 flex flex-col ${location.pathname === "/databases" ? "overflow-hidden" : "overflow-y-auto"}`}
      >
        {error && (
          <div className="bg-red-500 text-white p-2 text-center">
            <p>{error}</p>
            <button
              type="button"
              onClick={() => setError(null)}
              className="font-bold"
            >
              Dismiss
            </button>
          </div>
        )}
        <main
          className={`flex-1 flex h-full ${location.pathname === "/databases" ? "" : "p-6"}`}
        >
          <Suspense fallback={<div className="text-white">Loading...</div>}>
            <ErrorBoundary>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/sites" element={<Sites />} />
                <Route path="/php" element={<PHP />} />
                <Route path="/services" element={<Services />} />
                <Route path="/databases" element={<Databases />} />
              </Routes>
            </ErrorBoundary>
          </Suspense>
        </main>
      </div>
    </div>
  );
}

export default App;
