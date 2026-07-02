# FloresOnline — Web (Next.js)

Migración de la app Flutter (`../lib`) a **Next.js 14 (App Router) + TypeScript + Tailwind CSS**.
Réplica fiel de la tienda y el panel de gestión, 100% web.

## Stack
- **Next.js 14** (App Router, componentes de servidor + `"use client"`)
- **TypeScript** + **Tailwind CSS** (paleta "Editorial Atelier" en `tailwind.config.ts`)
- Fuentes vía `next/font/google`: Cormorant Garamond, Poppins, Dancing Script
- Iconos: `lucide-react` · QR: `qrcode.react`
- Estado global con React Context (`context/StoreProvider.tsx`): carrito, auth y pedidos

## Correr
```bash
npm install
npm run dev      # http://localhost:3000
npm run build && npm run start
```

## Rutas
- `/` — Tienda: hero, categorías, colección con filtros/búsqueda, atelier, carrito (drawer),
  mini-cart, FAB de WhatsApp y flujo de pago (QR → confirmación → WhatsApp).
- `/admin` — Panel de empleados (link "Acceso empleados" en el footer):
  login demo, pedidos + detalle, nuevo pedido, clientes y secciones placeholder.
  Login demo: cualquier correo/clave, o el precargado `ana@floresonline.com`.

## Mapa de la migración
| Flutter | Next.js |
|---|---|
| `lib/models.dart` | `lib/products.ts` |
| `lib/theme.dart` | `tailwind.config.ts` + `app/globals.css` |
| `lib/cart.dart`, `admin/admin_data.dart` (estado) | `context/StoreProvider.tsx` |
| `lib/home_screen.dart` + widgets | `components/Storefront.tsx` y componentes |
| `lib/payment_screen.dart` | `components/PaymentModal.tsx` |
| `lib/admin/*` | `components/admin/*` |
| `assets/images/*` | `public/images/*` |
