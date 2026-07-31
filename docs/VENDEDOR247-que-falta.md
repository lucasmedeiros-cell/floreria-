# Vendedor 24/7 — qué está hecho y qué falta para dejarlo configurado

Revisión del 2026-07-31 sobre la rama `desktop-coquito`. Este documento explica,
sin dar nada por sabido, en qué estado real está el bot de WhatsApp con IA, qué
hace falta para que atienda clientes de verdad, y qué implicaría tener **dos
números** (uno boliviano y uno paraguayo).

El documento hermano `docs/vendedor247.md` describe el diseño y cómo probarlo.
Este describe **el estado**: lo que funciona, lo que falta y por qué.

---

## 1. Cómo funciona hoy, en una pasada

Un mensaje entrante recorre este camino:

```
WhatsApp del cliente
   ↓
Transporte  ── lib/whatsappBaileys.ts  (número vinculado por QR, el que se usa hoy)
            └─ lib/whatsappCloud.ts    (Cloud API de Meta, por webhook — alternativa)
   ↓
Motor       ── lib/vendedorEngine.ts   → handleIncoming()
   1. guarda el mensaje en wa_conversations / wa_messages
   2. ¿el bot está encendido?           (config botEnabled)
   3. ¿un humano tomó el control?       (columna bot_active)
   4. ¿estamos en horario?              (config businessHours + timezone)
   5. ¿hace falta palabra clave?        (config activationKeyword)
   ↓
IA          ── lib/vendedor247.ts      → generateReply()
   arma el system prompt con la persona del rubro + el catálogo real de la BD
   ↓
Respuesta   → se envía por el transporte
   si el texto trae el marcador [QR:monto] → lib/baas.ts genera el QR del BCP
   y se manda como imagen
```

El panel del negocio (**Admin → Configuración → Vendedor 24/7**,
`components/admin/VendedorEditor.tsx`) permite encender el bot, escribir la
persona, elegir modelo, formas de pago, vincular WhatsApp por QR y probar la
conversación sin WhatsApp real.

**Todo eso está construido y funciona.** Lo que sigue son los huecos.

---

## 2. Lo que falta, en orden de importancia

### 2.1 Credenciales de IA — bloqueante

Sin credenciales, el bot **no falla**: entra en *modo simulado* y contesta un
texto de ejemplo que termina en "(respuesta simulada — configura
ANTHROPIC_API_KEY para IA real)". Es fácil creer que está andando cuando no lo
está.

Hay tres modos, en este orden de prioridad (`lib/vendedor247.ts`):

| Prioridad | Variable | Dónde sirve |
|---|---|---|
| 1 | `ANTHROPIC_API_KEY` | En cualquier lado. Es lo que corresponde en el servidor. |
| 2 | `ANTHROPIC_AUTH_TOKEN`, o el archivo `~/.claude/.credentials.json` | Solo en una máquina con sesión de Claude Code. El token caduca y se renueva solo; el bot lo relee en cada llamada. |
| 3 | ninguna | Modo simulado. |

**Estado actual:** en `.env.local` la línea `ANTHROPIC_API_KEY` está comentada,
así que en tu máquina el bot está usando el token OAuth de tu sesión de Claude
Code. Eso sirve para probar, pero **no es una configuración de producción**: en
bilbo no hay sesión de Claude Code, y si no está la API key el vendedor contesta
simulado a clientes reales.

No pude verificar el `.env` de bilbo desde esta sesión (el SSH pidió clave
pública y no la tengo). Para confirmarlo:

```bash
ssh -p 2202 bilbo 'grep -E "ANTHROPIC" ~/easypos/.env'
```

Si no aparece nada, hay que agregar `ANTHROPIC_API_KEY=sk-ant-...` y reiniciar
con pm2.

### 2.2 Nadie arranca Baileys cuando levanta el proceso

La sesión de WhatsApp solo se abre cuando alguien entra al panel y aprieta
*Generar QR* — es decir, cuando llega un `POST /api/whatsapp/baileys
{"action":"start"}`. No hay ningún arranque automático: busqué un
`instrumentation.ts` o un hook de boot y no existe.

Consecuencia práctica: **después de cada deploy o de cada `pm2 restart`, el
vendedor queda mudo** hasta que una persona abra Configuración en el navegador.
Los mensajes que lleguen mientras tanto no se contestan (y como el socket nunca
se abrió, ni siquiera quedan registrados).

