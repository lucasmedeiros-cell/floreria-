import { existsSync, readdirSync, readFileSync } from "node:fs";
import { rename, rm } from "node:fs/promises";
import { join } from "node:path";
import { handleIncoming, type Sender } from "./vendedorEngine";
import { estaActivo, isMultiTenant, negocioBySlug, runWithTenant } from "./tenant";

/**
 * Transporte WhatsApp por BAILEYS (número normal, se vincula por QR).
 *
 * Hay UNA SESIÓN POR NEGOCIO: cada negocio vincula su propio número desde su
 * ficha, y los mensajes de ese número se atienden contra LA BASE DE ESE NEGOCIO.
 * La sesión de cada uno vive en su propia carpeta (`.wa-auth/<slug>`), así que
 * dos negocios pueden tener el bot andando a la vez sin pisarse.
 *
 * Corre como un proceso persistente (ideal en local con `npm run dev` o en
 * bilbo con pm2). NO sirve para serverless (Netlify). Riesgo de baneo de Meta:
 * usar con un número dedicado. Portado de Vendedor247 (whatsapp.service.ts).
 *
 * Baileys se importa de forma perezosa (dynamic import) para no cargar la
 * librería ni abrir sockets salvo que se arranque explícitamente el bot.
 */

type Status = "idle" | "connecting" | "qr" | "open" | "closed" | "unavailable";

// Raíz de las sesiones. Cada negocio guarda la suya en `<raíz>/<slug>`.
const AUTH_ROOT = join(process.env.WA_AUTH_DIR || process.cwd(), ".wa-auth");

/** Instalación de un solo negocio (sin central): la sesión va en `default`. */
const SLUG_UNICO = "default";

/**
 * ¿Estamos en un entorno serverless con filesystem de solo lectura (Netlify /
 * AWS Lambda)? Ahí Baileys NO puede correr (no puede persistir la sesión ni
 * mantener el socket). Se detecta y se deshabilita limpiamente.
 */
function serverlessReadOnly(): boolean {
  return !!(
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    process.env.LAMBDA_TASK_ROOT ||
    process.env.NETLIFY ||
    process.cwd() === "/var/task"
  );
}

// Un manager por negocio, conservado entre recargas de módulo (HMR de Next).
const g = globalThis as unknown as { __waBaileysPorNegocio?: Map<string, BaileysManager> };

class BaileysManager {
  /** Slug del negocio dueño de esta sesión. */
  readonly slug: string;
  private sock: any = null;
  private qrDataUrl: string | null = null;
  private status: Status = "idle";
  private starting = false;
  private reconnectAttempts = 0;
  private lastError: string | null = null;

  constructor(slug: string) {
    this.slug = slug || SLUG_UNICO;
  }

  /** Carpeta de credenciales de ESTE negocio. */
  private authDir(): string {
    return join(AUTH_ROOT, this.slug);
  }

  getStatus() {
    const available = !serverlessReadOnly();
    return {
      status: available ? this.status : ("unavailable" as Status),
      hasQr: !!this.qrDataUrl,
      connected: available && this.status === "open",
      available,
      number: this.getNumber(),
      error: available
        ? this.lastError
        : "WhatsApp por Baileys no está disponible en este despliegue (serverless). Corré el vendedor en local o en bilbo.",
    };
  }

  getQr() {
    return this.qrDataUrl;
  }

  /**
   * Número al que está vinculado el WhatsApp del vendedor (solo dígitos, ej.
   * "59177648081"). Del socket vivo si está abierto; si no, de las credenciales
   * persistidas. null si nunca se vinculó.
   */
  getNumber(): string | null {
    const parse = (id?: string | null) => {
      const digits = (id ?? "").split(/[:@]/)[0].replace(/[^0-9]/g, "");
      return digits || null;
    };
    const live = parse(this.sock?.user?.id);
    if (live) return live;
    if (serverlessReadOnly()) return null;
    try {
      const creds = JSON.parse(readFileSync(join(this.authDir(), "creds.json"), "utf8"));
      return parse(creds?.me?.id);
    } catch {
      return null;
    }
  }

