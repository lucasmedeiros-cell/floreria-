# El botón "Debug" — cómo está hecho y cómo llevarlo a otro proyecto

Es el botón flotante que aparece en la tienda, en el CRM, en el programa de PC y
en la app: abre un formulario corto (tipo, título, descripción, correo, captura)
y **crea un ticket en Tickets** (`tickets.petroboxinc.com`) en estado desarrollo,
etiquetado con el proyecto y el negocio desde donde se reportó.

---

## 1. Cómo funciona (leer esto primero)

```
[ Botón Debug ]  --multipart-->  [ TU servidor: /api/tickets/report ]  --X-Api-Key-->  [ Tickets ]
  navegador                        (Next.js, server-side)                    /api/public/report
```

**El navegador nunca le habla a Tickets.** Siempre pasa por un endpoint propio.
Dos razones, y las dos importan:

1. **La API key.** `TICKETS_API_KEY` identifica al app_client ante Tickets. Si el
   fetch saliera del navegador, la key viajaría en el bundle y cualquiera podría
   abrir tickets a tu nombre. En el proxy vive solo en el servidor.
2. **CORS.** Tickets no habilita el dominio de cada instalación. Desde el
   servidor no hay CORS que valga.

El proxy además **enriquece** el ticket: le pega el nombre del proyecto y del
negocio al título, y agrega al final de la descripción un bloque de contexto
(plataforma, negocio, origen, URL). Eso es lo que hace que el ticket sea
accionable sin tener que preguntarle nada a quien reportó.

---

## 2. Variables de entorno

```ini
# A dónde reportar (por defecto ya apunta a producción)
TICKETS_API=https://tickets.petroboxinc.com/api
# La key del app_client. SIN esto el botón responde 503 y no rompe nada más.
TICKETS_API_KEY=pbx_...
# Con qué nombre se etiquetan los tickets de esta instalación
TICKETS_PROJECT=easy pos
```

`TICKETS_API_KEY` **no** lleva prefijo `NEXT_PUBLIC_`: si se lo ponés, se filtra
al cliente y perdés el punto 1 de arriba.

---

## 3. El endpoint de Tickets (el contrato)

```
POST {TICKETS_API}/public/report
Header:  X-Api-Key: <TICKETS_API_KEY>
Body:    multipart/form-data
  tipo         "error" | "optimizacion"
  titulo       string
  descripcion  string
  email        string
  imagenes     File   ← OJO: PLURAL. Con "imagen" (singular) la captura se pierde
                        en silencio: el ticket se crea igual, sin adjunto.
Respuesta 200: { ok: true, numero_ticket: "TK-1234" }
Respuesta ≠200: { error | mensaje }
```

---

## 4. El proxy (servidor) — Next.js App Router

`app/api/tickets/report/route.ts`. Esta versión está **despegada de este repo**:
sin helpers propios, listo para pegar en otro proyecto.

```ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TICKETS_API = process.env.TICKETS_API || "https://tickets.petroboxinc.com/api";
const TICKETS_API_KEY = process.env.TICKETS_API_KEY || "";
const TICKETS_PROJECT = process.env.TICKETS_PROJECT || "mi proyecto";

const origenLabel = (s: string) =>
  s === "crm" ? "CRM / Admin"
  : s === "pc" ? "Programa de PC"
  : s === "mobile" ? "App de celular"
  : "Web";

export async function POST(req: NextRequest) {
  if (!TICKETS_API_KEY) {
    return NextResponse.json(
      { error: "El reporte de bugs no está configurado (falta TICKETS_API_KEY)." },
      { status: 503 }
    );
  }

  // La web manda multipart (puede adjuntar captura); PC y app mandan JSON.
  const ct = req.headers.get("content-type") || "";
  let tipo = "error", titulo = "", descripcion = "", email = "", surface = "web", url = "";
  let imagen: File | null = null;

  if (ct.includes("application/json")) {
    const b = await req.json();
    tipo = b.tipo === "optimizacion" ? "optimizacion" : "error";
    titulo = String(b.titulo ?? "").trim();
    descripcion = String(b.descripcion ?? "").trim();
    email = String(b.email ?? "").trim();
    surface = String(b.surface ?? "web").trim();
    url = String(b.url ?? "").trim();
  } else {
    const f = await req.formData();
    tipo = (f.get("tipo") as string) === "optimizacion" ? "optimizacion" : "error";
    titulo = ((f.get("titulo") as string) || "").trim();
    descripcion = ((f.get("descripcion") as string) || "").trim();
    email = ((f.get("email") as string) || "").trim();
    surface = ((f.get("surface") as string) || "web").trim();
    url = ((f.get("url") as string) || "").trim();
    const img = f.get("imagen");
    if (img && typeof img !== "string" && (img as File).size > 0) imagen = img as File;
  }

  if (!titulo || !descripcion) {
    return NextResponse.json({ error: "Título y descripción son obligatorios." }, { status: 400 });
  }
  if (!email) {
    return NextResponse.json({ error: "El correo es obligatorio." }, { status: 400 });
  }

  // Contexto: es lo que hace que el ticket se entienda sin repreguntar.
  const contexto =
    `\n\n--- Contexto ---\n` +
    `Plataforma: ${TICKETS_PROJECT}\n` +
    `Origen: ${origenLabel(surface)}\n` +
    `URL: ${url || "N/A"}`;

  const out = new FormData();
  out.append("tipo", tipo);
  out.append("titulo", `[${TICKETS_PROJECT}] ${titulo}`);
  out.append("descripcion", descripcion + contexto);
  out.append("email", email);
  if (imagen) out.append("imagenes", imagen, imagen.name || "captura.jpg"); // plural

  const r = await fetch(`${TICKETS_API}/public/report`, {
    method: "POST",
    headers: { "X-Api-Key": TICKETS_API_KEY },
    body: out,
  });
  const data = await r.json().catch(() => ({} as Record<string, string>));
  if (!r.ok) {
    const status = r.status >= 400 && r.status < 600 ? r.status : 502;
    return NextResponse.json(
      { error: data?.mensaje || data?.error || "No se pudo enviar el reporte." },
      { status }
    );
  }
  return NextResponse.json({ numero_ticket: data.numero_ticket ?? null });
}
```

