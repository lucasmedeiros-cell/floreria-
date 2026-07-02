// ============================================================
//  Cliente del BaaS de PetroBox (QR dinámico del BCP).
//  El servidor le pide al BaaS que genere un QR de monto fijo y
//  luego consulta si fue pagado.
//
//  Toda la identidad y las credenciales se leen del entorno (.env.local),
//  nunca van en el código:
//    BAAS_BASE_URL, BAAS_USER, BAAS_PASS, QR_BUSINESS_CODE, QR_IDNODE
//
//  QR_BUSINESS_CODE / QR_IDNODE identifican a qué comercio se acreditan
//  los pagos: deben ser los de FloresOnline.
// ============================================================

const BAAS_BASE_URL = process.env.BAAS_BASE_URL ?? "";
const BAAS_USER = process.env.BAAS_USER ?? "";
const BAAS_PASS = process.env.BAAS_PASS ?? "";
const QR_BUSINESS_CODE = process.env.QR_BUSINESS_CODE ?? "";
const QR_IDNODE = process.env.QR_IDNODE ?? "";

function authHeader(): string {
  const basic = Buffer.from(`${BAAS_USER}:${BAAS_PASS}`).toString("base64");
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
  try {
    const res = await fetch(`${BAAS_BASE_URL}/api/qr_dinamico/generar`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader(),
      },
      body: JSON.stringify({
        amount,
        businessCode: QR_BUSINESS_CODE,
        idnode: QR_IDNODE,
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
  try {
    const res = await fetch(`${BAAS_BASE_URL}/api/qr_dinamico/estado`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader(),
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