  /** Sender para el motor. */
  sender: Sender = {
    sendText: async (phone, body) => {
      await this.sendText(phone, body);
    },
    sendImageBase64: async (phone, base64, caption) => {
      if (!this.sock || this.status !== "open") {
        console.warn(`[wa:baileys][${this.slug}] sin conexión: NO se envió la imagen a ${phone}`);
        return;
      }
      const jid = await this.destino(phone);
      try {
        await this.sock.sendMessage(jid, { image: Buffer.from(base64, "base64"), caption });
      } catch (e) {
        console.warn(`[wa:baileys] send image: ${e}`);
      }
    },
  };

  /**
   * Teléfono que mostramos → JID exacto al que hay que contestar.
   *
   * WhatsApp ya no siempre direcciona por número: manda un LID
   * (`1234567890123@lid`). Contestarle a `<lid>@s.whatsapp.net` no falla, pero
   * el mensaje no llega a nadie. Así que se recuerda el JID original.
   */
  private destinos = new Map<string, string>();

  private recordarDestino(phone: string, jid: string) {
    this.destinos.set(phone, jid);
  }

  /**
   * A dónde se manda: lo recordado en memoria, lo guardado en la charla, y como
   * último recurso el número armado a mano (que es lo correcto cuando el cliente
   * sí vino identificado por teléfono).
   */
  private async destino(phone: string): Promise<string> {
    const enMemoria = this.destinos.get(phone);
    if (enMemoria) return enMemoria;
    try {
      const { queryOne } = await import("./db");
      const fila = await queryOne<{ jid: string | null }>(
        `SELECT jid FROM wa_conversations WHERE phone = $1`,
        [phone]
      );
      if (fila?.jid) {
        this.destinos.set(phone, fila.jid);
        return fila.jid;
      }
    } catch {
      /* sin contexto de negocio o sin la columna: se usa el número */
    }
    return this.jid(phone);
  }

  private jid(phone: string) {
    return `${phone.replace(/[^0-9]/g, "")}@s.whatsapp.net`;
  }

  async sendText(phone: string, text: string): Promise<boolean> {
    if (!this.sock || this.status !== "open") {
      console.warn(`[wa:baileys][${this.slug}] sin conexión: NO se envió a ${phone}`);
      return false;
    }
    try {
      await this.sock.sendMessage(await this.destino(phone), { text });
      return true;
    } catch (e) {
      console.warn(`[wa:baileys] send text: ${e}`);
      return false;
    }
  }

  /** Cierra la sesión y borra credenciales (fuerza un QR nuevo). */
  async logout() {
    try {
      await this.sock?.logout?.();
    } catch {}
    this.sock = null;
    this.status = "idle";
    this.qrDataUrl = null;
    await rm(this.authDir(), { recursive: true, force: true }).catch(() => {});
  }

  /**
   * Mueve la sesión a un lado con la fecha, en vez de borrarla.
   *
   * OJO: nunca mover ni copiar la carpeta de sesión con el socket CONECTADO. El
   * proceso vivo sigue escribiendo claves ahí, el siguiente arranca con
   * credenciales a medias y WhatsApp revoca el dispositivo — hay que reescanear.
   */
  private async archivarSesion(): Promise<void> {
    const dir = this.authDir();
    const destino = `${dir}.revocada-${Date.now()}`;
    try {
      await rename(dir, destino);
      console.warn(`[wa:baileys][${this.slug}] sesión archivada en ${destino}`);
    } catch {
      await rm(dir, { recursive: true, force: true }).catch(() => {});
    }
  }

