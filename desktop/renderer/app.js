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
  }[s] || screenStub)(c, s);
}

function screenStub(c, s) {
  c.innerHTML = `<div class="empty"><div style="opacity:.4;margin-bottom:10px">${svg(NAV.find(n=>n.s===s)?.ic || "reportes", 40)}</div><h3 class="serif" style="font-size:20px">${TITLE[s]}</h3><p style="margin-top:6px">Esta sección está en construcción (próxima etapa).</p></div>`;
}

// ================================================================ CATÁLOGO
async function screenCatalogo(c) {
  c.innerHTML = `
    <div style="margin-bottom:14px"><input class="search" id="cat-q" placeholder="Buscar por código, nombre, código de barras…"/></div>
    <div class="card"><table><thead><tr><th>SKU</th><th>Producto</th><th>Categoría</th><th class="right">Precio</th><th class="right">Costo</th><th class="right">Stock</th></tr></thead><tbody id="cat-body"><tr><td colspan="6" class="center" style="color:var(--faint);padding:30px">Cargando…</td></tr></tbody></table></div>`;
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
