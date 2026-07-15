# easy pos — Tienda + CRM multi-rubro (Next.js)

**easy pos** es el producto: un CRM/punto de venta con tienda web y landing promocional,
en **Next.js 14 (App Router) + TypeScript + Tailwind CSS**.

El sistema **no está atado a un rubro**: se elige uno (florería, ferretería, repuestos,
minimarket, farmacia, restaurante, boutique, tecnología) y la web, la landing y el panel
se adaptan solos — colores, textos, categorías, catálogo demo y hasta la persona del bot
de WhatsApp. Ver [docs/rubros.md](docs/rubros.md).

## Stack
- **Next.js 14** (App Router, componentes de servidor + `"use client"`)
- **TypeScript** + **Tailwind CSS** (el color de marca sale del rubro, vía variables CSS)
- Fuentes vía `next/font/google`: Cormorant Garamond, Poppins, Dancing Script
- Iconos: `lucide-react` · QR: `qrcode.react`
- Estado global con React Context (`context/StoreProvider.tsx`): negocio, carrito, auth, pedidos

## Correr
```bash
npm install
npm run dev      # http://localhost:3000
npm run build && npm run start
```

## Rutas
- `/` — Tienda: hero, colección con búsqueda, carrito (drawer), mini-cart, FAB de WhatsApp
  y flujo de pago (QR → confirmación → WhatsApp).
- `/promo` — Landing promocional de un producto destacado (editable desde el panel).
- `/admin` — CRM de empleados (link "Acceso empleados" en el footer): pedidos, entregas,
  agenda, clientes, productos, reportes, usuarios y configuración.
- `/n/<slug>`, `/n/<slug>/promo`, `/n/<slug>/admin` — lo mismo, pero de **un negocio
  pareado**: cada comercio tiene su web y su CRM, con su base. Ver abajo.
- `/parear` — conecta este navegador con un negocio (pegando el token o con `?token=…`).

## Un negocio o muchos (pareo)
Por defecto easy pos atiende a **un solo negocio** (el de `DATABASE_URL`): es el modo de
siempre y no cambió nada. Si se configura `CENTRAL_DATABASE_URL` (la base central de
[Case](https://gitlab.com/petrobox/case)), la misma instalación pasa a servir a **muchos
negocios**: cada comercio se da de alta desde el panel de Case, que le crea su base
(`bo_epos_<slug>`) y le entrega un **QR de pareo**. Desde ahí el comercio tiene su tienda
en `/n/<slug>`, su CRM en `/n/<slug>/admin`, y el CRM móvil se conecta escaneando el QR.

El contrato completo (QR, endpoints, headers, login, migración de la flota) está en
**[docs/pareo.md](docs/pareo.md)** — es lo que necesita la app móvil.

| Pieza | Archivo |
|---|---|
| Registro de negocios, pool por base, contexto del negocio | `lib/tenant.ts` |
| Negocio de la request (slug o token de pareo) | `lib/tenantRequest.ts` |
| Rutas y API por negocio (`/n/<slug>/…`) | `middleware.ts`, `app/n/[slug]/` |
| Pareo (verificar y sembrar un comercio nuevo) | `app/api/pair/` |
| Pareo desde el navegador | `app/parear/`, `components/PairForm.tsx` |
| Migrar todas las bases | `db/migrate-tenants.sh` |

## Módulos del CRM
`Configuración → Módulos del CRM`. Cada negocio prende y apaga las secciones que usa:
una tienda de repuestos que vende sobre el mostrador apaga **Entregas** y la sección
desaparece del menú (y el alta de pedido deja de pedir repartidor y costo de envío).
Apagar un módulo **no borra datos**: prenderlo de vuelta trae todo intacto.

Inicio, Pedidos y Configuración no se pueden apagar (sin Configuración no habría forma de
volver a prender lo demás). Los módulos arrancan según el rubro —florería reparte,
ferretería no— y cambiar de rubro los vuelve a alinear con el preset nuevo. Ver
`lib/modules.ts` y `components/admin/ModulosEditor.tsx`.

## Rubro del negocio
`Configuración → Rubro del negocio` en el CRM. Cambiarlo aplica el preset completo:
paleta, textos de la tienda, categorías, catálogo demo, landing y persona del bot.
Los productos cargados con SKU propio no se tocan.

| Pieza | Archivo |
|---|---|
| Marca del producto (easy pos: splash, login, menú) | `lib/easypos.ts`, `components/admin/EasyPosSplash.tsx` |
| Presets de los 8 rubros (colores, copy, catálogo, promo, bot) | `lib/rubros.ts` |
| Config del negocio (marca, contacto, colores, categorías) | `lib/business.ts` |
| Persistencia en la tabla `settings` | `lib/businessStore.ts` |
| API pública / guardado | `app/api/business/route.ts` |
| Editor del panel | `components/admin/NegocioEditor.tsx` |

## Base de datos
PostgreSQL, base **`easypos`** (dueño `petrobox`). Esquema en `db/schema.sql`
(idempotente) y semilla en `db/seed.sql` — solo el usuario inicial del CRM y el
repartidor "Sin asignar": **easy pos arranca vacío**.

```bash
# 1) Crear rol y base (una vez, como superusuario)
sudo -u postgres psql -f db/bootstrap.sql
# 2) Esquema + seed
npm run db:apply
# 3) Desplegar a bilbo (por Tailscale)
./db/deploy-bilbo.sh
```

Usuario inicial del CRM: `admin@easypos.bo` / `easypos1234` (cambialo al entrar).
Para cargar la demo de la florería: `psql ... -f db/seed-floreria.sql`.

```bash
npm run db:apply
```
