# Rubros (verticales de negocio)

Hay **dos marcas** en juego y conviene no mezclarlas:

- **easy pos** — el producto (el CRM). Marca fija: amarillo `#FEBB03` y negro. Aparece en el
  splash de inicio del panel, en el login y en el pie del menú lateral. No cambia nunca.
  Definida en `lib/easypos.ts`; el logo es el archivo original
  (`public/images/easypos.png`) y el splash es `components/admin/EasyPosSplash.tsx`.
- **El negocio** — quien usa easy pos (una florería, una ferretería…). Su rubro define el
  color y los textos de la tienda, la landing y el bot.

El sistema (tienda web + landing + CRM) es **agnóstico del rubro**. Un rubro es un preset
completo que define cómo se ve y cómo habla el negocio. Se elige desde el CRM en
**Configuración → Rubro del negocio** y no requiere tocar código. El rubro activo se ve
siempre como chip bajo el nombre del negocio en el menú lateral del panel, y en el splash.

## Instalación nueva: todo vacío

easy pos arranca **sin negocio y sin datos**, listo para vincularse a uno:

- Rubro `generico` ("Sin definir"), gris neutro, `configured: false`. El panel muestra un
  aviso para configurarlo y la landing `/promo` queda despublicada.
- Sin productos, sin clientes, sin pedidos y sin usuarios (`db/seed.sql` solo crea el
  empleado inicial y los repartidores).
- El catálogo de ejemplo de un rubro **no se carga solo**: hay que marcar
  *"Cargar catálogo de ejemplo del rubro"* al guardar en Configuración. Para la demo
  completa de la florería está `db/seed-floreria.sql`.

## Una sola fuente de datos

El catálogo vive en la tabla `products` y lo leen **el CRM y la tienda** (via
`/api/products`). Lo que se carga o edita en el panel aparece en la web sin tocar código:
no hay catálogos en archivos.

## Rubros incluidos

| id | Rubro | Color | Catálogo demo |
|---|---|---|---|
| `floreria` | Florería *(por defecto)* | Rosa `#E8366B` | Rosas, ramos, girasoles, exóticas |
| `ferreteria` | Ferretería | Naranja `#F97316` | Herramientas, construcción, electricidad, plomería, pinturas |
| `repuestos` | Repuestos automotrices | Azul `#2563EB` | Motor, frenos, suspensión, lubricantes, accesorios |
| `minimarket` | Minimarket / Almacén | Verde `#16A34A` | Abarrotes, bebidas, limpieza, snacks, lácteos |
| `farmacia` | Farmacia | Celeste `#0EA5E9` | Medicamentos, cuidado personal, dermocosmética, vitaminas, bebés |
| `restaurante` | Restaurante | Rojo `#DC2626` | Almuerzos, a la carta, parrilla, bebidas, postres |
| `boutique` | Boutique / Ropa | Violeta `#7C3AED` | Mujer, hombre, calzado, accesorios, ofertas |
| `tecnologia` | Tecnología | Índigo `#4F46E5` | Computación, celulares, accesorios, gaming, redes |

## Qué cambia al elegir un rubro

- **Colores** — la paleta se inyecta como variables CSS (`--c-accent`, `--c-accent-deep`,
  `--c-accent-soft`, `--c-accent-hero`) en `<body>` desde `app/layout.tsx`. Tailwind las
  consume (`tailwind.config.ts`), así que toda la UI —tienda y CRM— se repinta sola.
- **Textos de la tienda** — hero, botones, "cómo comprar", barra de confianza, pie de página.
- **Categorías** del catálogo (tienda, alta de productos y footer).
- **Catálogo demo** — se reemplaza el del rubro anterior en la base de datos. Los productos
  con SKU propio del negocio **no se tocan** (`lib/rubroApply.ts`).
- **Landing `/promo`** — vuelve a la promo por defecto del rubro nuevo.
- **Vendedor 24/7** — la persona y las reglas de venta del bot salen del rubro, salvo que
  se escriba una propia en el panel.
- **Animación de inicio** — pétalos en florería, isotipo del rubro en el resto.

Lo que **no** cambia: WhatsApp, teléfono, dirección, horario, métodos de pago y costo de
envío. Son datos del negocio, no del rubro.

## Imágenes

Solo el rubro florería trae fotos (`public/images/`). En los demás, los productos sin foto
se pintan con un placeholder generado (degradado del color del rubro + su icono + el nombre;
ver `components/ProductImage.tsx`). Al cargar una foto real, la reemplaza.

## Agregar un rubro nuevo

1. Copiar un bloque de `lib/rubros.ts` (por ejemplo `ferreteria`) y ajustar id, label,
   colores, copy, categorías, catálogo, promo y la persona del bot.
2. Agregarlo a `RUBROS` y a `RUBRO_LIST`, y sumar su id al tipo `RubroId`.
3. Si usa un icono que no está en `components/Icon.tsx`, importarlo ahí.

No hay nada más que tocar: el selector del panel, la tienda, la landing y el bot lo toman
automáticamente.