  async start() {
    if (serverlessReadOnly()) {
      // Netlify/Lambda: FS de solo lectura, no se puede vincular WhatsApp aquí.
      this.status = "unavailable";
      this.lastError = null;
      return;
    }
    if (this.starting || this.status === "open") return;
    this.starting = true;
    this.lastError = null;
    try {
      const baileys = await import("@whiskeysockets/baileys");
      const makeWASocket = (baileys as any).default ?? baileys.makeWASocket;
      const { useMultiFileAuthState, DisconnectReason } = baileys as any;
      const QRCode = (await import("qrcode")).default ?? (await import("qrcode"));
      const pino = (await import("pino")).default ?? (await import("pino"));

      const { state, saveCreds } = await useMultiFileAuthState(this.authDir());
      this.status = "connecting";
      this.sock = makeWASocket({
        auth: state,
        logger: (pino as any)({ level: "silent" }),
        browser: ["FloresOnline", "Chrome", "1.0"],
      });

      this.sock.ev.on("creds.update", saveCreds);

      this.sock.ev.on("connection.update", async (u: any) => {
        const { connection, lastDisconnect, qr } = u;
        if (qr) {
          this.qrDataUrl = await (QRCode as any).toDataURL(qr);
          this.status = "qr";
          console.log(`[wa:baileys][${this.slug}] QR generado — escanéalo desde WhatsApp`);
        }
        if (connection === "open") {
          this.status = "open";
          this.qrDataUrl = null;
          this.reconnectAttempts = 0;
          console.log(`[wa:baileys][${this.slug}] ✅ WhatsApp conectado`);
        }
        if (connection === "close") {
          this.status = "closed";
          this.starting = false;
          const code = (lastDisconnect?.error as any)?.output?.statusCode;
          if (code === DisconnectReason?.loggedOut) {
            console.warn(
              `[wa:baileys][${this.slug}] WhatsApp revocó la sesión (401): hace falta reescanear el QR.`
            );
            this.reconnectAttempts = 0;
            // Se ARCHIVA en vez de borrarse: si el 401 fue un accidente (dos
            // procesos con las mismas credenciales, o mover la carpeta con el
            // socket vivo) queda el rastro para entender qué pasó, y no se
            // pierde en silencio.
            await this.archivarSesion();
          } else {
            this.reconnectAttempts += 1;
            const delay = Math.min(60000, 3000 * 2 ** Math.min(this.reconnectAttempts - 1, 5));
            console.warn(`[wa:baileys][${this.slug}] conexión cerrada (code ${code ?? "n/a"}), reintento #${this.reconnectAttempts} en ${Math.round(delay / 1000)}s`);
            setTimeout(() => this.start().catch(() => {}), delay);
          }
        }
      });

      this.sock.ev.on("messages.upsert", (m: any) => {
        this.onMessages(m).catch((e) => console.warn(`[wa:baileys] incoming: ${e}`));
      });
    } catch (e) {
      this.status = "closed";
      this.lastError = e instanceof Error ? e.message : String(e);
      console.error(`[wa:baileys] start error: ${e}`);
    } finally {
      this.starting = false;
    }
  }

  private async onMessages(m: any) {
    if (m.type !== "notify") return;
    for (const msg of m.messages ?? []) {
      if (!msg.message || msg.key?.fromMe) continue;
      const jid: string = msg.key?.remoteJid ?? "";
      if (!jid || jid.endsWith("@g.us") || jid.includes("broadcast")) continue;
      const text = textoDelMensaje(msg.message);
      if (!text.trim()) continue;

      // Con LID, WhatsApp manda aparte el número real (`senderPn`). Se prefiere
      // ese para mostrar y guardar; el LID solo sirve para contestar.
      const pn: string =
        msg.key?.senderPn || msg.key?.remoteJidAlt || msg.key?.participantPn || "";
      const idParaMostrar = (pn || jid).split("@")[0].split(":")[0];
      const phone = "+" + idParaMostrar;
      const name = msg.pushName || phone;
      this.recordarDestino(phone, jid);
      if (jid.endsWith("@lid") && !pn) {
        console.warn(
          `[wa:baileys][${this.slug}] el cliente vino como LID y sin número: se guarda ${phone}`
        );
      }

      // Anuncio click-to-WhatsApp de Meta (referral en el mensaje).
      const adRef =
        msg.message?.extendedTextMessage?.contextInfo?.externalAdReply ??
        msg.message?.imageMessage?.contextInfo?.externalAdReply;
      const campaign = adRef
        ? String(adRef.title || adRef.sourceId || adRef.body || "Anuncio Meta").slice(0, 80)
        : null;

      // Indicador "escribiendo…" mientras responde la IA.
      try {
        await this.sock.presenceSubscribe(jid);
        await this.sock.sendPresenceUpdate("composing", jid);
      } catch {}

      await atenderComoNegocio(this.slug, async () => {
        await handleIncoming(phone, name, text, campaign, this.sender);
        // El JID se guarda DESPUÉS: la fila de la charla la crea el motor.
        const { query } = await import("./db");
        await query(`UPDATE wa_conversations SET jid = $2 WHERE phone = $1`, [phone, jid]).catch(
          () => {}
        );
      }).catch((e) => console.warn(`[wa:baileys][${this.slug}] handle: ${e}`));

      try {
        await this.sock.sendPresenceUpdate("paused", jid);
      } catch {}
    }
  }
}

