const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  getSites: () => ipcRenderer.invoke("get-sites"),
  getSitesPath: () => ipcRenderer.invoke("get-sites-path"),
  getServicesStatus: () => ipcRenderer.invoke("get-services-status"),
  toggleServices: (servicesShouldRun) =>
    ipcRenderer.send("toggle-services", servicesShouldRun),
  onError: (callback) => {
    const listener = (event, ...args) => callback(...args);
    ipcRenderer.on("error", listener);
    return () => {
      ipcRenderer.removeListener("error", listener);
    };
  },

  getSetting: (key) => ipcRenderer.invoke("get-setting", key),
  setSetting: (key, value) => ipcRenderer.invoke("set-setting", key, value),
  selectDirectory: () => ipcRenderer.invoke("select-directory"),
  getSiteSetting: (siteName, key) =>
    ipcRenderer.invoke("get-site-setting", siteName, key),
  setSiteSetting: (siteName, key, value) =>
    ipcRenderer.invoke("set-site-setting", siteName, key, value),
  getServices: () => ipcRenderer.invoke("get-services"),
  setServices: (services) => ipcRenderer.invoke("set-services", services),
  startService: (category, serviceName) =>
    ipcRenderer.invoke("start-service", category, serviceName),
  stopService: (category, serviceName) =>
    ipcRenderer.invoke("stop-service", category, serviceName),
  deleteService: (category, serviceName) =>
    ipcRenderer.invoke("delete-service", category, serviceName),
  addService: (service) => ipcRenderer.invoke("service:add", service),
  onServiceInstallLog: (callback) => {
    const listener = (event, ...args) => callback(...args);
    ipcRenderer.on("service:install-log", listener);
    return () => {
      ipcRenderer.removeListener("service:install-log", listener);
    };
  },
  openDirectory: (path) => ipcRenderer.invoke("open-directory", path),
  openAdminer: () => ipcRenderer.invoke("open-adminer"),
  openDbgate: () => ipcRenderer.invoke("open-dbgate"),
  getAvailablePhpVersions: () =>
    ipcRenderer.invoke("get-available-php-versions"),
  installPhpVersion: (version) =>
    ipcRenderer.invoke("install-php-version", version),
  runShellCommand: (command, options) =>
    ipcRenderer.invoke("run-shell-command", command, options),
  onServicesStatusChange: (callback) => {
    const listener = (event, ...args) => callback(...args);
    ipcRenderer.on("services-status-changed", listener);
    return () => {
      ipcRenderer.removeListener("services-status-changed", listener);
    };
  },
  openExternalLink: (url) => ipcRenderer.invoke("open-external-link", url),
  copyTemplate: (options) => ipcRenderer.invoke("copy-template", options),
  toggleSite: (site) => ipcRenderer.send("toggle-site", site),
  onSiteStatusChanged: (callback) => {
    const listener = (event, ...args) => callback(...args);
    ipcRenderer.on("site-status-changed", listener);
    return () => {
      ipcRenderer.removeListener("site-status-changed", listener);
    };
  },
  capturePage: (url) => ipcRenderer.invoke("sites:capturePage", url),

  // NPM related commands
  getSiteProjectType: (sitePath) =>
    ipcRenderer.invoke("get-site-project-type", sitePath),
  runNpmCommand: (options) => ipcRenderer.send("run-npm-command", options),
  stopNpmCommand: (options) => ipcRenderer.send("stop-npm-command", options),
  onNpmCommandOutput: (commandKey, callback) => {
    const channel = `npm-command-output-${commandKey}`;
    const listener = (event, ...args) => callback(...args);
    ipcRenderer.on(channel, listener);
    return () => {
      ipcRenderer.removeListener(channel, listener);
    };
  },
  onNpmCommandError: (commandKey, callback) => {
    const channel = `npm-command-error-${commandKey}`;
    const listener = (event, ...args) => callback(...args);
    ipcRenderer.on(channel, listener);
    return () => {
      ipcRenderer.removeListener(channel, listener);
    };
  },
  onNpmCommandExit: (commandKey, callback) => {
    const channel = `npm-command-exit-${commandKey}`;
    const listener = (event, ...args) => callback(...args);
    ipcRenderer.on(channel, listener);
    return () => {
      ipcRenderer.removeListener(channel, listener);
    };
  },
  deleteSite: (site) => ipcRenderer.invoke("delete-site", site),
  restartAllServices: () => ipcRenderer.invoke("restart-all-services"),
  fetchPhpVersions: () => ipcRenderer.invoke("fetch-php-versions"),
  downloadPhpVersion: (version) =>
    ipcRenderer.invoke("download-php-version", version),
  deletePhpVersion: (version) =>
    ipcRenderer.invoke("delete-php-version", version),
  onPhpDownloadStatus: (callback) => {
    const listener = (event, ...args) => callback(...args);
    ipcRenderer.on("php-download-status", listener);
    return () => {
      ipcRenderer.removeListener("php-download-status", listener);
    };
  },
  checkReverbStatus: (sitePath) =>
    ipcRenderer.invoke("site:check-reverb", sitePath),
  installReverb: (sitePath) =>
    ipcRenderer.invoke("site:install-reverb", sitePath),
  startReverb: (sitePath) => ipcRenderer.invoke("site:start-reverb", sitePath),
  stopReverb: (sitePath) => ipcRenderer.invoke("site:stop-reverb", sitePath),
  onReverbInstallLog: (callback) => {
    const listener = (event, ...args) => callback(...args);
    ipcRenderer.on("site:reverb-install-log", listener);
    return () => {
      ipcRenderer.removeListener("site:reverb-install-log", listener);
    };
  },
  checkServiceInstalled: (serviceName) =>
    ipcRenderer.invoke("check-service-installed", serviceName),

  // Database
  dbGetConnections: () => ipcRenderer.invoke("db:get-connections"),
  dbSaveConnections: (connections) =>
    ipcRenderer.invoke("db:save-connections", connections),
  dbTestConnection: (connectionConfig) =>
    ipcRenderer.invoke("db:test-connection", connectionConfig),
  dbGetTables: (connectionConfig) =>
    ipcRenderer.invoke("db:get-tables", connectionConfig),
  dbGetTableData: (options) => ipcRenderer.invoke("db:get-table-data", options),
  dbCreateTable: (options) => ipcRenderer.invoke("db:create-table", options),
  dbDeleteItem: (options) => ipcRenderer.invoke("db:delete-item", options),
  dbGetTableColumns: (options) =>
    ipcRenderer.invoke("db:get-table-columns", options),
  dbInsertRow: (options) => ipcRenderer.invoke("db:insert-row", options),
  dbUpdateRow: (options) => ipcRenderer.invoke("db:update-row", options),
  dbDeleteRow: (options) => ipcRenderer.invoke("db:delete-row", options),
  dbExecuteQuery: (options) => ipcRenderer.invoke("db:execute-query", options),
  generateSQLQuery: (options) =>
    ipcRenderer.invoke("generateSQLQuery", options),
});
