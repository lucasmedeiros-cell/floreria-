// Proceso principal de Electron.
//
// El programa habla SOLO con la nube de easy pos (easypos.easypaybo.com): el
// pareo (X-Device-Token) dice de qué negocio es este equipo y el backend
// trabaja contra la base de ESE negocio. Sin servidor local, sin configurar IP.
//
// Las peticiones HTTP se hacen ACÁ (proceso main, Node) y no en el renderer,
// para evitar CORS y mantener el renderer aislado (contextIsolation on).

const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("node:path");
const fs = require("node:fs");

const CONFIG_FILE = () => path.join(app.getPath("userData"), "config.json");

// El servidor de easy pos (producción). El programa se vincula al negocio con
// el código/token del panel y cada request lleva X-Device-Token: así el
// backend resuelve la base de ESE negocio.
const DEFAULT_API = "https://easypos.easypaybo.com";

/** Config persistida: a qué servidor easy pos le habla el programa. */
function readConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE(), "utf8"));
  } catch {
    return { apiBase: DEFAULT_API };
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
    title: "easy pos",
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
// Servidor recomendado (compilado): lo usa el login para autorecuperarse si el
// servidor guardado dejó de responder.
ipcMain.handle("config:default", () => DEFAULT_API);

/**
 * Prueba si un servidor easy pos responde (GET /api/health). Se usa en el login
 * para diagnosticar la conexión ANTES de intentar entrar, y para autorecuperar
 * si la config guardada quedó apuntando a un servidor que ya no está.
 * Devuelve { ok, db?, error? } — nunca lanza.
 */
ipcMain.handle("api:ping", async (_e, base) => {
  const clean = String(base || "").trim().replace(/\/$/, "");
  if (!/^https?:\/\//.test(clean)) {
    return { ok: false, error: "La dirección debe empezar con http:// o https://" };
  }
  try {
    // Con el equipo vinculado, el health responde con la base del NEGOCIO
    // (bo_epos_<slug>): sirve de confirmación visual de a quién le hablamos.
    const { deviceToken } = readConfig();
    const res = await fetch(`${clean}/api/health`, {
      headers: deviceToken ? { "X-Device-Token": deviceToken } : undefined,
      signal: AbortSignal.timeout(6000),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data && data.ok === true) return { ok: true, db: data.db };
    return { ok: false, error: `El servidor respondió pero no es easy pos (HTTP ${res.status}).` };
  } catch (err) {
    const msg =
      err && err.name === "TimeoutError"
        ? "easy pos no respondió. Revisá el internet de la PC."
        : "Sin conexión con easy pos. Revisá el internet de la PC.";
    return { ok: false, error: msg };
  }
});

// -------------------------------------------------------------- IPC: API HTTP

/**
 * Puente HTTP hacia easy pos. El renderer llama `api(method, path, body, token)`
 * y esto hace el fetch real. Devuelve { ok, status, data } — nunca lanza, así
 * la UI maneja el error con un mensaje claro en vez de un stack.
 */
ipcMain.handle("api:request", async (_e, { method, path: p, body, token }) => {
  const { apiBase, deviceToken } = readConfig();
  const url = `${apiBase.replace(/\/$/, "")}${p}`;
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  // El pareo del equipo: con esto el backend sabe QUÉ negocio es y trabaja
  // contra su base (multi-negocio). Sin token: instalación local de un negocio.
  if (deviceToken) headers["X-Device-Token"] = deviceToken;
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
        ? "easy pos no respondió. Revisá el internet de la PC."
        : "Sin conexión con easy pos. Revisá el internet de la PC.";
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