**Multi-inquilino (opcional).** En easy pos el proxy además lee el negocio de la
request y etiqueta `"easy pos · Auto Piezas Coquito"`. Si tu proyecto es de un
solo cliente, sacá esa parte: alcanza con `TICKETS_PROJECT`.

---

## 5. El botón (cliente) — React

`components/DebugReporter.tsx`. Es un componente suelto, sin dependencias del
resto de la app salvo `lucide-react` para los íconos. Se monta UNA vez por
pantalla raíz:

```tsx
<DebugReporter surface="crm" />   // en el shell del panel
<DebugReporter surface="web" />   // en la tienda pública
```

Lo que hace, en orden:

1. FAB fijo (`fixed bottom-5 left-5 z-[85]`) que abre un modal.
2. El modal pide **tipo** (Error / Mejora), **título**, **descripción**, **correo**
   y una **captura opcional**.
3. Arma un `FormData` con esos campos **más `surface` y `window.location.href`**
   (eso es la mitad del valor del reporte: saber desde qué pantalla y con qué URL
   pasó) y lo postea a `/api/tickets/report`.
4. Con la respuesta OK muestra el **número de ticket**, que es lo que le sirve al
   usuario para hacer seguimiento.

El archivo completo está en `components/DebugReporter.tsx` de este repo — copialo
tal cual y cambiá solo dos cosas:

- El `fetch(apiUrl("/api/tickets/report"))` → `fetch("/api/tickets/report")` si tu
  proyecto no es multi-inquilino (`apiUrl` acá le antepone `/n/<slug>`).
- El correo por defecto del campo "Correo de contacto".

### Dónde poner el FAB

Arrancó abajo a la derecha y **se sentaba justo encima del botón de cobrar** del
punto de venta. Está abajo a la izquierda por eso. Antes de fijar la esquina,
mirá qué botón vive ahí en tu pantalla más cargada.

---

## 6. Los otros clientes (mismo endpoint, JSON en vez de multipart)

- **Programa de PC (Electron)** — `desktop/renderer/app.js`:
  `POST /api/tickets/report` con `{ tipo, titulo, descripcion, email, surface: "pc", url }`.
- **App (Flutter)** — `mobile/admin_app/lib/api.dart`:
  mismo POST con `surface: "mobile"`.

Ninguno de los dos manda captura: por eso el proxy acepta JSON además de
multipart. Si agregás una plataforma nueva, sumá su etiqueta en `origenLabel()`.

---

## 7. Checklist para llevarlo a otro proyecto

- [ ] Copiar `app/api/tickets/report/route.ts` (versión genérica de arriba).
- [ ] Copiar `components/DebugReporter.tsx` y ajustar la URL del fetch y el correo.
- [ ] Montar `<DebugReporter />` en el layout o shell de cada superficie.
- [ ] Pedir una **API key de app_client** en Tickets para ese proyecto.
- [ ] Poner `TICKETS_API_KEY` y `TICKETS_PROJECT` en el `.env` del servidor
      (y en el `.env.production` del deploy, que es donde siempre se olvida).
- [ ] Elegir la esquina del FAB mirando la pantalla más cargada.
- [ ] Probar de punta a punta: reportar con captura y confirmar que el ticket
      llegó **con el adjunto** (es lo que se rompe si el campo no es `imagenes`).
