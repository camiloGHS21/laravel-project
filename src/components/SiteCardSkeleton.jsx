const SiteCardSkeleton = () => {
  return (
    <div className="bg-gray-800 p-4 rounded-lg shadow-lg animate-pulse">
      <div className="flex items-center justify-between mb-4">
        <div className="h-4 bg-gray-700 rounded w-1/3"></div>
        <div className="h-4 bg-gray-700 rounded w-1/4"></div>
      </div>
      <div className="mb-4">
        <div className="h-32 bg-gray-700 rounded"></div>
      </div>
      <div className="flex justify-between">
        <div className="h-8 bg-gray-700 rounded w-1/4"></div>
        <div className="h-8 bg-gray-700 rounded w-1/4"></div>
      </div>
    </div>
  );
};

export default SiteCardSkeleton;
