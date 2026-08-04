# Vendedor 24/7 (bot de WhatsApp con IA)

Asistente de ventas que atiende WhatsApp automáticamente actuando como vendedor:
usa el catálogo real de la florería, responde breve y cordial, toma el pedido y
cobra por QR. Portado del proyecto **Vendedor247** (easy-pay-pos) y adaptado a
FloresOnline. No reemplaza el checkout web ni el enlace `wa.me` existentes: es
una capa nueva y aditiva para los mensajes **entrantes** de WhatsApp.

## Piezas

| Archivo | Qué hace |
|---|---|
| `lib/vendedor247.ts` | Config (tabla `settings`, key `vendedor247`) + system prompt de ventas + respuesta con Claude (o simulada). Elige la credencial: plan, API key o token de cuenta. |
| `lib/claudePlan.ts` | **Puente al PLAN**: ejecuta el CLI de Claude Code headless con el token de la cuenta dedicada. Reintentos + registro de consumo en `ia_uso`. |
| `lib/vendedorEngine.ts` | Motor agnóstico del transporte: persistencia, horario, palabra clave, IA y marcador `[QR:monto]`. |
| `lib/whatsappBaileys.ts` | **Transporte actual**: WhatsApp por Baileys (número por QR), proceso persistente. |
| `lib/whatsappCloud.ts` | Transporte alternativo: WhatsApp Cloud API (Meta) por webhook. |
| `app/api/whatsapp/baileys/route.ts` | Estado/QR y arranque de Baileys (solo empleados). |
| `app/api/whatsapp/webhook/route.ts` | Webhook de Meta (GET verificación · POST mensajes). |
| `app/api/whatsapp/config/route.ts` | Config del bot para el panel admin (solo empleados). |
| `app/api/whatsapp/simulate/route.ts` | Probador local: simula un mensaje entrante. |
| `components/admin/VendedorEditor.tsx` | Panel en **Configuración**: editar el bot, conectar WhatsApp (QR) y probarlo. |
| `db/migrations/002_vendedor247.sql` | Tablas `wa_conversations` y `wa_messages`. |
| `db/migrations/013_ia_uso.sql` | Tabla `ia_uso`: consumo de IA por llamada. |

## Autenticación de IA (por orden de preferencia)

1. **PLAN — el modo de producción.** Con `CLAUDE_CODE_OAUTH_TOKEN` cargado, el
   bot ejecuta el **CLI de Claude Code en modo headless** (`claude -p`) con el
   token de una cuenta de Claude **dedicada al vendedor**. El consumo va contra
   la suscripción de esa cuenta: **no gasta crédito de API**. Es el mismo
   esquema que usa **Jarvis**, el bot de soporte de PetroBox (repo `tickets`).
   Ver `lib/claudePlan.ts`.
2. **API key** (`ANTHROPIC_API_KEY`) — respaldo automático: si la llamada al
   plan falla (sin cupo, CLI caído), el vendedor reintenta por la API.
3. **Token de la sesión local de Claude Code** (`~/.claude/.credentials.json` o
   `ANTHROPIC_AUTH_TOKEN`) — solo para probar en tu máquina. Caduca en horas y
   en un servidor no hay nadie que lo renueve.
4. Sin ninguno → **modo simulado** (respuestas de ejemplo, con el aviso pegado).

El badge del panel (**Configuración → Vendedor 24/7**) dice con cuál está
respondiendo: *plan del vendedor* · *API key* · *token de cuenta* · *simulado*.

### Cómo se saca el token del plan

Logueado con **la cuenta del vendedor** (no la tuya):

```bash
claude setup-token          # devuelve sk-ant-oat01-...
```

Ese token es de larga duración — es el mecanismo previsto para correr Claude
Code sin sesión interactiva. Va al `.env` del servidor:

```
CLAUDE_CODE_OAUTH_TOKEN=sk-ant-oat01-...
```

En bilbo hace falta además tener el CLI instalado y, si no está en el `PATH` de
pm2, apuntarlo con `CLAUDE_BIN`.

### Cómo se invoca (lib/claudePlan.ts)

```
claude -p "<conversación>" --system-prompt "<persona + reglas + catálogo>" \
       --output-format json --no-session-persistence \
       --exclude-dynamic-system-prompt-sections \
       --model <haiku|sonnet|opus> --disallowedTools Bash Read Write ...
```

Detalles que importan:

- **`--system-prompt` reemplaza** el prompt de agente de código del CLI por el
  del vendedor (Jarvis en cambio aplana todo en un solo prompt).
- **`--exclude-dynamic-system-prompt-sections`** recorta el contexto que el CLI
  agrega solo: de ~11.900 a ~2.900 tokens por llamada.
- **Se borran `ANTHROPIC_API_KEY` y `ANTHROPIC_AUTH_TOKEN` del entorno del
  proceso hijo.** Si quedan, Claude Code las prefiere y la llamada se cobra al
  crédito de API en vez de consumir del plan — justo lo que se quiere evitar.
- Herramientas deshabilitadas: el vendedor conversa, no toca disco.
- **3 reintentos** con espera creciente ante fallas intermitentes, para que un
  tropiezo de red no deje al cliente sin respuesta.
