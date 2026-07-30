// easy pos — programa de PC (renderer).
// Toda escritura/lectura pasa por la API de easy pos (window.easypos.request),
// que corre en el proceso main. Sin SQL directo: los datos se comparten con la
// app móvil y el POS sin riesgo de corromper la base.

const root = document.getElementById("root");
const S = {
  // Servidor por defecto: la nube de easy pos. El proceso principal manda su
  // config guardada al arrancar; si hay un servidor local ("todo en uno"), el
  // login lo descubre en la red. Esto es solo el respaldo inicial.
  apiBase: "https://easypos.easypaybo.com",
  // Pareo del equipo: token de dispositivo (X-Device-Token) que dice QUÉ
  // negocio es. Obligatorio contra la nube; innecesario con servidor local.
  deviceToken: null,
  negocioNombre: null,
  token: null,
  user: null,
  business: null, // config del negocio (nombre, logoUrl configurado en el teléfono)
  screen: "inicio",
  productos: [],
  cart: [], // { id, sku, name, price, stock, qty, discountPct }
};

// ------------------------------------------------------------------ permisos
// El backend valida todo igual; esto solo decide qué mostrar/ocultar.
//   · Administrador: puede todo (usuarios + catálogo).
//   · Otro rol: gestiona catálogo solo si tiene la bandera `products`.
const isAdmin = () => S.user?.role === "Administrador";
const canProducts = () => !!(S.user?.can?.products || isAdmin());

