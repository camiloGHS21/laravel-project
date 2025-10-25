import { memo } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  FaTachometerAlt,
  FaCog,
  FaGlobe,
  FaServer,
  FaDatabase,
} from "react-icons/fa";
import { DiPhp } from "react-icons/di";

const Sidebar = memo(() => {
  const location = useLocation();

  const menuItems = [
    { icon: <FaTachometerAlt />, name: "Dashboard", path: "/" },
    { icon: <FaCog />, name: "Settings", path: "/settings" },
    { icon: <FaGlobe />, name: "Sites", path: "/sites" },
    { icon: <DiPhp size={24} />, name: "PHP", path: "/php" },
    { icon: <FaServer />, name: "Services", path: "/services" },
    { icon: <FaDatabase />, name: "Bases de datos", path: "/databases" },
    // { icon: <FaEnvelope />, name: 'Mail', pro: true },
  ];

  return (
    <div className="w-64 bg-sidebar text-white h-screen p-4">
      <div className="flex items-center mb-8">
        <div className="w-8 h-8 bg-accent rounded-md flex items-center justify-center font-bold text-xl mr-2">
          H
        </div>
        <span className="text-xl font-bold">Laravel Hid</span>
      </div>
      <nav>
        <ul>
          {menuItems.map((item) => (
            <li key={item.name}>
              <Link
                to={item.path || "#"}
                className={`flex items-center p-2 rounded-md cursor-pointer ${
                  location.pathname === item.path ? "bg-active" : ""
                }`}
              >
                <span className="mr-3">{item.icon}</span>
                <span>{item.name}</span>
                {item.pro && (
                  <span className="ml-auto bg-accent-pro text-white text-xs font-bold px-2 py-1 rounded-full">
                    Pro
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
});

export default Sidebar;
