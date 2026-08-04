# Vendedor 24/7 — qué está hecho y qué falta para dejarlo configurado

Revisión del 2026-08-03 sobre la rama `desktop-coquito`. Este documento explica,
sin dar nada por sabido, en qué estado real está el bot de WhatsApp con IA y qué
hace falta para que atienda clientes de verdad.

El documento hermano `docs/vendedor247.md` describe el diseño y cómo probarlo.
Este describe **el estado**: lo que funciona, lo que falta y por qué.

---

## 1. Cómo funciona hoy, en una pasada

```
WhatsApp del cliente
   ↓
Meta → POST /api/whatsapp/webhook   (uno solo para todos los negocios)
   ↓  valida la firma X-Hub-Signature-256
lib/whatsappCloud.ts → processWebhook
   ↓  lee metadata.phone_number_id: el ID de NUESTRO número, el que recibió
lib/tenant.ts → waNumeroByPhoneId → el negocio dueño de ese número
   ↓  runWithTenant(negocio, …)      ← desde acá, todo va a SU base
Motor       ── lib/vendedorEngine.ts → handleIncoming()
   1. guarda el mensaje en wa_conversations / wa_messages
   2. ¿el bot está encendido?           (config botEnabled)
   3. ¿un humano tomó el control?       (columna bot_active)
   4. ¿hace falta palabra clave?        (config activationKeyword)
   ↓
IA          ── lib/vendedor247.ts    → generateReply()
   arma el system prompt con la persona del rubro + el catálogo real de la BD
   ↓
Respuesta   → sale por el MISMO número que recibió (cloudSenderFor)
   si el texto trae el marcador [QR:monto] → lib/baas.ts genera el QR del BCP
   y se manda como imagen
```

El panel de easy pos (**ficha del negocio → WhatsApp del Vendedor 24/7**) asocia
los números. El panel del negocio (**Admin → Configuración → Vendedor 24/7**,
`components/admin/VendedorEditor.tsx`) enciende el bot, escribe la persona,
elige modelo y formas de pago, muestra con qué credencial está corriendo la IA y
qué número tiene asignado, y permite probar la conversación sin WhatsApp real.

**Todo eso está construido y funciona.** Lo que sigue son los huecos.

---

## 2. Lo que falta, en orden de importancia

### 2.1 Los números de Meta, dados de alta

Es lo único que bloquea la prueba con clientes reales, y no depende del código:

- Business Manager verificado y una app con el producto WhatsApp.
- El número **sin** estar registrado en WhatsApp normal ni en la app Business.
- Token permanente de System User → `META_WA_TOKEN`.
- `META_WA_VERIFY_TOKEN` y `META_WA_APP_SECRET` en el `.env.local` del servidor.
- Webhook apuntando a `https://easypos.easypaybo.com/api/whatsapp/webhook`, con
  el campo **messages** suscrito.
- El `phone_number_id` de cada número cargado en el panel, en la ficha del negocio.

Ojo con **la ventana de 24 horas**: al cliente que escribe se le puede contestar
libre por 24 h; pasado eso solo salen plantillas aprobadas. Al bot no lo afecta
(siempre responde a un mensaje entrante), pero los avisos de estado de pedido que
manda `OrdersPage` sí van a necesitar plantilla.

### 2.2 Esquema aplicado en las bases correctas

Tres cosas, y las tres son minutos:

- `db/central.sql` en la central — trae la tabla `wa_numero`. **Sin esto el
  webhook no resuelve ningún negocio y no contesta a nadie.**
- Migración `002_vendedor247.sql` (tablas `wa_conversations` / `wa_messages`) en
  la base de cada negocio; si falta, el bot lanza error al guardar el primer
  mensaje entrante.
- Migración `013_ia_uso.sql`, también por negocio, para medir el consumo de IA.

```bash
psql -d bo_epos_central -f db/central.sql
npm run db:apply   # con DATABASE_URL apuntando a la base del negocio
```

### 2.3 No hay bandeja de conversaciones ni traspaso a humano

La columna `bot_active` existe y el motor la respeta (si está en `false`, el bot
se calla y deja que conteste una persona). Pero no hay ninguna pantalla para:

- ver las conversaciones que atendió el bot,
- tomar el control de una charla,
- devolvérsela al bot después.

Hoy eso solo se puede hacer editando la base a mano. Para un vendedor que cierra
ventas, no poder intervenir cuando se traba es una limitación seria.

### 2.4 El pedido no aterriza en el POS

