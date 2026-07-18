// Puente seguro entre el renderer (UI) y el proceso main. El renderer no tiene
// acceso a Node ni a la red directa: solo a estas funciones.

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("easypos", {
  getConfig: () => ipcRenderer.invoke("config:get"),
  setConfig: (cfg) => ipcRenderer.invoke("config:set", cfg),
  /** Petición a la API de easy pos. Devuelve { ok, status, data }. */
  request: (method, path, body, token) =>
    ipcRenderer.invoke("api:request", { method, path, body, token }),
});
