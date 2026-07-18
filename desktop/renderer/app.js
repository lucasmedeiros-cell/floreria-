// Auto Piezas Coquito — programa de PC (renderer).
// Toda escritura/lectura pasa por la API de easy pos (window.easypos.request),
// que corre en el proceso main. Sin SQL directo: los datos se comparten con la
// app móvil y el POS sin riesgo de corromper la base.

const root = document.getElementById("root");
const S = {
  apiBase: "http://localhost:3010",
  token: null,
  user: null,
  screen: "venta",
  productos: [],
  cart: [], // { id, sku, name, price, stock, qty, discountPct }
};

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
};
function svg(name, size = 20) {
  const d = IC[name] || "";
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d.split(" M").map((p, i) => `<path d="${i ? "M" + p : p}"/>`).join("")}</svg>`;
}

// ------------------------------------------------------------------ arranque
(async function init() {
  const cfg = await window.easypos.getConfig();
  S.apiBase = cfg.apiBase || S.apiBase;
  renderLogin();
})();

// ================================================================ LOGIN
function renderLogin(err) {
  root.innerHTML = `
    <div id="login">
      <div class="brand">
        <div class="logo">${logoMark(56)}</div>
        <h1>Auto Piezas<br/>Coquito</h1>
        <p>Punto de venta y gestión. Los datos se comparten con el mostrador y la app del teléfono.</p>
      </div>
      <div class="form">
        <span class="eyebrow">easy pos</span>
        <h2>Iniciar sesión</h2>
        <label class="field"><span>Correo o teléfono</span><input id="l-id" autofocus placeholder="admin@coquito.local"/></label>
        <label class="field"><span>Contraseña</span><input id="l-pass" type="password" placeholder="••••••••"/></label>
        <label class="field"><span>Servidor easy pos</span><input id="l-srv" value="${esc(S.apiBase)}"/></label>
        ${err ? `<p style="color:var(--error);font-size:12.5px;margin-top:10px">${esc(err)}</p>` : ""}
        <button class="btn btn-primary btn-block" id="l-go" style="margin-top:18px">Ingresar</button>
      </div>
    </div>`;
  const go = async () => {
    const identifier = document.getElementById("l-id").value.trim();
    const pass = document.getElementById("l-pass").value;
    const srv = document.getElementById("l-srv").value.trim();
    if (!identifier || !pass) return renderLogin("Ingresá tu usuario y contraseña.");
    document.getElementById("l-go").disabled = true;
    S.apiBase = srv;
    await window.easypos.setConfig({ apiBase: srv });
    try {
      const data = await api("POST", "/api/auth/employee/login", { identifier, email: identifier, pass });
      S.token = data.token;
      S.user = data;
      renderApp();
    } catch (e) {
      renderLogin(e.message.includes("conect") ? e.message : "Usuario o contraseña incorrectos.");
    }
  };
  document.getElementById("l-go").onclick = go;
  document.getElementById("l-pass").addEventListener("keydown", (e) => e.key === "Enter" && go());
}

function logoMark(size) {
  // Recuadro amarillo con "easy pos" — mini réplica del logo.
  return `<div style="width:${size}px;height:${size}px;background:var(--yellow);border-radius:10px;display:grid;place-items:center;color:#000;font-family:var(--serif);font-weight:700;line-height:.9;text-align:center;font-size:${size*0.3}px"><div><i style="font-weight:400;font-size:${size*0.22}px">easy</i><br/>pos</div></div>`;
}

// ================================================================ SHELL
const NAV = [
  { s: "venta", label: "Venta", ic: "venta" },
  { s: "catalogo", label: "Catálogo", ic: "catalogo" },
  { s: "historial", label: "Historial", ic: "historial" },
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
          <div class="name">Auto Piezas<small>COQUITO</small></div>
        </div>
        <nav id="nav">
          ${NAV.map((n) => `<button class="navitem${n.s === S.screen ? " active" : ""}" data-s="${n.s}"><span class="ic">${svg(n.ic, 19)}</span>${n.label}</button>`).join("")}
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
  navigate(S.screen);
}

function navigate(s) {
  S.screen = s;
  document.querySelectorAll(".navitem").forEach((b) => b.classList.toggle("active", b.dataset.s === s));
  const t = document.getElementById("hdr-title");
  if (t) t.textContent = TITLE[s] || "";
  const c = document.getElementById("content");
  ({
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

function screenStub(c, s) {
  c.innerHTML = `<div class="empty"><div style="opacity:.4;margin-bottom:10px">${svg(NAV.find(n=>n.s===s)?.ic || "reportes", 40)}</div><h3 class="serif" style="font-size:20px">${TITLE[s]}</h3><p style="margin-top:6px">Esta sección está en construcción (próxima etapa).</p></div>`;
}

// ================================================================ CATÁLOGO
async function screenCatalogo(c) {
  c.innerHTML = `
    <div style="display:flex;gap:10px;margin-bottom:14px;align-items:center">
      <input class="search" id="cat-q" placeholder="Buscar por código, nombre, código de barras…" style="flex:1"/>
      <button class="btn btn-outline" id="cat-import">Importar CSV</button>
      <input type="file" id="cat-file" accept=".csv,text/csv" class="hidden"/>
    </div>
    <div class="card"><table><thead><tr><th>SKU</th><th>Producto</th><th>Categoría</th><th class="right">Precio</th><th class="right">Costo</th><th class="right">Stock</th></tr></thead><tbody id="cat-body"><tr><td colspan="6" class="center" style="color:var(--faint);padding:30px">Cargando…</td></tr></tbody></table></div>`;
  document.getElementById("cat-import").onclick = () => document.getElementById("cat-file").click();
  document.getElementById("cat-file").onchange = (e) => importarCSV(e.target.files[0], () => load(document.getElementById("cat-q").value.trim()));
  const load = async (q) => {
    try {
      const rows = await api("GET", `/api/products${q ? "?q=" + encodeURIComponent(q) : ""}`);
      S.productos = rows;
      const body = document.getElementById("cat-body");
      if (!rows.length) { body.innerHTML = `<tr><td colspan="6" class="center" style="color:var(--faint);padding:30px">Sin productos.</td></tr>`; return; }
      body.innerHTML = rows.map((p) => `
        <tr>
          <td class="mono" style="font-weight:700;color:var(--yellow-deep)">${esc(p.id)}</td>
          <td>${esc(p.name)}</td>
          <td style="color:var(--ink2)">${esc(p.category || "")}</td>
          <td class="right mono">${bs(p.price)}</td>
          <td class="right mono" style="color:var(--ink2)">${bs(p.cost)}</td>
          <td class="right"><span class="chip ${Number(p.stock) <= 5 ? "bad" : "ok"}">${p.stock}</span></td>
        </tr>`).join("");
    } catch (e) { toast(e.message, "err"); }
  };
  let deb;
  document.getElementById("cat-q").oninput = (e) => { clearTimeout(deb); deb = setTimeout(() => load(e.target.value.trim()), 250); };
  load("");
}

// ================================================================ VENTA (POS)
function screenVenta(c) {
  c.style.padding = "0";
  c.innerHTML = `
    <div class="pos">
      <div class="left">
        <input class="search" id="v-q" placeholder="Buscar repuesto en el inventario…" autofocus/>
        <div id="v-res" style="margin-top:14px"></div>
      </div>
      <div class="cart">
        <div class="head">${svg("venta", 18)} Comprobante <span id="v-count" style="margin-left:auto;color:var(--ink2);font-weight:500;font-size:12px"></span></div>
        <div class="lines" id="v-lines"></div>
        <div class="foot">
          <input id="v-cli" placeholder="Cliente (opcional)" style="width:100%;padding:10px 12px;border:1px solid var(--line);border-radius:10px;outline:none"/>
          <select id="v-pay" style="width:100%;padding:10px 12px;border:1px solid var(--line);border-radius:10px;margin-top:8px;outline:none">
            <option>Efectivo</option><option>QR / Transferencia</option><option>Tarjeta</option>
          </select>
          <div class="total-row" style="margin-top:12px"><span style="font-weight:600;color:var(--ink2)">Total</span><span class="amt" id="v-total">Bs 0.00</span></div>
          <button class="btn btn-primary btn-block" id="v-cobrar" style="margin-top:10px" disabled>Cobrar y facturar</button>
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
  document.getElementById("v-cobrar").onclick = cobrar;
  renderCart();
}

