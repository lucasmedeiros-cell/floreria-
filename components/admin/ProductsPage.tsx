"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeftRight,
  Bell,
  LayoutGrid,
  List,
  Package,
  PackageMinus,
  PackagePlus,
  Pencil,
  Plus,
  Search,
  Trash2,
  TrendingUp,
  Truck,
  X,
} from "lucide-react";
import {
  Product,
  ProductStatus,
  bs2,
  productPhotos,
  productStatusLabel,
} from "@/lib/products";
import { useBusiness, useProducts, useToast } from "@/context/StoreProvider";
import { apiListPurchaseOrders } from "@/lib/purchaseClient";
import { apiAdjustStock } from "@/lib/stockClient";
import { ProductImage } from "@/components/ProductImage";
import { OutlineButton, PrimaryButton } from "@/components/ui";
import { ImageGalleryField } from "./ImageGalleryField";
import { IconTile } from "./kit";

/** Igual que el umbral del reporte (`app/api/reports`): 5 o menos es alerta. */
const STOCK_BAJO = 5;

/**
 * Cómo se listan los productos: la tabla, o la fila de tarjetas con foto que
 * se corre de lado (es la que deja reconocer el producto por la imagen).
 */
type Vista = "tarjeta" | "lista";

/** Movimiento manual de stock: lo que entra sin pedido y lo que se devuelve. */
type Movimiento = "recibir" | "devolver";