- El modelo sale del panel; en modo plan valen los alias `haiku` / `sonnet` /
  `opus` y también se mapean los IDs largos (`claude-haiku-4-5` → `haiku`).

### Consumo

Cada llamada queda registrada en la tabla **`ia_uso`** (modelo, tipo, tokens,
caché y costo). En modo plan el costo es el que *habría* salido por API: sirve
para medir cuánto está rindiendo la suscripción.

```sql
SELECT modelo, count(*), sum(costo_usd) FROM ia_uso GROUP BY modelo;
```

> El plan tiene límites por ventana de tiempo. Cuando se agotan, el vendedor
> pasa solo a la API si hay `ANTHROPIC_API_KEY`; si no, cae a modo simulado —
> que es visible para el cliente. Vale la pena dejar la API key cargada como red.

## WhatsApp con la Cloud API de Meta (transporte actual)

Es el WhatsApp **oficial**: no hay QR que escanear ni teléfono que quede
prendido, y funciona igual en bilbo que en serverless. Cada negocio tiene su
número (uno o dos); todos comparten el mismo webhook.

**Cómo sabe de quién es un mensaje.** Meta manda en cada evento
`value.metadata.phone_number_id` — el ID de NUESTRO número, el que recibió. Con
ese ID se busca el negocio en la central (tabla `wa_numero`) y el motor corre
dentro de SU base (`runWithTenant`). Sin esa resolución, todos los negocios
leerían el catálogo y escribirían las conversaciones en la base por defecto.

```
POST /api/whatsapp/webhook
   ↓ valida X-Hub-Signature-256 (META_WA_APP_SECRET)
lib/whatsappCloud.ts → processWebhook
   ↓ metadata.phone_number_id
lib/tenant.ts → waNumeroByPhoneId  →  negocio  (central, caché de 30 s)
   ↓ runWithTenant(negocio, …)
lib/vendedorEngine.ts → handleIncoming   ← ya contra la base del negocio
   ↓
respuesta por el MISMO número que recibió (cloudSenderFor)
```

**Alta de un número.** Panel de easy pos → ficha del negocio → *WhatsApp del
Vendedor 24/7*: se carga el `phone_number_id` que da Meta (no el número), el
número visible y una etiqueta. Empieza a atender en ≤30 s (la caché). Desde ahí
también se pausa o se quita.

**Credenciales.** Normalmente una sola app de easy pos para todos: el token sale
de `META_WA_TOKEN` y lo único que cambia por negocio es el `phone_number_id`. Un
negocio que traiga su propia cuenta de Meta guarda su token en su fila de
`wa_numero` y ese pisa al del entorno.

**Baileys** (`lib/whatsappBaileys.ts`, `/api/whatsapp/baileys`) quedó fuera del
panel y ya no se usa: era un número no oficial, con riesgo de baneo, que además
exigía un proceso persistente y no arrancaba solo después de un reinicio.

## Probar en local (sin subir nada)

1. Base de datos: `npm run db:apply` (crea las tablas `wa_*`).
2. `npm run dev`
3. Simular una conversación:

   ```bash
   curl -s localhost:3000/api/whatsapp/simulate \
     -H 'Content-Type: application/json' \
     -d '{"text":"Hola, quiero un ramo de rosas para un aniversario"}' | jq
   ```

   La respuesta trae el texto del bot y el historial. También se puede probar
   desde el panel: **Admin → Configuración → Vendedor 24/7 → Probar la conversación**.

### Probar el webhook sin Meta

El POST va firmado, así que hay que firmarlo a mano (con `META_WA_APP_SECRET`
sin cargar, la firma no se valida y alcanza con mandar el JSON pelado):

```bash
BODY='{"entry":[{"changes":[{"value":{"metadata":{"phone_number_id":"PHONE_A"},
  "contacts":[{"profile":{"name":"Cliente"}}],
  "messages":[{"type":"text","from":"59171111111","text":{"body":"Hola"}}]}}]}]}'
SIG=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$META_WA_APP_SECRET" -hex | sed 's/^.*= //')
curl -s localhost:3000/api/whatsapp/webhook -H 'Content-Type: application/json' \
  -H "X-Hub-Signature-256: sha256=$SIG" -d "$BODY"
```

## Conectar WhatsApp real

Del lado de Meta hace falta: Business Manager verificado, una app con el producto
WhatsApp, el número **sin** estar registrado en WhatsApp normal ni en la app
Business, y un token permanente de System User.

1. Cargar en el `.env.local` del servidor: `CLAUDE_CODE_OAUTH_TOKEN` + `CLAUDE_BIN`
   (la IA), y `META_WA_TOKEN`, `META_WA_VERIFY_TOKEN`, `META_WA_APP_SECRET`.
   `META_WA_PHONE_ID` solo hace falta en modo de un solo negocio (sin central).
2. En Meta, apuntar el webhook a `https://<dominio>/api/whatsapp/webhook` con el
   mismo verify token, y suscribir el campo **messages**.
3. Aplicar `db/central.sql` (trae la tabla `wa_numero`) y dar de alta el número
   del negocio desde el panel.

> **La ventana de 24 horas.** Si el cliente escribe, se le puede contestar libre
> durante 24 h. Pasado ese lapso solo salen plantillas aprobadas por Meta: al bot
> no lo afecta, pero los avisos de estado de pedido sí van a necesitar plantilla.
