const {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  shell,
  session,
} = require("electron");
const path = require("path");
const fsp = require("fs").promises;
const { spawn, exec, execSync } = require("child_process");
const hostile = require("hostile");
const Store = require("electron-store");
const fetch = require("node-fetch");
const extract = require("extract-zip");
const cheerio = require("cheerio");
const { Client } = require("pg");
const mysql = require("mysql2/promise");
const { MongoClient } = require("mongodb");
const redis = require("redis");
const knex = require("knex");

ipcMain.handle(
  "db:create-table",
  async (event, { connectionConfig, itemData }) => {
    const { type } = connectionConfig;
    const { name, key, value, sql } = itemData;

    if (type === "postgres") {
      const client = new Client(connectionConfig);
      try {
        await client.connect();
        await client.query(sql); // Execute the generated SQL
        await client.end();
        return { success: true };
      } catch (error) {
        return { success: false, error: error.message };
      }
    } else if (type === "mariadb") {
      let connection;
      try {
        connection = await mysql.createConnection(connectionConfig);
        await connection.query(sql); // Execute the generated SQL
        return { success: true };
      } catch (error) {
        return { success: false, error: error.message };
      } finally {
        if (connection) await connection.end();
      }
    } else if (type === "mongodb") {
      const { user, password, host, port, database } = connectionConfig;
      const url = `mongodb://${user && password ? `${user}:${password}@` : ""}${host}:${port}`;
      const client = new MongoClient(url, { serverSelectionTimeoutMS: 5000 });
      try {
        await client.connect();
        const db = client.db(database);
        await db.createCollection(name);
        return { success: true };
      } catch (error) {
        return { success: false, error: error.message };
      } finally {
        await client.close();
      }
    } else if (type === "redis") {
      const { host, port } = connectionConfig;
      const client = redis.createClient({ url: `redis://${host}:${port}` });
      try {
        await client.connect();
        await client.set(key, value);
        return { success: true };
      } catch (error) {
        return { success: false, error: error.message };
      } finally {
        if (client.isOpen) await client.disconnect();
      }
    }

    return { success: false, error: "Tipo de base de datos no soportado." };
  },
);