Ojo con la confusión fácil: `whatsappBaileys.ts` **sí** tiene reconexión
automática con reintentos exponenciales, pero eso solo cubre caídas de la
conexión *dentro de un proceso que ya arrancó el bot*. No cubre el arranque en
frío.

Lo que falta: un `instrumentation.ts` de Next que llame a `baileys().start()` al
levantar el server (y que no lo intente en serverless, donde ya está detectado y
deshabilitado).

### 2.3 El bot no ve la base del negocio (rompe el multi-negocio)

Este es el hueco menos visible y el más importante si el vendedor va a vivir en
`easypos.easypaybo.com`.

El sistema es multi-negocio: cada negocio tiene su propia base
(`bo_epos_coquito`, etc.) y `lib/tenant.ts` resuelve cuál corresponde **por
request**, dejándola en un `AsyncLocalStorage`. `lib/db.ts` la lee de ahí, y por
eso ninguna ruta tiene que pasar el negocio a mano.

El problema: `handleIncoming` no corre dentro de una request. Lo dispara el
socket de WhatsApp (`messages.upsert`), fuera de todo contexto HTTP. Sin
contexto de tenant, `activePool()` cae al pool por defecto, o sea `DATABASE_URL`.

Traducido: en un servidor multi-negocio, el bot leería la configuración y el
catálogo de **la base por defecto**, y escribiría ahí las conversaciones — no en
la base del negocio dueño de ese WhatsApp. Hoy solo es correcto en modo *un solo
negocio*, que es como corre Coquito.

Lo que falta: que el transporte sepa a qué negocio pertenece la sesión y ejecute
el motor dentro del contexto de ese tenant.

### 2.4 Migración 002 aplicada en la base correcta

Las tablas `wa_conversations` y `wa_messages` vienen de
`db/migrations/002_vendedor247.sql`. Hay que asegurarse de que estén aplicadas en
**la base del negocio**, no solo en la de desarrollo:

```bash
npm run db:apply   # con DATABASE_URL apuntando a la base que corresponda
```

Si faltan, el bot lanza error al guardar el primer mensaje entrante.

### 2.5 El horario de atención no se puede configurar desde el panel

El motor tiene la lógica completa de horarios (`isWithinHours`, con rangos por
día de semana y zona horaria) y el mensaje automático de fuera de horario. Pero
`VendedorEditor.tsx` no incluye esos campos: su interfaz de config no tiene
`businessHours`, así que al guardar manda `undefined` y la ruta
`app/api/whatsapp/config/route.ts` escribe `businessHours: null`.

Dos consecuencias:

- El bot atiende **siempre**, 24/7, aunque el negocio quiera un horario.
- El campo "Mensaje fuera de horario" que sí aparece en el panel **nunca se
  usa**: como no hay horario, nunca hay un "fuera de horario".
- Y si alguien cargara el horario a mano en la base, el primer guardado desde el
  panel se lo borra.

Lo que falta: los campos de horario y zona horaria en el panel, o al menos que
el POST no pise lo que ya estaba guardado.

### 2.6 No hay bandeja de conversaciones ni traspaso a humano

La columna `bot_active` existe y el motor la respeta (si está en `false`, el bot
se calla y deja que conteste una persona). Pero no hay ninguna pantalla para:

- ver las conversaciones que atendió el bot,
- tomar el control de una charla,
- devolvérsela al bot después.

Hoy eso solo se puede hacer editando la base a mano. Para un vendedor que cierra
ventas, no poder intervenir cuando se traba es una limitación seria.

### 2.7 El pedido no aterriza en el POS

Cuando el cliente confirma, el bot manda el QR del BCP y ahí termina su trabajo.
No crea un pedido, no crea una venta, y no hace seguimiento del pago (el
endpoint de estado del QR existe, `/payments/status`, pero el motor no lo
consulta).

O sea: la plata puede entrar y en el sistema no queda registro de la venta ni
del pedido; solo el chat. Alguien tiene que mirar WhatsApp y cargarlo a mano.

### 2.8 Número dedicado y el transporte oficial a medias

Baileys vincula un número normal escaneando el QR de *Dispositivos vinculados*.
Es cómodo y gratis, pero **no es oficial**: Meta puede banear el número. Usá una
línea dedicada al bot, nunca el WhatsApp personal del dueño.