// ------------------------------------------------------------------ utilidades
const bs = (n) => "Bs " + (Number(n) || 0).toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const uid = () => "pc-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);
const norm = (s) => String(s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

function toast(msg, kind = "") {
  const host = document.getElementById("toast");
  const t = document.createElement("div");
  t.className = "toast " + kind;
  t.textContent = msg;
  host.appendChild(t);
  setTimeout(() => t.remove(), 3200);
}

async function api(method, path, body) {
  const r = await window.easypos.request(method, path, body, S.token);
  if (!r.ok) throw new Error((r.data && r.data.error) || `Error ${r.status}`);
  return r.data;
}

// SVG mínimos (stroke). name → path(s).
const IC = {
  venta: "M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z M3 6h18 M16 10a4 4 0 0 1-8 0",
  catalogo: "M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z M3.3 7 12 12l8.7-5 M12 22V12",
  historial: "M3 3v5h5 M3.05 13A9 9 0 1 0 6 5.3L3 8 M12 7v5l4 2",
  gastos: "M12 1v22 M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6",
  caja: "M3 6h18v12H3z M3 10h18 M7 15h4",
  reportes: "M3 3v18h18 M18 17V9 M13 17V5 M8 17v-3",
  usuarios: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M22 21v-2a4 4 0 0 0-3-3.9",
  bell: "M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9 M10.3 21a1.9 1.9 0 0 0 3.4 0",
  plus: "M12 5v14 M5 12h14",
  search: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14Z M21 21l-4.3-4.3",
  logout: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4 M16 17l5-5-5-5 M21 12H9",
  wrench: "M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.7 2.7-2.7-2.7Z",
  bug: "M9 5a3 3 0 0 1 6 0 M6 10a6 6 0 0 0 12 0 M12 10v10 M6 13H3 M21 13h-3 M6 17l-2 2 M18 17l2 2",
  inicio: "M3 10.5 12 3l9 7.5 M5 9.5V21h14V9.5",
  proveedor: "M3 21V8l9-5 9 5v13 M3 21h18 M9 21v-6h6v6",
  check: "M20 6 9 17l-5-5",
  qr: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h3v3h-3z M20 14v3 M17 20h4 M20 20v1",
};
function svg(name, size = 20) {
  const d = IC[name] || "";
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d.split(" M").map((p, i) => `<path d="${i ? "M" + p : p}"/>`).join("")}</svg>`;
}

// ------------------------------------------------------------------ arranque
(async function init() {
  const cfg = await window.easypos.getConfig();
  S.apiBase = cfg.apiBase || S.apiBase;
  S.deviceToken = cfg.deviceToken || null;
  S.negocioNombre = cfg.negocioNombre || null;
  initScanner();
  // Igual que en el teléfono: primero el pareo, después el login. Sin vincular
  // el equipo no sabemos de qué negocio es, así que ni mostramos el login.
  if (S.deviceToken) renderLogin();
  else renderPairing();
})();

// --------------------------------------------------------------- lector CCD
// Un lector de código de barras USB/CCD actúa como TECLADO: "teclea" los
// dígitos del código muy rápido y cierra con Enter. Se distingue del tecleo
// humano por la velocidad (< 60 ms entre teclas). Cada pantalla que quiera
// escaneo define `S.onScan(code)`; navigate() lo limpia al cambiar de pantalla.
let _scanBuf = "";
let _scanPrev = 0;
function initScanner() {
  document.addEventListener("keydown", (e) => {
    if (typeof S.onScan !== "function") return;
    const now = Date.now();
    const rapido = now - _scanPrev < 60; // ráfaga = viene del lector
    _scanPrev = now;
    if (e.key === "Enter") {
      const code = _scanBuf;
      _scanBuf = "";
      if (code.length >= 3) { e.preventDefault(); S.onScan(code); }
      return;
    }
    // Solo caracteres imprimibles; si vienen con pausa (humano) el buffer se
    // reinicia, así que nunca se arma un "código" tecleando a mano.
    if (e.key.length === 1) _scanBuf = rapido ? _scanBuf + e.key : e.key;
    else _scanBuf = "";
  });
}

// ================================================================ PAREO
// Primera pantalla si el equipo NO está vinculado: se pega el código de 6
// dígitos (o el token) que muestra el panel de easy pos y, al verificarlo,
// pasa al login del negocio.
function renderPairing() {
  root.innerHTML = `
    <div id="login">
      <div class="brand">
        <div class="logo">${logoMark(56)}</div>
        <h1>easy pos</h1>
        <p>Primero vinculá este equipo a tu negocio. El código lo genera el panel de easy pos (sección Vinculación QR).</p>
      </div>
      <div class="form">
        <span class="eyebrow">easy pos</span>
        <h2>Vincular equipo</h2>
        <label class="field"><span>Código del panel</span>
          <input id="p-code" autofocus placeholder="Código de 4 dígitos"/>
        </label>
        <div id="p-status" style="margin-top:10px;font-size:12.5px;min-height:18px"></div>
        <button class="btn btn-primary btn-block" id="p-go" style="margin-top:12px">Vincular</button>
      </div>
    </div>`;

  const $ = (id) => document.getElementById(id);
  const set = (html) => { const s = $("p-status"); if (s) s.innerHTML = html; };
  const bad = (t) => set(`<span style="color:var(--error);font-weight:600">✕ ${esc(t)}</span>`);
  const info = (t) => set(`<span style="color:var(--ink2)">${esc(t)}</span>`);

  const vincular = async () => {
    const val = ($("p-code").value || "").trim();
    if (!val) { bad("Escribí el código de 4 dígitos del panel."); return; }
    const btn = $("p-go"); btn.disabled = true; btn.textContent = "Vinculando…";
    info("Vinculando el equipo…");
    try {
      let token;
      if (/^\d{4,6}$/.test(val)) {
        token = (await api("POST", "/api/devices/pair", { code: val })).token;
      } else if (/^[a-f0-9]{32,}$/i.test(val)) {
        token = val;
      } else {
        bad("Eso no parece un código del panel.");
        btn.disabled = false; btn.textContent = "Vincular"; return;
      }
      // Confirmar el pareo y averiguar el negocio ANTES de darlo por bueno.
      const v = await window.easypos.request("GET", "/api/pair/verify", null, token);
      if (!v.ok) throw new Error((v.data && v.data.error) || "El código no es válido.");
      const neg = v.data && v.data.negocio;
      S.deviceToken = token;
      S.negocioNombre = typeof neg === "string" ? neg : (neg && neg.nombre) || null;
      await window.easypos.setConfig({ deviceToken: token, negocioNombre: S.negocioNombre });
      renderLogin();
      toast(`Equipo vinculado a ${S.negocioNombre || "su negocio"}.`, "ok");
    } catch (e) {
      bad(String(e.message || "No se pudo vincular."));
      btn.disabled = false; btn.textContent = "Vincular";
    }
  };

  $("p-go").onclick = vincular;
  $("p-code").addEventListener("keydown", (e) => e.key === "Enter" && vincular());
}

// ================================================================ LOGIN
function renderLogin() {
  root.innerHTML = `
    <div id="login">
      <div class="brand">
        <div class="logo">${logoMark(56)}</div>
        <h1>easy pos</h1>
        <p>Punto de venta y gestión. Los datos se comparten con el mostrador y la app del teléfono.</p>
      </div>
      <div class="form">
        <span class="eyebrow">easy pos</span>
        <h2>Iniciar sesión</h2>
        <label class="field"><span>Correo o teléfono</span><input id="l-id" autofocus placeholder="correo@tunegocio.com"/></label>
        <label class="field"><span>Contraseña</span><input id="l-pass" type="password" placeholder="••••••••"/></label>
        <div class="field"><span>Vinculación</span>
          <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;border:1px solid var(--line);border-radius:10px;background:rgba(46,166,107,.08)">
            <span style="color:var(--success);font-weight:700">✓</span>
            <span style="flex:1">Equipo vinculado a <b>${esc(S.negocioNombre || "su negocio")}</b></span>
            <a href="#" id="l-unpair" style="font-size:12px;color:var(--ink2)">Desvincular</a>
          </div>
        </div>
        <div id="l-status" style="margin-top:10px;font-size:12.5px;min-height:18px"></div>
        <button class="btn btn-primary btn-block" id="l-go" style="margin-top:12px">Ingresar</button>
      </div>
    </div>`;

  const $ = (id) => document.getElementById(id);
  const setStatus = (html) => { const s = $("l-status"); if (s) s.innerHTML = html; };
  const stOk = (t) => setStatus(`<span style="color:var(--success);font-weight:600">✓ ${esc(t)}</span>`);
  const stBad = (t) => setStatus(`<span style="color:var(--error);font-weight:600">✕ ${esc(t)}</span>`);
  const stInfo = (t) => setStatus(`<span style="color:var(--ink2)">${esc(t)}</span>`);
  const ping = (url) => (window.easypos.ping ? window.easypos.ping(url) : Promise.resolve({ ok: true }));

  // Al abrir: confirmar que la nube de easy pos responde. Nada que configurar:
  // el programa habla SIEMPRE con easypos.easypaybo.com.
  const autoConnect = async () => {
    stInfo("Conectando con easy pos…");
    const r = await ping(S.apiBase);
    if (r.ok) { stOk(`Conectado a easy pos${r.db ? ` (${r.db})` : ""}.`); return; }
    stBad(r.error || "Sin conexión con easy pos. Revisá el internet de la PC.");
  };

  // Vincular el equipo: código de 6 dígitos (se canjea por token) o el token
  // largo que muestra el panel junto al QR. Queda guardado en la config y el
  // proceso main lo manda como X-Device-Token en cada request.
  // "Desvincular": olvida el pareo y vuelve a la pantalla de vincular equipo.
  const unpair = async (e) => {
    e.preventDefault();
    S.deviceToken = null;
    S.negocioNombre = null;
    await window.easypos.setConfig({ deviceToken: null, negocioNombre: null });
    renderPairing();
  };

  const go = async () => {
    const identifier = $("l-id").value.trim();
    const pass = $("l-pass").value;
    if (!identifier || !pass) { stBad("Ingresá tu usuario y contraseña."); return; }
    const btn = $("l-go"); btn.disabled = true; btn.textContent = "Entrando…";
    stInfo("Conectando…");
    try {
      const data = await api("POST", "/api/auth/employee/login", { identifier, email: identifier, pass });
      S.token = data.token;
      S.user = data;
      try {
        const me = await api("GET", "/api/auth/employee/me");
        if (me && me.user) { S.user.role = me.user.role; S.user.can = me.user.can; }
      } catch { /* si falla, se cae al rol del login */ }
      // Config del negocio: trae el LOGO que se cargó desde el teléfono.
      try {
        const biz = await api("GET", "/api/business");
        if (biz) S.business = biz;
      } catch { /* sin config: se usa el logo por defecto */ }
      renderApp();
    } catch (e) {
      btn.disabled = false; btn.textContent = "Ingresar";
      const msg = String(e.message || "");
      // Distinguir "no conecta" (problema de red/servidor) de "credenciales".
      if (/conect|servidor|red|respond|Failed to fetch|ECONN|ETIMED/i.test(msg)) {
        stBad(msg || "No se pudo conectar con el servidor.");
        autoConnect();
      } else {
        stBad("Usuario o contraseña incorrectos.");
      }
    }
  };

  $("l-go").onclick = go;
  $("l-pass").addEventListener("keydown", (e) => e.key === "Enter" && go());
  $("l-unpair").onclick = unpair;
  autoConnect();
}

function logoMark(size) {
  // 1º el logo configurado del negocio (desde el teléfono), 2º el logo embebido.
  const url = (S.business && S.business.logoUrl) ? S.business.logoUrl
    : (typeof LOGO_DATA !== "undefined" ? LOGO_DATA : "");
  if (url) {
    return `<img src="${url}" alt="Logo del negocio" style="width:${size}px;height:${size}px;border-radius:${Math.round(size * 0.2)}px;object-fit:cover;display:block;background:#fff"/>`;
  }
  return `<div style="width:${size}px;height:${size}px;background:var(--yellow);border-radius:10px;display:grid;place-items:center;color:#000;font-family:var(--serif);font-weight:700;line-height:.9;text-align:center;font-size:${size * 0.3}px"><div><i style="font-weight:400;font-size:${size * 0.22}px">easy</i><br/>pos</div></div>`;
}

// ================================================================ SHELL
const NAV = [
  { s: "inicio", label: "Inicio", ic: "inicio" },
  { s: "venta", label: "Venta", ic: "venta" },
  { s: "catalogo", label: "Catálogo", ic: "catalogo" },
  { s: "historial", label: "Historial", ic: "historial" },
  { s: "proveedor", label: "Proveedor", ic: "proveedor" },
  { s: "gastos", label: "Gastos", ic: "gastos" },
  { s: "caja", label: "Corte de caja", ic: "caja" },
  { s: "reportes", label: "Reportes", ic: "reportes" },
  { s: "usuarios", label: "Usuarios", ic: "usuarios" },
];
const TITLE = Object.fromEntries(NAV.map((n) => [n.s, n.label]));

function renderApp() {
  const ini = (S.user?.name || "A").trim().split(" ").map((p) => p[0]).slice(0, 2).join("");
  root.innerHTML = `
    <div id="app">
      <aside class="sidebar">
        <div class="top">
          ${logoMark(34)}
          <div class="name">${esc((S.business && S.business.name) || S.negocioNombre || "Mi negocio")}<small>EASY POS</small></div>
        </div>
        <nav id="nav">
          ${NAV.filter((n) => n.s !== "usuarios" || isAdmin()).map((n) => `<button class="navitem${n.s === S.screen ? " active" : ""}" data-s="${n.s}"><span class="ic">${svg(n.ic, 19)}</span>${n.label}</button>`).join("")}
        </nav>
        <div class="user">
          <div class="av">${esc(ini)}</div>
          <div class="who"><b>${esc(S.user?.name || "Usuario")}</b><small>${esc(S.user?.role || "")}</small></div>
          <button class="hbtn" title="Salir" id="logout" style="width:34px;height:34px;background:transparent;color:var(--ink2)">${svg("logout", 18)}</button>
        </div>
      </aside>
      <div class="main">
        <div class="curved">
          <div class="bar">
            <span class="watermark">${svg("wrench", 130)}</span>
            <h1 id="hdr-title">${TITLE[S.screen] || ""}</h1>
            <button class="hdr-dbg" id="dbg-btn" title="Reportar un error o sugerencia">${svg("bug", 15)} Debug</button>
            <button class="hbtn">${svg("bell", 20)}</button>
          </div>
          <svg class="wave" viewBox="0 0 100 24" preserveAspectRatio="none"><path d="M0,24 L0,9 Q22,24 50,15 Q80,2 100,19 L100,24 Z" fill="#F6F4F1"/></svg>
        </div>
        <div class="content" id="content"></div>
      </div>
    </div>`;
  document.getElementById("nav").onclick = (e) => {
    const b = e.target.closest(".navitem");
    if (b) navigate(b.dataset.s);
  };
  document.getElementById("logout").onclick = () => { S.token = null; S.user = null; renderLogin(); };
  document.getElementById("dbg-btn").onclick = reportarBug;
  navigate(S.screen);
}

function navigate(s) {
  // Usuarios es solo del administrador (el backend igual lo exige).
  if (s === "usuarios" && !isAdmin()) s = "inicio";
  S.onScan = null; // cada pantalla vuelve a definir su escaneo (o ninguno)
  S.screen = s;
  document.querySelectorAll(".navitem").forEach((b) => b.classList.toggle("active", b.dataset.s === s));
  const t = document.getElementById("hdr-title");
  if (t) t.textContent = TITLE[s] || "";
  const c = document.getElementById("content");
  c.style.padding = ""; // reset: Venta lo pone en 0; el resto usa el padding del CSS
  ({
    inicio: screenInicio,
    proveedor: screenProveedor,
    venta: screenVenta,
    catalogo: screenCatalogo,
    historial: screenHistorial,
    gastos: screenGastos,
    caja: screenCaja,
    reportes: screenReportes,
    usuarios: screenUsuarios,
  }[s] || screenStub)(c, s);
}

// ------------------------------------------------------------------ modal
function modal(html) {
  const wrap = document.createElement("div");
  wrap.style.cssText = "position:fixed;inset:0;background:rgba(20,17,15,.45);display:grid;place-items:center;z-index:90";
  wrap.innerHTML = `<div style="background:var(--surface);border-radius:20px;max-width:520px;width:92%;max-height:88vh;overflow:auto;box-shadow:0 30px 70px rgba(0,0,0,.4)">${html}</div>`;
  wrap.addEventListener("click", (e) => { if (e.target === wrap) wrap.remove(); });
  document.body.appendChild(wrap);
  return wrap;
}
const fmtDate = (iso) => { const d = new Date(iso); return `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`; };

// ------------------------------------------------------------------ Debug / reporte de bugs
// Envía un ticket al sistema de desarrollo (tickets.petroboxinc.com) vía el proxy
// /api/tickets/report del servidor. Llega etiquetado con el proyecto de esta
// instalación, al equipo que corresponde.
function reportarBug() {
  const m = modal(`<div style="padding:24px">
    <h3 class="serif" style="font-size:20px;display:flex;align-items:center;gap:8px">${svg("bug", 18)} Reportar / Sugerir</h3>
    <p style="color:var(--ink2);font-size:13px;margin-top:4px">Un error o una mejora. Llega al equipo de desarrollo.</p>
    <div style="display:flex;gap:8px;margin-top:14px">
      <button class="btn btn-outline" id="rb-error" style="flex:1">Error</button>
      <button class="btn btn-outline" id="rb-opt" style="flex:1">Sugerencia</button>
    </div>
    <label class="field"><span>Título</span><input id="rb-tit" placeholder="Resumen corto"/></label>
    <label class="field"><span>Descripción</span><textarea id="rb-desc" rows="4" style="width:100%;padding:11px 12px;border:1px solid var(--line);border-radius:11px;outline:none;resize:vertical;font-family:inherit" placeholder="¿Qué pasó o qué te gustaría que agreguemos?"></textarea></label>
    <label class="field"><span>Correo de contacto</span><input id="rb-mail" value="desarrolloia@petroboxinc.com"/></label>
    <div style="display:flex;gap:10px;margin-top:18px"><button class="btn btn-outline btn-block" id="rb-x">Cancelar</button><button class="btn btn-primary btn-block" id="rb-ok">Enviar</button></div>
  </div>`);
  let tipo = "error";
  const setTipo = (t) => {
    tipo = t;
    m.querySelector("#rb-error").classList.toggle("btn-primary", t === "error");
    m.querySelector("#rb-opt").classList.toggle("btn-primary", t === "optimizacion");
  };
  m.querySelector("#rb-error").onclick = () => setTipo("error");
  m.querySelector("#rb-opt").onclick = () => setTipo("optimizacion");
  setTipo("error");
  m.querySelector("#rb-x").onclick = () => m.remove();
  m.querySelector("#rb-ok").onclick = async () => {
    const titulo = m.querySelector("#rb-tit").value.trim();
    const descripcion = m.querySelector("#rb-desc").value.trim();
    const email = m.querySelector("#rb-mail").value.trim();
    if (!titulo || !descripcion) return toast("Completá título y descripción", "err");
    if (!email) return toast("Ingresá un correo de contacto", "err");
    const btn = m.querySelector("#rb-ok"); btn.disabled = true; btn.textContent = "Enviando…";
    try {
      const r = await api("POST", "/api/tickets/report", { tipo, titulo, descripcion, email, surface: "pc", url: S.apiBase });
      toast(r && r.numero_ticket ? `Reporte enviado · ${r.numero_ticket}` : "Reporte enviado, ¡gracias!", "ok");
      m.remove();
    } catch (e) { toast(e.message, "err"); btn.disabled = false; btn.textContent = "Enviar"; }
  };
}

function screenStub(c, s) {
  c.innerHTML = `<div class="empty"><div style="opacity:.4;margin-bottom:10px">${svg(NAV.find(n=>n.s===s)?.ic || "reportes", 40)}</div><h3 class="serif" style="font-size:20px">${TITLE[s]}</h3><p style="margin-top:6px">Esta sección está en construcción (próxima etapa).</p></div>`;
}

// ================================================================ INICIO (igual al teléfono)
async function screenInicio(c) {
  const primer = (S.user?.name || "").trim().split(" ")[0] || "";
  c.innerHTML = `
    <div style="max-width:840px;margin:0 auto">
      <h2 class="serif" style="font-size:30px;font-weight:700">${primer ? "¡Hola, " + esc(primer) + "!" : "¡Hola!"}</h2>
      <p style="color:var(--ink2);margin-top:6px">Este es el resumen de ${esc((S.business && S.business.name) || "tu negocio")}.</p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:18px">
        <button class="stat" data-go="catalogo" style="cursor:pointer">
          <div class="ico" style="background:var(--yellow-soft);color:var(--yellow-deep)">${svg("catalogo",22)}</div>
          <div class="num" id="ini-prod">—</div><div class="lbl">Productos</div>
        </button>
        <button class="stat" data-go="catalogo" style="cursor:pointer">
          <div class="ico" style="background:rgba(224,50,78,.12);color:var(--error)">${svg("reportes",22)}</div>
          <div class="num" id="ini-bajo">—</div><div class="lbl">Stock bajo</div>
        </button>
      </div>
      <button data-go="proveedor" style="width:100%;margin-top:14px;border:none;cursor:pointer;background:linear-gradient(135deg,var(--dark),#2a2320);color:#fff;border-radius:20px;padding:18px 20px;display:flex;align-items:center;gap:16px;text-align:left">
        <span style="width:52px;height:52px;border-radius:15px;background:linear-gradient(135deg,var(--yellow),var(--yellow-deep));color:var(--on-accent);display:grid;place-items:center">${svg("proveedor",24)}</span>
        <div style="flex:1"><div class="serif" style="font-size:28px;font-weight:700" id="ini-ped">—</div><div style="opacity:.85;font-size:13px">Pedidos a proveedor por recibir</div></div>
        <span style="opacity:.6">${svg("plus",20)}</span>
      </button>
      <button data-go="venta" style="width:100%;margin-top:14px;border:1px solid var(--line);background:var(--surface);cursor:pointer;border-radius:18px;padding:16px 18px;display:flex;align-items:center;gap:14px;text-align:left">
        <span style="width:46px;height:46px;border-radius:13px;background:var(--yellow);color:var(--on-accent);display:grid;place-items:center">${svg("venta",22)}</span>
        <div><div style="font-weight:700;font-size:15px">Nueva venta</div><div style="color:var(--ink2);font-size:12.5px">Cobrar un repuesto del inventario</div></div>
      </button>
      <div style="margin-top:24px"><span class="eyebrow">Accesos rápidos</span>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:12px">
          ${qaCard("venta","venta","Vender","Nueva venta")}
          ${qaCard("catalogo","catalogo","Productos","Ver inventario")}
          ${qaCard("proveedor","proveedor","Pedir","A proveedor")}
        </div>
      </div>
    </div>`;
  c.querySelectorAll("[data-go]").forEach((b) => b.onclick = () => navigate(b.dataset.go));
  try {
    const r = await api("GET", "/api/reports");
    const p = document.getElementById("ini-prod"); if (p) p.textContent = r.totalProductos ?? 0;
    const b = document.getElementById("ini-bajo"); if (b) b.textContent = r.stockBajo ?? 0;
  } catch { /* sin datos */ }
  try {
    const pos = await api("GET", "/api/purchase-orders");
    const el = document.getElementById("ini-ped");
    if (el) el.textContent = pos.filter((p) => p.status === "solicitado").length;
  } catch { /* sin datos */ }
}
function qaCard(ic, go, title, sub) {
  return `<button data-go="${go}" style="cursor:pointer;border:1px solid var(--line);background:var(--surface);border-radius:14px;padding:14px 12px;text-align:center">
    <div style="width:38px;height:38px;margin:0 auto;border-radius:11px;background:var(--yellow-soft);color:var(--yellow-deep);display:grid;place-items:center">${svg(ic,19)}</div>
    <div style="font-weight:700;font-size:13px;margin-top:8px">${title}</div><div style="color:var(--ink2);font-size:11px">${sub}</div>
  </button>`;
}

// ================================================================ PROVEEDOR (pedidos a proveedor)
async function screenProveedor(c) {
  c.innerHTML = `
    <div style="display:flex;align-items:center;margin-bottom:14px"><span class="eyebrow">Reposición de inventario</span><button class="btn btn-primary" id="pv-new" style="margin-left:auto">+ Nuevo pedido</button></div>
    <div class="card"><table><thead><tr><th>Código</th><th>Proveedor</th><th>Fecha</th><th class="center">Ítems</th><th class="center">Estado</th><th class="right">Acciones</th></tr></thead><tbody id="pv-body"><tr><td colspan="6" class="center" style="color:var(--faint);padding:30px">Cargando…</td></tr></tbody></table></div>`;
  const chip = { solicitado: "Solicitado", recibido: "Recibido", cancelado: "Cancelado" };
  const load = async () => {
    try {
      const rows = await api("GET", "/api/purchase-orders");
      const body = document.getElementById("pv-body");
      if (!rows.length) { body.innerHTML = `<tr><td colspan="6" class="center" style="color:var(--faint);padding:30px">Sin pedidos a proveedor. Creá uno cuando pidas repuestos a tu distribuidora.</td></tr>`; return; }
      body.innerHTML = rows.map((o) => `
        <tr>
          <td class="mono" style="font-weight:700">${esc(o.code)}</td>
          <td>${esc(o.supplier || "—")}</td>
          <td style="color:var(--ink2);font-size:12.5px">${o.createdAt ? fmtDate(o.createdAt) : ""}</td>
          <td class="center">${o.itemCount}</td>
          <td class="center"><span class="chip ${o.status === "recibido" ? "ok" : o.status === "cancelado" ? "bad" : ""}" ${o.status === "solicitado" ? 'style="background:var(--yellow-soft);color:var(--yellow-deep)"' : ""}>${chip[o.status]}</span></td>
          <td class="right">${o.status === "solicitado" ? `<button class="btn btn-primary" style="padding:6px 12px" data-recv="${o.id}">Recibir</button> <button class="btn btn-outline" style="padding:6px 12px" data-canc="${o.id}">Cancelar</button>` : "—"}</td>
        </tr>`).join("");
      body.querySelectorAll("[data-recv]").forEach((b) => b.onclick = async () => { try { await api("PATCH", `/api/purchase-orders/${b.dataset.recv}`, { status: "recibido" }); toast("Pedido recibido · stock actualizado", "ok"); load(); } catch (e) { toast(e.message, "err"); } });
      body.querySelectorAll("[data-canc]").forEach((b) => b.onclick = async () => { try { await api("PATCH", `/api/purchase-orders/${b.dataset.canc}`, { status: "cancelado" }); toast("Pedido cancelado", "ok"); load(); } catch (e) { toast(e.message, "err"); } });
    } catch (e) { toast(e.message, "err"); }
  };
  document.getElementById("pv-new").onclick = () => nuevoPedidoProveedor(load);
  load();
}

function nuevoPedidoProveedor(onDone) {
  const items = [];
  const m = modal(`<div style="padding:24px">
    <h3 class="serif" style="font-size:20px">Nuevo pedido a proveedor</h3>
    <label class="field"><span>Proveedor</span><input id="pp-sup" placeholder="Distribuidora / casa de repuestos"/></label>
    <label class="field"><span>Agregar productos</span><input id="pp-q" class="search" placeholder="Buscar por SKU o nombre…"/></label>
    <div id="pp-res" style="margin-top:6px"></div>
    <div id="pp-items" style="margin-top:8px"></div>
    <div style="display:flex;gap:10px;margin-top:18px"><button class="btn btn-outline btn-block" id="pp-x">Cancelar</button><button class="btn btn-primary btn-block" id="pp-ok">Crear pedido</button></div>
  </div>`);
  const resBox = m.querySelector("#pp-res");
  const itemsBox = m.querySelector("#pp-items");
  const draw = () => {
    itemsBox.innerHTML = items.length ? items.map((it, i) => `
      <div class="line" style="display:flex;align-items:center;gap:8px">
        <div style="flex:1"><b style="font-size:13px">${esc(it.name)}</b><div style="font-size:11px;color:var(--faint)">${esc(it.sku)}</div></div>
        <label style="font-size:11px;color:var(--ink2)">Cant. <input data-q="${i}" type="number" min="1" value="${it.qty}" style="width:52px;padding:4px 6px;border:1px solid var(--line);border-radius:8px"/></label>
        <label style="font-size:11px;color:var(--ink2)">Costo <input data-cost="${i}" type="number" min="0" value="${it.unitCost}" style="width:70px;padding:4px 6px;border:1px solid var(--line);border-radius:8px"/></label>
        <button data-del="${i}" style="border:none;background:none;color:var(--faint);cursor:pointer">✕</button>
      </div>`).join("") : `<p style="color:var(--faint);font-size:12.5px;padding:8px 0">Sin productos aún.</p>`;
    itemsBox.querySelectorAll("[data-q]").forEach((x) => x.onchange = () => { items[+x.dataset.q].qty = Math.max(1, parseInt(x.value) || 1); });
    itemsBox.querySelectorAll("[data-cost]").forEach((x) => x.onchange = () => { items[+x.dataset.cost].unitCost = Math.max(0, parseFloat(x.value) || 0); });
    itemsBox.querySelectorAll("[data-del]").forEach((x) => x.onclick = () => { items.splice(+x.dataset.del, 1); draw(); });
  };
  let deb;
  m.querySelector("#pp-q").oninput = (e) => {
    clearTimeout(deb);
    deb = setTimeout(async () => {
      const t = e.target.value.trim();
      if (!t) { resBox.innerHTML = ""; return; }
      try {
        const rows = await api("GET", `/api/products?q=${encodeURIComponent(t)}&limit=6`);
        resBox.innerHTML = rows.map((p) => `<button class="result" data-add="${esc(p.id)}"><div style="flex:1"><div class="sku">${esc(p.id)}</div><div class="nm">${esc(p.name)}</div></div><span class="add">${svg("plus",18)}</span></button>`).join("");
        resBox.querySelectorAll("[data-add]").forEach((b) => b.onclick = () => {
          const p = rows.find((x) => x.id === b.dataset.add);
          if (p && !items.some((it) => it.productId === p.id)) { items.push({ productId: p.id, sku: p.id, name: p.name, qty: 1, unitCost: Number(p.cost) || 0 }); draw(); }
          e.target.value = ""; resBox.innerHTML = "";
        });
      } catch { /* nada */ }
    }, 220);
  };
  m.querySelector("#pp-x").onclick = () => m.remove();
  m.querySelector("#pp-ok").onclick = async () => {
    const supplier = m.querySelector("#pp-sup").value.trim();
    if (!supplier) return toast("Indicá el proveedor", "err");
    if (!items.length) return toast("Agregá al menos un producto", "err");
    try { await api("POST", "/api/purchase-orders", { supplier, items }); toast("Pedido a proveedor creado", "ok"); m.remove(); onDone && onDone(); }
    catch (e) { toast(e.message, "err"); }
  };
  draw();
}

// ================================================================ CATÁLOGO
/** URL de la imagen del producto (data URI o http). "" si no tiene. */
function imgSrc(p) {
  const s = (p && p.image && String(p.image)) || (p && Array.isArray(p.images) && p.images[0]) || "";
  return /^data:|^https?:\/\//.test(s) ? s : "";
}
/** Miniatura cuadrada (imagen o placeholder). El fondo gris queda detrás por si
 *  la imagen no carga (no se usa onerror inline: la CSP bloquea handlers inline). */
function thumb(p, size) {
  const s = imgSrc(p);
  return s
    ? `<img src="${esc(s)}" style="width:${size}px;height:${size}px;object-fit:cover;border-radius:9px;display:block;background:var(--surface2)"/>`
    : `<div style="width:${size}px;height:${size}px;border-radius:9px;background:var(--surface2);display:grid;place-items:center;color:var(--faint)">${svg("catalogo", Math.round(size * 0.5))}</div>`;
}

async function screenCatalogo(c) {
  const puede = canProducts();
  if (!S.catView) S.catView = "tarjetas"; // vista por defecto: tarjetas (con imagen)
  c.innerHTML = `
    <div style="display:flex;gap:10px;margin-bottom:14px;align-items:center;flex-wrap:wrap">
      <input class="search" id="cat-q" placeholder="Buscar por código, nombre, código de barras…" value="${esc(S.catQ || "")}" style="flex:1;min-width:220px"/>
      <div class="viewtoggle">
        <button data-view="tarjetas" class="${S.catView === "tarjetas" ? "active" : ""}">${svg("catalogo", 16)} Tarjetas</button>
        <button data-view="tabla" class="${S.catView === "tabla" ? "active" : ""}">${svg("reportes", 16)} Tabla</button>
      </div>
      ${puede ? `<button class="btn btn-primary" id="cat-nuevo">${svg("plus", 16)} Nuevo producto</button>
      <button class="btn btn-outline" id="cat-import">Importar CSV</button>
      <input type="file" id="cat-file" accept=".csv,text/csv" class="hidden"/>` : `<span class="chip" style="background:var(--surface2);color:var(--ink2)">Solo lectura</span>`}
    </div>
    ${puede ? `<div style="margin-bottom:12px;font-size:12px;color:var(--ink2);display:flex;align-items:center;gap:6px">${svg("qr", 14)} Pasá un producto por el lector: si existe lo abre para editar, si no, lo carga con ese código.</div>` : ""}
    <div id="cat-out"><div class="empty" style="padding:36px">Cargando…</div></div>`;
  // Alternar vista conserva lo que estabas buscando (no recarga todo el catálogo).
  c.querySelectorAll("[data-view]").forEach((b) => b.onclick = () => {
    S.catQ = document.getElementById("cat-q").value.trim();
    S.catView = b.dataset.view;
    screenCatalogo(c);
  });
  const out = document.getElementById("cat-out");
  const load = async (q) => {
    try {
      const rows = await api("GET", `/api/products${q ? "?q=" + encodeURIComponent(q) : ""}`);
      S.productos = rows;
      if (!rows.length) { out.innerHTML = `<div class="empty" style="padding:40px">Sin productos.</div>`; return; }
      out.innerHTML = S.catView === "tabla" ? catTabla(rows) : catTarjetas(rows);
      // Con permiso: clic en un producto lo abre para editar/ajustar stock.
      if (puede) {
        out.querySelectorAll("[data-edit]").forEach((el) => {
          el.style.cursor = "pointer";
          el.onclick = () => {
            const p = rows.find((x) => String(x.id) === el.dataset.edit);
            if (p) formProducto(p, () => load(S.catQ || ""));
          };
        });
      }
    } catch (e) { toast(e.message, "err"); }
  };
  if (puede) {
    document.getElementById("cat-nuevo").onclick = () => formProducto({}, () => load(S.catQ || ""));
    document.getElementById("cat-import").onclick = () => document.getElementById("cat-file").click();
    document.getElementById("cat-file").onchange = (e) => {
      const f = e.target.files[0];
      e.target.value = ""; // limpiar para poder reimportar el MISMO archivo
      importarCSV(f, () => load(S.catQ || ""));
    };
    // Escaneo en el catálogo: existe → editar; no existe → alta con ese código.
    S.onScan = async (code) => {
      try {
        const rows = await api("GET", `/api/products?barcode=${encodeURIComponent(code)}`);
        const p = rows && rows[0];
        if (p) formProducto(p, () => load(S.catQ || ""));
        else formProducto({ barcode: code }, () => load(S.catQ || ""));
      } catch (e) { toast(e.message, "err"); }
    };
  }
  let deb;
  document.getElementById("cat-q").oninput = (e) => { S.catQ = e.target.value.trim(); clearTimeout(deb); deb = setTimeout(() => load(S.catQ), 250); };
  load(S.catQ || "");
}

/** Formulario de alta/edición de un producto (modal). El campo de código de
 *  barras se llena escaneando con el lector o tipeando. */
function formProducto(prod, onSaved) {
  prod = prod || {};
  const editando = !!prod.id;
  const m = modal(`<div style="padding:22px 24px">
    <h3 class="serif" style="font-size:20px;font-weight:700">${editando ? "Editar producto" : "Nuevo producto"}</h3>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:16px">
      <label class="field" style="grid-column:1/-1"><span>Código de barras (pasá el lector o escribí)</span>
        <input id="f-barcode" value="${esc(prod.barcode || "")}" placeholder="Escaneá con el lector…"/>
        <div id="f-bchint" style="font-size:11.5px;color:var(--ink2);margin-top:4px;min-height:15px"></div></label>
      <label class="field"><span>SKU / Código${editando ? "" : " (o dejá que use el de barras)"}</span>
        <input id="f-id" value="${esc(prod.id || "")}" ${editando ? "disabled" : ""}/></label>
      <label class="field"><span>Categoría</span><input id="f-cat" value="${esc(prod.category || "")}"/></label>
      <label class="field" style="grid-column:1/-1"><span>Nombre</span><input id="f-name" value="${esc(prod.name || "")}"/></label>
      <label class="field" style="grid-column:1/-1"><span>Ubicación (opcional — dónde está en la tienda)</span>
        <input id="f-ubic" value="${esc((prod.attributes && prod.attributes.ubicacion) || "")}" placeholder="Estante A3, vitrina 2, depósito…"/></label>
      <label class="field"><span>Precio de venta (Bs)</span><input id="f-price" type="number" min="0" step="0.01" value="${prod.price ?? ""}"/></label>
      <label class="field"><span>Costo (Bs)</span><input id="f-cost" type="number" min="0" step="0.01" value="${prod.cost ?? ""}"/></label>
      <label class="field"><span>Stock</span><input id="f-stock" type="number" step="1" value="${prod.stock ?? 0}"/></label>
    </div>
    <div id="f-err" style="color:var(--error);font-size:12.5px;margin-top:10px;min-height:16px"></div>
    <div style="display:flex;gap:10px;margin-top:6px">
      <button class="btn btn-outline btn-block" id="f-cancel">Cancelar</button>
      <button class="btn btn-primary btn-block" id="f-save">${editando ? "Guardar cambios" : "Crear producto"}</button>
    </div>
  </div>`);
  const $ = (sel) => m.querySelector(sel);
  const err = (t) => { $("#f-err").textContent = t || ""; };

  // Busca el código en bases públicas y precarga los campos VACÍOS (no pisa lo
  // que el usuario ya escribió). Solo tiene sentido para altas nuevas.
  const autocompletar = async (code) => {
    if (editando || !code || code.length < 6) return;
    const hint = $("#f-bchint");
    if (hint) hint.textContent = "Buscando datos del código…";
    try {
      const info = await api("GET", `/api/products/lookup/${encodeURIComponent(code)}`);
      const set = (sel, v) => { const el = $(sel); if (el && !el.value.trim() && v) el.value = v; };
      if (info && info.found) {
        set("#f-name", [info.brand, info.name].filter(Boolean).join(" ").trim() || info.name);
        set("#f-cat", info.category);
        if (hint) hint.textContent = "✓ Datos encontrados — revisá y completá el precio.";
      } else {
        if (hint) hint.textContent = info && info.country
          ? `Código de ${info.country}. No hay datos públicos: completá a mano.`
          : "Sin datos públicos de ese código: completá a mano.";
      }
    } catch (e) {
      if (hint) hint.textContent = "";
    }
  };

  // Mientras el form está abierto, el lector llena el código de barras y busca.
  const prevScan = S.onScan;
  S.onScan = (code) => {
    const b = $("#f-barcode");
    if (b) { b.value = code; }
    autocompletar(code);
    const nm = $("#f-name"); if (nm) nm.focus();
  };
  const cerrar = () => { S.onScan = prevScan; m.remove(); };
  // Restaurar el escaneo de la pantalla si se cierra tocando el fondo.
  m.addEventListener("click", (e) => { if (e.target === m) S.onScan = prevScan; });
  $("#f-cancel").onclick = cerrar;

  $("#f-save").onclick = async () => {
    const barcode = ($("#f-barcode").value || "").trim();
    const id = editando ? prod.id : (($("#f-id").value || "").trim() || barcode);
    const name = ($("#f-name").value || "").trim();
    if (!id) return err("Poné un SKU o escaneá un código de barras.");
    if (!name) return err("Poné el nombre del producto.");
    // La ubicación viaja como atributo; se mezcla con los del rubro para no
    // borrarlos. Vacío = se quita la ubicación.
    const attributes = { ...(prod.attributes || {}) };
    const ubic = ($("#f-ubic").value || "").trim();
    if (ubic) attributes.ubicacion = ubic;
    else delete attributes.ubicacion;
    const payload = {
      name,
      barcode,
      price: Number($("#f-price").value) || 0,
      cost: Number($("#f-cost").value) || 0,
      stock: parseInt($("#f-stock").value, 10) || 0,
      category: ($("#f-cat").value || "").trim() || "General",
      attributes,
    };
    $("#f-save").disabled = true;
    try {
      if (editando) await api("PATCH", `/api/products/${encodeURIComponent(prod.id)}`, payload);
      else await api("POST", "/api/products", { id, ...payload });
      toast(editando ? "Producto actualizado." : "Producto creado.", "ok");
      cerrar();
      if (onSaved) onSaved();
    } catch (e) {
      $("#f-save").disabled = false;
      err(e.message);
    }
  };

  // Escribir/pegar el código a mano también dispara la búsqueda (tras una pausa).
  let debBc;
  $("#f-barcode").addEventListener("input", (e) => {
    clearTimeout(debBc);
    const code = e.target.value.trim();
    debBc = setTimeout(() => autocompletar(code), 500);
  });

  // Nuevo con código ya cargado (escaneo desde el catálogo): buscar de una.
  if (!editando && prod.barcode) autocompletar(prod.barcode);

  // Nuevo sin código: enfocar el campo de barras para escanear de una.
  setTimeout(() => { const f = editando ? $("#f-name") : $("#f-barcode"); if (f) f.focus(); }, 60);
}

function catTabla(rows) {
  return `<div class="card"><table><thead><tr><th style="width:54px"></th><th>SKU</th><th>Producto</th><th>Categoría</th><th class="right">Precio</th><th class="right">Costo</th><th class="right">Stock</th></tr></thead><tbody>
    ${rows.map((p) => `<tr data-edit="${esc(p.id)}">
      <td>${thumb(p, 38)}</td>
      <td class="mono" style="font-weight:700;color:var(--yellow-deep)">${esc(p.id)}</td>
      <td>${esc(p.name)}</td>
      <td style="color:var(--ink2)">${esc(p.category || "")}</td>
      <td class="right mono">${bs(p.price)}</td>
      <td class="right mono" style="color:var(--ink2)">${bs(p.cost)}</td>
      <td class="right"><span class="chip ${Number(p.stock) <= 5 ? "bad" : "ok"}">${p.stock}</span></td>
    </tr>`).join("")}
  </tbody></table></div>`;
}

function catTarjetas(rows) {
  return `<div class="pgrid">
    ${rows.map((p) => `<div class="pcard" data-edit="${esc(p.id)}">
      <div class="pcard-img">${imgSrc(p) ? `<img src="${esc(imgSrc(p))}"/>` : `<span class="ph">${svg("catalogo", 34)}</span>`}</div>
      <div class="pcard-body">
        <div class="pcard-sku">${esc(p.id)}${p.category ? " · " + esc(p.category) : ""}</div>
        <div class="pcard-nm">${esc(p.name)}</div>
        <div class="pcard-foot">
          <span class="pcard-price mono">${bs(p.price)}</span>
          <span class="chip ${Number(p.stock) <= 5 ? "bad" : "ok"}">Stock ${p.stock}</span>
        </div>
      </div>
    </div>`).join("")}
  </div>`;
}

// ================================================================ VENTA (POS)
function screenVenta(c) {
  c.style.padding = "0";
  c.innerHTML = `
    <div class="pos">
      <div class="left">
        <input class="search" id="v-q" placeholder="Buscar por nombre, o pasá el lector de código de barras…" autofocus/>
        <div id="v-scanhint" style="margin-top:8px;font-size:12px;color:var(--ink2);display:flex;align-items:center;gap:6px">${svg("qr", 14)} Escaneá un producto y se agrega solo al comprobante.</div>
        <div id="v-res" style="margin-top:14px"></div>
      </div>
      <div class="cart">
        <div class="head">${svg("venta", 18)} Comprobante <span id="v-count" style="margin-left:auto;color:var(--ink2);font-weight:500;font-size:12px"></span></div>
        <div class="lines" id="v-lines"></div>
        <div class="foot">
          <input id="v-cli" placeholder="Cliente (opcional)" style="width:100%;padding:10px 12px;border:1px solid var(--line);border-radius:10px;outline:none"/>
          <div class="total-row" style="margin-top:12px"><span style="font-weight:600;color:var(--ink2)">Total</span><span class="amt" id="v-total">Bs 0.00</span></div>
          <button class="btn btn-primary btn-block" id="v-cobrar" style="margin-top:10px" disabled>Cobrar en efectivo</button>
          <button class="btn btn-outline btn-block" id="v-qr" style="margin-top:8px" disabled>${svg("qr", 16)} Cobrar con QR</button>
        </div>
      </div>
    </div>`;
  const resBox = document.getElementById("v-res");
  const q = document.getElementById("v-q");
  let deb;
  const buscar = async (text) => {
    if (!text.trim()) { resBox.innerHTML = `<div class="empty" style="padding:40px"><p>Escribí para buscar en el inventario.</p></div>`; return; }
    try {
      const rows = await api("GET", `/api/products?q=${encodeURIComponent(text)}&limit=8`);
      if (!rows.length) { resBox.innerHTML = `<div class="empty" style="padding:30px"><p><b>Sin resultados.</b><br/>No hay ese repuesto en el inventario.</p></div>`; return; }
      resBox.innerHTML = rows.map((p) => `
        <button class="result" data-id="${esc(p.id)}">
          <div style="flex:1">
            <div class="sku">${esc(p.id)}${p.category ? " · " + esc(p.category) : ""}</div>
            <div class="nm">${esc(p.name)}</div>
          </div>
          <div style="text-align:right">
            <div style="font-weight:700">${bs(p.price)}</div>
            <div style="font-size:11px;font-weight:700;color:${Number(p.stock) <= 0 ? "var(--error)" : "var(--success)"}">${Number(p.stock) <= 0 ? "Sin stock" : "Stock " + p.stock}</div>
          </div>
          <span class="add">${svg("plus", 18)}</span>
        </button>`).join("");
      resBox.querySelectorAll(".result").forEach((b) => b.onclick = () => { addToCart(rows.find((x) => x.id === b.dataset.id)); q.value = ""; buscar(""); q.focus(); });
    } catch (e) { toast(e.message, "err"); }
  };
  q.oninput = (e) => { clearTimeout(deb); deb = setTimeout(() => buscar(e.target.value), 220); };
  buscar("");
  // Escaneo con el lector: busca por código de barras EXACTO y agrega al carrito.
  S.onScan = async (code) => {
    try {
      const rows = await api("GET", `/api/products?barcode=${encodeURIComponent(code)}`);
      const p = rows && rows[0];
      if (p) {
        addToCart(p);
        toast(`Agregado: ${p.name}`, "ok");
      } else {
        toast(`Código ${code}: no hay ese producto. Cargalo en Catálogo.`, "err");
      }
    } catch (e) { toast(e.message, "err"); }
    if (q) { q.value = ""; buscar(""); q.focus(); }
  };
  document.getElementById("v-cobrar").onclick = cobrar;
  document.getElementById("v-qr").onclick = cobrarConQr;
  renderCart();
}

/** Cobrar con QR: genera el QR, ESPERA la confirmación del pago (polling del
 *  estado + confirmación manual del cajero) y RECIÉN AHÍ registra la venta. Así
 *  no se asienta una venta cobrada por QR sin que el pago esté confirmado. */
async function cobrarConQr() {
  if (!S.cart.length) return;
  const total = S.cart.reduce((a, l) => a + l.qty * l.price, 0);
  const clientName = document.getElementById("v-cli").value.trim();
  const items = S.cart.map((l) => ({ productId: l.id, sku: l.sku, name: l.name, qty: l.qty, unitPrice: l.price, discountPct: l.discountPct }));
  const qbtn = document.getElementById("v-qr");
  if (qbtn) qbtn.disabled = true;
  // 1) Generar el QR (la venta NO se registra todavía).
  let qr;
  try {
    qr = await api("POST", "/api/payments/qr", { amount: total, gloss: (S.business && S.business.name) || "easy pos" });
  } catch (e) { if (qbtn) qbtn.disabled = false; toast(e.message, "err"); return; }
  if (qbtn) qbtn.disabled = false;
  if (!qr || !qr.qrImage) return toast("No se pudo generar el QR de pago.", "err");

  // 2) Mostrar el QR y ESPERAR el pago. La venta se registra SOLA cuando el
  //    banco confirma el pago (polling del estado); no hay confirmación manual.
  let cerrado = false, registrando = false, intentos = 0;
  const m = modal(`<div style="padding:24px;text-align:center">
    <h3 class="serif" style="font-size:20px;font-weight:700;display:flex;align-items:center;justify-content:center;gap:8px">${svg("qr", 18)} Cobro con QR</h3>
    <p style="color:var(--ink2);font-size:13px;margin-top:2px">${bs(total)} · el cliente escanea desde la app de su banco</p>
    <div style="margin-top:14px;display:grid;place-items:center"><img src="${esc(qr.qrImage)}" style="width:220px;height:220px;border-radius:10px"/></div>
    <div id="qr-estado" style="margin-top:12px;font-size:13px;font-weight:600;color:var(--ink2);display:flex;align-items:center;justify-content:center;gap:8px"><span class="spin"></span> Esperando el pago…</div>
    <div style="margin-top:16px">
      <button class="btn btn-outline btn-block" id="qr-cancel">Cancelar</button>
    </div>
  </div>`);
  const cerrar = () => { cerrado = true; m.remove(); };
  const setEstado = (html) => { const e = document.getElementById("qr-estado"); if (e) e.innerHTML = html; };
  const registrarVenta = async () => {
    if (registrando || cerrado) return;
    registrando = true;
    setEstado(`<span style="color:var(--success)">✓ Pago confirmado — registrando la venta…</span>`);
    try {
      const sale = await api("POST", "/api/sales", { kind: "factura", clientName, payMethod: "QR / Transferencia", clientRef: uid(), items });
      cerrar();
      S.cart = [];
      screenVenta(document.getElementById("content"));
      confirmacionVenta(sale, total, "QR / Transferencia");
    } catch (e) { registrando = false; setEstado(`<span style="color:var(--error)">${esc(e.message)}</span>`); }
  };
  m.querySelector("#qr-cancel").onclick = cerrar;
  // 3) Polling del estado del pago: al confirmarse, la venta se registra sola.
  //    Sigue chequeando ~10 min; si no llega, se avisa y se puede cancelar.
  const poll = async () => {
    if (cerrado || registrando) return;
    intentos++;
    try {
      const st = await api("POST", "/api/payments/status", { correlativo: qr.correlativo, qrId: qr.qrId });
      if (st && st.pagado) return registrarVenta();
    } catch { /* reintentar en silencio */ }
    if (cerrado || registrando) return;
    if (intentos >= 170) {
      setEstado(`<span style="color:var(--ink2)">El pago no se confirmó todavía. Dejá esta ventana abierta o cancelá y volvé a intentar.</span>`);
      setTimeout(poll, 6000); // sigue chequeando, más espaciado
      return;
    }
    setTimeout(poll, 3500);
  };
  setTimeout(poll, 3000);
}

function addToCart(p) {
  if (!p) return;
  const ex = S.cart.find((l) => l.id === p.id);
  if (ex) ex.qty += 1;
  else S.cart.push({ id: p.id, sku: p.id, name: p.name, price: Number(p.price), stock: Number(p.stock || 0), qty: 1, discountPct: 0, ubic: (p.attributes && p.attributes.ubicacion) || "" });
  renderCart();
}

function renderCart() {
  const box = document.getElementById("v-lines");
  if (!box) return;
  if (!S.cart.length) { box.innerHTML = `<div class="empty" style="padding:40px"><p>Agregá productos desde la búsqueda.</p></div>`; }
  else {
    box.innerHTML = S.cart.map((l, i) => `
      <div class="line">
        <div style="display:flex;justify-content:space-between;gap:6px"><b style="font-size:13px">${esc(l.name)}</b><button data-x="${i}" style="border:none;background:none;color:var(--faint);cursor:pointer">✕</button></div>
        <div style="font-size:11px;color:var(--faint)">${esc(l.sku)} · ${bs(l.price)} c/u ${l.qty > l.stock ? `<span style="color:var(--error)">· supera stock (${l.stock})</span>` : ""}</div>
        ${l.ubic ? `<div style="font-size:11px;color:var(--yellow-deep);font-weight:600;margin-top:2px">📍 ${esc(l.ubic)}</div>` : ""}
        <div style="display:flex;align-items:center;gap:8px;margin-top:8px">
          <div class="qty"><button data-m="${i}">−</button><input data-q="${i}" value="${l.qty}"/><button data-p="${i}">+</button></div>
          <span style="margin-left:auto;font-weight:700">${bs(l.qty * l.price)}</span>
        </div>
      </div>`).join("");
    box.querySelectorAll("[data-x]").forEach((b) => b.onclick = () => { S.cart.splice(+b.dataset.x, 1); renderCart(); });
    box.querySelectorAll("[data-m]").forEach((b) => b.onclick = () => { const l = S.cart[+b.dataset.m]; l.qty = Math.max(1, l.qty - 1); renderCart(); });
    box.querySelectorAll("[data-p]").forEach((b) => b.onclick = () => { S.cart[+b.dataset.p].qty += 1; renderCart(); });
    box.querySelectorAll("[data-q]").forEach((inp) => inp.onchange = () => { S.cart[+inp.dataset.q].qty = Math.max(1, parseInt(inp.value) || 1); renderCart(); });
  }
  const total = S.cart.reduce((a, l) => a + l.qty * l.price, 0);
  const totalEl = document.getElementById("v-total");
  const countEl = document.getElementById("v-count");
  const cobrarEl = document.getElementById("v-cobrar");
  if (totalEl) totalEl.textContent = bs(total);
  if (countEl) countEl.textContent = S.cart.length ? `${S.cart.length} ${S.cart.length === 1 ? "ítem" : "ítems"}` : "";
  if (cobrarEl) cobrarEl.disabled = S.cart.length === 0;
  const qrEl = document.getElementById("v-qr");
  if (qrEl) qrEl.disabled = S.cart.length === 0;
}

async function cobrar() {
  if (!S.cart.length) return;
  const btn = document.getElementById("v-cobrar");
  btn.disabled = true; btn.textContent = "Procesando…";
  const total = S.cart.reduce((a, l) => a + l.qty * l.price, 0);
  const payMethod = "Efectivo"; // "Cobrar en efectivo" siempre registra en efectivo
  const clientName = document.getElementById("v-cli").value.trim();
  try {
    const sale = await api("POST", "/api/sales", {
      kind: "factura",
      clientName,
      payMethod,
      clientRef: uid(),
      items: S.cart.map((l) => ({ productId: l.id, sku: l.sku, name: l.name, qty: l.qty, unitPrice: l.price, discountPct: l.discountPct })),
    });
    S.cart = [];
    screenVenta(document.getElementById("content"));
    confirmacionVenta(sale, total, payMethod);
  } catch (e) {
    toast(e.message, "err");
    btn.disabled = false; btn.textContent = "Cobrar en efectivo";
  }
}

/** Confirmación grande de venta realizada (con total y acceso al comprobante). */
function confirmacionVenta(sale, total, payMethod) {
  const m = modal(`<div style="padding:28px 26px;text-align:center">
    <div style="width:66px;height:66px;border-radius:50%;background:rgba(46,166,107,.14);color:var(--success);display:grid;place-items:center;margin:0 auto">${svg("check", 34)}</div>
    <h3 class="serif" style="font-size:22px;font-weight:700;margin-top:14px">¡Venta realizada!</h3>
    <p style="color:var(--ink2);margin-top:4px;font-size:13.5px">Comprobante <b>${esc(sale.code)}</b> · stock actualizado</p>
    <div style="background:var(--surface2);border-radius:14px;padding:14px 16px;margin-top:16px;display:flex;justify-content:space-between;align-items:center">
      <span style="color:var(--ink2)">Total cobrado</span>
      <span class="serif mono" style="font-size:24px;font-weight:700">${bs(total)}</span>
    </div>
    <div style="color:var(--faint);font-size:12.5px;margin-top:8px">Pago: ${esc(payMethod)}</div>
    <div style="display:flex;gap:10px;margin-top:20px">
      <button class="btn btn-outline btn-block" id="cv-ver">Ver comprobante</button>
      <button class="btn btn-primary btn-block" id="cv-ok">Nueva venta</button>
    </div>
  </div>`);
  m.querySelector("#cv-ok").onclick = () => m.remove();
  m.querySelector("#cv-ver").onclick = () => { m.remove(); verVenta(sale.id); };
}

// ================================================================ HISTORIAL
async function screenHistorial(c) {
  c.innerHTML = `<div class="card"><table><thead><tr><th>Código</th><th>Tipo</th><th>Cliente</th><th class="center">Ítems</th><th class="right">Total</th><th>Método</th><th>Fecha</th><th></th></tr></thead><tbody id="h-body"><tr><td colspan="8" class="center" style="color:var(--faint);padding:30px">Cargando…</td></tr></tbody></table></div>`;
  const load = async () => {
    try {
      const rows = await api("GET", "/api/sales");
      const body = document.getElementById("h-body");
      if (!rows.length) { body.innerHTML = `<tr><td colspan="8" class="center" style="color:var(--faint);padding:30px">Todavía no hay ventas.</td></tr>`; return; }
      body.innerHTML = rows.map((s) => `
        <tr style="${s.voided ? "opacity:.5" : ""}">
          <td class="mono" style="font-weight:700">${esc(s.code)}</td>
          <td><span class="chip ${s.kind === "factura" ? "ok" : ""}" style="${s.kind !== "factura" ? "background:var(--yellow-soft);color:var(--yellow-deep)" : ""}">${s.kind === "factura" ? "Factura" : "Proforma"}</span></td>
          <td>${esc(s.clientName || "Consumidor final")}</td>
          <td class="center">${s.itemCount}</td>
          <td class="right mono" style="font-weight:700">${bs(s.total)}</td>
          <td style="color:var(--ink2)">${esc(s.payMethod || "")}</td>
          <td style="color:var(--ink2);font-size:12.5px">${fmtDate(s.createdAt)}</td>
          <td class="right">
            ${s.voided ? `<span class="chip bad">Anulada</span>` :
              `<button class="btn btn-outline" style="padding:6px 12px" data-ver="${s.id}">Ver</button>
               ${s.kind === "factura" ? `<button class="btn btn-outline" style="padding:6px 12px;color:var(--error);border-color:var(--error)" data-anular="${s.id}" data-code="${esc(s.code)}">Anular</button>` : ""}`}
          </td>
        </tr>`).join("");
      body.querySelectorAll("[data-ver]").forEach((b) => b.onclick = () => verVenta(b.dataset.ver));
      body.querySelectorAll("[data-anular]").forEach((b) => b.onclick = () => anularVenta(b.dataset.anular, b.dataset.code, load));
    } catch (e) { toast(e.message, "err"); }
  };
  load();
}

async function verVenta(id) {
  try {
    const s = await api("GET", `/api/sales/${id}`);
    const items = s.items || [];
    const m = modal(`
      <div class="printable" style="padding:22px 24px">
        <div style="text-align:center;margin-bottom:10px">
          <div class="serif" style="font-size:22px;font-weight:700">${esc((S.business && S.business.name) || "easy pos")}</div>
          <div style="font-size:12px;color:var(--ink2)">${s.kind === "factura" ? "FACTURA" : "PROFORMA"} · ${esc(s.code)}</div>
          <div style="font-size:11px;color:var(--faint)">${fmtDate(s.createdAt)}</div>
        </div>
        <div style="border-top:1px dashed var(--line);border-bottom:1px dashed var(--line);padding:8px 0;margin:8px 0">
          ${items.map((it) => `<div style="display:flex;justify-content:space-between;font-size:12.5px;margin:3px 0"><span>${it.qty}× ${esc(it.name)}</span><span class="mono">${bs(it.qty * it.unitPrice)}</span></div>`).join("")}
        </div>
        <div style="display:flex;justify-content:space-between;font-weight:700;font-size:16px"><span>TOTAL</span><span class="mono">${bs(s.total)}</span></div>
        <div style="font-size:11.5px;color:var(--ink2);margin-top:6px">Cliente: ${esc(s.clientName || "Consumidor final")} · Pago: ${esc(s.payMethod || "")}</div>
      </div>
      <div style="padding:0 24px 20px;display:flex;gap:10px" class="no-print">
        <button class="btn btn-outline btn-block" id="m-close">Cerrar</button>
        <button class="btn btn-primary btn-block" id="m-print">Imprimir</button>
      </div>`);
    m.querySelector("#m-close").onclick = () => m.remove();
    m.querySelector("#m-print").onclick = () => window.print();
  } catch (e) { toast(e.message, "err"); }
}

async function anularVenta(id, code, onDone) {
  const m = modal(`<div style="padding:24px">
    <h3 class="serif" style="font-size:20px">Anular ${esc(code)}</h3>
    <p style="color:var(--ink2);margin-top:8px;font-size:13.5px">Se marcará la venta como anulada y se devolverá el stock de los productos. Esta acción queda registrada.</p>
    <div style="display:flex;gap:10px;margin-top:18px">
      <button class="btn btn-outline btn-block" id="a-no">Cancelar</button>
      <button class="btn btn-block" id="a-si" style="background:var(--error);color:#fff">Anular y devolver stock</button>
    </div></div>`);
  m.querySelector("#a-no").onclick = () => m.remove();
  m.querySelector("#a-si").onclick = async () => {
    try { await api("PATCH", `/api/sales/${id}`, { void: true }); toast(`${code} anulada · stock devuelto`, "ok"); m.remove(); onDone(); }
    catch (e) { toast(e.message, "err"); }
  };
}

// ================================================================ GASTOS
async function screenGastos(c) {
  c.innerHTML = `
    <div style="display:flex;align-items:center;margin-bottom:14px">
      <div><span class="eyebrow">Egresos</span><div id="g-total" class="serif" style="font-size:26px;font-weight:700">Bs 0.00</div></div>
      <button class="btn btn-primary" id="g-new" style="margin-left:auto">+ Nuevo gasto</button>
    </div>
    <div class="card"><table><thead><tr><th>Fecha</th><th>Categoría</th><th>Descripción</th><th class="right">Monto</th></tr></thead><tbody id="g-body"><tr><td colspan="4" class="center" style="color:var(--faint);padding:30px">Cargando…</td></tr></tbody></table></div>`;
  const load = async () => {
    try {
      const rows = await api("GET", "/api/expenses");
      const total = rows.reduce((a, r) => a + (r.amount || 0), 0);
      document.getElementById("g-total").textContent = bs(total);
      const body = document.getElementById("g-body");
      body.innerHTML = rows.length ? rows.map((g) => `
        <tr><td style="color:var(--ink2)">${esc(g.spentAt)}</td><td>${esc(g.category)}</td><td>${esc(g.description)}</td><td class="right mono" style="font-weight:700">${bs(g.amount)}</td></tr>`).join("")
        : `<tr><td colspan="4" class="center" style="color:var(--faint);padding:30px">Sin gastos registrados.</td></tr>`;
    } catch (e) { toast(e.message, "err"); }
  };
  document.getElementById("g-new").onclick = () => {
    const hoy = new Date().toISOString().slice(0, 10);
    const m = modal(`<div style="padding:24px">
      <h3 class="serif" style="font-size:20px">Nuevo gasto</h3>
      <label class="field"><span>Categoría</span><input id="g-cat" placeholder="Ej. Servicios, Alquiler…"/></label>
      <label class="field"><span>Descripción</span><input id="g-desc" placeholder="Detalle del gasto"/></label>
      <label class="field"><span>Monto (Bs)</span><input id="g-amt" type="number" value="0"/></label>
      <label class="field"><span>Fecha</span><input id="g-date" type="date" value="${hoy}"/></label>
      <div style="display:flex;gap:10px;margin-top:18px"><button class="btn btn-outline btn-block" id="g-x">Cancelar</button><button class="btn btn-primary btn-block" id="g-ok">Guardar</button></div></div>`);
    m.querySelector("#g-x").onclick = () => m.remove();
    m.querySelector("#g-ok").onclick = async () => {
      const amount = parseFloat(m.querySelector("#g-amt").value) || 0;
      if (amount <= 0) return toast("Ingresá un monto mayor a cero", "err");
      try {
        await api("POST", "/api/expenses", { category: m.querySelector("#g-cat").value.trim() || "General", description: m.querySelector("#g-desc").value.trim(), amount, spentAt: m.querySelector("#g-date").value });
        toast("Gasto registrado", "ok"); m.remove(); load();
      } catch (e) { toast(e.message, "err"); }
    };
  };
  load();
}

// ================================================================ CORTE DE CAJA
async function screenCaja(c) {
  c.innerHTML = `<div id="caja"></div>`;
  try {
    const r = await api("GET", "/api/cash");
    const box = document.getElementById("caja");
    box.innerHTML = `
      <p style="color:var(--ink2);margin-bottom:14px">Turno desde ${r.fromAt ? fmtDate(r.fromAt) : "el inicio del día"} · ${r.numVentas} venta(s).</p>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px">
        ${statCard("Total ventas", bs(r.totalVentas))}
        ${statCard("Efectivo", bs(r.totalEfectivo))}
        ${statCard("QR / Transf.", bs(r.totalQr))}
        ${statCard("Otros", bs(r.totalOtros))}
      </div>
      <div class="card" style="padding:20px;margin-top:18px;max-width:460px">
        <span class="eyebrow">Arqueo</span>
        <label class="field"><span>Efectivo contado en caja (Bs)</span><input id="cj-count" type="number" value="0"/></label>
        <div class="total-row" style="margin-top:14px"><span style="color:var(--ink2);font-weight:600">Diferencia</span><span class="amt" id="cj-diff">Bs 0.00</span></div>
        <button class="btn btn-primary btn-block" id="cj-close" style="margin-top:14px">Cerrar caja</button>
      </div>`;
    const inp = document.getElementById("cj-count");
    const diff = document.getElementById("cj-diff");
    const upd = () => { const d = (parseFloat(inp.value) || 0) - r.totalEfectivo; diff.textContent = (d >= 0 ? "" : "-") + bs(Math.abs(d)); diff.style.color = Math.abs(d) < 0.005 ? "var(--success)" : "var(--error)"; };
    inp.oninput = upd; upd();
    document.getElementById("cj-close").onclick = async () => {
      try { const res = await api("POST", "/api/cash", { countedCash: parseFloat(inp.value) || 0 }); toast(`Caja cerrada · diferencia ${bs(res.difference)}`, "ok"); screenCaja(c); }
      catch (e) { toast(e.message, "err"); }
    };
  } catch (e) { toast(e.message, "err"); }
}
function statCard(label, value, color) {
  return `<div class="stat"><div class="lbl">${esc(label)}</div><div class="num" style="${color ? "color:" + color : ""}">${value}</div></div>`;
}

// ================================================================ REPORTES
// Fechas locales YYYY-MM-DD (hora de la PC) y rangos rápidos.
function ymd(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function rangoRapido(cual) {
  const hoy = new Date();
  const d = new Date();
  if (cual === "ayer") { d.setDate(d.getDate() - 1); return { desde: ymd(d), hasta: ymd(d) }; }
  if (cual === "semana") { d.setDate(d.getDate() - 6); return { desde: ymd(d), hasta: ymd(hoy) }; }
  if (cual === "mes") return { desde: ymd(hoy).slice(0, 8) + "01", hasta: ymd(hoy) };
  return { desde: ymd(hoy), hasta: ymd(hoy) }; // hoy
}
// Descarga un archivo de texto (CSV) desde el renderer.
function descargarArchivo(nombre, contenido, mime) {
  const blob = new Blob(["﻿" + contenido], { type: (mime || "text/csv") + ";charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = nombre;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
// Arma una celda CSV segura (comillas si hace falta).
function csvCel(v) {
  const s = String(v ?? "");
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

async function screenReportes(c) {
  if (!S.rep) S.rep = { ...rangoRapido("mes"), tab: "resumen" };
  const R = S.rep;

  c.innerHTML = `
    <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:14px">
      <div class="viewtoggle">
        <button data-tab="resumen" class="${R.tab === "resumen" ? "active" : ""}">${svg("reportes", 16)} Resumen</button>
        <button data-tab="movs" class="${R.tab === "movs" ? "active" : ""}">${svg("historial", 16)} Movimientos</button>
      </div>
      <div style="flex:1"></div>
      <button class="btn btn-outline sm" data-q="ayer">Ayer</button>
      <button class="btn btn-outline sm" data-q="hoy">Hoy</button>
      <button class="btn btn-outline sm" data-q="semana">Semana</button>
      <button class="btn btn-outline sm" data-q="mes">Mes</button>
      <input type="date" id="rep-d" value="${R.desde}" class="date-input"/>
      <span style="color:var(--faint);font-size:12px">a</span>
      <input type="date" id="rep-h" value="${R.hasta}" class="date-input"/>
      <button class="btn btn-outline sm" id="rep-csv">${svg("reportes", 14)} Exportar CSV</button>
    </div>
    <div id="rep" class="empty">Cargando…</div>`;

  const rerender = () => screenReportes(c);
  c.querySelectorAll("[data-q]").forEach((b) => b.onclick = () => { Object.assign(R, rangoRapido(b.dataset.q)); rerender(); });
  c.querySelectorAll("[data-tab]").forEach((b) => b.onclick = () => { R.tab = b.dataset.tab; rerender(); });
  document.getElementById("rep-d").onchange = (e) => { R.desde = e.target.value; rerender(); };
  document.getElementById("rep-h").onchange = (e) => { R.hasta = e.target.value; rerender(); };

  const qs = `?desde=${R.desde}&hasta=${R.hasta}`;
  const box = document.getElementById("rep");
  try {
    if (R.tab === "movs") {
      const L = await api("GET", `/api/reports/ledger${qs}`);
      box.className = "";
      let saldo = 0;
      const filas = L.movimientos.map((m) => {
        saldo += m.monto;
        const ing = m.monto >= 0;
        return `<tr>
          <td style="color:var(--ink2)">${esc(m.fecha)}</td>
          <td>${ing ? "🟢 Ingreso" : "🔴 Egreso"}</td>
          <td>${esc(m.concepto)}${m.ref ? ` <span style="color:var(--faint)">· ${esc(m.ref)}</span>` : ""}</td>
          <td style="color:var(--ink2)">${esc(m.metodo)}</td>
          <td class="right mono" style="font-weight:700;color:${ing ? "var(--success)" : "var(--error)"}">${ing ? "" : "−"}${bs(Math.abs(m.monto))}</td>
          <td class="right mono">${bs(saldo)}</td>
        </tr>`;
      }).join("");
      box.innerHTML = `
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px">
          ${statCard("Ingresos", bs(L.ingresos), "var(--success)")}
          ${statCard("Egresos", bs(L.egresos), "var(--error)")}
          ${statCard("Neto", bs(L.neto), L.neto >= 0 ? "var(--success)" : "var(--error)")}
        </div>
        <div class="card" style="padding:0;margin-top:16px;overflow:auto">
          <table><thead><tr><th>Fecha</th><th>Tipo</th><th>Concepto</th><th>Método</th><th class="right">Monto</th><th class="right">Saldo</th></tr></thead>
          <tbody>${filas || `<tr><td colspan="6" class="center" style="color:var(--faint);padding:24px">Sin movimientos en el período.</td></tr>`}</tbody></table>
        </div>`;
      R._data = { tipo: "movs", L };
    } else {
      const r = await api("GET", `/api/reports${qs}`);
      const maxMes = Math.max(1, ...r.porMes.map((m) => m.total));
      box.className = "";
      box.innerHTML = `
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px">
          ${statCard("Ventas", bs(r.totalVentas))}
          ${statCard("Ganancia", bs(r.ganancia), r.ganancia >= 0 ? "var(--success)" : "var(--error)")}
          ${statCard("Ticket prom.", bs(r.ticketPromedio))}
          ${statCard("N° ventas", r.numVentas)}
        </div>
        <div style="display:grid;grid-template-columns:1.3fr 1fr;gap:16px;margin-top:16px">
          <div class="card" style="padding:18px">
            <span class="eyebrow">Ventas por período</span>
            <div style="display:flex;align-items:flex-end;gap:10px;height:150px;margin-top:14px;overflow-x:auto">
              ${r.porMes.length ? r.porMes.map((m) => `<div style="flex:0 0 56px;text-align:center"><div style="font-size:10px;font-weight:600;color:var(--ink2);margin-bottom:5px">${bs(m.total)}</div><div title="${bs(m.total)}" style="background:linear-gradient(180deg,var(--yellow),var(--yellow-deep));height:${Math.max(4, (m.total / maxMes) * 120)}px;border-radius:6px 6px 0 0"></div><div style="font-size:9.5px;color:var(--faint);margin-top:6px">${esc(m.mes.slice(5))}</div></div>`).join("") : `<span style="color:var(--faint);margin:auto">Sin ventas en el período.</span>`}
            </div>
          </div>
          <div class="card" style="padding:18px">
            <span class="eyebrow">Por método de pago</span>
            <div style="margin-top:12px">${r.porMetodo.length ? r.porMetodo.map((m) => `<div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--line);font-size:13px"><span>${esc(m.metodo)} <span style="color:var(--faint)">(${m.n})</span></span><b class="mono">${bs(m.total)}</b></div>`).join("") : `<span style="color:var(--faint)">—</span>`}</div>
          </div>
        </div>
        <div class="card" style="padding:18px;margin-top:16px">
          <span class="eyebrow">Productos más vendidos</span>
          <table style="margin-top:8px"><tbody>
            ${r.topProductos.length ? r.topProductos.map((t, i) => `<tr><td style="width:30px;color:var(--yellow-deep);font-weight:700">${i + 1}</td><td>${esc(t.name)}</td><td class="center" style="color:var(--ink2)">${t.qty} u.</td><td class="right mono" style="font-weight:700">${bs(t.revenue)}</td></tr>`).join("") : `<tr><td class="center" style="color:var(--faint);padding:20px">Sin datos.</td></tr>`}
          </tbody></table>
        </div>
        <p style="margin-top:12px;color:var(--faint);font-size:12px">Ganancia = ventas − costo de lo vendido − gastos. Costo vendido: ${bs(r.costoVendido)} · Gastos: ${bs(r.gastos)}.</p>`;
      R._data = { tipo: "resumen", r };
    }
  } catch (e) { box.innerHTML = `<div class="empty">${esc(e.message)}</div>`; }

  // Exportar CSV según la pestaña activa.
  document.getElementById("rep-csv").onclick = () => exportarCSV(R);
}

// Genera y descarga el CSV del período (movimientos o resumen).
async function exportarCSV(R) {
  const qs = `?desde=${R.desde}&hasta=${R.hasta}`;
  try {
    if (R.tab === "movs") {
      const L = R._data && R._data.tipo === "movs" ? R._data.L : await api("GET", `/api/reports/ledger${qs}`);
      let saldo = 0;
      const lineas = [["Fecha", "Tipo", "Concepto", "Comprobante", "Metodo", "Monto", "Saldo"].join(",")];
      for (const m of L.movimientos) {
        saldo += m.monto;
        lineas.push([m.fecha, m.monto >= 0 ? "Ingreso" : "Egreso", csvCel(m.concepto), csvCel(m.ref), csvCel(m.metodo), m.monto.toFixed(2), saldo.toFixed(2)].join(","));
      }
      lineas.push(["", "", "", "", "Ingresos", L.ingresos.toFixed(2), ""].join(","));
      lineas.push(["", "", "", "", "Egresos", L.egresos.toFixed(2), ""].join(","));
      lineas.push(["", "", "", "", "Neto", L.neto.toFixed(2), ""].join(","));
      descargarArchivo(`movimientos_${R.desde}_a_${R.hasta}.csv`, lineas.join("\n"));
    } else {
      const r = R._data && R._data.tipo === "resumen" ? R._data.r : await api("GET", `/api/reports${qs}`);
      const lineas = [
        ["Reporte del periodo", `${R.desde} a ${R.hasta}`].join(","),
        "",
        ["Concepto", "Monto"].join(","),
        ["Ventas", r.totalVentas.toFixed(2)].join(","),
        ["Costo de lo vendido", r.costoVendido.toFixed(2)].join(","),
        ["Gastos", r.gastos.toFixed(2)].join(","),
        ["Ganancia", r.ganancia.toFixed(2)].join(","),
        ["N ventas", r.numVentas].join(","),
        ["Ticket promedio", r.ticketPromedio.toFixed(2)].join(","),
        "",
        ["Por metodo de pago", "N", "Total"].join(","),
        ...r.porMetodo.map((m) => [csvCel(m.metodo), m.n, m.total.toFixed(2)].join(",")),
        "",
        ["Producto mas vendido", "Unidades", "Ingreso"].join(","),
        ...r.topProductos.map((t) => [csvCel(t.name), t.qty, t.revenue.toFixed(2)].join(",")),
      ];
      descargarArchivo(`reporte_${R.desde}_a_${R.hasta}.csv`, lineas.join("\n"));
    }
    toast("CSV descargado.", "ok");
  } catch (e) { toast(e.message, "err"); }
}

// ================================================================ USUARIOS (solo admin)
async function screenUsuarios(c) {
  if (!isAdmin()) {
    c.innerHTML = `<div class="empty"><div style="opacity:.4;margin-bottom:10px">${svg("usuarios", 40)}</div><h3 class="serif" style="font-size:20px">Solo para administradores</h3><p style="margin-top:6px">Tu cuenta no puede gestionar usuarios.</p></div>`;
    return;
  }
  c.innerHTML = `
    <div style="display:flex;align-items:center;margin-bottom:14px"><span class="eyebrow">Equipo</span><button class="btn btn-primary" id="u-new" style="margin-left:auto">+ Nuevo usuario</button></div>
    <div class="card"><table><thead><tr><th>Nombre</th><th>Correo</th><th>Teléfono</th><th>Rol</th><th class="center">Catálogo</th><th class="center">Estado</th><th class="right">Acciones</th></tr></thead><tbody id="u-body"><tr><td colspan="7" class="center" style="color:var(--faint);padding:30px">Cargando…</td></tr></tbody></table></div>
    <p style="margin-top:10px;color:var(--faint);font-size:12px">El permiso <b>Catálogo</b> deja que una vendedora registre y edite productos. El administrador siempre puede.</p>`;
  const load = async () => {
    try {
      const rows = await api("GET", "/api/employees");
      document.getElementById("u-body").innerHTML = rows.map((u) => {
        const admin = u.role === "Administrador";
        const has = !!(u.perms && u.perms.products);
        const self = u.id === S.user?.id;
        const cat = admin
          ? `<span class="chip" style="background:var(--surface2);color:var(--ink2)">Siempre</span>`
          : `<button class="chip ${has ? "ok" : ""}" data-perm="${esc(u.id)}" data-has="${has ? 1 : 0}" style="cursor:pointer;border:none;${has ? "" : "background:var(--surface2);color:var(--ink2)"}">${has ? "Sí" : "No"}</button>`;
        const acc = self
          ? `<span style="color:var(--faint);font-size:12px">Vos</span>`
          : `<button class="btn btn-outline" style="padding:6px 12px${u.active ? ";color:var(--error);border-color:var(--error)" : ""}" data-active="${esc(u.id)}" data-cur="${u.active ? 1 : 0}">${u.active ? "Desactivar" : "Activar"}</button>`;
        return `<tr style="${u.active ? "" : "opacity:.5"}"><td style="font-weight:600">${esc(u.name)}</td><td style="color:var(--ink2)">${esc(u.email || "—")}</td><td style="color:var(--ink2)">${esc(u.phone || "—")}</td><td>${esc(u.role)}</td><td class="center">${cat}</td><td class="center"><span class="chip ${u.active ? "ok" : "bad"}">${u.active ? "Activo" : "Inactivo"}</span></td><td class="right">${acc}</td></tr>`;
      }).join("");
      document.querySelectorAll("[data-perm]").forEach((b) => b.onclick = async () => {
        try { await api("PATCH", `/api/employees/${b.dataset.perm}`, { perms: { products: b.dataset.has !== "1" } }); load(); }
        catch (e) { toast(e.message, "err"); }
      });
      document.querySelectorAll("[data-active]").forEach((b) => b.onclick = async () => {
        try { await api("PATCH", `/api/employees/${b.dataset.active}`, { active: b.dataset.cur !== "1" }); load(); }
        catch (e) { toast(e.message, "err"); }
      });
    } catch (e) { toast(e.message, "err"); }
  };
  document.getElementById("u-new").onclick = () => {
    const m = modal(`<div style="padding:24px">
      <h3 class="serif" style="font-size:20px">Nuevo usuario</h3>
      <label class="field"><span>Nombre</span><input id="u-name"/></label>
      <label class="field"><span>Correo</span><input id="u-email" placeholder="opcional"/></label>
      <label class="field"><span>Teléfono</span><input id="u-phone" placeholder="opcional"/></label>
      <label class="field"><span>Contraseña</span><input id="u-pass" type="password"/></label>
      <label class="field"><span>Rol</span><select id="u-role"><option>Vendedora</option><option>Administrador</option></select></label>
      <label class="field" id="u-perm-wrap" style="display:flex;align-items:center;gap:8px;flex-direction:row"><input id="u-perm" type="checkbox" style="width:auto"/><span style="margin:0">Puede gestionar el catálogo (registrar y editar productos)</span></label>
      <div style="display:flex;gap:10px;margin-top:18px"><button class="btn btn-outline btn-block" id="u-x">Cancelar</button><button class="btn btn-primary btn-block" id="u-ok">Crear</button></div></div>`);
    // El admin siempre puede el catálogo: la casilla solo aplica a otros roles.
    const roleSel = m.querySelector("#u-role");
    const permWrap = m.querySelector("#u-perm-wrap");
    const syncPerm = () => { permWrap.style.display = roleSel.value === "Administrador" ? "none" : "flex"; };
    roleSel.onchange = syncPerm; syncPerm();
    m.querySelector("#u-x").onclick = () => m.remove();
    m.querySelector("#u-ok").onclick = async () => {
      const name = m.querySelector("#u-name").value.trim();
      const pass = m.querySelector("#u-pass").value;
      const email = m.querySelector("#u-email").value.trim();
      const phone = m.querySelector("#u-phone").value.trim();
      const role = roleSel.value;
      const perm = m.querySelector("#u-perm").checked && role !== "Administrador";
      if (!name || !pass || (!email && !phone)) return toast("Nombre, contraseña y correo o teléfono son obligatorios", "err");
      try {
        const nuevo = await api("POST", "/api/employees", { name, email, phone, pass, role });
        // El permiso de catálogo se asigna después (el alta no lo toma).
        if (perm && nuevo && nuevo.id) {
          try { await api("PATCH", `/api/employees/${nuevo.id}`, { perms: { products: true } }); } catch { /* no bloquea el alta */ }
        }
        toast("Usuario creado", "ok"); m.remove(); load();
      } catch (e) { toast(e.message, "err"); }
    };
  };
  load();
}

// ================================================================ IMPORTAR CSV
function parseCSV(text) {
  const clean = text.replace(/\r/g, "");
  const delim = (clean.split("\n")[0].match(/;/g) || []).length > (clean.split("\n")[0].match(/,/g) || []).length ? ";" : ",";
  const rows = [];
  let row = [], cur = "", q = false;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (q) { if (ch === '"') { if (clean[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
    else if (ch === '"') q = true;
    else if (ch === delim) { row.push(cur); cur = ""; }
    else if (ch === "\n") { row.push(cur); rows.push(row); row = []; cur = ""; }
    else cur += ch;
  }
  if (cur !== "" || row.length) { row.push(cur); rows.push(row); }
  return rows.filter((r) => r.some((x) => x.trim() !== ""));
}

async function importarCSV(file, onDone) {
  if (!file) return;
  const text = await file.text();
  const rows = parseCSV(text);
  if (rows.length < 2) return toast("El CSV está vacío o no tiene datos.", "err");
  const head = rows[0].map((h) => norm(h.trim()));
  const col = (...names) => { for (const n of names) { const i = head.indexOf(n); if (i >= 0) return i; } return -1; };
  const ci = { id: col("sku", "id", "codigo", "code"), name: col("nombre", "name", "producto"), price: col("precio", "price", "venta"), cost: col("costo", "cost"), stock: col("stock", "cantidad"), barcode: col("barcode", "codigo de barras", "ean"), category: col("categoria", "category", "rubro"), desc: col("descripcion", "desc") };
  if (ci.id < 0 || ci.name < 0) return toast("El CSV necesita al menos columnas 'sku' y 'nombre'.", "err");
  const data = rows.slice(1);
  toast(`Importando ${data.length} productos…`);
  let ok = 0, err = 0;
  for (const r of data) {
    const g = (i) => (i >= 0 ? (r[i] || "").trim() : "");
    const id = g(ci.id);
    if (!id) { err++; continue; }
    try {
      await api("POST", "/api/products", {
        id, name: g(ci.name), desc: g(ci.desc),
        price: parseFloat(g(ci.price)) || 0, cost: parseFloat(g(ci.cost)) || 0,
        stock: parseInt(g(ci.stock)) || 0, barcode: g(ci.barcode), category: g(ci.category) || "General",
      });
      ok++;
    } catch { err++; }
  }
  toast(`Importación: ${ok} creados${err ? `, ${err} con error/repetidos` : ""}`, err && !ok ? "err" : "ok");
  onDone && onDone();
}