ipcMain.handle("db:delete-item", async (event, { connectionConfig, item }) => {
  const { type, database } = connectionConfig;

  if (type === "postgres") {
    const client = new Client(connectionConfig);
    try {
      await client.connect();
      await client.query(`DROP TABLE IF EXISTS "${item}"`);
      await client.end();
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  } else if (type === "mariadb") {
    let connection;
    try {
      connection = await mysql.createConnection(connectionConfig);
      await connection.query(`DROP TABLE IF EXISTS
${item}
`);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    } finally {
      if (connection) await connection.end();
    }
  } else if (type === "mongodb") {
    const { user, password, host, port } = connectionConfig;
    const url = `mongodb://${user && password ? `${user}:${password}@` : ""}${host}:${port}`;
    const client = new MongoClient(url, { serverSelectionTimeoutMS: 5000 });
    try {
      await client.connect();
      const db = client.db(database);
      const result = await db.collection(item).drop();
      return { success: result };
    } catch (error) {
      if (error.codeName === "NamespaceNotFound") {
        return { success: true };
      }
      return { success: false, error: error.message };
    } finally {
      await client.close();
    }
  } else if (type === "redis") {
    const { host, port } = connectionConfig;
    const client = redis.createClient({ url: `redis://${host}:${port}` });
    try {
      await client.connect();
      await client.del(item);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    } finally {
      if (client.isOpen) await client.disconnect();
    }
  }

  return { success: false, error: "Tipo de base de datos no soportado." };
});

async function getTableColumns({ connectionConfig, table }) {
  const { type } = connectionConfig;

  if (type === "postgres") {
    const client = new Client(connectionConfig);
    try {
      await client.connect();
      const res = await client.query(
        `SELECT
          c.column_name,
          c.data_type,
          c.is_nullable,
          tc.constraint_type
        FROM
          information_schema.columns AS c
        LEFT JOIN
          information_schema.key_column_usage AS kcu ON c.column_name = kcu.column_name AND c.table_schema = kcu.table_schema AND c.table_name = kcu.table_name
        LEFT JOIN
          information_schema.table_constraints AS tc ON kcu.constraint_name = tc.constraint_name AND kcu.table_schema = tc.table_schema AND kcu.table_name = tc.table_name AND tc.constraint_type = 'PRIMARY KEY'
        WHERE c.table_schema = 'public' AND c.table_name = $1`,
        [table],
      );
      await client.end();
      return {
        success: true,
        columns: res.rows.map((row) => ({
          name: row.column_name,
          type: row.data_type,
          isNullable: row.is_nullable === "YES",
          isPrimaryKey: row.constraint_type === "PRIMARY KEY",
        })),
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  } else if (type === "mariadb") {
    let connection;
    try {
      connection = await mysql.createConnection(connectionConfig);
      const [rows] = await connection.query(`DESCRIBE
        ${table}
      `);
      return {
        success: true,
        columns: rows.map((row) => ({
          name: row.Field,
          type: row.Type,
          isNullable: row.Null === "YES",
          isPrimaryKey: row.Key === "PRI",
        })),
      };
    } catch (error) {
      return { success: false, error: error.message };
    } finally {
      if (connection) await connection.end();
    }
  }

  // For non-SQL databases, this is not applicable in the same way.
  return { success: true, columns: [] };
}

ipcMain.handle("db:get-table-columns", async (event, args) => {
  return getTableColumns(args);
});

ipcMain.handle(
  "db:insert-row",
  async (event, { connectionConfig, table, data }) => {
    if (
      connectionConfig.type !== "postgres" &&
      connectionConfig.type !== "mariadb"
    ) {
      return {
        success: false,
        error:
          "La inserción de filas solo está soportada para bases de datos SQL.",
      };
    }

    const { type, name, ...dbConnectionConfig } = connectionConfig;

    const knexClient = knex({
      client: type === "postgres" ? "pg" : "mysql",
      connection: dbConnectionConfig,
    });

    try {
      const cleanData = {};
      for (const key in data) {
        if (data[key] !== "" && data[key] !== null && data[key] !== undefined) {
          cleanData[key] = data[key];
        }
      }

      await knexClient(table).insert(cleanData);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    } finally {
      await knexClient.destroy();
    }
  },
);

ipcMain.handle(
  "db:update-row",
  async (event, { connectionConfig, table, data, originalData }) => {
    // Force rebundle
    console.log("db:update-row called with:", {
      connectionConfig,
      table,
      data,
      originalData,
    });

    if (
      connectionConfig.type !== "postgres" &&
      connectionConfig.type !== "mariadb"
    ) {
      return {
        success: false,
        error:
          "La actualización de filas solo está soportada para bases de datos SQL.",
      };
    }

    const { type, name, ...dbConnectionConfig } = connectionConfig;

    const knexClient = knex({
      client: type === "postgres" ? "pg" : "mysql",
      connection: dbConnectionConfig,
    });

    try {
      console.log("Getting table columns...");
      const columnsResult = await getTableColumns({ connectionConfig, table });
      console.log("columnsResult:", columnsResult);

      if (!columnsResult.success) {
        throw new Error(
          "Could not retrieve table column info to determine primary key.",
        );
      }
      const primaryKeys = columnsResult.columns
        .filter((c) => c.isPrimaryKey)
        .map((c) => c.name);
      console.log("Primary keys:", primaryKeys);

      if (primaryKeys.length === 0) {
        throw new Error(
          "No primary key found for this table. Updates are not supported without a primary key.",
        );
      }

      const whereClause = {};
      primaryKeys.forEach((pk) => {
        whereClause[pk] = originalData[pk];
      });
      console.log("Where clause:", whereClause);

      const updateResult = await knexClient(table)
        .where(whereClause)
        .update(data);
      console.log("Update result:", updateResult);

      return { success: true };
    } catch (error) {
      console.error("Error in db:update-row:", error);
      return { success: false, error: error.message };
    } finally {
      await knexClient.destroy();
    }
  },
);

ipcMain.handle(
  "db:delete-row",
  async (event, { connectionConfig, table, row }) => {
    if (
      connectionConfig.type !== "postgres" &&
      connectionConfig.type !== "mariadb"
    ) {
      return {
        success: false,
        error:
          "La eliminación de filas solo está soportada para bases de datos SQL.",
      };
    }

    const { type, name, ...dbConnectionConfig } = connectionConfig;

    const knexClient = knex({
      client: type === "postgres" ? "pg" : "mysql",
      connection: dbConnectionConfig,
    });

    try {
      const columnsResult = await getTableColumns({ connectionConfig, table });

      if (!columnsResult.success) {
        throw new Error(
          "No se pudo obtener la información de las columnas de la tabla para determinar la clave primaria.",
        );
      }
      const primaryKeys = columnsResult.columns
        .filter((c) => c.isPrimaryKey)
        .map((c) => c.name);

      if (primaryKeys.length === 0) {
        // As a fallback, assume the first column is the primary key.
        // This is not ideal, but it's better than nothing.
        primaryKeys.push(columnsResult.columns[0].name);
      }

      const whereClause = {};
      primaryKeys.forEach((pk) => {
        whereClause[pk] = row[pk];
      });

      await knexClient(table).where(whereClause).del();

      return { success: true };
    } catch (error) {
      console.error("Error in db:delete-row:", error);
      return { success: false, error: error.message };
    } finally {
      await knexClient.destroy();
    }
  },
);

const store = new Store({
  defaults: {
    sitesPath: path.join(app.getPath("documents"), "hid-sites"),
    phpVersion: "8.4.12",
  },
});

let phpProcesses = new Map();
let serviceProcesses = new Map();
let nginxProcess;
let servicesRunning = false;
const siteToPort = new Map();
let reverbProcesses = new Map();
let adminerProcess;
let dbgateProcess;

let mainWindow;

function broadcastServicesStatus() {
  if (mainWindow) {
    mainWindow.webContents.send("services-status-changed", servicesRunning);
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    show: false, // Ocultar la ventana inicialmente
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Mostrar la ventana solo cuando el contenido esté listo para evitar la pantalla blanca
  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  if (process.env.NODE_ENV === "development") {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }
  mainWindow.webContents.openDevTools();

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  console.log("Node.js version:", process.version);
}

ipcMain.handle("get-setting", (event, key) => store.get(key));
ipcMain.handle("set-setting", (event, key, value) => store.set(key, value));

ipcMain.handle("get-site-setting", (event, siteName, key) =>
  store.get(`siteSettings.${siteName}.${key}`),
);
ipcMain.handle("set-site-setting", (event, siteName, key, value) =>
  store.set(`siteSettings.${siteName}.${key}`, value),
);

// Database Management Handlers
ipcMain.handle("db:get-connections", (event) => {
  return store.get("databaseConnections", []);
});

ipcMain.handle("db:save-connections", (event, connections) => {
  store.set("databaseConnections", connections);
  return { success: true };
});

ipcMain.handle("db:test-connection", async (event, connectionConfig) => {
  const { type, user, password, host, port, database } = connectionConfig;

  if (type === "postgres") {
    const client = new Client({
      ...connectionConfig,
      connectionTimeoutMillis: 5000,
    });
    try {
      await client.connect();
      await client.end();
      return { success: true, message: "Conexión exitosa." };
    } catch (error) {
      return { success: false, error: error.message };
    }
  } else if (type === "mariadb") {
    let connection;
    try {
      connection = await mysql.createConnection({
        ...connectionConfig,
        connectTimeout: 5000,
      });
      return { success: true, message: "Conexión exitosa." };
    } catch (error) {
      return { success: false, error: error.message };
    } finally {
      if (connection) await connection.end();
    }
  } else if (type === "mongodb") {
    const url = `mongodb://${user && password ? `${user}:${password}@` : ""}${host}:${port}`;
    const client = new MongoClient(url, { serverSelectionTimeoutMS: 5000 });
    try {
      await client.connect();
      return { success: true, message: "Conexión exitosa." };
    } catch (error) {
      return { success: false, error: error.message };
    } finally {
      await client.close();
    }
  } else if (type === "redis") {
    const client = redis.createClient({ url: `redis://${host}:${port}` });
    try {
      await client.connect();
      await client.ping();
      return { success: true, message: "Conexión exitosa." };
    } catch (error) {
      return { success: false, error: error.message };
    } finally {
      if (client.isOpen) await client.disconnect();
    }
  }
  return { success: false, error: "Tipo de base de datos no soportado." };
});

ipcMain.handle("db:get-tables", async (event, connectionConfig) => {
  const { type, user, password, host, port, database } = connectionConfig;

  if (type === "postgres") {
    const client = new Client(connectionConfig);
    try {
      await client.connect();
      const res = await client.query(
        `SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname != 'pg_catalog' AND schemaname != 'information_schema'`,
      );
      await client.end();
      return { success: true, tables: res.rows.map((row) => row.tablename) };
    } catch (error) {
      return { success: false, error: error.message };
    }
  } else if (type === "mariadb") {
    let connection;
    try {
      connection = await mysql.createConnection(connectionConfig);
      const [rows] = await connection.query("SHOW TABLES");
      const key = Object.keys(rows[0])[0];
      return { success: true, tables: rows.map((row) => row[key]) };
    } catch (error) {
      return { success: false, error: error.message };
    } finally {
      if (connection) await connection.end();
    }
  } else if (type === "mongodb") {
    const url = `mongodb://${user && password ? `${user}:${password}@` : ""}${host}:${port}`;
    const client = new MongoClient(url, { serverSelectionTimeoutMS: 5000 });
    try {
      await client.connect();
      const db = client.db(database);
      const collections = await db.listCollections().toArray();
      return { success: true, tables: collections.map((c) => c.name) };
    } catch (error) {
      return { success: false, error: error.message };
    } finally {
      await client.close();
    }
  } else if (type === "redis") {
    const client = redis.createClient({ url: `redis://${host}:${port}` });
    try {
      await client.connect();
      const keys = await client.keys("*");
      return { success: true, tables: keys.slice(0, 100) }; // Limit to 100 keys
    } catch (error) {
      return { success: false, error: error.message };
    } finally {
      if (client.isOpen) await client.disconnect();
    }
  }
  return { success: false, error: "Tipo de base de datos no soportado." };
});

ipcMain.handle(
  "db:get-table-data",
  async (event, { connectionConfig, table }) => {
    const { type, user, password, host, port, database } = connectionConfig;

    if (type === "postgres") {
      const client = new Client(connectionConfig);
      try {
        await client.connect();
        const res = await client.query(`SELECT * FROM "${table}" LIMIT 100`);
        await client.end();
        return { success: true, data: res.rows };
      } catch (error) {
        return { success: false, error: error.message };
      }
    } else if (type === "mariadb") {
      let connection;
      try {
        connection = await mysql.createConnection(connectionConfig);
        const [rows] = await connection.query(`SELECT * FROM
${table}
 LIMIT 100`);
        return { success: true, data: rows };
      } catch (error) {
        return { success: false, error: error.message };
      } finally {
        if (connection) await connection.end();
      }
    } else if (type === "mongodb") {
      const url = `mongodb://${user && password ? `${user}:${password}@` : ""}${host}:${port}`;
      const client = new MongoClient(url, { serverSelectionTimeoutMS: 5000 });
      try {
        await client.connect();
        const db = client.db(database);
        const data = await db.collection(table).find().limit(100).toArray();
        return { success: true, data };
      } catch (error) {
        return { success: false, error: error.message };
      } finally {
        await client.close();
      }
    } else if (type === "redis") {
      const client = redis.createClient({ url: `redis://${host}:${port}` });
      try {
        await client.connect();
        const type = await client.type(table);
        let data;
        switch (type) {
          case "string":
            data = await client.get(table);
            break;
          case "hash":
            data = await client.hGetAll(table);
            break;
          case "list":
            data = await client.lRange(table, 0, 99);
            break;
          default:
            data = `Tipo de clave '${type}' no soportado para visualización.`;
        }
        return { success: true, data, type };
      } catch (error) {
        return { success: false, error: error.message };
      } finally {
        if (client.isOpen) await client.disconnect();
      }
    }

    return { success: false, error: "Tipo de base de datos no soportado." };
  },
);

ipcMain.handle(
  "db:execute-query",
  async (event, { connectionConfig, query }) => {
    const { type } = connectionConfig;
    if (type === "postgres") {
      const client = new Client(connectionConfig);
      try {
        await client.connect();
        const res = await client.query(query);
        await client.end();
        // res can be an array of results for multi-statement queries
        const finalResult = Array.isArray(res) ? res[res.length - 1] : res;
        return { success: true, data: finalResult.rows };
      } catch (error) {
        return { success: false, error: error.message };
      }
    } else if (type === "mariadb") {
      let connection;
      try {
        connection = await mysql.createConnection(connectionConfig);
        const [rows] = await connection.query(query);
        return { success: true, data: rows };
      } catch (error) {
        return { success: false, error: error.message };
      } finally {
        if (connection) await connection.end();
      }
    }
    return {
      success: false,
      error: "Query execution is only supported for SQL databases.",
    };
  },
);

ipcMain.handle(
  "generateSQLQuery",
  async (event, { connectionConfig, prompt, tables }) => {
    console.log("[AI] Received request to generate SQL query.");
    const apiKey = store.get("googleAiApiKey");
    if (!apiKey) {
      console.error("[AI] Google AI API Key not found.");
      return {
        success: false,
        error:
          "Google AI API Key no encontrada. Por favor, configúrala en los ajustes.",
      };
    }
    console.log("[AI] API Key found.");

    try {
      console.log("[AI] Fetching table schemas...");
      let schemaPrompt = "";
      for (const table of tables) {
        const columnsResult = await getTableColumns({
          connectionConfig,
          table,
        });
        if (columnsResult.success && columnsResult.columns.length > 0) {
          schemaPrompt += `
CREATE TABLE ${table} (
`;
          columnsResult.columns.forEach((col) => {
            schemaPrompt += `  ${col.name} ${col.type}${col.isPrimaryKey ? " PRIMARY KEY" : ""},
`;
          });
          schemaPrompt = schemaPrompt.slice(0, -2); // Remove last comma and newline
          schemaPrompt += "\n);\n";
        }
      }
      console.log("[AI] Schema prompt generated:", schemaPrompt);

      const dialect =
        connectionConfig.type === "postgres" ? "PostgreSQL" : "MariaDB";
      const fullPrompt = `
      Basado en el siguiente esquema de base de datos ${dialect} y la petición del usuario, genera una única consulta SQL.
      Responde únicamente con el código SQL, sin explicaciones adicionales.

      Esquema:
      ${schemaPrompt}

      Petición del usuario: "${prompt}"
    `;

      console.log("[AI] Sending prompt to Google AI...");
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: fullPrompt }] }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 2048,
          },
        }),
      });

      console.log(
        "[AI] Received response from Google AI. Status:",
        response.status,
      );

      if (!response.ok) {
        const errorBody = await response.json();
        console.error("[AI] Google AI API Error:", errorBody);
        return {
          success: false,
          error: `Error de la API de Google AI: ${errorBody.error?.message || "Unknown error"}`,
        };
      }

      const body = await response.json();
      console.log(
        "[AI] Google AI response body:",
        JSON.stringify(body, null, 2),
      );

      const generatedText = body.candidates[0]?.content?.parts[0]?.text || "";

      // Clean the response to get only the SQL
      const sqlQuery = generatedText
        .replace(/\n/g, " ")
        .replace(/```/g, "")
        .replace(/^sql/, "")
        .trim();
      console.log("[AI] Generated SQL query:", sqlQuery);

      return { success: true, query: sqlQuery };
    } catch (error) {
      console.error("[AI] Error generating SQL query:", error);
      return { success: false, error: error.message };
    }
  },
);

ipcMain.handle("get-services", (event) => store.get("services", {}));
ipcMain.handle("set-services", (event, services) =>
  store.set("services", services),
);

ipcMain.handle("check-service-installed", (event, serviceName) => {
  return new Promise((resolve) => {
    exec(`winget list --name "${serviceName}"`, (error, stdout, stderr) => {
      if (error) {
        // winget exits with non-zero code if package is not found
        if (
          stdout.includes(
            "No se encontró ningún paquete que coincida con los criterios de entrada",
          ) ||
          stdout.includes("No installed package found matching input criteria")
        ) {
          resolve(false);
        } else {
          console.error(`Error checking winget for ${serviceName}:`, stderr);
          resolve(false); // Assume not installed on error
        }
        return;
      }
      // Check if stdout contains the service name, indicating it's installed
      resolve(stdout.toLowerCase().includes(serviceName.toLowerCase()));
    });
  });
});

ipcMain.handle("start-service", (event, category, serviceName) => {
  const serviceKey = `${category}-${serviceName}`;

  if (serviceName.toLowerCase().includes("postgresql")) {
    return new Promise((resolve) => {
      exec("net start postgresql-x64-16", (error, stdout, stderr) => {
        if (error) {
          console.error(`[${serviceName} exec error]: ${error.message}`);
        }
        if (stderr) {
          console.error(`[${serviceName} stderr]: ${stderr}`);
        }
        resolve({
          success: true,
          message: `Service ${serviceName} start command issued.`,
        });
      });
    });
  } else if (serviceName.toLowerCase().includes("mariadb")) {
    return new Promise((resolve) => {
      exec("net start MySQL", (error, stdout, stderr) => {
        if (error) {
          console.error(`[${serviceName} exec error]: ${error.message}`);
        }
        if (stderr) {
          console.error(`[${serviceName} stderr]: ${stderr}`);
        }
        resolve({
          success: true,
          message: `Service ${serviceName} start command issued.`,
        });
      });
    });
  } else if (serviceName.toLowerCase().includes("mongodb")) {
    return new Promise((resolve) => {
      exec("net start MongoDB", (error, stdout, stderr) => {
        if (error) {
          console.error(`[${serviceName} exec error]: ${error.message}`);
        }
        if (stderr) {
          console.error(`[${serviceName} stderr]: ${stderr}`);
        }
        resolve({
          success: true,
          message: `Service ${serviceName} start command issued.`,
        });
      });
    });
  } else if (serviceName.toLowerCase().includes("redis")) {
    return new Promise((resolve) => {
      exec("net start memurai", (error, stdout, stderr) => {
        if (error) {
          console.error(`[${serviceName} exec error]: ${error.message}`);
        }
        if (stderr) {
          console.error(`[${serviceName} stderr]: ${stderr}`);
        }
        resolve({
          success: true,
          message: `Service ${serviceName} start command issued.`,
        });
      });
    });
  } else {
    // Fallback to placeholder for other services
    if (serviceProcesses.has(serviceKey)) {
      return { success: false, message: "Service is already running." };
    }
    console.log(
      `Main process: Starting service ${serviceName} in category ${category}`,
    );
    const child = spawn("powershell.exe", [
      "-NoExit",
      "-Command",
      `Write-Host 'Placeholder service ${serviceName} running...'`,
    ]);
    serviceProcesses.set(serviceKey, child);

    child.stdout.on("data", (data) => {
      console.log(`[${serviceName} stdout]: ${data.toString()}`);
    });

    child.stderr.on("data", (data) => {
      console.error(`[${serviceName} stderr]: ${data.toString()}`);
    });

    child.on("close", (code) => {
      console.log(`Service ${serviceName} exited with code ${code}`);
      serviceProcesses.delete(serviceKey);
    });

    child.on("error", (err) => {
      console.error(`Failed to start service ${serviceName}:`, err);
      serviceProcesses.delete(serviceKey);
    });

    return { success: true, message: `Service ${serviceName} started.` };
  }
});

ipcMain.handle("stop-service", (event, category, serviceName) => {
  const serviceKey = `${category}-${serviceName}`;

  if (serviceName.toLowerCase().includes("postgresql")) {
    return new Promise((resolve) => {
      exec("net stop postgresql-x64-16", (error, stdout, stderr) => {
        if (error) {
          console.error(`[${serviceName} exec error]: ${error.message}`);
        }
        if (stderr) {
          console.error(`[${serviceName} stderr]: ${stderr}`);
        }
        resolve({
          success: true,
          message: `Service ${serviceName} stop command issued.`,
        });
      });
    });
  } else if (serviceName.toLowerCase().includes("mariadb")) {
    return new Promise((resolve) => {
      exec("net stop MySQL", (error, stdout, stderr) => {
        if (error) {
          console.error(`[${serviceName} exec error]: ${error.message}`);
        }
        if (stderr) {
          console.error(`[${serviceName} stderr]: ${stderr}`);
        }
        resolve({
          success: true,
          message: `Service ${serviceName} stop command issued.`,
        });
      });
    });
  } else if (serviceName.toLowerCase().includes("mongodb")) {
    return new Promise((resolve) => {
      exec("net stop MongoDB", (error, stdout, stderr) => {
        if (error) {
          console.error(`[${serviceName} exec error]: ${error.message}`);
        }
        if (stderr) {
          console.error(`[${serviceName} stderr]: ${stderr}`);
        }
        resolve({
          success: true,
          message: `Service ${serviceName} stop command issued.`,
        });
      });
    });
  } else if (serviceName.toLowerCase().includes("redis")) {
    return new Promise((resolve) => {
      exec("net stop memurai", (error, stdout, stderr) => {
        if (error) {
          console.error(`[${serviceName} exec error]: ${error.message}`);
        }
        if (stderr) {
          console.error(`[${serviceName} stderr]: ${stderr}`);
        }
        resolve({
          success: true,
          message: `Service ${serviceName} stop command issued.`,
        });
      });
    });
  } else {
    // Fallback to placeholder
    if (!serviceProcesses.has(serviceKey)) {
      return { success: false, message: "Service is not running." };
    }
    console.log(
      `Main process: Stopping service ${serviceName} in category ${category}`,
    );
    const child = serviceProcesses.get(serviceKey);
    child.kill();
    return { success: true, message: `Service ${serviceName} stopped.` };
  }
});

ipcMain.handle("delete-service", (event, category, serviceName) => {
  console.log(
    `Main process: Deleting service ${serviceName} in category ${category}`,
  );

  // First, stop the service if it's running
  // (Add your logic here to stop the service process)
  console.log(`Stopping service ${serviceName}...`);
  // Placeholder for actual service stop logic

  // Then, remove it from the store
  const services = store.get("services", {});
  if (services[category]) {
    const serviceIndex = services[category].findIndex(
      (s) => s.name === serviceName,
    );
    if (serviceIndex > -1) {
      services[category].splice(serviceIndex, 1);
      if (services[category].length === 0) {
        delete services[category];
      }
      store.set("services", services);
      return { success: true, message: `Service ${serviceName} deleted.` };
    }
  }

  return { success: false, message: `Service ${serviceName} not found.` };
});

ipcMain.handle("service:add", async (event, service) => {
  const { name, category } = service;
  const servicesPath = path.join(app.getPath("userData"), "services");
  const servicePath = path.join(servicesPath, category, name);

  try {
    // 1. Check if service is installed
    if (
      await fsp
        .access(servicePath)
        .then(() => true)
        .catch(() => false)
    ) {
      // Service is already installed, just add it to the store
      const services = store.get("services", {});
      if (!services[category]) {
        services[category] = [];
      }
      services[category].push(service);
      store.set("services", services);
      return { success: true, service };
    }

    // 2. Install the service
    await fsp.mkdir(servicePath, { recursive: true });

    let installCommand;
    if (name.toLowerCase().includes("postgresql")) {
      installCommand = `winget install PostgreSQL.PostgreSQL.16 --silent --location "${servicePath}" --override "--disable-components pgadmin4 --superpassword postgres --servicepassword postgres" --accept-source-agreements --accept-package-agreements`;
    } else if (name.toLowerCase().includes("mariadb")) {
      installCommand = `winget install MariaDB.Server --silent --override "/qn REMOVE=HeidiSQL" --accept-source-agreements --accept-package-agreements`;
    } else if (name.toLowerCase().includes("mongodb")) {
      installCommand = `winget install MongoDB.Server --silent --override "/qb SHOULD_INSTALL_COMPASS=\"0\" ADDLOCAL=\"ServerService\"" --accept-source-agreements --accept-package-agreements`;
    } else if (name.toLowerCase().includes("redis")) {
      installCommand = `winget install Memurai.MemuraiDeveloper --silent --override "/quiet" --accept-source-agreements --accept-package-agreements`;
    } else {
      // Placeholder for other services
      return {
        success: false,
        error: "Service not supported for automatic installation yet.",
      };
    }

    const child = spawn(installCommand, { shell: true });

    child.stdout.on("data", (data) => {
      mainWindow.webContents.send("service:install-log", data.toString());
    });

    child.stderr.on("data", (data) => {
      mainWindow.webContents.send("service:install-log", data.toString());
    });

    return new Promise((resolve) => {
      child.on("close", (code) => {
        if (code === 0) {
          // 3. Add to store after successful installation
          const services = store.get("services", {});
          if (!services[category]) {
            services[category] = [];
          }
          services[category].push(service);
          store.set("services", services);
          resolve({ success: true, service });
        } else {
          resolve({
            success: false,
            error: `Installation failed with code ${code}`,
          });
        }
      });
    });
  } catch (error) {
    console.error(`Failed to add service ${name}:`, error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle("select-directory", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openDirectory"],
  });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle("open-directory", (event, path) => {
  shell.openPath(path);
});

ipcMain.handle("open-adminer", () => {
  adminer.hid.clone
});

ipcMain.handle("open-dbgate", () => {
  const resourcesPath =
    process.env.NODE_ENV === "development"
      ? app.getAppPath()
      : process.resourcesPath;
  const dbgatePath = path.join(resourcesPath, "bin", "dbgate");
  const dbgateProcess = spawn("yarn.cmd", ["start"], { cwd: dbgatePath });

  let dbgateWindow = new BrowserWindow({
    width: 1024,
    height: 768,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // It might take a moment for the web server to start
  setTimeout(() => {
    if (dbgateWindow) {
      dbgateWindow.loadURL("http://localhost:5001");
    }
  }, 5000); // 5 second delay

  dbgateWindow.on("closed", () => {
    if (dbgateProcess && dbgateProcess.pid) {
      execSync(`taskkill /pid ${dbgateProcess.pid} /t /f`);
    }
    dbgateWindow = null;
  });
});

ipcMain.handle("open-external-link", async (event, url) => {
  await shell.openExternal(url);
});

ipcMain.handle(
  "copy-template",
  async (event, { templateName, targetLocation, projectName }) => {
    const resourcesPath =
      process.env.NODE_ENV === "development"
        ? app.getAppPath()
        : process.resourcesPath;
    const sourceDir = path.join(
      resourcesPath,
      "bin",
      "templates",
      `template-${templateName}`,
    );
    const destDir = path.join(targetLocation, projectName);

    try {
      await fsp.cp(sourceDir, destDir, { recursive: true });
      return { success: true };
    } catch (error) {
      console.error(`Failed to copy template: ${error.message}`);
      return { success: false, error: error.message };
    }
  },
);

async function buildFrontendAssets(sitePath, siteName) {
  const packageJsonPath = path.join(sitePath, "package.json");
  if (
    !(await fsp
      .access(packageJsonPath)
      .then(() => true)
      .catch(() => false))
  ) {
    return;
  }

  const nodeModulesPath = path.join(sitePath, "node_modules");
  const publicBuildPath = path.join(sitePath, "public", "build");

  let packageManager = "npm";
  const yarnLockPath = path.join(sitePath, "yarn.lock");
  if (
    await fsp
      .access(yarnLockPath)
      .then(() => true)
      .catch(() => false)
  ) {
    packageManager = "yarn";
  }

  try {
    if (
      !(await fsp
        .access(nodeModulesPath)
        .then(() => true)
        .catch(() => false))
    ) {
      await new Promise((resolve, reject) => {
        const installCommand =
          packageManager === "yarn" ? "yarn install" : "npm install";
        exec(installCommand, { cwd: sitePath }, (error, stdout, stderr) => {
          if (stderr)
            console.error(`Frontend install stderr (${siteName}): ${stderr}`);
          if (error) {
            console.error(
              `Frontend install error (${siteName}): ${error.message}`,
            );
            // sendErrorToWindow(`Frontend install error (${siteName}): ${error.message}`);
            reject(error);
          } else {
            resolve();
          }
        });
      });
    } else {
    }

    if (
      !(await fsp
        .access(publicBuildPath)
        .then(() => true)
        .catch(() => false))
    ) {
      await new Promise((resolve, reject) => {
        const buildCommand =
          packageManager === "yarn" ? "yarn build" : "npm run build";
        exec(buildCommand, { cwd: sitePath }, (error, stdout, stderr) => {
          if (stderr)
            console.error(`Frontend build stderr (${siteName}): ${stderr}`);
          if (error) {
            console.error(
              `Frontend build error (${siteName}): ${error.message}`,
            );
            // sendErrorToWindow(`Frontend build error (${siteName}): ${error.message}`);
            reject(error);
          } else {
            resolve();
          }
        });
      });
    } else {
    }
  } catch (error) {
    console.error(`Error during frontend build for site ${siteName}:`, error);
    // sendErrorToWindow(`Error during frontend build for site ${siteName}: ${error.message}`);
  }
}

async function startSite(site) {
  const sitesPath = store.get("sitesPath");
  const resourcesPath =
    process.env.NODE_ENV === "development"
      ? app.getAppPath()
      : process.resourcesPath;

  const port = siteToPort.get(site.url);
  if (!port) {
    console.error(`Port not found for site ${site.name}`);
    return;
  }

  await new Promise((resolve) => {
    hostile.set("127.0.0.1", site.url, (err) => {
      if (err) {
        console.error(`Error setting domain ${site.url} in hosts file:`, err);
        // Not rejecting, as the user might need to run as admin
      }
      resolve();
    });
  });

  const sitePath = path.join(sitesPath, site.name);
  const phpVersion = store.get("phpVersion");
  const sitePhpPath = path.join(
    resourcesPath,
    "bin",
    `php-${phpVersion}`,
    "php.exe",
  );
  const phpIniPath = path.join(path.dirname(sitePhpPath), "php.ini");

  if (
    !(await fsp
      .access(sitePhpPath)
      .then(() => true)
      .catch(() => false))
  ) {
    console.error("PHP executable not found:", sitePhpPath);
    // sendErrorToWindow('PHP executable not found in the application resources.');
    return;
  }

  let documentRoot = sitePath;
  const publicPath = path.join(sitePath, "public");
  if (
    await fsp
      .access(path.join(publicPath, "index.php"))
      .then(() => true)
      .catch(() => false)
  ) {
    documentRoot = publicPath;
  }

  // Build frontend assets
  // await buildFrontendAssets(sitePath, site.name);

  const envPath = path.join(sitePath, ".env");
  if (
    await fsp
      .access(envPath)
      .then(() => true)
      .catch(() => false)
  ) {
    let envContent = await fsp.readFile(envPath, "utf-8");
    envContent = envContent.replace(
      /APP_URL=.*/g,
      `APP_URL=http://${site.url}`,
    );
    envContent += "\nVITE_ASSET_URL=/";
    await fsp.writeFile(envPath, envContent);
  }

  const phpServer = spawn(sitePhpPath, [
    "-c",
    phpIniPath,
    "-S",
    `127.0.0.1:${port}`,
    "-t",
    documentRoot,
  ]);

  phpServer.stdout.on("data", (data) => {});

  let stderrBuffer = "";
  phpServer.stderr.on("data", (data) => {
    stderrBuffer += data.toString();
    const lines = stderrBuffer.split(/\r?\n/);
    stderrBuffer = lines.pop() || ""; // Keep the last partial line in buffer

    lines.forEach((line) => {
      if (line.trim() === "") return;
      // PHP's built-in server logs everything to stderr. We'll filter out access logs.
      if (/(\ \[\\\d{3}\])|Accepted|Closing|Development Server/.test(line)) {
        console.log(`PHP server log (${site.name}): ${line.trim()}`);
      } else {
        console.error(`PHP server error (${site.name}): ${line.trim()}`);
        // sendErrorToWindow(`PHP server error (${site.name}): ${line.trim()}`);
      }
    });
  });

  phpServer.on("close", (code) => {
    if (code !== 0 && code !== null) {
      // sendErrorToWindow(`PHP server for ${site.name} exited with non-zero code: ${code}`);
    }
  });

  phpServer.on("error", (err) => {
    console.error(`PHP server error for site ${site.name}:`, err);
    if (err.code === "ENOENT") {
      // sendErrorToWindow(`PHP executable not found for site ${site.name} at '${sitePhpPath}'. Please check settings.`);
    } else {
      // sendErrorToWindow(`An error occurred with a PHP server for site ${site.name}: ${err.message}`);
    }
  });

  phpProcesses.set(site.name, phpServer);
}

