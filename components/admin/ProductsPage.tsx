"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { Flower2, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import {
  Product,
  ProductStatus,
  bs2,
  kProductCategories,
  productStatusLabel,
} from "@/lib/products";
import { useProducts, useToast } from "@/context/StoreProvider";
import { OutlineButton, PrimaryButton } from "@/components/ui";

export function ProductsPage() {
  const model = useProducts();
  const { showToast } = useToast();
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Product | null>(null);
  const [creating, setCreating] = useState(false);

  const list = useMemo(() => model.search(q), [model, q]);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-line bg-bg px-6 pb-4 pt-6">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1">
            <span className="eyebrow text-[10.5px] font-semibold text-pink">
              Catálogo
            </span>
            <h1 className="mt-1 text-[30px] font-semibold text-ink">
              Productos
            </h1>
            <p className="mt-1 text-[13px] text-ink2">
              {model.products.length} productos en el catálogo
            </p>
          </div>
          <PrimaryButton
            label="Nuevo producto"
            icon={<Plus size={18} />}
            onClick={() => setCreating(true)}
          />
        </div>

        <div className="mt-4 flex h-[46px] max-w-[420px] items-center gap-2.5 rounded-xl border border-line bg-surface px-4">
          <Search size={19} className="text-faint" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por SKU, nombre, categoría o palabra clave…"
            className="flex-1 bg-transparent text-[13.5px] text-ink outline-none placeholder:text-faint"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-10 pt-5">
        {list.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center">
            <Flower2 size={40} className="text-faint" />
            <h3 className="mt-3 text-[22px] font-semibold text-ink">
              Sin resultados
            </h3>
            <p className="mt-1.5 text-[13px] text-ink2">
              Ajusta la búsqueda o registra un producto nuevo.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {list.map((p) => (
              <ProductCardAdmin
                key={p.id}
                p={p}
                onEdit={() => setEditing(p)}
                onDelete={() => {
                  model.remove(p.id);
                  showToast(`Producto ${p.id} eliminado`);
                }}
              />
            ))}
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
    </div>
  );
}

function ProductCardAdmin({
  p,
  onEdit,
  onDelete,
}: {
  p: Product;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const active = (p.status ?? "activo") === "activo";
  return (
    <div className="flex gap-3.5 rounded-[18px] border border-line bg-surface p-3.5 shadow-soft">
      <div className="relative h-[86px] w-[86px] shrink-0 overflow-hidden rounded-[12px] bg-surface2">
        {p.image ? (
          <Image src={p.image} alt={p.name} fill sizes="86px" className="object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-pink">
            🌿
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="eyebrow text-[10.5px] font-semibold text-pink">{p.id}</span>
          <StatusPill active={active} />
        </div>
        <h3 className="mt-0.5 truncate text-[18px] font-semibold text-ink">
          {p.name}
        </h3>
        <p className="text-[11.5px] text-faint">{p.category}</p>
        <div className="mt-1.5 flex items-center gap-3">
          <span className="text-[17px] font-bold text-pink">
            {bs2(p.price)}
          </span>
          <span className="text-[12px] text-ink2">Stock: {p.stock ?? 0}</span>
        </div>
        <div className="mt-2 flex gap-2">
          <button
            onClick={onEdit}
            className="flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-[12px] font-semibold text-ink2"
          >
            <Pencil size={14} /> Editar
          </button>
          <button
            onClick={onDelete}
            className="flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-[12px] font-semibold text-[#C0334E]"
          >
            <Trash2 size={14} /> Eliminar
          </button>
        </div>
      </div>
    </div>
  );
}

function StatusPill({ active }: { active: boolean }) {
  const color = active ? "#2EA66B" : "#9C9094";
  return (
    <span
      className="rounded-full px-2 py-0.5 text-[10.5px] font-bold"
      style={{ background: `${color}1F`, color }}
    >
      {active ? "Activo" : "Inactivo"}
    </span>
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
  const { showToast } = useToast();
  const isEdit = !!product;

  const [sku, setSku] = useState(product?.id ?? "");
  const [name, setName] = useState(product?.name ?? "");
  const [category, setCategory] = useState(product?.category ?? kProductCategories[0]);
  const [price, setPrice] = useState(product ? String(product.price) : "");
  const [stock, setStock] = useState(product ? String(product.stock ?? 0) : "0");
  const [status, setStatus] = useState<ProductStatus>(product?.status ?? "activo");
  const [image, setImage] = useState(product?.image ?? "");
  const [desc, setDesc] = useState(product?.desc ?? "");

  const save = () => {
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
      image: image.trim(),
      category,
      stock: st,
      status,
    };

    const ok = isEdit
      ? model.update(product!.id, data)
      : model.add(data);
    if (!ok) return showToast(`El SKU "${id}" ya existe`);

    showToast(isEdit ? "Producto actualizado" : `Producto ${id} registrado`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[85] flex items-center justify-center bg-black/40 p-5">
      <div className="flex max-h-[88vh] w-full max-w-[520px] flex-col rounded-[22px] bg-surface">
        <div className="flex items-start px-6 pb-3 pt-5">
          <div>
            <span className="eyebrow text-[10.5px] font-semibold text-pink">
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
                {kProductCategories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <Field label="Nombre *" value={name} onChange={setName} placeholder="Nombre del arreglo" />
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
            <Field label="Precio (Bs) *" value={price} onChange={setPrice} placeholder="0" />
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
          <Field
            label="Imagen (ruta)"
            value={image}
            onChange={setImage}
            placeholder="/images/r213.jpg"
          />
          <div>
            <Label>Descripción / palabras clave</Label>
            <textarea
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              rows={2}
              placeholder="Palabras clave para el buscador (colores, ocasión, flores…)"
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
