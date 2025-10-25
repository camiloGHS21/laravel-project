import React from "react";
import { VscDebugStart, VscDebugStop, VscTrash } from "react-icons/vsc";

const api = window.electronAPI;

const SiteListItem = ({ site, isSelected, onSelect, onDelete }) => {
  return (
    <li
      className={`flex items-center justify-between rounded-md ${isSelected ? "bg-active" : "hover:bg-active"}`}
    >
      <button
        type="button"
        onClick={() => onSelect(site)}
        className="w-full text-left p-3"
      >
        <p className="font-bold flex items-center">
          <span
            className={`w-2 h-2 rounded-full mr-2 ${site.running ? "bg-green-500" : "bg-red-500"}`}
          ></span>
          {site.name}
        </p>
        <p className="text-sm text-gray-400 ml-4">{site.name}.test</p>
      </button>
      <div className="flex items-center">
        <button
          type="button"
          onClick={() => api.toggleSite(site)}
          className="p-2 rounded-md hover:bg-gray-700 mr-2"
        >
          {site.running ? <VscDebugStop /> : <VscDebugStart />}
        </button>
        <button
          type="button"
          onClick={() => onDelete(site)}
          className="p-2 rounded-md hover:bg-red-500 mr-2"
        >
          <VscTrash />
        </button>
      </div>
    </li>
  );
};

export default React.memo(SiteListItem);