function stopSite(site) {
  return new Promise((resolve) => {
    const cleanup = () => {
      hostile.remove("127.0.0.1", site.url, (err) => {
        if (err) {
          /* Ignore errors, e.g., if entry doesn't exist */
        }
        resolve();
      });
    };

    if (phpProcesses.has(site.name)) {
      const phpServer = phpProcesses.get(site.name);
      phpServer.on("close", () => {
        phpProcesses.delete(site.name);
        cleanup();
      });
      phpServer.kill();
    } else {
      cleanup();
    }
  });
}

ipcMain.handle("get-available-php-versions", async () => {
  const resourcesPath =
    process.env.NODE_ENV === "development"
      ? app.getAppPath()
      : process.resourcesPath;
  const binPath = path.join(resourcesPath, "bin");
  try {
    const files = await fsp.readdir(binPath);
    const phpVersions = [];
    for (const file of files) {
      if (file.startsWith("php-")) {
        const stat = await fsp.stat(path.join(binPath, file));
        if (stat.isDirectory()) {
          phpVersions.push(file.replace("php-", ""));
        }
      }
    }
    return phpVersions;
  } catch (error) {
    console.error("Error reading PHP versions:", error);
    // sendErrorToWindow('Could not read available PHP versions.');
    return [];
  }
});

