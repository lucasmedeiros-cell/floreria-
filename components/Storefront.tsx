"use client";

import { useLink } from "@/lib/negocioLink";
import { useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Lock, Search, ShoppingCart } from "lucide-react";
import { bs } from "@/lib/products";
import { useBusiness, useCart, useProducts } from "@/context/StoreProvider";
import { openWhatsapp, useBusinessWhatsapp } from "@/lib/whatsapp";
import { BrandMark, Wordmark } from "./Brand";
import { Icon } from "./Icon";
import { ProductCard } from "./ProductCard";
import { WhatsAppIcon } from "./WhatsAppIcon";
import { CartDrawer } from "./CartDrawer";
import { MiniCart } from "./MiniCart";
import { DebugReporter } from "./DebugReporter";

const NAV = ["INICIO", "PRODUCTOS", "CÓMO COMPRAR", "CONTACTO"] as const;

/**
 * Tienda pública. Todo lo que la hace "de florería" (colores, textos, catálogo,
 * categorías) sale de la config del negocio → el rubro activo, así que el mismo
 * componente sirve para una ferretería, una tienda de repuestos, etc.
 */
export function Storefront() {
  const link = useLink();
  const cart = useCart();
  const business = useBusiness();
  const { products, byId, search } = useProducts();
  const { rubro, hero, noun } = business;

  const [query, setQuery] = useState("");
  const [nav, setNav] = useState<string>("INICIO");
  const [cartOpen, setCartOpen] = useState(false);

  // WhatsApp del negocio = el número vinculado al Vendedor 24/7 (con respaldo).
  const waNumber = useBusinessWhatsapp();

  const openCart = () => setCartOpen(true);
  const closeCart = () => setCartOpen(false);

  /** Abre WhatsApp con el resumen del pedido para continuar la compra. */
  const continuarPedido = () => {
    if (cart.ids.length === 0) return;
    const lines = cart.ids
      .map((id) => {
        const p = byId(id);
        if (!p) return null;
        const q = cart.qty(id);
        return `• ${q}x ${p.name} — ${bs(p.price * q)}`;
      })
      .filter(Boolean)
      .join("\n");
    const msg =
      `${business.greeting}\n\n` +
      `Quiero continuar con este pedido:\n\n` +
      `${lines}\n\n` +
      `*Total: ${bs(cart.total)}*\n\n` +
      `¿Me ayudan a coordinar la entrega y el pago?`;
    openWhatsapp(msg, waNumber);
    // No vaciamos el carrito: el pedido aún no está confirmado, sólo se está
    // redactando el mensaje de WhatsApp. Si el cliente vuelve, no debe perderlo.
    closeCart();
  };

  const productosRef = useRef<HTMLDivElement>(null);
  const comoRef = useRef<HTMLDivElement>(null);
  const contactoRef = useRef<HTMLDivElement>(null);

  const scrollTo = (ref: React.RefObject<HTMLElement>, name: string) => {
    setNav(name);
    ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const goTop = () => {
    setNav("INICIO");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const filtered = useMemo(() => search(query), [search, query]);

  return (
    <div className="min-h-screen bg-white">
      {/* ===================== HEADER ===================== */}
      <header className="sticky top-0 z-40 bg-white">
        <div className="mx-auto w-[92%] max-w-[1760px] px-6 pt-[22px]">
          <div className="flex items-center gap-6">
            <button onClick={goTop} className="flex items-center gap-2.5">
              <BrandMark size={42} />
              <Wordmark />
            </button>

            {/* Buscador */}
            <div className="relative mx-auto hidden w-full max-w-[420px] flex-1 md:block">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => scrollTo(productosRef, "PRODUCTOS")}
                placeholder="Buscar"
                aria-label="Buscar"
                className="w-full rounded-full border border-line py-[13px] pl-5 pr-[46px] text-[.9rem] text-ink outline-none transition-colors focus:border-pink"
              />
              <Search
                size={18}
                className="absolute right-[18px] top-1/2 -translate-y-1/2 text-faint"
              />
            </div>

            {/* Carrito */}
            <button
              onClick={openCart}
              className="relative text-pink"
              aria-label="Carrito"
            >
              <ShoppingCart size={30} />
              <span className="absolute -right-2 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-pink text-[.7rem] font-semibold text-white">
                {cart.count}
              </span>
            </button>
          </div>

          {/* Nav */}
          <nav className="mt-6 flex justify-center gap-8 overflow-x-auto border-b border-line md:gap-[46px]">
            {NAV.map((label) => {
              const active = nav === label;
              const onClick =
                label === "INICIO"
                  ? goTop
                  : label === "PRODUCTOS"
                  ? () => scrollTo(productosRef, label)
                  : label === "CÓMO COMPRAR"
                  ? () => scrollTo(comoRef, label)
                  : () => scrollTo(contactoRef, label);
              return (
                <button
                  key={label}
                  onClick={onClick}
                  className={`relative whitespace-nowrap pb-[18px] text-[.82rem] font-medium tracking-[1.5px] transition-colors ${
                    active ? "text-pink" : "text-ink2 hover:text-ink"
                  }`}
                >
                  {label}
                  {active && (
                    <span className="absolute inset-x-0 -bottom-px h-0.5 bg-pink" />
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="mx-auto w-[92%] max-w-[1760px] px-6">
        {/* ===================== HERO ===================== */}
        <section className="mt-[30px] grid grid-cols-1 items-center gap-8 rounded-[6px] bg-pinkHero px-7 py-9 md:grid-cols-2 md:px-14 md:py-[50px]">
          <div className="order-2 md:order-1">
            <p className="mb-3.5 text-[.72rem] font-semibold tracking-[3px] text-pink">
              {hero.eyebrow}
            </p>
            <h1 className="text-[2.3rem] font-normal leading-[1.05] tracking-[-1px] text-ink md:text-[3rem]">
              {hero.title}
              {rubro.heroScript ? (
                <span className="mt-0.5 block font-script text-[2.5rem] font-bold text-pinkDeep md:text-[3.2rem]">
                  {hero.highlight}
                </span>
              ) : (
                <span className="mt-0.5 block font-semibold text-pinkDeep">
                  {hero.highlight}
                </span>
              )}
            </h1>
            <div className="my-[22px] h-0.5 w-[54px] bg-pink" />
            <p className="mb-[26px] text-[.95rem] text-ink2">{hero.subtitle}</p>
            <div className="flex flex-wrap items-center gap-3.5">
              <button
                onClick={() => scrollTo(productosRef, "PRODUCTOS")}
                className="rounded-full border-[1.5px] border-pink px-7 py-[13px] text-[.78rem] font-semibold tracking-[1.5px] text-pink transition-colors hover:bg-pink hover:text-white"
              >
                {rubro.hero.ctaPrimary}
              </button>
              <button
                onClick={() =>
                  openWhatsapp(
                    `${business.greeting} Quisiera hacer un pedido.`,
                    waNumber
                  )
                }
                className="inline-flex items-center gap-2 rounded-full bg-pink px-7 py-[14px] text-[.78rem] font-semibold tracking-[1px] text-white transition-colors hover:bg-pinkDeep"
              >
                <WhatsAppIcon size={16} /> {rubro.hero.ctaSecondary}
              </button>
            </div>
          </div>

          {/* Foto (la del rubro florería; los demás rubros usan el isotipo) */}
          <div className="order-1 overflow-hidden rounded-[12px] md:order-2">
            <div className="relative aspect-[4/3] w-full md:aspect-[5/4]">
              {rubro.id === "floreria" ? (
                <Image
                  src="/images/hero.jpg"
                  alt={business.name}
                  fill
                  priority
                  sizes="(max-width:860px) 100vw, 45vw"
                  className="object-cover"
                />
              ) : (
                <div className="absolute inset-0 grid place-items-center bg-gradient-to-br from-pinkSoft to-white">
                  <span className="text-pink opacity-70">
                    <Icon name={rubro.icon} size={120} />
                  </span>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ===================== PRODUCTOS ===================== */}
        <div ref={productosRef} className="mb-1.5 mt-[46px] inline-block">
          <h2 className="text-[1.5rem] font-semibold text-ink">
            {query.trim() ? "Resultados" : "Lo último"}
          </h2>
          <div className="mt-1.5 h-[3px] w-[42px] rounded-full bg-pink" />
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center">
            <Search size={38} className="text-faint" />
            <h3 className="mt-3 text-[1.15rem] font-semibold text-ink">
              No encontramos {noun.many}
            </h3>
            <p className="mt-1.5 text-[.9rem] text-ink2">
              {products.length === 0
                ? "El catálogo aún está vacío."
                : "Prueba con otra búsqueda."}
            </p>
          </div>
        ) : (
          <section className="mt-6 grid grid-cols-2 gap-[14px] md:grid-cols-3 md:gap-[22px] lg:grid-cols-4">
            {filtered.map((p, i) => (
              <ProductCard key={p.id} product={p} index={i} />
            ))}
          </section>
        )}

        {/* ===================== CÓMO COMPRAR ===================== */}
        <div ref={comoRef} className="mb-1.5 mt-[52px] inline-block">
          <h2 className="text-[1.5rem] font-semibold text-ink">Cómo comprar</h2>
          <div className="mt-1.5 h-[3px] w-[42px] rounded-full bg-pink" />
        </div>
        <section className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {rubro.steps.map((s, i) => (
            <Step
              key={s.title}
              icon={<Icon name={s.icon} size={22} />}
              n={String(i + 1)}
              title={s.title}
              text={s.text}
            />
          ))}
        </section>

        {/* ===================== TRUST BAR ===================== */}
        <section className="mb-[60px] mt-[46px] grid grid-cols-2 gap-[18px] border-t border-line py-[26px] lg:grid-cols-4">
          {rubro.trust.map((t) => (
            <TrustItem
              key={t.title + t.sub}
              icon={<Icon name={t.icon} size={30} />}
              title={t.title}
              sub={t.sub}
            />
          ))}
        </section>
      </main>

      {/* ===================== FOOTER ===================== */}
      <footer ref={contactoRef} className="bg-[#1d1d1d]">
        <div className="mx-auto w-[92%] max-w-[1760px] px-6 pb-7 pt-12">
          <div className="flex flex-wrap gap-x-10 gap-y-8">
            <div className="w-full md:w-[290px]">
              <div className="flex items-center gap-2.5">
                <BrandMark size={40} />
                <Wordmark light />
              </div>
              <p className="mt-4 text-[.82rem] leading-relaxed text-white/60">
                {business.about}
              </p>
            </div>

            <div className="w-[45%] md:w-[150px]">
              <p className="text-[.7rem] font-semibold tracking-[2px] text-pink">
                TIENDA
              </p>
              <div className="mt-4 flex flex-col gap-2.5 text-[.82rem] text-white/60">
                {business.categories.map((c) => (
                  <span key={c}>{c}</span>
                ))}
              </div>
            </div>

            <div className="w-full md:w-[240px]">
              <p className="text-[.7rem] font-semibold tracking-[2px] text-pink">
                CONTACTO
              </p>
              <div className="mt-4 flex flex-col gap-3 text-[.82rem] text-white/60">
                <span>📍 {business.address}</span>
                <span>📞 {business.phone}</span>
                <button
                  onClick={() =>
                    openWhatsapp(
                      `${business.greeting} Quisiera hacer un pedido.`,
                      waNumber
                    )
                  }
                  className="text-left transition-colors hover:text-white"
                >
                  💬 WhatsApp: {business.phone}
                </button>
                <span>🕐 {business.hours}</span>
              </div>
            </div>
          </div>

          <div className="mt-8 h-px bg-white/10" />
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            {/* El enlace va a la IZQUIERDA para no quedar debajo del botón
                flotante de WhatsApp (fijo abajo-derecha), que le robaba el clic. */}
            <Link
              href={link("/admin")}
              className="relative z-10 flex items-center gap-1.5 text-[.75rem] font-semibold text-pink"
            >
              <Lock size={13} /> Acceso empleados
            </Link>
            <span className="text-[.75rem] text-white/40">
              © 2026 {business.name} · {business.tagline.toLowerCase()}
            </span>
          </div>
        </div>
      </footer>

      {/* Overlays */}
      <MiniCart onViewCart={openCart} onContinue={continuarPedido} />
      <CartDrawer open={cartOpen} onClose={closeCart} onContinue={continuarPedido} />
      <DebugReporter surface="web" />
    </div>
  );
}

function Step({
  icon,
  n,
  title,
  text,
}: {
  icon: React.ReactNode;
  n: string;
  title: string;
  text: string;
}) {
  return (
    <div className="relative rounded-[14px] border border-line bg-white p-5">
      <span className="absolute right-4 top-3 text-[2rem] font-bold text-pinkSoft">
        {n}
      </span>
      <span className="grid h-11 w-11 place-items-center rounded-[12px] bg-pinkSoft text-pink">
        {icon}
      </span>
      <h3 className="mt-3.5 text-[.95rem] font-semibold text-ink">{title}</h3>
      <p className="mt-1 text-[.82rem] leading-snug text-ink2">{text}</p>
    </div>
  );
}

function TrustItem({
  icon,
  title,
  sub,
}: {
  icon: React.ReactNode;
  title: string;
  sub: string;
}) {
  return (
    <div className="flex items-center justify-center gap-3.5">
      <span className="shrink-0 text-pink">{icon}</span>
      <span className="text-[.82rem] font-semibold leading-tight text-ink">
        {title}
        <span className="block font-normal text-faint">{sub}</span>
      </span>
    </div>
  );
}