Cuando el cliente confirma, el bot manda el QR del BCP y ahí termina su trabajo.
No crea un pedido, no crea una venta, y no hace seguimiento del pago (el
endpoint de estado del QR existe, `/payments/status`, pero el motor no lo
consulta).

O sea: la plata puede entrar y en el sistema no queda registro de la venta ni
del pedido; solo el chat. Alguien tiene que mirar WhatsApp y cargarlo a mano.

Ya existe el modelo de pedidos con estados y aviso al cliente (`OrdersPage`), así
que el motor se engancha ahí en vez de inventar algo nuevo.

### 2.5 Sin respaldo si se acaba el plan Pro

La IA corre con el plan de la cuenta `vendedor24_7@petroboxinc.com`
(`CLAUDE_CODE_OAUTH_TOKEN` + `CLAUDE_BIN`). No hay `ANTHROPIC_API_KEY` de
respaldo — **decisión tomada**: si el plan se queda sin cupo, el vendedor cae a
modo simulado. El panel muestra en qué modo está, así que al menos se ve.

Nadie mira todavía la tabla `ia_uso`: la escribe `lib/claudePlan.ts` y no hay
ninguna pantalla que la lea.

---

## 3. Lo que ya se resolvió

| Cuándo | Qué |
|---|---|
| 2026-08-03 | **Multi-número con la Cloud API de Meta.** Cada negocio tiene su número (uno o dos); el webhook resuelve el negocio por `phone_number_id` y el motor corre en la base de ese negocio. Antes escribía siempre en la base por defecto. |
| 2026-08-03 | **Firma del webhook.** El POST valida `X-Hub-Signature-256`; antes el endpoint público no validaba nada. |
| 2026-08-03 | **Se abandona Baileys.** Con eso se caen solos el arranque en frío (nadie levantaba el socket después de un `pm2 restart`), el límite de un número por proceso, la carpeta `.wa-auth` y el riesgo de baneo del número. |
| 2026-08-03 | **Horario de atención: descartado.** El vendedor atiende 24/7 — de ahí el nombre. Se sacó del panel el campo "Mensaje fuera de horario", que nunca se usaba. |
| 2026-08-03 | **Credenciales de IA.** Modo PLAN con el token de la cuenta dedicada, y el panel muestra si está en `plan`, `api-key`, `cuenta` o `simulado`. |

---

## 4. Lo específico de Paraguay

Las sesiones y los números ya no son el problema: alcanza con dar de alta el
número paraguayo y asociarlo a su negocio. Lo que sigue asumiendo Bolivia:

| Qué | Dónde | Por qué importa |
|---|---|---|
| Moneda cableada | `systemPrompt()` dice "Los precios van en bolivianos (Bs)" y arma el catálogo como `Bs <precio>`; `lib/central.ts` fija `CENTRAL_CURRENCY = "BOB"` | El bot paraguayo cotizaría en bolivianos. Hay que sacar la moneda del negocio, no del código. |
| Cobro por QR | `lib/baas.ts` es el BaaS de PetroBox contra el **BCP de Bolivia** (`BAAS_USER`, `QR_BUSINESS_CODE`, `QR_IDNODE`) | En Paraguay no sirve. O se integra otra pasarela, o el bot paraguayo ofrece transferencia manual y se le saca el marcador `[QR:monto]` del prompt. |
| Zona horaria | default `America/La_Paz` | Debería ser `America/Asuncion`. El campo existe en la config pero no está en el panel. |

El formato de teléfono no es problema: el transporte trabaja con los dígitos del
JID, así que `+595…` funciona igual que `+591…`.

---

## 5. Resumen accionable

| # | Falta | Bloquea | Esfuerzo |
|---|---|---|---|
| 1 | Alta de los números en Meta + credenciales en bilbo | Que reciba mensajes reales | depende de Meta |
| 2 | `central.sql` y migraciones 002/013 aplicadas | Que resuelva el negocio y guarde | minutos |
| 3 | Bandeja + traspaso a humano | Poder intervenir una venta | mediano |
| 4 | Crear pedido/venta y conciliar el pago | Que la venta exista en el POS | mediano |
| 5 | Moneda y pasarela por negocio | Vender fuera de Bolivia | mediano |

**Orden sugerido:** 1 y 2 son configuración pura y desbloquean la prueba real.
3 y 4 son la siguiente etapa: lo que convierte al bot de "contesta bien" en
"vende y queda registrado".