ipcMain.handle("run-shell-command", (event, command, options) => {
  return new Promise((resolve, reject) => {
    exec(command, options, (error, stdout, stderr) => {
      resolve({
        error,
        stdout,
        stderr,
        exitCode: error ? error.code : 0,
      });
    });
  });
});

ipcMain.handle("sites:capturePage", async (event, url) => {
  let win;
  try {
    win = new BrowserWindow({
      show: false,
      width: 1280, // Standard width for capture
      height: 720, // Initial height
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      },
    });

    const pageLoadedPromise = new Promise((resolve, reject) => {
      win.webContents.on("did-finish-load", () => {
        win.webContents
          .executeJavaScript(
            "({width: document.body.scrollWidth, height: document.body.scrollHeight})",
          )
          .then((size) => {
            if (size.height > 0 && size.width > 0) {
              win.setSize(size.width, size.height);
              setTimeout(resolve, 2000); // Increased delay for rendering
            } else {
              resolve();
            }
          })
          .catch((err) => {
            console.error("Error getting page size:", err);
            resolve();
          });
      });
      win.webContents.on(
        "did-fail-load",
        (event, errorCode, errorDescription) => {
          reject(new Error(errorDescription));
        },
      );
    });

    const navigationPromise = win.loadURL(url);
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Page load timed out")), 20000),
    );

    await Promise.race([
      Promise.all([navigationPromise, pageLoadedPromise]),
      timeoutPromise,
    ]);

    const image = await win.webContents.capturePage();
    win.close();
    return image.toDataURL();
  } catch (error) {
    console.error(`Failed to capture page for ${url}:`, error);
    if (win && !win.isDestroyed()) {
      win.close();
    }
    return null;
  }
});