export function ProductsPage({ onGo }: { onGo?: (s: "proveedor") => void }) {
  const model = useProducts();
  const { categories } = useBusiness();
  const { showToast } = useToast();

  const [q, setQ] = useState("");
  const [categoria, setCategoria] = useState("");
  const [estado, setEstado] = useState<"todos" | ProductStatus>("activo");
  const [vista, setVista] = useState<Vista>("lista");
  const [porPagina, setPorPagina] = useState(10);
  const [pagina, setPagina] = useState(1);

  const [editing, setEditing] = useState<Product | null>(null);
  const [creating, setCreating] = useState(false);
  const [movimiento, setMovimiento] = useState<Movimiento | null>(null);

  /** Pedidos a proveedor sin recibir: la tarjeta "solicitudes de stock". */
  const [solicitudes, setSolicitudes] = useState<number | null>(null);
  useEffect(() => {
    let alive = true;
    apiListPurchaseOrders()
      .then((pos) => {
        if (alive) setSolicitudes(pos.filter((p) => p.status === "solicitado").length);
      })
      .catch(() => alive && setSolicitudes(0));
    return () => {
      alive = false;
    };
  }, []);

  const buscados = useMemo(() => model.search(q), [model, q]);
  const list = useMemo(
    () =>
      buscados.filter(
        (p) =>
          (categoria === "" || p.category === categoria) &&
          (estado === "todos" || (p.status ?? "activo") === estado)
      ),
    [buscados, categoria, estado]
  );

  // Cambió el filtro: la página 4 de un resultado de 6 productos quedaría vacía.
  useEffect(() => setPagina(1), [q, categoria, estado, porPagina]);

  const totalPaginas = Math.max(1, Math.ceil(list.length / porPagina));
  const pag = Math.min(pagina, totalPaginas);
  const desde = (pag - 1) * porPagina;
  const visibles = list.slice(desde, desde + porPagina);

  const activos = model.products.filter((p) => (p.status ?? "activo") === "activo").length;
  const alertaStock = model.products.filter((p) => (p.stock ?? 0) <= STOCK_BAJO).length;

  const borrar = (p: Product) => {
    if (!window.confirm(`Se eliminará “${p.name}” del catálogo. ¿Continuar?`)) return;
    model.remove(p.id);
    showToast(`Producto ${p.id} eliminado`);
  };

  return (
    <div className="h-full overflow-y-auto bg-bg">
      <div className="mx-auto w-full max-w-[1500px] px-5 pb-10 pt-6 sm:px-8">
        {/* ---------- Título y acciones ---------- */}
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="mr-auto text-[27px] font-extrabold leading-none tracking-[-0.4px] text-ink">
            Inventario
          </h1>
          <BarButton
            icon={<PackagePlus size={16} />}
            label="Recibir mercadería"
            onClick={() => setMovimiento("recibir")}
          />
          <BarButton
            icon={<PackageMinus size={16} />}
            label="Devolver mercadería"
            onClick={() => setMovimiento("devolver")}
          />
          <BarButton
            icon={<Truck size={16} />}
            label="Proveedores"
            onClick={() => onGo?.("proveedor")}
          />
          <PrimaryButton
            label="Nuevo producto"
            icon={<Plus size={18} />}
            onClick={() => setCreating(true)}
          />
          <button
            onClick={() => setEstado("todos")}
            aria-label="Alertas de inventario"
            className="relative grid h-[42px] w-[42px] shrink-0 place-items-center rounded-[12px] border border-line bg-surface text-ink2 hover:text-ink"
          >
            <Bell size={19} />
            {alertaStock > 0 && (
              <span className="absolute -right-1.5 -top-1.5 grid h-[19px] min-w-[19px] place-items-center rounded-full bg-pink px-1 text-[10px] font-bold text-onAccent">
                {alertaStock}
              </span>
            )}
          </button>
        </div>

        {/* ---------- Vistazo del inventario ---------- */}
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <InvCard
            icon={<Bell size={26} />}
            tone="#F5A800"
            label="Alerta de stock"
            value={alertaStock}
          />
          <InvCard
            icon={<ArrowLeftRight size={26} />}
            tone="#17A2B8"
            label="Solicitudes de stock"
            value={solicitudes}
            onClick={() => onGo?.("proveedor")}
          />
          <InvCard
            icon={<TrendingUp size={26} />}
            tone="#2EA66B"
            label="Productos activos"
            value={activos}
          />
        </div>

        {/* ---------- Filtros y forma de ver ---------- */}
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <div className="flex h-[46px] min-w-[220px] flex-1 items-center gap-2.5 rounded-[12px] border border-line bg-surface px-4">
            <Search size={18} className="shrink-0 text-faint" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar producto…"
              className="w-full bg-transparent text-[13.5px] text-ink outline-none placeholder:text-faint"
            />
          </div>
          <select
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
            className="h-[46px] rounded-[12px] border border-line bg-surface px-3.5 text-[13px] font-medium text-ink outline-none focus:border-pink"
          >
            <option value="">Categorías</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select
            value={estado}
            onChange={(e) => setEstado(e.target.value as "todos" | ProductStatus)}
            className="h-[46px] rounded-[12px] border border-line bg-surface px-3.5 text-[13px] font-medium text-ink outline-none focus:border-pink"
          >
            <option value="activo">Estado: Activos</option>
            <option value="inactivo">Estado: Inactivos</option>
            <option value="todos">Estado: Todos</option>
          </select>

          <div className="ml-auto flex items-center gap-1 rounded-[12px] border border-line bg-surface p-1">
            <VistaBtn
              actual={vista}
              id="tarjeta"
              icon={<LayoutGrid size={15} />}
              label="Vista Tarjeta"
              onClick={setVista}
            />
            <VistaBtn
              actual={vista}
              id="lista"
              icon={<List size={15} />}
              label="Vista Lista"
              onClick={setVista}
            />
          </div>
        </div>

        {/* ---------- El catálogo ---------- */}
        {list.length === 0 ? (
          <div className="mt-5 flex flex-col items-center rounded-[18px] border border-line bg-surface py-16 text-center">
            <Package size={40} className="text-faint" />
            <h3 className="mt-3 text-[20px] font-bold text-ink">Sin resultados</h3>
            <p className="mt-1.5 text-[13px] text-ink2">
              Ajusta la búsqueda o registra un producto nuevo.
            </p>
          </div>
        ) : vista === "lista" ? (
          <TablaProductos
            list={visibles}
            onEdit={setEditing}
            onDelete={borrar}
          />
        ) : (
          // Las tarjetas mantienen su ancho (la foto se ve grande) y bajan de
          // fila cuando no entran: nada que deslizar de costado.
          <div className="mt-5 flex flex-wrap gap-4">
            {visibles.map((p) => (
              <div key={p.id} className="w-full max-w-[280px] sm:w-[280px]">
                <TarjetaProducto
                  p={p}
                  onEdit={() => setEditing(p)}
                  onDelete={() => borrar(p)}
                />
              </div>
            ))}
          </div>
        )}

        {/* ---------- Paginación ---------- */}
        {list.length > 0 && (
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <p className="text-[12.5px] text-ink2">
              Mostrando {desde + 1} a {desde + visibles.length} de {list.length} productos
            </p>
            <div className="mx-auto flex items-center gap-1.5">
              <PagBtn
                disabled={pag <= 1}
                onClick={() => setPagina(pag - 1)}
                label="Página anterior"
              >
                ‹
              </PagBtn>
              {Array.from({ length: totalPaginas }, (_, i) => i + 1)
                // Con muchas páginas solo se muestran las de alrededor.
                .filter((n) => Math.abs(n - pag) <= 2 || n === 1 || n === totalPaginas)
                .map((n) => (
                  <button
                    key={n}
                    onClick={() => setPagina(n)}
                    className={`h-9 min-w-9 rounded-[10px] px-2.5 text-[12.5px] font-bold ${
                      n === pag
                        ? "bg-pink text-onAccent"
                        : "border border-line bg-surface text-ink2 hover:text-ink"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              <PagBtn
                disabled={pag >= totalPaginas}
                onClick={() => setPagina(pag + 1)}
                label="Página siguiente"
              >
                ›
              </PagBtn>
            </div>
            <select
              value={porPagina}
              onChange={(e) => setPorPagina(Number(e.target.value))}
              className="h-[38px] rounded-[10px] border border-line bg-surface px-3 text-[12.5px] font-medium text-ink outline-none focus:border-pink"
            >
              {[10, 20, 50].map((n) => (
                <option key={n} value={n}>
                  {n} por página
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {(creating || editing) && (
        <ProductDialog
          product={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      )}

      {movimiento && (
        <StockDialog tipo={movimiento} onClose={() => setMovimiento(null)} />
      )}
    </div>
  );
}

/* ============================ Piezas ============================ */

function BarButton({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="inline-flex h-[42px] shrink-0 items-center gap-2 rounded-[12px] border border-line bg-surface px-4 text-[12.5px] font-semibold text-ink2 transition-colors hover:text-ink"
    >
      {icon} {label}
    </button>
  );
}

function VistaBtn({
  actual,
  id,
  icon,
  label,
  onClick,
}: {
  actual: Vista;
  id: Vista;
  icon: React.ReactNode;
  label: string;
  onClick: (v: Vista) => void;
}) {
  const active = actual === id;
  return (
    <button
      onClick={() => onClick(id)}
      className={`inline-flex items-center gap-2 rounded-[9px] px-3.5 py-2 text-[12.5px] font-semibold transition-colors ${
        active ? "bg-pink text-onAccent" : "text-ink2 hover:text-ink"
      }`}
    >
      {icon} <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

function InvCard({
  icon,
  tone,
  label,
  value,
  onClick,
}: {
  icon: React.ReactNode;
  tone: string;
  label: string;
  /** `null` mientras se carga: mejor un guion que un 0 que no es cierto. */
  value: number | null;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-4 rounded-[18px] border border-line bg-surface p-5 text-left shadow-card"
      style={{ borderTopColor: tone }}
    >
      <IconTile icon={icon} tone={tone} size={58} />
      <span className="min-w-0">
        <span className="block text-[11.5px] font-bold uppercase tracking-[0.8px] text-ink2">
          {label}
        </span>
        <span className="mt-1 block text-[28px] font-extrabold leading-none" style={{ color: tone }}>
          {value ?? "—"}
        </span>
      </span>
    </button>
  );
}

function PagBtn({
  children,
  disabled,
  onClick,
  label,
}: {
  children: React.ReactNode;
  disabled: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="grid h-9 w-9 place-items-center rounded-[10px] border border-line bg-surface text-[15px] font-bold text-ink2 disabled:opacity-40"
    >
      {children}
    </button>
  );
}

/** Vista Lista: la tabla, que es donde se ve el stock de un vistazo. */
function TablaProductos({
  list,
  onEdit,
  onDelete,
}: {
  list: Product[];
  onEdit: (p: Product) => void;
  onDelete: (p: Product) => void;
}) {
  return (
    <div className="mt-5 overflow-x-auto rounded-[18px] border border-line bg-surface shadow-card">
      <table className="w-full min-w-[720px] border-collapse">
        <thead>
          <tr className="border-b border-line">
            {["Producto", "Precio", "Stock", "Estado", "Acciones"].map((h, i) => (
              <th
                key={h}
                className={`px-5 py-3.5 text-[11px] font-bold uppercase tracking-[0.8px] text-ink2 ${
                  i === 0 ? "text-left" : "text-center"
                }`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {list.map((p) => {
            const activo = (p.status ?? "activo") === "activo";
            const stock = p.stock ?? 0;
            return (
              <tr key={p.id} className="border-b border-line last:border-0">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3.5">
                    <div className="relative h-[54px] w-[54px] shrink-0 overflow-hidden rounded-[10px] bg-surface2">
                      <ProductImage src={p.image} alt={p.name} sizes="54px" iconSize={20} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11.5px] font-bold uppercase tracking-[0.5px] text-pinkDeep">
                        {p.id}
                      </p>
                      <p className="truncate text-[14px] font-semibold text-ink">{p.name}</p>
                    </div>
                  </div>
                </td>
                <td className="whitespace-nowrap px-5 py-3 text-center text-[14px] font-bold text-ink">
                  {bs2(p.price)}
                </td>
                <td
                  className={`whitespace-nowrap px-5 py-3 text-center text-[13px] font-semibold ${
                    stock <= STOCK_BAJO ? "text-error" : "text-ink2"
                  }`}
                >
                  Stock: {stock}
                </td>
                <td className="px-5 py-3 text-center">
                  <StatusPill active={activo} />
                </td>
                <td className="px-5 py-3">
                  <div className="flex items-center justify-center gap-2">
                    <RowAction icon={<Pencil size={14} />} label="Editar" onClick={() => onEdit(p)} />
                    <RowAction
                      icon={<Trash2 size={14} />}
                      label="Eliminar"
                      danger
                      onClick={() => onDelete(p)}
                    />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function RowAction({
  icon,
  label,
  onClick,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-[10px] border border-line px-3 py-2 text-[12px] font-semibold transition-colors ${
        danger ? "text-error hover:border-error/50" : "text-ink2 hover:text-ink"
      }`}
    >
      {icon} {label}
    </button>
  );
}

/** Vista Tarjeta (y carrusel): la foto manda, que es como se reconoce el producto. */
function TarjetaProducto({
  p,
  onEdit,
  onDelete,
}: {
  p: Product;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const activo = (p.status ?? "activo") === "activo";
  return (
    <div className="flex h-full flex-col rounded-[18px] border border-line bg-surface p-4 shadow-card">
      <div className="relative">
        <div className="relative mx-auto h-[170px] w-full overflow-hidden rounded-[12px] bg-surface2">
          <ProductImage src={p.image} alt={p.name} sizes="280px" iconSize={34} />
        </div>
        <span className="absolute right-2 top-2">
          <StatusPill active={activo} />
        </span>
      </div>
      <h3 className="mt-3.5 line-clamp-2 text-center text-[14.5px] font-bold text-ink">{p.name}</h3>
      <p className="mt-1 text-center text-[17px] font-extrabold text-pinkDeep">{bs2(p.price)}</p>
      <p className="mt-1 text-center text-[11.5px] text-faint">
        {p.id} · Stock: {p.stock ?? 0}
      </p>
      <div className="mt-3.5 flex items-center justify-center gap-2">
        <RowAction icon={<Pencil size={14} />} label="Editar" onClick={onEdit} />
        <RowAction icon={<Trash2 size={14} />} label="Eliminar" danger onClick={onDelete} />
      </div>
    </div>
  );
}

function StatusPill({ active }: { active: boolean }) {
  const color = active ? "#2EA66B" : "#9C9094";
  return (
    <span
      className="rounded-full px-2.5 py-1 text-[10.5px] font-bold"
      style={{ background: `${color}1F`, color }}
    >
      {active ? "Activo" : "Inactivo"}
    </span>
  );
}

/**
 * Recibir o devolver mercadería: mueve el stock de un producto a mano y deja el
 * movimiento registrado con su motivo. La reposición CON pedido va por
 * Proveedores; esto es para lo que entra o sale sin pedido de por medio.
 */
function StockDialog({ tipo, onClose }: { tipo: Movimiento; onClose: () => void }) {
  const model = useProducts();
  const { showToast } = useToast();
  const recibir = tipo === "recibir";

  const [q, setQ] = useState("");
  const [sel, setSel] = useState<Product | null>(null);
  const [cantidad, setCantidad] = useState("1");
  const [motivo, setMotivo] = useState("");
  const [saving, setSaving] = useState(false);

  const opciones = useMemo(() => model.search(q).slice(0, 8), [model, q]);

  const guardar = async () => {
    if (!sel) return showToast("Elige el producto");
    const n = parseInt(cantidad, 10);
    if (!Number.isFinite(n) || n <= 0) return showToast("Ingresa una cantidad mayor a 0");
    if (!recibir && n > (sel.stock ?? 0))
      return showToast(`Solo hay ${sel.stock ?? 0} en stock de ${sel.name}`);

    setSaving(true);
    try {
      await apiAdjustStock(
        sel.id,
        recibir ? n : -n,
        motivo.trim() || (recibir ? "Mercadería recibida" : "Mercadería devuelta")
      );
      await model.refresh();
      showToast(
        recibir ? `Entraron ${n} de ${sel.name}` : `Salieron ${n} de ${sel.name}`
      );
      onClose();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "No se pudo mover el stock");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[85] flex items-center justify-center bg-black/40 p-5">
      <div className="flex max-h-[88vh] w-full max-w-[480px] flex-col rounded-[22px] bg-surface">
        <div className="flex items-start px-6 pb-3 pt-5">
          <div>
            <span className="eyebrow text-[10.5px] font-semibold text-ink">Inventario</span>
            <h2 className="mt-1 text-[22px] font-bold text-ink">
              {recibir ? "Recibir mercadería" : "Devolver mercadería"}
            </h2>
            <p className="mt-1 text-[12.5px] text-ink2">
              {recibir
                ? "Suma al stock lo que entró sin pedido de por medio."
                : "Descuenta del stock lo que sale (devolución, merma o error de carga)."}
            </p>
          </div>
          <button onClick={onClose} aria-label="Cerrar" className="ml-auto text-ink2">
            <X size={22} />
          </button>
        </div>
        <div className="h-px bg-line" />

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {sel ? (
            <div className="flex items-center gap-3 rounded-[14px] border border-line bg-surface2 p-3">
              <div className="relative h-[46px] w-[46px] shrink-0 overflow-hidden rounded-[10px] bg-surface">
                <ProductImage src={sel.image} alt={sel.name} sizes="46px" iconSize={18} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] font-semibold text-ink">{sel.name}</p>
                <p className="text-[11.5px] text-ink2">
                  {sel.id} · Stock actual: {sel.stock ?? 0}
                </p>
              </div>
              <button
                onClick={() => setSel(null)}
                className="shrink-0 text-[12px] font-semibold text-ink2 hover:text-ink"
              >
                Cambiar
              </button>
            </div>
          ) : (
            <>
              <Label>Producto</Label>
              <div className="mt-1.5 flex h-[46px] items-center gap-2.5 rounded-xl border border-line bg-surface px-3.5">
                <Search size={18} className="shrink-0 text-faint" />
                <input
                  autoFocus
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Buscar por SKU o nombre…"
                  className="w-full bg-transparent text-[13.5px] text-ink outline-none placeholder:text-faint"
                />
              </div>
              <div className="mt-2 flex flex-col gap-1.5">
                {opciones.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setSel(p)}
                    className="flex items-center gap-3 rounded-[12px] border border-line px-3 py-2 text-left hover:bg-surface2"
                  >
                    <div className="relative h-[38px] w-[38px] shrink-0 overflow-hidden rounded-[9px] bg-surface2">
                      <ProductImage src={p.image} alt={p.name} sizes="38px" iconSize={16} />
                    </div>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-semibold text-ink">
                        {p.name}
                      </span>
                      <span className="block text-[11.5px] text-ink2">
                        {p.id} · Stock: {p.stock ?? 0}
                      </span>
                    </span>
                  </button>
                ))}
                {opciones.length === 0 && (
                  <p className="py-3 text-center text-[12.5px] text-ink2">Sin resultados.</p>
                )}
              </div>
            </>
          )}

          {sel && (
            <>
              <div className="mt-3.5">
                <Label>Cantidad *</Label>
                <input
                  value={cantidad}
                  onChange={(e) => setCantidad(e.target.value)}
                  inputMode="numeric"
                  className="mt-1.5 w-full rounded-xl border border-line bg-surface px-3.5 py-3 text-[13.5px] text-ink outline-none focus:border-pink"
                />
              </div>
              <div className="mt-3.5">
                <Label>Motivo</Label>
                <input
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  placeholder={
                    recibir ? "Compra directa, reposición…" : "Devolución al proveedor, merma…"
                  }
                  className="mt-1.5 w-full rounded-xl border border-line bg-surface px-3.5 py-3 text-[13.5px] text-ink outline-none placeholder:text-faint focus:border-pink"
                />
              </div>
              <p className="mt-2.5 text-[12px] text-ink2">
                Queda como {recibir ? "entrada" : "salida"} de{" "}
                <span className="font-bold text-ink">{parseInt(cantidad, 10) || 0}</span>. Stock
                después:{" "}
                <span className="font-bold text-ink">
                  {Math.max(
                    0,
                    (sel.stock ?? 0) + (recibir ? 1 : -1) * (parseInt(cantidad, 10) || 0)
                  )}
                </span>
                .
              </p>
            </>
          )}
        </div>

        <div className="h-px bg-line" />
        <div className="flex items-center gap-2.5 p-4">
          <div className="flex-1">
            <OutlineButton label="Cancelar" full onClick={onClose} />
          </div>
          <PrimaryButton
            label={saving ? "Guardando…" : recibir ? "Recibir" : "Devolver"}
            icon={recibir ? <PackagePlus size={18} /> : <PackageMinus size={18} />}
            onClick={guardar}
            disabled={saving || !sel}
          />
        </div>
      </div>
    </div>
  );
}

function ProductDialog({
  product,
  onClose,
}: {
  product: Product | null;
  onClose: () => void;
}) {
  const model = useProducts();
  const { categories, noun } = useBusiness();
  const { showToast } = useToast();
  const isEdit = !!product;

  const [sku, setSku] = useState(product?.id ?? "");
  const [name, setName] = useState(product?.name ?? "");
  const [category, setCategory] = useState(product?.category ?? categories[0]);
  const [price, setPrice] = useState(product ? String(product.price) : "");
  const [stock, setStock] = useState(product ? String(product.stock ?? 0) : "0");
  const [status, setStatus] = useState<ProductStatus>(product?.status ?? "activo");
  // Galería: la primera foto es la principal (`image`). Los productos viejos
  // solo tienen `image`, así que se normaliza al abrir el formulario.
  const [images, setImages] = useState<string[]>(
    product ? productPhotos(product) : []
  );
  const [desc, setDesc] = useState(product?.desc ?? "");
  // Código de barras físico (EAN/UPC): es lo que escanea la app móvil. Distinto
  // del SKU, que es el código interno del negocio.
  const [barcode, setBarcode] = useState(product?.barcode ?? "");
  const [cost, setCost] = useState(product ? String(product.cost ?? 0) : "0");

  const save = async () => {
    const id = sku.trim();
    const nm = name.trim();
    const pr = parseFloat(price.replace(",", ".")) || 0;
    const st = parseInt(stock, 10) || 0;

    if (id === "") return showToast("Ingresa el SKU / código");
    if (nm === "") return showToast("Ingresa el nombre del producto");
    if (pr <= 0) return showToast("Ingresa un precio válido");
    if (model.skuExists(id, isEdit ? product!.id : undefined))
      return showToast(`El SKU "${id}" ya existe`);

    const data: Product = {
      id,
      name: nm,
      desc: desc.trim(),
      price: pr,
      cost: parseInt(cost, 10) || 0,
      barcode: barcode.trim(),
      // `image` sigue siendo la principal (lo que leen el ticket y la app);
      // `images` lleva la galería completa.
      image: images[0] ?? "",
      images,
      category,
      stock: st,
      status,
    };

    const ok = isEdit
      ? await model.update(product!.id, data)
      : await model.add(data);
    if (!ok) return showToast(`No se pudo guardar el producto "${id}"`);

    showToast(isEdit ? "Producto actualizado" : `Producto ${id} registrado`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[85] flex items-center justify-center bg-black/40 p-5">
      <div className="flex max-h-[88vh] w-full max-w-[520px] flex-col rounded-[22px] bg-surface">
        <div className="flex items-start px-6 pb-3 pt-5">
          <div>
            <span className="eyebrow text-[10.5px] font-semibold text-ink">
              {isEdit ? "Editar producto" : "Nuevo producto"}
            </span>
            <h2 className="mt-1 text-[23px] font-semibold text-ink">
              {isEdit ? product!.name : "Registrar producto"}
            </h2>
          </div>
          <button onClick={onClose} className="ml-auto text-ink2">
            <X size={22} />
          </button>
        </div>
        <div className="h-px bg-line" />

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <Field label="SKU / Código *" value={sku} onChange={setSku} placeholder="Ej. R213" />
            <div>
              <Label>Categoría</Label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-line bg-surface px-3.5 py-3 text-[13.5px] text-ink outline-none focus:border-pink"
              >
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <Field label="Nombre *" value={name} onChange={setName} placeholder={`Nombre del ${noun.one}`} />
          <Field
            label="Código de barras (EAN / UPC)"
            value={barcode}
            onChange={setBarcode}
            placeholder="Se completa solo al escanearlo desde la app"
          />
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <Field label="Precio de venta (Bs) *" value={price} onChange={setPrice} placeholder="0" />
            <Field label="Costo (Bs)" value={cost} onChange={setCost} placeholder="0" />
          </div>
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <Field label="Stock" value={stock} onChange={setStock} placeholder="0" />
            <div>
              <Label>Estado</Label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as ProductStatus)}
                className="mt-1.5 w-full rounded-xl border border-line bg-surface px-3.5 py-3 text-[13.5px] text-ink outline-none focus:border-pink"
              >
                <option value="activo">{productStatusLabel("activo")}</option>
                <option value="inactivo">{productStatusLabel("inactivo")}</option>
              </select>
            </div>
          </div>
          <div className="mt-3.5">
            <ImageGalleryField
              label="Fotos del producto"
              values={images}
              onChange={setImages}
              // El catálogo trae las fotos de cada producto en la misma
              // respuesta: acá conviene una imagen más liviana que en el hero.
              maxSide={1000}
              hint="La primera es la principal: es la que se ve en el catálogo y en el ticket. Las demás se muestran en la ficha del producto."
            />
          </div>
          <div>
            <Label>Descripción / palabras clave</Label>
            <textarea
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              rows={2}
              placeholder="Palabras clave para el buscador (marca, medida, modelo…)"
              className="mt-1.5 w-full rounded-xl border border-line bg-surface px-3.5 py-3 text-[13.5px] text-ink outline-none placeholder:text-faint focus:border-pink"
            />
          </div>
        </div>

        <div className="h-px bg-line" />
        <div className="flex items-center gap-2.5 p-4">
          <div className="flex-1">
            <OutlineButton label="Cancelar" full onClick={onClose} />
          </div>
          <PrimaryButton
            label={isEdit ? "Guardar cambios" : "Registrar"}
            icon={<Plus size={18} />}
            onClick={save}
          />
        </div>
      </div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-[12.5px] font-medium text-ink2">{children}</label>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="mt-0.5">
      <Label>{label}</Label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1.5 w-full rounded-xl border border-line bg-surface px-3.5 py-3 text-[13.5px] text-ink outline-none placeholder:text-faint focus:border-pink"
      />
    </div>
  );
}
