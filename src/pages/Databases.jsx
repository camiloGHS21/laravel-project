import { useEffect, useState } from "react";
import AceEditor from "react-ace";
import { BiLogoPostgresql } from "react-icons/bi";
import { DiMongodb, DiRedis } from "react-icons/di";
import { FaPlay, FaPlus, FaRobot, FaTrash } from "react-icons/fa";
import { SiMariadb } from "react-icons/si";
import AddConnectionModal from "@/components/AddConnectionModal";
import CreateItemModal from "@/components/CreateItemModal";
import DataTable from "@/components/DataTable";
import RowModal from "@/components/RowModal";

import "ace-builds/src-noconflict/mode-sql";
import "ace-builds/src-noconflict/theme-tomorrow_night";

const DBIcon = ({ type }) => {
  if (type === "postgres")
    return <BiLogoPostgresql className="inline-block mr-2" size={20} />;
  if (type === "mariadb")
    return <SiMariadb className="inline-block mr-2" size={20} />;
  if (type === "mongodb")
    return <DiMongodb className="inline-block mr-2" size={20} />;
  if (type === "redis")
    return <DiRedis className="inline-block mr-2" size={20} />;
  return null;
};

const Databases = () => {
  const [isAddConnectionModalOpen, setAddConnectionModalOpen] = useState(false);
  const [isCreateItemModalOpen, setCreateItemModalOpen] = useState(false);
  const [isRowModalOpen, setRowModalOpen] = useState(false);
  const [editingRowData, setEditingRowData] = useState(null);
  const [connections, setConnections] = useState([]);
  const [selectedConnection, setSelectedConnection] = useState(null);
  const [tables, setTables] = useState([]);
  const [connectionStatus, setConnectionStatus] = useState(null);
  const [modalKey, setModalKey] = useState(0);

  const [selectedTable, setSelectedTable] = useState(null);
  const [selectedTableColumns, setSelectedTableColumns] = useState([]);
  const [tableData, setTableData] = useState(null);
  const [isDataLoading, setIsDataLoading] = useState(false);

  const [activeTab, setActiveTab] = useState("browser");
  const [sqlQuery, setSqlQuery] = useState("");
  const [queryResult, setQueryResult] = useState(null);
  const [isQueryRunning, setIsQueryRunning] = useState(false);
  const [queryError, setQueryError] = useState("");
  const [aiPrompt, setAiPrompt] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);

  useEffect(() => {
    const loadConnections = async () => {
      const savedConnections = await window.electronAPI.dbGetConnections();
      setConnections(savedConnections || []);
    };
    loadConnections();
  }, []);

  const handleSaveConnection = async (connectionData) => {
    const newConnections = [...connections, connectionData];
    await window.electronAPI.dbSaveConnections(newConnections);
    setConnections(newConnections);
  };

  const handleDeleteConnection = async (e, connToDelete) => {
    e.stopPropagation();
    if (
      window.confirm(
        `¿Estás seguro de que quieres eliminar la conexión "${connToDelete.name}"?`,
      )
    ) {
      const newConnections = connections.filter(
        (conn) => conn.name !== connToDelete.name,
      );
      await window.electronAPI.dbSaveConnections(newConnections);
      setConnections(newConnections);
      if (selectedConnection?.name === connToDelete.name) {
        setSelectedConnection(null);
        setTables([]);
        setConnectionStatus(null);
        setTableData(null);
        setSelectedTable(null);
        setQueryResult(null);
        setQueryError("");
      }
    }
  };

  const handleSelectConnection = async (conn) => {
    if (selectedConnection?.name === conn.name) {
      setSelectedConnection(null);
      setTables([]);
      setTableData(null);
      setSelectedTable(null);
      setConnectionStatus(null);
      setQueryResult(null);
      setQueryError("");
      return;
    }

    setSelectedConnection(conn);
    setTables([]);
    setTableData(null);
    setSelectedTable(null);
    setConnectionStatus("connecting");
    setQueryResult(null);
    setQueryError("");

    const result = await window.electronAPI.dbTestConnection(conn);
    if (result.success) {
      setConnectionStatus("success");
      const tablesResult = await window.electronAPI.dbGetTables(conn);
      if (tablesResult.success) {
        setTables(tablesResult.tables);
      } else {
        setConnectionStatus("error");
      }
    } else {
      setConnectionStatus("error");
    }
  };

  const handleSelectTable = async (e, table) => {
    if (e) e.stopPropagation();
    setActiveTab("browser");
    setSelectedTable(table);
    setIsDataLoading(true);
    setTableData(null);

    const result = await window.electronAPI.dbGetTableData({
      connectionConfig: selectedConnection,
      table,
    });
    if (result.success) {
      setTableData(result.data);
    } else {
      setTableData({ error: result.error });
    }
    setIsDataLoading(false);
  };

  const handleCreateItem = async (itemData) => {
    const result = await window.electronAPI.dbCreateTable({
      connectionConfig: selectedConnection,
      itemData,
    });
    if (result.success) {
      handleSelectConnection(selectedConnection);
    } else {
      console.error("Failed to create item:", result.error);
      alert(`Error al crear: ${result.error}`);
    }
  };

  const handleDeleteTable = async (e, tableToDelete) => {
    e.stopPropagation();
    const itemType =
      selectedConnection.type === "mongodb"
        ? "colección"
        : selectedConnection.type === "redis"
          ? "clave"
          : "tabla";
    if (
      window.confirm(
        `¿Estás seguro de que quieres eliminar la ${itemType} "${tableToDelete}"? Esta acción es irreversible.`,
      )
    ) {
      const result = await window.electronAPI.dbDeleteItem({
        connectionConfig: selectedConnection,
        item: tableToDelete,
      });
      if (result.success) {
        handleSelectConnection(selectedConnection);
      } else {
        console.error(`Failed to delete item: ${tableToDelete}`, result.error);
        alert(`Error al eliminar: ${result.error}`);
      }
    }
  };

  const handleOpenModal = async (rowData = null) => {
    if (!selectedTable) return;
    const result = await window.electronAPI.dbGetTableColumns({
      connectionConfig: selectedConnection,
      table: selectedTable,
    });
    if (result.success) {
      setModalKey((prev) => prev + 1);
      setSelectedTableColumns(result.columns);
      setEditingRowData(rowData);
      setRowModalOpen(true);
    } else {
      alert(`Error al obtener columnas: ${result.error}`);
    }
  };

  const handleDeleteRow = async (row) => {
    if (window.confirm(`¿Estás seguro de que quieres eliminar esta fila?`)) {
      const result = await window.electronAPI.dbDeleteRow({
        connectionConfig: selectedConnection,
        table: selectedTable,
        row: row,
      });

      if (result.success) {
        handleSelectTable(null, selectedTable); // Refresh data
      } else {
        console.error(`Failed to delete row:`, result.error);
        alert(`Error al eliminar fila: ${result.error}`);
      }
    }
  };

  const handleSaveRow = async (rowData) => {
    const isEdit = editingRowData != null;
    const result = isEdit
      ? await window.electronAPI.dbUpdateRow({
          connectionConfig: selectedConnection,
          table: selectedTable,
          data: rowData,
          originalData: editingRowData,
        })
      : await window.electronAPI.dbInsertRow({
          connectionConfig: selectedConnection,
          table: selectedTable,
          data: rowData,
        });

    if (result.success) {
      setRowModalOpen(false);
      handleSelectTable(null, selectedTable);
    } else {
      alert(
        `Error al ${isEdit ? "actualizar" : "insertar"} fila: ${result.error}`,
      );
    }
  };

  const handleRunQuery = async () => {
    if (!selectedConnection || !sqlQuery) return;
    setIsQueryRunning(true);
    setQueryResult(null);
    setQueryError("");
    const result = await window.electronAPI.dbExecuteQuery({
      connectionConfig: selectedConnection,
      query: sqlQuery,
    });
    if (result.success) {
      setQueryResult(result.data);
    } else {
      setQueryError(result.error);
    }
    setIsQueryRunning(false);
  };

  const handleGenerateQuery = async () => {
    if (!selectedConnection || !aiPrompt) return;
    setIsAiLoading(true);
    setQueryError("");
    const result = await window.electronAPI.generateSQLQuery({
      connectionConfig: selectedConnection,
      prompt: aiPrompt,
      tables,
    });
    if (result.success) {
      setSqlQuery(result.query);
    } else {
      setQueryError(result.error);
    }
    setIsAiLoading(false);
  };

  const isSqlBasedConnection =
    selectedConnection &&
    ["postgres", "mariadb"].includes(selectedConnection.type);

  return (
    <div className="text-text flex-1 flex flex-col p-6 ">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Bases de Datos</h1>
        <button
          type="button"
          onClick={() => setAddConnectionModalOpen(true)}
          className="bg-accent hover:bg-accent-dark text-text font-bold py-2 px-4 rounded"
        >
          Nueva Conexión
        </button>
      </div>

      <div className="flex-1 flex border-t border-secondary overflow-y-hidden">
        <aside className="w-60 bg-sidebar p-4 border-r border-secondary flex flex-col ">
          <div className="flex justify-between items-center mb-2">
            <h2 className="font-bold">Conexiones</h2>
            {selectedConnection && (
              <button
                type="button"
                onClick={() => setCreateItemModalOpen(true)}
                className="text-text/80 hover:text-text"
              >
                <FaPlus />
              </button>
            )}
          </div>
          <ul className="flex-1 overflow-y-auto">
            {connections.map((conn, index) => (
              <li
                // biome-ignore lint/suspicious/noArrayIndexKey: fix
                key={index}
                onClick={() => handleSelectConnection(conn)}
                onKeyPress={(e) => {
                  if (e.key === "Enter") {
                    handleSelectConnection(conn);
                  }
                }}
                className={`p-2 rounded cursor-pointer ${selectedConnection?.name === conn.name ? "bg-active" : "hover:bg-active"}`}
              >
                <div className="group flex items-center justify-between">
                  <div className="flex items-center truncate">
                    <DBIcon type={conn.type} />
                    <span className="truncate font-semibold">{conn.name}</span>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => handleDeleteConnection(e, conn)}
                    className="ml-2 text-text/60 hover:text-text opacity-0 group-hover:opacity-100"
                  >
                    <FaTrash />
                  </button>
                </div>
                {selectedConnection?.name === conn.name &&
                  connectionStatus === "success" && (
                    <ul className="ml-6 mt-2 border-l-2 border-secondary">
                      {tables.map((table) => (
                        <li
                          key={table}
                          className={`group flex items-center justify-between p-1 pl-3 rounded text-sm ${selectedTable === table && activeTab === "browser" ? "bg-secondary" : "hover:bg-primary"}`}
                        >
                          <button
                            type="button"
                            onClick={(e) => handleSelectTable(e, table)}
                            className="truncate flex-1 cursor-pointer"
                          >
                            {table}
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleDeleteTable(e, table)}
                            className="ml-2 text-text/60 hover:text-text opacity-0 group-hover:opacity-100"
                          >
                            <FaTrash />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                {selectedConnection?.name === conn.name &&
                  connectionStatus === "connecting" && (
                    <p className="text-xs ml-6 mt-2 text-yellow-400">
                      Cargando...
                    </p>
                  )}
              </li>
            ))}
          </ul>
        </aside>

        <main className="flex-1 p-6 flex flex-col overflow-y-auto">
          {isSqlBasedConnection && (
            <div className="flex border-b border-secondary mb-4">
              <button
                type="button"
                onClick={() => setActiveTab("browser")}
                className={`py-2 px-4 ${activeTab === "browser" ? "border-b-2 border-accent text-text" : "text-text/80"}`}
              >
                Navegador
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("editor")}
                className={`py-2 px-4 ${activeTab === "editor" ? "border-b-2 border-accent text-text" : "text-text/80"}`}
              >
                Editor SQL
              </button>
            </div>
          )}

          {activeTab === "browser" && (
            <>
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-bold text-lg">
                  Datos:{" "}
                  {selectedTable && (
                    <span className="font-normal text-text/80">
                      ({selectedTable})
                    </span>
                  )}
                </h3>
                {selectedTable &&
                  ["postgres", "mariadb"].includes(
                    selectedConnection?.type,
                  ) && (
                    <button
                      type="button"
                      onClick={() => handleOpenModal()}
                      className="bg-accent hover:bg-accent-dark text-text font-bold py-1 px-3 rounded text-sm"
                    >
                      Insertar Fila
                    </button>
                  )}
              </div>
              {isDataLoading ? (
                <p>Cargando datos...</p>
              ) : tableData ? (
                <DataTable
                  data={tableData}
                  onRowDoubleClick={handleOpenModal}
                  onDeleteRow={handleDeleteRow}
                />
              ) : (
                <p className="text-text/80">
                  Selecciona una conexión y luego una tabla para ver los datos.
                </p>
              )}
            </>
          )}

          {activeTab === "editor" && isSqlBasedConnection && (
            <div className="flex flex-col h-full">
              <div className="relative">
                <AceEditor
                  mode="sql"
                  theme="tomorrow_night"
                  onChange={setSqlQuery}
                  value={sqlQuery}
                  name="sql-editor"
                  editorProps={{ $blockScrolling: true }}
                  width="100%"
                  height="200px"
                  className="border border-secondary rounded"
                />
                <button
                  type="button"
                  onClick={handleRunQuery}
                  disabled={isQueryRunning}
                  className="absolute top-2 right-2 bg-button hover:bg-blue-700 text-text font-bold py-1 px-3 rounded text-sm flex items-center"
                >
                  <FaPlay className="mr-2" />{" "}
                  {isQueryRunning ? "Ejecutando..." : "Ejecutar"}
                </button>
              </div>
              <div className="flex items-center mt-2">
                <div className="relative flex-grow">
                  <input
                    type="text"
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    placeholder="Pregúntale a la IA... (ej: 'mostrar todos los usuarios con más de 10 posts')"
                    className="bg-input text-text w-full py-2 pl-10 pr-20 rounded"
                  />
                  <FaRobot className="absolute left-3 top-1/2 transform -translate-y-1/2 text-text/80" />
                </div>
                <button
                  type="button"
                  onClick={handleGenerateQuery}
                  disabled={isAiLoading}
                  className="ml-2 bg-accent hover:bg-accent-dark text-text font-bold py-2 px-4 rounded"
                >
                  {isAiLoading ? "Generando..." : "Generar SQL"}
                </button>
              </div>
              <div className="flex-1 mt-4 flex flex-col overflow-hidden">
                <h3 className="font-bold text-lg mb-2">Resultados</h3>
                <div className="flex-1 overflow-y-auto">
                  {isQueryRunning ? (
                    <p>Cargando resultados...</p>
                  ) : queryError ? (
                    <div className="text-red-400 bg-accent-dark p-4 rounded">
                      <pre>{queryError}</pre>
                    </div>
                  ) : queryResult ? (
                    <DataTable data={queryResult} />
                  ) : (
                    <p className="text-text/80">
                      Los resultados de la consulta aparecerán aquí.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {!isSqlBasedConnection && activeTab === "editor" && (
            <p className="text-text/80">
              El editor SQL solo está disponible para conexiones SQL
              (PostgreSQL, MariaDB).
            </p>
          )}
        </main>
      </div>

      <AddConnectionModal
        isOpen={isAddConnectionModalOpen}
        onClose={() => setAddConnectionModalOpen(false)}
        onSave={handleSaveConnection}
      />
      {selectedConnection && (
        <CreateItemModal
          isOpen={isCreateItemModalOpen}
          onClose={() => setCreateItemModalOpen(false)}
          onSave={handleCreateItem}
          dbType={selectedConnection.type}
        />
      )}

      {isRowModalOpen && (
        <RowModal
          key={modalKey}
          isOpen={isRowModalOpen}
          onClose={() => setRowModalOpen(false)}
          onSave={handleSaveRow}
          columns={selectedTableColumns}
          tableName={selectedTable}
          initialData={editingRowData}
        />
      )}
    </div>
  );
};

export default Databases;