ipcMain.handle("set-php-version", (event, version) => {
  store.set("phpVersion", version);
});

ipcMain.handle("fetch-php-versions", async () => {
  try {
    const response = await fetch("https://windows.php.net/download/");
    const html = await response.text();
    const $ = cheerio.load(html);
    const versions = [];
    $(".innerbox").each((i, innerbox) => {
      const h4 = $(innerbox).find("h4").text();
      const isNTS = h4.includes("Non Thread Safe");
      const isX64 = h4.includes("x64");

      if (isNTS && isX64) {
        const link = $(innerbox).find('a:contains("Zip")');
        const href = link.attr("href");
        if (href) {
          const versionMatch = href.match(/php-(\d+\.\d+\.\d+)-/);
          if (versionMatch && !versions.includes(versionMatch[1])) {
            versions.push(versionMatch[1]);
          }
        }
      }
    });
    return { success: true, versions };
  } catch (error) {
    console.error("Failed to fetch PHP versions:", error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle("download-php-version", async (event, version) => {
  const phpDownloadUrl = `https://windows.php.net/downloads/releases/php-${version}-nts-Win32-vs16-x64.zip`;
  const resourcesPath =
    process.env.NODE_ENV === "development"
      ? app.getAppPath()
      : process.resourcesPath;
  const binPath = path.join(resourcesPath, "bin");
  const tempPath = path.join(app.getPath("temp"), `php-${version}.zip`);
  const extractionPath = path.join(binPath, `php-${version}`);

  try {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("php-download-status", {
        version,
        status: "downloading",
      });
    }

    const response = await fetch(phpDownloadUrl);
    if (!response.ok) {
      throw new Error(
        `Failed to download PHP ${version}: ${response.statusText}`,
      );
    }
    const fileStream = require("fs").createWriteStream(tempPath);
    await new Promise((resolve, reject) => {
      response.body.pipe(fileStream);
      response.body.on("error", reject);
      fileStream.on("finish", resolve);
    });

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("php-download-status", {
        version,
        status: "extracting",
      });
    }

    await extract(tempPath, { dir: extractionPath });

    // Copy php.ini from the currently active version
    const activeVersion = store.get("phpVersion");
    const sourceIni = path.join(binPath, `php-${activeVersion}`, "php.ini");
    const destIni = path.join(extractionPath, "php.ini");
    await fsp.copyFile(sourceIni, destIni);

    await fsp.unlink(tempPath);

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("php-download-status", {
        version,
        status: "complete",
      });
    }

    return { success: true };
  } catch (error) {
    console.error(`Failed to download PHP ${version}:`, error);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("php-download-status", {
        version,
        status: "error",
        error: error.message,
      });
    }
    return { success: false, error: error.message };
  }
});

