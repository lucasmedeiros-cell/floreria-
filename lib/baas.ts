// ============================================================
//  Cliente del BaaS de PetroBox (QR dinámico del BCP).
//  El servidor le pide al BaaS que genere un QR de monto fijo y
//  luego consulta si fue pagado.
//
//  Las credenciales del comercio son POR NEGOCIO: viven en la base del
//  tenant (`settings`, clave "baas") y se cargan en el panel de provisión.
//  Sin eso, cada negocio cobraría contra la misma cuenta BCP global.
//  Si el negocio no tiene credenciales propias se cae a las del entorno
//  (BAAS_USER, BAAS_PASS, QR_BUSINESS_CODE, QR_IDNODE) — el modo de un
//  solo negocio sigue funcionando igual que siempre.
//  El dominio del BaaS (no es secreto) tiene un valor por defecto para
//  que la URL nunca quede relativa (evita "Failed to parse URL").
// ============================================================

import { queryOne } from "./db";

const BAAS_BASE_URL =
  process.env.BAAS_BASE_URL || "https://baas-bcp.petroboxinc.com";

export interface BaasCreds {
  user: string;
  pass: string;
  businessCode: string;
  idnode: string;
}

export const BAAS_SETTINGS_KEY = "baas";

/**
 * Credenciales efectivas del negocio de ESTA request: primero las suyas
 * (settings del tenant), si no las del entorno. Nunca tira: sin fila en
 * settings (o sin tabla) simplemente se usa el fallback.
 */
async function credenciales(): Promise<BaasCreds> {
  let propio: Partial<BaasCreds> = {};
  try {
    const row = await queryOne<{ value: Partial<BaasCreds> }>(
      `SELECT value FROM settings WHERE key = $1`,
      [BAAS_SETTINGS_KEY]
    );
    propio = row?.value ?? {};
  } catch {
    // sin settings accesibles: se sigue con el entorno
  }
  return {
    user: propio.user || process.env.BAAS_USER || "",
    pass: propio.pass || process.env.BAAS_PASS || "",
    businessCode: propio.businessCode || process.env.QR_BUSINESS_CODE || "",
    idnode: propio.idnode || process.env.QR_IDNODE || "",
  };
}

/** Faltan credenciales del comercio → no se puede cobrar por QR. */
function configError(c: BaasCreds): string | null {
  const faltan: string[] = [];
  if (!c.user) faltan.push("usuario");
  if (!c.pass) faltan.push("clave");
  if (!c.businessCode) faltan.push("código de comercio");
  if (!c.idnode) faltan.push("idnode");
  return faltan.length
    ? `Pago QR no configurado para este negocio (falta: ${faltan.join(", ")}). Cargalo en el panel.`
    : null;
}

function authHeader(c: BaasCreds): string {
  const basic = Buffer.from(`${c.user}:${c.pass}`).toString("base64");
  return `Basic ${basic}`;
}

export interface QRGenerado {
  ok: boolean;
  correlativo?: string;
  qrImage?: string; // PNG base64 (sin prefijo data:)
  id?: number;
  expiration?: string;
  amount?: number;
  error?: string;
}

/** Genera un QR dinámico de monto fijo ante el BaaS/BCP. */
export async function generarQR(
  amount: number,
  gloss: string
): Promise<QRGenerado> {
  const creds = await credenciales();
  const cfg = configError(creds);
  if (cfg) return { ok: false, error: cfg };
  try {
    const res = await fetch(`${BAAS_BASE_URL}/api/qr_dinamico/generar`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader(creds),
      },
      body: JSON.stringify({
        amount,
        businessCode: creds.businessCode,
        idnode: creds.idnode,
        gloss: gloss.slice(0, 120),
        teller: "1", // el BCP exige Teller no vacío
      }),
      cache: "no-store",
    });
    const d = await res.json();
    if (d.state === "00" && d.qr_image) {
      return {
        ok: true,
        correlativo: d.correlativo,
        qrImage: d.qr_image,
        id: d.id,
        expiration: d.expiration,
        amount: d.amount,
      };
    }
    return { ok: false, error: d.message || `Error BCP (state ${d.state})` };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "No se pudo conectar al BaaS",
    };
  }
}

export interface EstadoPago {
  pagado: boolean;
  status?: string;
  amount?: number | null;
  operationNumber?: string | null;
  receiverName?: string | null;
  fecha?: string | null;
  error?: string;
}

/** Consulta si un QR ya fue pagado. Se matchea por el id del QR. */
export async function consultarEstado(
  correlativo: string,
  qrId?: string | number | null
): Promise<EstadoPago> {
  const creds = await credenciales();
  try {
    const res = await fetch(`${BAAS_BASE_URL}/api/qr_dinamico/estado`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader(creds),
      },
      // El BCP manda el callback con correlativoid VACÍO; matcheamos por qr_id.
      body: JSON.stringify({
        correlativo,
        qr_id: qrId != null ? String(qrId) : "",
      }),
      cache: "no-store",
    });
    const d = await res.json();
    return {
      pagado: !!d.pagado,
      status: d.status,
      amount: d.amount,
      operationNumber: d.operationNumber,
      receiverName: d.receiverName,
      fecha: d.fecha,
    };
  } catch (e) {
    return {
      pagado: false,
      error: e instanceof Error ? e.message : "Sin conexión",
    };
  }
}
