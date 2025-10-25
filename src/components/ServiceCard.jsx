const ServiceCard = ({
  service,
  category,
  toggleServiceStatus,
  deleteService,
}) => {
  const { name, version, port, status } = service;

  return (
    <div className="bg-gray-800 p-4 rounded-lg flex items-center justify-between">
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
      <div className="flex items-center space-x-4">
        <button
          type="button"
          onClick={() => console.log("Settings for", name)}
          className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded"
        >
          Settings
        </button>
        <button
          type="button"
          onClick={() => deleteService(category, name)}
          className="bg-red-700 hover:bg-red-600 text-white font-bold py-2 px-4 rounded"
        >
          Delete
        </button>
        <button
          type="button"
          onClick={() => toggleServiceStatus(category, name)}
          className={`w-24 text-white font-bold py-2 px-4 rounded ${
            status === "running"
              ? "bg-red-600 hover:bg-red-500"
              : "bg-green-600 hover:bg-green-500"
          }`}
        >
          {status === "running" ? "Stop" : "Start"}
        </button>
      </div>
    </div>
  );
};

export default ServiceCard;