/**
 * Qué texto se le pasa al bot según el tipo de mensaje.
 *
 * Antes solo se leían los de texto y el resto se descartaba ENTERO: el cliente
 * mandaba su ubicación por el clip, el bot no veía nada y le volvía a pedir la
 * dirección. Las fotos con epígrafe pasaban lo mismo.
 *
 * Lo que el bot no puede leer (audio, sticker) se convierte en un aviso, así al
 * menos contesta algo en vez de quedarse callado.
 */
function textoDelMensaje(m: any): string {
  if (!m) return "";

  const directo = m.conversation || m.extendedTextMessage?.text;
  if (directo) return String(directo);

  // Ubicación: se le pasa el enlace del mapa, que es lo que sirve para entregar.
  const loc = m.locationMessage || m.liveLocationMessage;
  if (loc?.degreesLatitude != null && loc?.degreesLongitude != null) {
    const lat = Number(loc.degreesLatitude).toFixed(6);
    const lng = Number(loc.degreesLongitude).toFixed(6);
    const detalle = [loc.name, loc.address].filter(Boolean).join(", ");
    return `Mi ubicación: https://maps.google.com/?q=${lat},${lng}${detalle ? ` (${detalle})` : ""}`;
  }

  // Foto o video con epígrafe: el epígrafe suele traer el pedido.
  const conEpigrafe = m.imageMessage?.caption || m.videoMessage?.caption || m.documentMessage?.caption;
  if (conEpigrafe) return String(conEpigrafe);

  // Contacto compartido.
  if (m.contactMessage?.displayName) return `Contacto: ${m.contactMessage.displayName}`;

  if (m.audioMessage || m.pttMessage) return "[el cliente mandó un audio]";
  if (m.stickerMessage) return "[el cliente mandó un sticker]";
  if (m.imageMessage || m.videoMessage || m.documentMessage) return "[el cliente mandó un archivo]";
  return "";
}

/**
 * Corre el motor dentro de la base del negocio dueño de ESTA sesión.
 *
 * A diferencia del webhook de Meta, el mensaje no llega por una request: lo
 * dispara el socket, fuera de todo contexto. Sin esto, `query()` cae al pool por
 * defecto y el bot leería el catálogo —y guardaría las conversaciones— en la
 * base equivocada, sin que nadie se entere.
 *
 * El dueño es el negocio desde cuya ficha se vinculó el número: va en el slug de
 * la sesión. Si ese negocio no existe o está suspendido, NO se contesta: es
 * preferible el silencio a contestarle a un cliente con los precios de otro.
 */
async function atenderComoNegocio(slug: string, fn: () => Promise<void>): Promise<void> {
  if (!isMultiTenant() || slug === SLUG_UNICO) return fn();

  const negocio = await negocioBySlug(slug);
  if (!negocio) {
    console.warn(`[wa:baileys][${slug}] ese negocio no existe en la central: mensaje ignorado`);
    return;
  }
  if (!estaActivo(negocio)) {
    console.warn(`[wa:baileys][${slug}] negocio ${negocio.estado}: no atiende`);
    return;
  }
  return runWithTenant(negocio, fn);
}

/** El manager del negocio (uno por slug). Sin slug, la instalación única. */
export function baileys(slug?: string | null): BaileysManager {
  const clave = (slug ?? "").trim() || SLUG_UNICO;
  const mapa = (g.__waBaileysPorNegocio ??= new Map<string, BaileysManager>());
  let m = mapa.get(clave);
  if (!m) {
    m = new BaileysManager(clave);
    mapa.set(clave, m);
  }
  return m;
}

/**
 * Slugs con sesión guardada en disco. Lo usa el arranque para reconectar TODAS
 * las que había, sin tener que anotarlas en ningún lado.
 */
export function sesionesGuardadas(): string[] {
  if (serverlessReadOnly()) return [];
  try {
    return readdirSync(AUTH_ROOT, { withFileTypes: true })
      .filter((d) => d.isDirectory() && !d.name.includes(".revocada-"))
      .filter((d) => existsSync(join(AUTH_ROOT, d.name, "creds.json")))
      .map((d) => d.name);
  } catch {
    return [];
  }
}
