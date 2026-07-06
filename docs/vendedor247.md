# Vendedor 24/7 (bot de WhatsApp con IA)

Asistente de ventas que atiende WhatsApp automáticamente actuando como vendedor:
usa el catálogo real de la florería, responde breve y cordial, toma el pedido y
cobra por QR. Portado del proyecto **Vendedor247** (easy-pay-pos) y adaptado a
FloresOnline. No reemplaza el checkout web ni el enlace `wa.me` existentes: es
una capa nueva y aditiva para los mensajes **entrantes** de WhatsApp.

## Piezas

| Archivo | Qué hace |
|---|---|
| `lib/vendedor247.ts` | Config (tabla `settings`, key `vendedor247`) + system prompt de ventas + respuesta con Claude (o simulada). Autentica con **token de cuenta** (OAuth) o API key. |
| `lib/vendedorEngine.ts` | Motor agnóstico del transporte: persistencia, horario, palabra clave, IA y marcador `[QR:monto]`. |
| `lib/whatsappBaileys.ts` | **Transporte actual**: WhatsApp por Baileys (número por QR), proceso persistente. |
| `lib/whatsappCloud.ts` | Transporte alternativo: WhatsApp Cloud API (Meta) por webhook. |
| `app/api/whatsapp/baileys/route.ts` | Estado/QR y arranque de Baileys (solo empleados). |
| `app/api/whatsapp/webhook/route.ts` | Webhook de Meta (GET verificación · POST mensajes). |
| `app/api/whatsapp/config/route.ts` | Config del bot para el panel admin (solo empleados). |
| `app/api/whatsapp/simulate/route.ts` | Probador local: simula un mensaje entrante. |
| `components/admin/VendedorEditor.tsx` | Panel en **Configuración**: editar el bot, conectar WhatsApp (QR) y probarlo. |
| `db/migrations/002_vendedor247.sql` | Tablas `wa_conversations` y `wa_messages`. |

## Autenticación de IA (dos modos)

1. **Token de la cuenta (OAuth) — el que se usa hoy.** Si hay sesión de Claude
   Code, el bot lee el access token de `~/.claude/.credentials.json` (o de
   `ANTHROPIC_AUTH_TOKEN`) y llama a Claude con `Authorization: Bearer` + header
   beta `oauth-2025-04-20`. No hace falta una API key aparte.
2. **API key** (`ANTHROPIC_API_KEY`) — tiene prioridad si está presente.
3. Sin ninguno → **modo simulado** (respuestas de ejemplo).

> Nota: los tokens OAuth caducan y se refrescan; el bot relee el archivo en cada
> llamada para tomar el valor vigente. En un servidor sin Claude Code hay que
> exportar `ANTHROPIC_AUTH_TOKEN` (o usar `ANTHROPIC_API_KEY`).

## WhatsApp con Baileys (transporte actual)

Se vincula un número normal escaneando un QR (no requiere cuenta de Meta):

1. **Admin → Configuración → Vendedor 24/7 → Conectar WhatsApp** → *Generar QR*.
2. En el teléfono: **WhatsApp → Dispositivos vinculados → Vincular un dispositivo**
   y escanear.
3. Conectado: el vendedor responde solo los mensajes entrantes.

La sesión se guarda en `./.wa-auth` (ignorado por git). Baileys necesita un
proceso **persistente** (local con `npm run dev`, o bilbo con pm2); no funciona
en serverless (Netlify) — para Netlify se usaría el transporte Cloud API (Meta).

`next.config.mjs` marca `@whiskeysockets/baileys`, `pino` y `qrcode` como
`serverComponentsExternalPackages` (si no, webpack rompe sus dependencias nativas).

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

## Conectar WhatsApp real (después)

1. Cargar `ANTHROPIC_API_KEY` y `META_WA_TOKEN` / `META_WA_PHONE_ID` /
   `META_WA_VERIFY_TOKEN`.
2. En Meta, apuntar el webhook a `https://<dominio>/api/whatsapp/webhook` con el
   mismo verify token.
