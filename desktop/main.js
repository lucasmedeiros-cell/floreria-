// Proceso principal de Electron.
//
// El programa NO habla con PostgreSQL directo: todo pasa por la API HTTP local
// de easy pos (http://localhost:3010 por defecto). Así se comparten los datos
// con la app móvil y el POS sin riesgo de corromper la base.
//
// Las peticiones HTTP se hacen ACÁ (proceso main, Node) y no en el renderer,
// para evitar CORS y mantener el renderer aislado (contextIsolation on).

const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("node:path");
const fs = require("node:fs");

const CONFIG_FILE = () => path.join(app.getPath("userData"), "config.json");

/** Config persistida: a qué servidor easy pos le habla el programa. */
function readConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE(), "utf8"));
  } catch {
    return { apiBase: "http://localhost:3010" };
  }
}
function writeConfig(cfg) {
  const merged = { ...readConfig(), ...cfg };
  fs.writeFileSync(CONFIG_FILE(), JSON.stringify(merged, null, 2));
  return merged;
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1024,
    minHeight: 680,
    backgroundColor: "#F6F4F1",
    title: "Auto Piezas Coquito",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.loadFile(path.join(__dirname, "renderer", "index.html"));
}

// -------------------------------------------------------------- IPC: config

ipcMain.handle("config:get", () => readConfig());
ipcMain.handle("config:set", (_e, cfg) => writeConfig(cfg));

// -------------------------------------------------------------- IPC: API HTTP

/**
 * Puente HTTP hacia easy pos. El renderer llama `api(method, path, body, token)`
 * y esto hace el fetch real. Devuelve { ok, status, data } — nunca lanza, así
 * la UI maneja el error con un mensaje claro en vez de un stack.
 */
ipcMain.handle("api:request", async (_e, { method, path: p, body, token }) => {
  const { apiBase } = readConfig();
  const url = `${apiBase.replace(/\/$/, "")}${p}`;
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  try {
    const res = await fetch(url, {
      method,
      headers,
      body: body != null ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(20000),
    });
    let data = null;
    const text = await res.text();
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { error: `Respuesta no válida del servidor (${res.status}).` };
    }
    return { ok: res.ok, status: res.status, data };
  } catch (err) {
    const msg =
      err && err.name === "TimeoutError"
        ? "El servidor no respondió. Revisá que easy pos esté encendido."
        : `No se pudo conectar con ${apiBase}. Revisá la dirección y la red.`;
    return { ok: false, status: 0, data: { error: msg } };
  }
});

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