ipcMain.handle("delete-php-version", async (event, version) => {
  try {
    const resourcesPath =
      process.env.NODE_ENV === "development"
        ? app.getAppPath()
        : process.resourcesPath;
    const versionPath = path.join(resourcesPath, "bin", `php-${version}`);

    // Basic check to prevent deleting outside the bin directory
    if (!versionPath.startsWith(path.join(resourcesPath, "bin"))) {
      throw new Error("Invalid version path for deletion.");
    }

    await fsp.rm(versionPath, { recursive: true, force: true });
    return { success: true };
  } catch (error) {
    console.error(`Failed to delete PHP version ${version}:`, error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle("get-site-project-type", async (event, sitePath) => {
  try {
    const packageJsonPath = path.join(sitePath, "package.json");
    if (
      !(await fsp
        .access(packageJsonPath)
        .then(() => true)
        .catch(() => false))
    ) {
      // Check if it's a Laravel project by looking for artisan
      const artisanPath = path.join(sitePath, "artisan");
      if (
        await fsp
          .access(artisanPath)
          .then(() => true)
          .catch(() => false)
      ) {
        // Could be livewire or other laravel project. For now, let's check composer.json
        const composerJsonPath = path.join(sitePath, "composer.json");
        if (
          await fsp
            .access(composerJsonPath)
            .then(() => true)
            .catch(() => false)
        ) {
          const composerJson = JSON.parse(
            await fsp.readFile(composerJsonPath, "utf-8"),
          );
          if (
            composerJson.require &&
            composerJson.require["livewire/livewire"]
          ) {
            return "livewire";
          }
        }
        return "laravel";
      }
      return "other";
    }

    const packageJson = JSON.parse(
      await fsp.readFile(packageJsonPath, "utf-8"),
    );
    const allDependencies = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    };

    if (allDependencies.react) {
      return "react";
    }
    if (allDependencies.vue) {
      return "vue";
    }
    return "other-js";
  } catch (error) {
    console.error(`Error detecting project type for ${sitePath}:`, error);
    // sendErrorToWindow(`Could not determine project type for ${sitePath}.`);
    return "other";
  }
});

const runningNpmCommands = new Map();

function stopAllNpmCommands() {
  return new Promise((resolve) => {
    if (runningNpmCommands.size === 0) {
      return resolve();
    }
    const promises = [];
    for (const [commandKey, child] of runningNpmCommands.entries()) {
      promises.push(
        new Promise((resolveCommand) => {
          child.on("exit", () => {
            runningNpmCommands.delete(commandKey);
            resolveCommand();
          });

          if (process.platform === "win32") {
            exec(`taskkill /pid ${child.pid} /t /f`, () => resolveCommand());
          } else {
            child.kill("SIGINT");
            resolveCommand();
          }
        }),
      );
    }
    Promise.all(promises).then(() => resolve());
  });
}

ipcMain.on("run-npm-command", (event, { sitePath, command, siteName }) => {
  const commandKey = `${siteName}-${command}`;

  // If the command is already running, don't start it again.
  if (runningNpmCommands.has(commandKey)) {
    // Maybe notify the frontend that it's already running.
    return;
  }

  // Use 'npm.cmd' on Windows
  const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";

  // Lista de comandos que no necesitan 'run'
  const directCommands = ["install", "ci", "uninstall", "init"];

  // Si el comando está en la lista, úsalo directamente. Si no, añade 'run'.
  const args = directCommands.includes(command) ? [command] : ["run", command];

  const child = spawn(npmCmd, args, { cwd: sitePath, shell: true });

  runningNpmCommands.set(commandKey, child);

  const channel = `npm-command-output-${commandKey}`;
  const errorChannel = `npm-command-error-${commandKey}`;
  const exitChannel = `npm-command-exit-${commandKey}`;

  child.stdout.on("data", (data) => {
    mainWindow.webContents.send(channel, data.toString());
  });

  child.stderr.on("data", (data) => {
    mainWindow.webContents.send(channel, data.toString()); // Send stderr to the same output channel
  });

  child.on("error", (error) => {
    mainWindow.webContents.send(errorChannel, error.message);
  });

  child.on("exit", (code) => {
    mainWindow.webContents.send(exitChannel, code);
    runningNpmCommands.delete(commandKey);
  });
});

ipcMain.on("stop-npm-command", (event, { command, siteName }) => {
  const commandKey = `${siteName}-${command}`;
  if (runningNpmCommands.has(commandKey)) {
    const child = runningNpmCommands.get(commandKey);
    // Use taskkill on windows to kill the process tree
    if (process.platform === "win32") {
      exec(`taskkill /pid ${child.pid} /t /f`);
    } else {
      child.kill();
    }
    runningNpmCommands.delete(commandKey);
  }
});

async function getSites() {
  const sitesPath = store.get("sitesPath");

  try {
    const files = await fsp.readdir(sitesPath);
    const sitePromises = files.map(async (file) => {
      const sitePath = path.join(sitesPath, file);
      const stat = await fsp.stat(sitePath);
      if (stat.isDirectory()) {
        return {
          name: file,
          url: `${file}.test`,
          path: sitePath,
          port: siteToPort.get(`${file}.test`),
          phpVersion: store.get("phpVersion"),
          running: phpProcesses.has(file),
        };
      }
      return null;
    });
    const sites = (await Promise.all(sitePromises)).filter(Boolean);
    return sites;
  } catch (error) {
    if (error.code === "ENOENT") {
      try {
        await fsp.mkdir(sitesPath, { recursive: true });
      } catch (mkdirError) {
        // sendErrorToWindow(`Failed to create sites directory at '${sitesPath}'. Please check permissions.`);
      }
    }
    return [];
  }
}

ipcMain.handle("get-sites", getSites);

ipcMain.handle("get-sites-path", () => {
  return store.get("sitesPath");
});

ipcMain.handle("get-services-status", () => {
  return servicesRunning;
});

ipcMain.handle("get-site-status", (event, siteName) => {
  return phpProcesses.has(siteName);
});

ipcMain.on("toggle-site", async (event, site) => {
  const isRunning = phpProcesses.has(site.name);
  if (isRunning) {
    await stopSite(site);
  } else {
    await startSite(site);
  }
  mainWindow.webContents.send("site-status-changed", {
    siteName: site.name,
    isRunning: !isRunning,
  });
});

ipcMain.handle("delete-site", async (event, site) => {
  try {
    // 1. Stop the site if it's running
    await stopSite(site);

    // 2. Delete the site directory
    await fsp.rm(site.path, { recursive: true, force: true });

    // 3. (Optional) Remove site-specific settings from store
    store.delete(`siteSettings.${site.name}`);

    return { success: true };
  } catch (error) {
    console.error(`Failed to delete site ${site.name}:`, error);
    return { success: false, error: error.message };
  }
});

async function startAllServices() {
  const resourcesPath =
    process.env.NODE_ENV === "development"
      ? app.getAppPath()
      : process.resourcesPath;

  // --- Adminer Service Logic ---
  const adminerDir = path.join(resourcesPath, "bin", "adminer");
  const adminerPort = 7999;
  const adminerUrl = "adminer.herd.clone";

  try {
    // 1. Set Adminer host
    await new Promise((resolve) => {
      hostile.set("127.0.0.1", adminerUrl, (err) => {
        if (err) {
          console.error(`Error setting Adminer domain in hosts file:`, err);
          // Not rejecting, as it might require admin rights
        }
        resolve();
      });
    });

    // 2. Start Adminer's PHP server
    const phpVersion = store.get("phpVersion");
    const phpExePath = path.join(
      resourcesPath,
      "bin",
      `php-${phpVersion}`,
      "php.exe",
    );
    if (
      await fsp
        .access(phpExePath)
        .then(() => true)
        .catch(() => false)
    ) {
      if (adminerProcess) adminerProcess.kill();
      adminerProcess = spawn(phpExePath, [
        "-S",
        `127.0.0.1:${adminerPort}`,
        "-t",
        adminerDir,
      ]);
      adminerProcess.stderr.on("data", (data) => {
        console.log(`Adminer PHP stderr: ${data}`);
      });
    } else {
      console.error("Could not find PHP executable to start Adminer.");
    }
  } catch (error) {
    console.error("Error starting Adminer service:", error);
  }
  // --- End of Adminer Service Logic ---

  try {
    const sites = await getSites();
    const nginxConfigPath = path.join(app.getPath("userData"), "nginx.conf");
    const lastSites = store.get("lastSitesForNginx", []);

    // Pre-assign ports for all sites regardless of Nginx config generation
    let port = 8000;
    for (const site of sites) {
      const currentPort = port++;
      siteToPort.set(site.url, currentPort);
    }

    const sitesChanged =
      JSON.stringify(sites.map((s) => s.name)) !==
      JSON.stringify(lastSites.map((s) => s.name));

    // Always regenerate Nginx config for simplicity and robustness
    // if (!await fsp.access(nginxConfigPath).then(() => true).catch(() => false)) || sitesChanged) {

    // Generate Nginx config
    let nginxConfigContent = `
worker_processes  1;
events {
    worker_connections  2048;
}
http {
    server_names_hash_bucket_size 128;
    client_max_body_size 100M;
    large_client_header_buffers 4 32k;

    # --- Adminer Server Block ---
    server {
        listen       80;
        server_name  adminer.herd.clone;
        location / {
            proxy_pass   http://127.0.0.1:7999;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    }
`;
    // Reset port for Nginx config generation to ensure consistency
    port = 8000;
    for (const site of sites) {
      const currentPort = siteToPort.get(site.url); // Get the already assigned port
      nginxConfigContent += `
  server {
      listen       80;
      server_name  ${site.url};

      add_header 'Access-Control-Allow-Origin' '*' always;
      add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, OPTIONS' always;
      add_header 'Access-Control-Allow-Headers' 'Content-Type, Authorization' always;

      # Handle preflight requests
      if ($request_method = 'OPTIONS') {
          return 204;
      }

      location / {
          proxy_pass   http://127.0.0.1:${currentPort};
          proxy_set_header Host $host;
          proxy_set_header X-Real-IP $remote_addr;
          proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
          proxy_set_header X-Forwarded-Proto $scheme;
      }
  }

  server {
      listen       127.0.0.1:${currentPort};
      server_name  127.0.0.1;

      add_header 'Access-Control-Allow-Origin' '*' always;
      add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, OPTIONS' always;
      add_header 'Access-Control-Allow-Headers' 'Content-Type, Authorization' always;

      # Handle preflight requests
      if ($request_method = 'OPTIONS') {
          return 204;
      }

      location / {
          proxy_pass   http://127.0.0.1:${currentPort};
          proxy_set_header Host $host;
          proxy_set_header X-Real-IP $remote_addr;
          proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
          proxy_set_header X-Forwarded-Proto $scheme;
      }
  }
`;
    }
    nginxConfigContent += `
}
`;

    await fsp.writeFile(nginxConfigPath, nginxConfigContent);

    // 1. PRIMERO: Iniciar todos los servidores PHP para cada sitio.
    console.log("Starting all PHP servers...");
    for (const site of sites) {
      await startSite(site);
    }
    console.log("All PHP servers started.");

    store.set("lastSitesForNginx", sites);

    // 2. LUEGO: Iniciar Nginx ahora que los backends están listos.
    console.log("Starting Nginx...");
    const resourcesPath =
      process.env.NODE_ENV === "development"
        ? app.getAppPath()
        : process.resourcesPath;
    const nginxDir = path.join(resourcesPath, "bin", "nginx-1.29.1");
    const nginxExePath = path.join(nginxDir, "nginx.exe");
    if (
      await fsp
        .access(nginxExePath)
        .then(() => true)
        .catch(() => false)
    ) {
      if (nginxProcess) {
        nginxProcess.removeAllListeners();
        try {
          execSync(`taskkill /pid ${nginxProcess.pid} /t /f`);
        } catch (error) {
          // Ignore errors if the process is already dead
        }
      }
      nginxProcess = spawn(nginxExePath, [
        "-c",
        nginxConfigPath,
        "-p",
        nginxDir,
      ]);
      nginxProcess.stdout.on("data", (data) => {});
      nginxProcess.stderr.on("data", (data) => {
        console.error(`Nginx stderr: ${data}`);
        // sendErrorToWindow(`Nginx error: ${data}`);
      });
      nginxProcess.on("error", (err) => {
        console.error("Nginx process error:", err);
        // sendErrorToWindow(`An error occurred with Nginx: ${err.message}`);
      });
      nginxProcess.on("close", (code) => {
        nginxProcess = null;
      });
    } else {
      // sendErrorToWindow('Nginx executable not found.');
    }

    servicesRunning = true;
    broadcastServicesStatus();
    return sites;
  } catch (error) {
    console.error("Error in startAllServices:", error);
    // sendErrorToWindow(`Error starting all services: ${error.message}`);
  }
}

async function stopAllServices() {
  // --- Stop Adminer Service ---
  if (adminerProcess) {
    adminerProcess.kill();
    adminerProcess = null;
  }
  await new Promise((resolve) => {
    hostile.remove("127.0.0.1", "adminer.herd.clone", (err) => {
      if (err) {
        /* Ignore errors */
      }
      resolve();
    });
  });
  // --- End of Adminer Service ---

  try {
    await stopAllNpmCommands();

    const sites = await getSites();
    const stopPromises = sites.map((site) => stopSite(site));
    await Promise.all(stopPromises);

    if (nginxProcess && nginxProcess.pid) {
      console.log(
        `Forcibly stopping Nginx process with PID: ${nginxProcess.pid}`,
      );
      try {
        // Usamos taskkill directamente con el PID que conocemos.
        // /t termina el proceso y cualquier proceso hijo.
        // /f fuerza la terminación.
        execSync(`taskkill /pid ${nginxProcess.pid} /t /f`);
      } catch (error) {
        // Ignorar errores, por ejemplo, si el proceso ya no existe.
        console.log(
          `Could not kill Nginx process ${nginxProcess.pid}. It might have already stopped.`,
        );
      }
      nginxProcess = null;
    }

    servicesRunning = false;
    broadcastServicesStatus();
  } catch (error) {
    console.error("Error in stopAllServices:", error);
    // sendErrorToWindow(`Error stopping all services: ${error.message}`);
  }
}

ipcMain.on("toggle-services", async (event, servicesShouldRun) => {
  if (servicesShouldRun) {
    await startAllServices();
  } else {
    await stopAllServices();
  }
});

ipcMain.handle("restart-all-services", async () => {
  try {
    await stopAllServices();
    const sites = await startAllServices(); // Llama a startAllServices y captura los sitios.
    return { success: true, sites: sites }; // Devuelve la lista fresca.
  } catch (error) {
    console.error("Failed to restart all services:", error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle("site:check-reverb", async (event, sitePath) => {
  const configPath = path.join(sitePath, "config", "reverb.php");
  const installed = await fsp
    .access(configPath)
    .then(() => true)
    .catch(() => false); // Check if we have a process for this site
  const running = reverbProcesses.has(sitePath);
  return { installed, running };
});

ipcMain.handle("site:install-reverb", async (event, sitePath) => {
  try {
    mainWindow.webContents.send(
      "site:reverb-install-log",
      `Installing Reverb for ${sitePath}...
`,
    );
    const child = spawn("php", ["artisan", "install:broadcasting"], {
      cwd: sitePath,
      shell: true,
    });

    child.stdout.on("data", (data) => {
      mainWindow.webContents.send("site:reverb-install-log", data.toString());
    });

    child.stderr.on("data", (data) => {
      mainWindow.webContents.send("site:reverb-install-log", data.toString());
    });

    return new Promise((resolve, reject) => {
      child.on("close", (code) => {
        if (code === 0) {
          mainWindow.webContents.send(
            "site:reverb-install-log",
            "Reverb installed successfully.\n",
          );
          resolve({ success: true });
        } else {
          mainWindow.webContents.send(
            "site:reverb-install-log",
            `Reverb installation failed with code ${code}.\n`,
          );
          reject({
            success: false,
            error: `Installation failed with code ${code}`,
          });
        }
      });
    });
  } catch (error) {
    console.error(`Failed to install Reverb for ${sitePath}:`, error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle("site:start-reverb", async (event, sitePath) => {
  try {
    if (reverbProcesses.has(sitePath)) {
      return {
        success: false,
        error: "Reverb is already running for this site.",
      };
    }

    mainWindow.webContents.send(
      "site:reverb-install-log",
      `Starting Reverb for ${sitePath}...
`,
    );
    const child = spawn("php", ["artisan", "reverb:start"], {
      cwd: sitePath,
      shell: true,
    });

    child.stdout.on("data", (data) => {
      mainWindow.webContents.send("site:reverb-install-log", data.toString());
    });

    child.stderr.on("data", (data) => {
      mainWindow.webContents.send("site:reverb-install-log", data.toString());
    });

    child.on("close", (code) => {
      reverbProcesses.delete(sitePath);
      if (code !== 0) {
        mainWindow.webContents.send(
          "site:reverb-install-log",
          `Reverb process exited with code ${code}.\n`,
        );
      }
    });

    child.on("error", (err) => {
      reverbProcesses.delete(sitePath);
      mainWindow.webContents.send(
        "site:reverb-install-log",
        `Error starting Reverb: ${err.message}\n`,
      );
    });

    reverbProcesses.set(sitePath, child);
    mainWindow.webContents.send("site:reverb-install-log", "Reverb started.\n");
    return { success: true };
  } catch (error) {
    console.error(`Failed to start Reverb for ${sitePath}:`, error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle("site:stop-reverb", async (event, sitePath) => {
  try {
    if (reverbProcesses.has(sitePath)) {
      const child = reverbProcesses.get(sitePath);
      child.kill(); // Send SIGTERM
      reverbProcesses.delete(sitePath);
      mainWindow.webContents.send(
        "site:reverb-install-log",
        "Reverb stopped.\n",
      );
      return { success: true };
    }
    return { success: false, error: "Reverb is not running for this site." };
  } catch (error) {
    console.error(`Failed to stop Reverb for ${sitePath}:`, error);
    return { success: false, error: error.message };
  }
});

app.whenReady().then(async () => {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Content-Security-Policy": [
          "script-src 'self' 'unsafe-inline' 'unsafe-eval' data: http://127.0.0.1:8000;",
        ],
      },
    });
  });

  createWindow();
  await startAllServices();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on("before-quit", async (event) => {
  event.preventDefault();

  console.log("before-quit: Stopping all services before exiting...");

  await stopAllServices();

  console.log("before-quit: All services stopped. Now quitting.");

  app.exit();
});