La alternativa oficial es la Cloud API de Meta, que ya está implementada
(`lib/whatsappCloud.ts` + `app/api/whatsapp/webhook/route.ts`), pero sin
configurar: en `.env.local` solo está `META_WA_VERIFY_TOKEN`; faltan
`META_WA_TOKEN` y `META_WA_PHONE_ID`. Además Baileys necesita un proceso
persistente (bilbo con pm2), así que **en Netlify no corre** — ahí el único
camino sería la Cloud API.

---

## 3. Dos números: uno boliviano y uno paraguayo

### Hoy no se puede, y estas son las tres razones concretas

1. **El manager es un singleton.** `baileys()` guarda una única instancia en
   `globalThis.__waBaileys`. Un proceso, un socket, un número.
2. **La carpeta de sesión es fija.** `AUTH_DIR = <WA_AUTH_DIR o cwd>/.wa-auth`.
   Las credenciales de un solo WhatsApp.
3. **La configuración es una sola fila.** Todo vive en `settings` con
   `key = 'vendedor247'`: una persona, un horario, unas formas de pago.

### Camino A — dos procesos, sin tocar código

Dos instancias en pm2, cada una con:

- su propio `WA_AUTH_DIR` (sesiones de WhatsApp separadas),
- su propio `DATABASE_URL` (una base por país: catálogo, precios y
  conversaciones aparte),
- su propio puerto.

Funciona **hoy mismo**, sin cambios. El costo es operativo: dos despliegues, dos
configuraciones y dos paneles que mantener.

### Camino B — soportarlo de verdad

Convertir el manager en un mapa de sesiones (una por negocio/número), con
carpeta de auth por clave, y hacer que el motor corra dentro del contexto de
tenant del negocio dueño del número que recibió el mensaje.

Es exactamente el mismo trabajo que arregla el punto **2.3**, así que conviene
hacer los dos juntos: sin contexto de tenant, dos números escribirían en la
misma base igual.

### Lo específico de Paraguay

Aunque resuelvas lo de las sesiones, hay tres cosas que hoy asumen Bolivia:

| Qué | Dónde | Por qué importa |
|---|---|---|
| Moneda cableada | `systemPrompt()` dice "Los precios van en bolivianos (Bs)" y arma el catálogo como `Bs <precio>`; `lib/central.ts` fija `CENTRAL_CURRENCY = "BOB"` | El bot paraguayo cotizaría en bolivianos. Hay que sacar la moneda del negocio, no del código. |
| Cobro por QR | `lib/baas.ts` es el BaaS de PetroBox contra el **BCP de Bolivia** (`BAAS_USER`, `QR_BUSINESS_CODE`, `QR_IDNODE`) | En Paraguay no sirve. O se integra otra pasarela, o el bot paraguayo ofrece transferencia manual y se le saca el marcador `[QR:monto]` del prompt. |
| Zona horaria | default `America/La_Paz` | Debería ser `America/Asuncion`. El campo existe en la config, pero es justo uno de los que no están en el panel (punto 2.5). |

El formato de teléfono no es problema: el transporte trabaja con los dígitos del
JID, así que `+595...` funciona igual que `+591...`.

---

## 4. Resumen accionable

| # | Falta | Bloquea | Esfuerzo |
|---|---|---|---|
| 1 | `ANTHROPIC_API_KEY` en el `.env` de bilbo | Que el bot conteste con IA real | minutos |
| 2 | Arranque automático de Baileys al boot | Que sobreviva a deploys y reinicios | chico |
| 3 | Contexto de tenant en el motor | Multi-negocio y dos números | mediano |
| 4 | Migración 002 en la base del negocio | Que guarde conversaciones | minutos |
| 5 | Campos de horario en el panel | Horario y mensaje fuera de horario | chico |
| 6 | Bandeja + traspaso a humano | Poder intervenir una venta | mediano |
| 7 | Crear pedido/venta y conciliar el pago | Que la venta exista en el POS | mediano |
| 8 | Número dedicado (y/o Cloud API) | Riesgo de baneo, y Netlify | según el camino |

**Orden sugerido:** 1 y 4 primero (son configuración pura y desbloquean la
prueba real), después 2 y 5 (chicos y muy visibles), y luego 3 junto con lo de
los dos números si el objetivo es multi-país. 6 y 7 son la siguiente etapa: lo
que convierte al bot de "contesta bien" en "vende y queda registrado".