function addToCart(p) {
  if (!p) return;
  const ex = S.cart.find((l) => l.id === p.id);
  if (ex) ex.qty += 1;
  else S.cart.push({ id: p.id, sku: p.id, name: p.name, price: Number(p.price), stock: Number(p.stock || 0), qty: 1, discountPct: 0 });
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
}

async function cobrar() {
  if (!S.cart.length) return;
  const btn = document.getElementById("v-cobrar");
  btn.disabled = true; btn.textContent = "Procesando…";
  try {
    const sale = await api("POST", "/api/sales", {
      kind: "factura",
      clientName: document.getElementById("v-cli").value.trim(),
      payMethod: document.getElementById("v-pay").value,
      clientRef: uid(),
      items: S.cart.map((l) => ({ productId: l.id, sku: l.sku, name: l.name, qty: l.qty, unitPrice: l.price, discountPct: l.discountPct })),
    });
    toast(`Venta ${sale.code} registrada · stock actualizado`, "ok");
    S.cart = [];
    screenVenta(document.getElementById("content"));
  } catch (e) {
    toast(e.message, "err");
    btn.disabled = false; btn.textContent = "Cobrar y facturar";
  }
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
          <div class="serif" style="font-size:22px;font-weight:700">Auto Piezas Coquito</div>
          <div style="font-size:12px;color:var(--ink2)">${s.kind === "factura" ? "FACTURA" : "PROFORMA"} · ${esc(s.code)}</div>
          <div style="font-size:11px;color:var(--faint)">${fmtDate(s.createdAt)}</div>
        </div>
        <div style="border-top:1px dashed var(--line);border-bottom:1px dashed var(--line);padding:8px 0;margin:8px 0">
          ${items.map((it) => `<div style="display:flex;justify-content:space-between;font-size:12.5px;margin:3px 0"><span>${it.qty}× ${esc(it.name)}</span><span class="mono">${bs(it.qty * it.unit_price)}</span></div>`).join("")}
        </div>
        <div style="display:flex;justify-content:space-between;font-weight:700;font-size:16px"><span>TOTAL</span><span class="mono">${bs(s.total)}</span></div>
        <div style="font-size:11.5px;color:var(--ink2);margin-top:6px">Cliente: ${esc(s.client_name || "Consumidor final")} · Pago: ${esc(s.pay_method || "")}</div>
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
async function screenReportes(c) {
  c.innerHTML = `<div id="rep" class="empty">Cargando…</div>`;
  try {
    const r = await api("GET", "/api/reports");
    const maxMes = Math.max(1, ...r.porMes.map((m) => m.total));
    document.getElementById("rep").className = "";
    document.getElementById("rep").innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px">
        ${statCard("Ventas", bs(r.totalVentas))}
        ${statCard("Ganancia", bs(r.ganancia), r.ganancia >= 0 ? "var(--success)" : "var(--error)")}
        ${statCard("Ticket prom.", bs(r.ticketPromedio))}
        ${statCard("N° ventas", r.numVentas)}
      </div>
      <div style="display:grid;grid-template-columns:1.3fr 1fr;gap:16px;margin-top:16px">
        <div class="card" style="padding:18px">
          <span class="eyebrow">Ventas por mes</span>
          <div style="display:flex;align-items:flex-end;gap:10px;height:150px;margin-top:14px">
            ${r.porMes.length ? r.porMes.map((m) => `<div style="flex:1;text-align:center"><div title="${bs(m.total)}" style="background:linear-gradient(180deg,var(--yellow),var(--yellow-deep));height:${Math.max(4, (m.total / maxMes) * 120)}px;border-radius:6px 6px 0 0"></div><div style="font-size:10px;color:var(--faint);margin-top:6px">${esc(m.mes.slice(5))}</div></div>`).join("") : `<span style="color:var(--faint);margin:auto">Sin ventas aún.</span>`}
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
  } catch (e) { document.getElementById("rep").innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
}

// ================================================================ USUARIOS
async function screenUsuarios(c) {
  c.innerHTML = `
    <div style="display:flex;align-items:center;margin-bottom:14px"><span class="eyebrow">Equipo</span><button class="btn btn-primary" id="u-new" style="margin-left:auto">+ Nuevo usuario</button></div>
    <div class="card"><table><thead><tr><th>Nombre</th><th>Correo</th><th>Teléfono</th><th>Rol</th><th class="center">Estado</th></tr></thead><tbody id="u-body"><tr><td colspan="5" class="center" style="color:var(--faint);padding:30px">Cargando…</td></tr></tbody></table></div>`;
  const load = async () => {
    try {
      const rows = await api("GET", "/api/employees");
      document.getElementById("u-body").innerHTML = rows.map((u) => `
        <tr style="${u.active ? "" : "opacity:.5"}"><td style="font-weight:600">${esc(u.name)}</td><td style="color:var(--ink2)">${esc(u.email || "—")}</td><td style="color:var(--ink2)">${esc(u.phone || "—")}</td><td>${esc(u.role)}</td><td class="center"><span class="chip ${u.active ? "ok" : "bad"}">${u.active ? "Activo" : "Inactivo"}</span></td></tr>`).join("");
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
      <div style="display:flex;gap:10px;margin-top:18px"><button class="btn btn-outline btn-block" id="u-x">Cancelar</button><button class="btn btn-primary btn-block" id="u-ok">Crear</button></div></div>`);
    m.querySelector("#u-x").onclick = () => m.remove();
    m.querySelector("#u-ok").onclick = async () => {
      const name = m.querySelector("#u-name").value.trim();
      const pass = m.querySelector("#u-pass").value;
      const email = m.querySelector("#u-email").value.trim();
      const phone = m.querySelector("#u-phone").value.trim();
      if (!name || !pass || (!email && !phone)) return toast("Nombre, contraseña y correo o teléfono son obligatorios", "err");
      try { await api("POST", "/api/employees", { name, email, phone, pass, role: m.querySelector("#u-role").value }); toast("Usuario creado", "ok"); m.remove(); load(); }
      catch (e) { toast(e.message, "err"); }
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
