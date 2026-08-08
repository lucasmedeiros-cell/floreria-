import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";
import { readFile } from "fs/promises";
import path from "path";
import { randomBytes } from "crypto";
import QRCode from "qrcode";
import { getPanelSession, logActividad } from "@/lib/panelAuth";
import { waNumber } from "@/lib/business";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ============================================================
//  Motor de administración de negocios (lo consume el panel `/panel`).
//  Trabaja contra la central PROPIA de easy pos (`bo_epos_central`):
//  altas de negocio (crea la base y el admin), estados, dispositivos
//  de pareo, empleados y credenciales de cobro QR.
//
//  Autorización: la sesión del panel (cookie `panel_session`), o la
//  clave PROVISION_KEY (header `x-provision-key`) para scripts. Sin
//  PROVISION_KEY configurada, la clave queda apagada; el panel sigue
//  funcionando con su sesión.
// ============================================================

const KEY = process.env.PROVISION_KEY || "";

function centralUrl(): string {
  const u = process.env.CENTRAL_DATABASE_URL;
  if (!u) throw new Error("CENTRAL_DATABASE_URL no configurada");
  return u;
}
function urlForDb(dbName: string): string {
  const u = new URL(centralUrl());
  u.pathname = "/" + dbName;
  return u.toString();
}
async function withPool<T>(url: string, fn: (p: Pool) => Promise<T>): Promise<T> {
  const pool = new Pool({ connectionString: url, max: 2, connectionTimeoutMillis: 10000 });
  try {
    return await fn(pool);
  } finally {
    await pool.end();
  }
}

/** Quién está operando: el usuario del panel, o "clave-api" si vino por clave. */
function actor(req: NextRequest, body?: { key?: string }): string | null {
  const s = getPanelSession();
  if (s) return s.email;
  if (KEY && (req.headers.get("x-provision-key") || body?.key || "") === KEY) return "clave-api";
  return null;
}
function serverBase(req: NextRequest): string {
  const proto = req.headers.get("x-forwarded-proto") || "https";
  const host = req.headers.get("host") || "";
  return `${proto}://${host}`;
}
const cleanSlug = (s: string) =>
  (s || "").toString().trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");

const ESTADOS = ["prueba", "activo", "suspendido", "baja"] as const;

// GET /api/provision  → lista los negocios (para la tabla del panel).
export async function GET(req: NextRequest) {
  const who = actor(req);
  if (!who) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  try {
    const rows = await withPool(centralUrl(), (p) =>
      p.query(
        `SELECT n.id, n.nombre, n.slug, n.db_name, n.estado, n.rubro,
                n.ciudad, n.nit, n.email, n.telefono,
                COALESCE(NULLIF(n.nit,''), NULLIF(n.email,''), '—') AS propietario,
                n.comision_qr::float8 AS "comisionQr", n.cuenta_qr AS "cuentaQr",
                n.fecha_alta AS "fechaAlta",
                (SELECT count(*) FROM dispositivo d WHERE d.negocio_id = n.id)::int AS dispositivos,
                (SELECT max(d.last_seen) FROM dispositivo d WHERE d.negocio_id = n.id) AS "ultimoUso"
           FROM negocio n
          ORDER BY n.fecha_alta DESC`
      ).then((r) => r.rows)
    );
    return NextResponse.json({ businesses: rows });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message || "Error en la provisión." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const who = actor(req, body);
  if (!who) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const action = body?.action;

  try {
    if (action === "createBusiness") {
      const nombre = (body.nombre || "").toString().trim();
      const slug = cleanSlug(body.slug || body.nombre);
      const rubro = (body.rubro || "repuestos").toString().trim();
      const adminName = (body.adminName || "Administrador").toString().trim();
      const adminPass = (body.adminPass || "").toString();
      const adminEmail = (body.adminEmail || "").toString().trim();
      if (!nombre || !slug) return NextResponse.json({ error: "Falta nombre/slug." }, { status: 400 });
      // Postgres trunca identificadores a 63 chars: un slug largo generaría una
      // DB con nombre distinto al db_name guardado → conexiones rotas después.
      if (slug.length > 50)
        return NextResponse.json({ error: "El slug es muy largo (máx. 50 caracteres)." }, { status: 400 });
      // El admin entra a la app con su CORREO, así que es obligatorio junto con la clave.
      if (!adminEmail) return NextResponse.json({ error: "Poné el correo del admin (con eso entra a la app)." }, { status: 400 });
      if (!adminPass || adminPass.length < 6)
        return NextResponse.json({ error: "La contraseña del admin necesita 6+ caracteres." }, { status: 400 });
      const dbName = `bo_epos_${slug}`;

      // ¿ya existe el slug?
      const dup = await withPool(centralUrl(), (p) =>
        p.query(`SELECT 1 FROM negocio WHERE slug = $1`, [slug]).then((r) => r.rowCount)
      );
      if (dup) return NextResponse.json({ error: `Ya existe un negocio con slug "${slug}".` }, { status: 400 });

      // 1) crear la base (fuera de transacción, desde la maintenance db 'postgres').
      // Se recuerda si la creamos NOSOTROS: si algo falla después, se borra para
      // que el reintento no quede bloqueado por un alta a medias.
      let dbCreadaAhora = false;
      await withPool(urlForDb("postgres"), async (p) => {
        const exists = await p.query(`SELECT 1 FROM pg_database WHERE datname = $1`, [dbName]);
        if (!exists.rowCount) {
          await p.query(`CREATE DATABASE "${dbName}"`);
          dbCreadaAhora = true;
        }
      });

      try {
        // 2) aplicar el esquema + permisos a la base nueva
        const schema = await readFile(path.join(process.cwd(), "db", "schema.sql"), "utf8");
        await withPool(urlForDb(dbName), async (p) => {
          await p.query(schema);
          await p.query(`GRANT USAGE ON SCHEMA public TO petrobox`);
          await p.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO petrobox`);
          await p.query(`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO petrobox`);
          await p.query(
            `ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO petrobox`
          );
          // Config del negocio: el NOMBRE y el rubro, para que la app y la web
          // muestren los datos cargados en el panel (no el default del rubro).
          await p.query(
            `INSERT INTO settings (key, value, updated_at)
             VALUES ('business', $1::jsonb, now())
             ON CONFLICT (key) DO UPDATE SET value = settings.value || EXCLUDED.value, updated_at = now()`,
            [JSON.stringify({ name: nombre, nameLight: "", rubroId: rubro, configured: true })]
          );
          // Admin inicial. Upsert por correo: si un intento anterior quedó a
          // medias, el reintento actualiza en vez de chocar con el unique.
          if (adminPass) {
            await p.query(
              `INSERT INTO employees (name, email, pass_hash, role)
               VALUES ($1, NULLIF($2,''), crypt($3, gen_salt('bf')), 'Administrador')
               ON CONFLICT (lower(email)) WHERE email IS NOT NULL DO UPDATE
                 SET name = EXCLUDED.name, pass_hash = EXCLUDED.pass_hash, role = 'Administrador'`,
              [adminName, adminEmail, adminPass]
            );
          }
        });

        // 3) alta del negocio en la central
        const neg = await withPool(centralUrl(), (p) =>
          p.query(
            `INSERT INTO negocio (nombre, slug, db_name, estado, rubro)
             VALUES ($1,$2,$3,'activo',$4)
             RETURNING id, nombre, slug, db_name, estado`,
            [nombre, slug, dbName, rubro]
          ).then((r) => r.rows[0])
        );
        logActividad(who, "alta-negocio", neg.id, { nombre, slug, rubro });
        return NextResponse.json({ business: neg });
      } catch (err) {
        // Compensación: si la DB la creamos en ESTE request y el alta no llegó
        // a completarse, se elimina para dejar todo como estaba.
        if (dbCreadaAhora) {
          await withPool(urlForDb("postgres"), (p) =>
            p.query(`DROP DATABASE IF EXISTS "${dbName}"`)
          ).catch(() => {});
        }
        throw err;
      }
    }

    if (action === "setEstado") {
      const slug = cleanSlug(body.slug);
      const estado = (body.estado || "").toString();
      if (!ESTADOS.includes(estado as (typeof ESTADOS)[number]))
        return NextResponse.json({ error: "Estado inválido (prueba, activo, suspendido o baja)." }, { status: 400 });
      const neg = await withPool(centralUrl(), (p) =>
        p.query(
          `UPDATE negocio SET estado = $2 WHERE slug = $1
           RETURNING id, nombre, slug, estado`,
          [slug, estado]
        ).then((r) => r.rows[0])
      );
      if (!neg) return NextResponse.json({ error: "Negocio no encontrado." }, { status: 404 });
      logActividad(who, "estado-negocio", neg.id, { slug, estado });
      // La app resuelve el negocio con un cache de 30 s (lib/tenant.ts): una
      // suspensión tarda a lo sumo eso en cortar el acceso.
      return NextResponse.json({ business: neg });
    }

    if (action === "updateNegocio") {
      const slug = cleanSlug(body.slug);
      const campos: Record<string, string | number | null> = {};
      for (const k of ["nombre", "rubro", "nit", "telefono", "email", "direccion", "ciudad"] as const) {
        if (k in body) {
          const v = (body[k] ?? "").toString().trim();
          if (k === "nombre" && !v)
            return NextResponse.json({ error: "El nombre no puede quedar vacío." }, { status: 400 });
          campos[k] = v || null;
        }
      }
      // Config de cobro con QR: % de comisión (0..100) y a qué cuenta cae.
      if ("comisionQr" in body) {
        const c = Number(body.comisionQr);
        campos.comision_qr = Number.isFinite(c) ? Math.min(100, Math.max(0, c)) : 0;
      }
      if ("cuentaQr" in body) {
        campos.cuenta_qr = body.cuentaQr === "comercio" ? "comercio" : "empresa";
      }
      if (!Object.keys(campos).length)
        return NextResponse.json({ error: "Nada para actualizar." }, { status: 400 });
      const sets = Object.keys(campos).map((k, i) => `${k} = $${i + 2}`);
      const neg = await withPool(centralUrl(), (p) =>
        p.query(
          `UPDATE negocio SET ${sets.join(", ")} WHERE slug = $1
           RETURNING id, nombre, slug, db_name, estado, rubro, nit, telefono, email, direccion, ciudad,
                     comision_qr::float8 AS "comisionQr", cuenta_qr AS "cuentaQr"`,
          [slug, ...Object.values(campos)]
        ).then((r) => r.rows[0])
      );
      if (!neg) return NextResponse.json({ error: "Negocio no encontrado." }, { status: 404 });
      logActividad(who, "editar-negocio", neg.id, campos);

      // El teléfono del panel es el WhatsApp con el que sale a la calle la
      // tienda: se copia a la config del negocio para que la vea (y lo pueda
      // cambiar) su CRM, y para que la landing lo use aunque el negocio nunca
      // haya entrado a Configuración.
      if ("telefono" in campos && neg.db_name) {
        try {
          await withPool(urlForDb(neg.db_name), (p) =>
            p.query(
              `INSERT INTO settings (key, value, updated_at)
                 VALUES ('business', jsonb_build_object('whatsapp', $1::text, 'phone', $1::text), now())
               ON CONFLICT (key) DO UPDATE
                 SET value = settings.value
                       || jsonb_build_object('whatsapp', $1::text, 'phone', $1::text),
                     updated_at = now()`,
              [waNumber(campos.telefono as string | null)]
            )
          );
        } catch (error) {
          // El alta en la central ya quedó guardada: que falle la copia (base
          // del negocio caída, por ejemplo) no debe tumbar la edición.
          console.warn("[panel] no se pudo copiar el teléfono al negocio:", error);
        }
      }

      // Lo mismo con el RUBRO, que ahora se elige SOLO acá (el CRM del negocio
      // ya no lo pregunta). De él salen los colores, los textos y las categorías
      // de la tienda y de la landing: sin esta copia, un negocio dado de alta
      // como "Sin definir" se quedaba genérico para siempre.
      // Solo se pisa `rubroId`: el nombre, el logo y el contacto que cargó el
      // negocio en su CRM quedan intactos.
      if ("rubro" in campos && campos.rubro && neg.db_name) {
        try {
          await withPool(urlForDb(neg.db_name), (p) =>
            p.query(
              `INSERT INTO settings (key, value, updated_at)
                 VALUES ('business', jsonb_build_object('rubroId', $1::text), now())
               ON CONFLICT (key) DO UPDATE
                 SET value = settings.value || jsonb_build_object('rubroId', $1::text),
                     updated_at = now()`,
              [campos.rubro]
            )
          );
        } catch (error) {
          console.warn("[panel] no se pudo copiar el rubro al negocio:", error);
        }
      }
      return NextResponse.json({ business: neg });
    }

    if (action === "getNegocio") {
      const slug = cleanSlug(body.slug);
      const neg = await withPool(centralUrl(), (p) =>
        p.query(
          `SELECT id, nombre, slug, db_name, estado, rubro, nit, telefono, email,
                  direccion, ciudad, comision_qr::float8 AS "comisionQr", cuenta_qr AS "cuentaQr",
                  fecha_alta AS "fechaAlta"
             FROM negocio WHERE slug = $1`,
          [slug]
        ).then((r) => r.rows[0])
      );
      if (!neg) return NextResponse.json({ error: "Negocio no encontrado." }, { status: 404 });
      return NextResponse.json({ business: neg });
    }

    // --- Números de WhatsApp (Cloud API de Meta) ---------------------------
    // Un negocio puede tener uno o dos. El `phoneNumberId` es el ID que da Meta
    // al número (no el número en sí): es lo que llega en el webhook y lo que
    // permite saber a qué negocio contestar (lib/whatsappCloud.ts).

    if (action === "listWaNumeros") {
      const slug = cleanSlug(body.slug);
      const filas = await withPool(centralUrl(), (p) =>
        p.query(
          `SELECT w.phone_number_id AS "phoneNumberId", w.numero, w.etiqueta,
                  w.activo, w.token IS NOT NULL AS "tokenPropio",
                  w.fecha_alta AS "fechaAlta"
             FROM wa_numero w
             JOIN negocio n ON n.id = w.negocio_id
            WHERE n.slug = $1
            ORDER BY w.fecha_alta`,
          [slug]
        ).then((r) => r.rows)
      );
      return NextResponse.json({ numeros: filas });
    }

    if (action === "saveWaNumero") {
      const slug = cleanSlug(body.slug);
      const phoneNumberId = (body.phoneNumberId || "").toString().trim();
      if (!phoneNumberId)
        return NextResponse.json({ error: "Falta el ID del número de Meta." }, { status: 400 });

      const neg = await withPool(centralUrl(), (p) =>
        p.query(`SELECT id, nombre FROM negocio WHERE slug = $1`, [slug]).then((r) => r.rows[0])
      );
      if (!neg) return NextResponse.json({ error: "Negocio no encontrado." }, { status: 404 });

      // Un número atiende a UN negocio: si ya está tomado por otro, se avisa en
      // vez de robárselo (el ON CONFLICT lo movería sin que nadie se entere).
      const duenio = await withPool(centralUrl(), (p) =>
        p.query(
          `SELECT n.slug, n.nombre FROM wa_numero w
             JOIN negocio n ON n.id = w.negocio_id
            WHERE w.phone_number_id = $1 AND w.negocio_id <> $2`,
          [phoneNumberId, neg.id]
        ).then((r) => r.rows[0])
      );
      if (duenio)
        return NextResponse.json(
          { error: `Ese número ya está asociado a ${duenio.nombre} (${duenio.slug}).` },
          { status: 409 }
        );

      const numero = waNumber((body.numero ?? "").toString()) || null;
      const etiqueta = (body.etiqueta ?? "").toString().trim() || null;
      const activo = body.activo === undefined ? true : !!body.activo;
      // Token propio: solo si el negocio trae su cuenta de Meta. Mandar "" lo
      // borra y vuelve al token compartido del entorno.
      const tokenRaw = body.token === undefined ? undefined : (body.token ?? "").toString().trim();

      const fila = await withPool(centralUrl(), (p) =>
        p.query(
          `INSERT INTO wa_numero (phone_number_id, negocio_id, numero, etiqueta, token, activo)
             VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (phone_number_id) DO UPDATE
             SET numero   = EXCLUDED.numero,
                 etiqueta = EXCLUDED.etiqueta,
                 activo   = EXCLUDED.activo,
                 token    = CASE WHEN $7 THEN EXCLUDED.token ELSE wa_numero.token END
           RETURNING phone_number_id AS "phoneNumberId", numero, etiqueta, activo,
                     token IS NOT NULL AS "tokenPropio"`,
          [
            phoneNumberId,
            neg.id,
            numero,
            etiqueta,
            tokenRaw ? tokenRaw : null,
            activo,
            tokenRaw !== undefined,
          ]
        ).then((r) => r.rows[0])
      );
      logActividad(who, "wa-numero", neg.id, { phoneNumberId, numero, activo });
      // El webhook cachea la resolución 30 s (lib/tenant.ts): el número nuevo
      // empieza a atender a lo sumo en ese lapso.
      return NextResponse.json({ numero: fila });
    }

    if (action === "deleteWaNumero") {
      const phoneNumberId = (body.phoneNumberId || "").toString().trim();
      const fila = await withPool(centralUrl(), (p) =>
        p.query(
          `DELETE FROM wa_numero WHERE phone_number_id = $1 RETURNING negocio_id`,
          [phoneNumberId]
        ).then((r) => r.rows[0])
      );
      if (!fila) return NextResponse.json({ error: "Ese número no está registrado." }, { status: 404 });
      logActividad(who, "wa-numero-baja", fila.negocio_id, { phoneNumberId });
      return NextResponse.json({ ok: true });
    }

    // --- Vendedor 24/7: config del bot y vínculo por QR ---------------------
    // El bot se administra desde acá y no desde el CRM del negocio (su editor
    // se sacó de Configuración). La config vive en la base del negocio, en
    // `settings.vendedor247`, que es la que lee lib/vendedor247.ts.

    if (action === "getVendedor" || action === "setVendedor") {
      const slug = cleanSlug(body.slug);
      const neg = await withPool(centralUrl(), (p) =>
        p.query(`SELECT id, db_name FROM negocio WHERE slug = $1`, [slug]).then((r) => r.rows[0])
      );
      if (!neg) return NextResponse.json({ error: "Negocio no encontrado." }, { status: 404 });

      if (action === "setVendedor") {
        const cfg: Record<string, unknown> = {};
        if ("botEnabled" in body) cfg.botEnabled = !!body.botEnabled;
        if ("botPersona" in body) cfg.botPersona = (body.botPersona ?? "").toString().trim();
        if ("aiModel" in body) cfg.aiModel = (body.aiModel ?? "").toString().trim() || "claude-haiku-4-5";
        if ("paymentOptions" in body) cfg.paymentOptions = (body.paymentOptions ?? "").toString().trim();
        if (!Object.keys(cfg).length)
          return NextResponse.json({ error: "Nada para actualizar." }, { status: 400 });
        await withPool(urlForDb(neg.db_name), (p) =>
          p.query(
            `INSERT INTO settings (key, value, updated_at) VALUES ('vendedor247', $1::jsonb, now())
             ON CONFLICT (key) DO UPDATE SET value = settings.value || $1::jsonb, updated_at = now()`,
            [JSON.stringify(cfg)]
          )
        );
        logActividad(who, "vendedor-config", neg.id, cfg);
      }

      const fila = await withPool(urlForDb(neg.db_name), (p) =>
        p.query(`SELECT value FROM settings WHERE key = 'vendedor247'`).then((r) => r.rows[0])
      );
      return NextResponse.json({ vendedor: fila?.value ?? null });
    }

    if (action === "baileysEstado" || action === "baileysStart" || action === "baileysLogout") {
      // Import perezoso: Baileys abre sockets y carga binarios nativos, no hay
      // que tocarlo salvo que el panel lo pida expresamente.
      const { baileys } = await import("@/lib/whatsappBaileys");
      // La sesión es del negocio de esta ficha: cada uno vincula su número.
      const wa = baileys(cleanSlug(body.slug));
      if (action === "baileysStart") await wa.start();
      if (action === "baileysLogout") {
        await wa.logout();
        logActividad(who, "vendedor-qr-desvincular", null, {});
      }
      return NextResponse.json({ ...wa.getStatus(), qr: wa.getQr() });
    }

    if (action === "createDevice") {
      const slug = cleanSlug(body.slug);
      const label = (body.label || "Dispositivo").toString().trim();
      if (!slug) return NextResponse.json({ error: "Elegí un negocio." }, { status: 400 });

      const neg = await withPool(centralUrl(), (p) =>
        p.query(`SELECT id, nombre FROM negocio WHERE slug = $1`, [slug]).then((r) => r.rows[0])
      );
      if (!neg) return NextResponse.json({ error: "Negocio no encontrado." }, { status: 404 });

      const token = randomBytes(24).toString("hex");
      // Código corto (4 dígitos) para tipear a mano cuando no se puede escanear.
      // Se reintenta si choca con otro código vigente (a lo sumo unas pocas veces).
      const PAIR_CODE_TTL_MIN = 30;
      let code = "";
      for (let intento = 0; intento < 6; intento++) {
        const c = (randomBytes(2).readUInt16BE(0) % 10000).toString().padStart(4, "0");
        const choca = await withPool(centralUrl(), (p) =>
          p.query(`SELECT 1 FROM dispositivo WHERE pair_code = $1 AND pair_code_exp > now()`, [c]).then(
            (r) => r.rowCount
          )
        );
        if (!choca) {
          code = c;
          break;
        }
      }
      await withPool(centralUrl(), (p) =>
        p.query(
          `INSERT INTO dispositivo (id, negocio_id, token, habilitado, fecha_alta, label, pair_code, pair_code_exp)
           VALUES (gen_random_uuid()::text, $1, $2, true, now(), $3, $4, now() + ($5 || ' minutes')::interval)`,
          [neg.id, token, label, code || null, String(PAIR_CODE_TTL_MIN)]
        )
      );
      logActividad(who, "alta-dispositivo", neg.id, { slug, label });

      const server = serverBase(req);
      // El QR lleva el TOKEN completo (lo más seguro para escanear); el código
      // de 4 dígitos es solo el atajo manual. QR más grande para leer de lejos.
      const qrContent = JSON.stringify({ token, server, code });
      const qrImage = await QRCode.toDataURL(qrContent, { margin: 1, width: 520 });
      return NextResponse.json({ token, code, server, negocio: neg.nombre, label, qrImage });
    }

    if (
      action === "listEmployees" ||
      action === "createEmployee" ||
      action === "setRole" ||
      action === "setEmployeePass"
    ) {
      const slug = cleanSlug(body.slug);
      const neg = await withPool(centralUrl(), (p) =>
        p.query(`SELECT id, db_name FROM negocio WHERE slug = $1`, [slug]).then((r) => r.rows[0])
      );
      if (!neg) return NextResponse.json({ error: "Negocio no encontrado." }, { status: 404 });
      const tenantUrl = urlForDb(neg.db_name);
      const ROLES = ["Administrador", "Vendedora", "Repartidor"];

      if (action === "listEmployees") {
        const emps = await withPool(tenantUrl, (p) =>
          p.query(`SELECT id, name, email, phone, role, active FROM employees ORDER BY active DESC, created_at`).then((r) => r.rows)
        );
        return NextResponse.json({ employees: emps });
      }

      if (action === "createEmployee") {
        const name = (body.name || "").toString().trim();
        const email = (body.email || "").toString().trim();
        const pass = (body.pass || "").toString();
        const role = ROLES.includes(body.role) ? body.role : "Vendedora";
        if (!name || !email) return NextResponse.json({ error: "Poné nombre y correo (el correo es el usuario)." }, { status: 400 });
        if (pass.length < 6) return NextResponse.json({ error: "La contraseña necesita 6+ caracteres." }, { status: 400 });
        try {
          await withPool(tenantUrl, (p) =>
            p.query(
              `INSERT INTO employees (name, email, pass_hash, role) VALUES ($1,$2,crypt($3,gen_salt('bf')),$4)`,
              [name, email, pass, role]
            )
          );
        } catch (err) {
          if ((err as { code?: string }).code === "23505")
            return NextResponse.json({ error: "Ya existe un usuario con ese correo." }, { status: 400 });
          throw err;
        }
        logActividad(who, "alta-empleado", neg.id, { slug, email, role });
        return NextResponse.json({ ok: true });
      }

      if (action === "setRole") {
        const id = (body.employeeId || "").toString();
        const role = ROLES.includes(body.role) ? body.role : null;
        if (!id || !role) return NextResponse.json({ error: "Falta usuario o rol válido." }, { status: 400 });
        const upd = await withPool(tenantUrl, (p) =>
          p.query(`UPDATE employees SET role = $2 WHERE id = $1 RETURNING id`, [id, role]).then((r) => r.rowCount)
        );
        if (upd) logActividad(who, "rol-empleado", neg.id, { slug, employeeId: id, role });
        return upd
          ? NextResponse.json({ ok: true })
          : NextResponse.json({ error: "Usuario no encontrado." }, { status: 404 });
      }

      // Asignar una contraseña NUEVA a un usuario. No se puede "ver" la actual
      // (está hasheada con bcrypt, es de una sola vía): esto la reemplaza por la
      // que teclea el equipo del panel, para poder entregársela al negocio.
      if (action === "setEmployeePass") {
        const id = (body.employeeId || "").toString();
        const pass = (body.pass || "").toString();
        if (!id) return NextResponse.json({ error: "Falta el usuario." }, { status: 400 });
        if (pass.length < 6)
          return NextResponse.json({ error: "La contraseña necesita 6+ caracteres." }, { status: 400 });
        const upd = await withPool(tenantUrl, (p) =>
          p
            .query(`UPDATE employees SET pass_hash = crypt($2, gen_salt('bf')) WHERE id = $1 RETURNING email`, [id, pass])
            .then((r) => r.rows[0])
        );
        if (upd) logActividad(who, "reset-clave-empleado", neg.id, { slug, email: upd.email });
        return upd
          ? NextResponse.json({ ok: true })
          : NextResponse.json({ error: "Usuario no encontrado." }, { status: 404 });
      }
    }

    if (action === "listDevices") {
      const slug = cleanSlug(body.slug);
      const rows = await withPool(centralUrl(), (p) =>
        p.query(
          `SELECT d.id, d.label, d.habilitado, d.last_seen AS "lastSeen", d.fecha_alta AS "altaAt",
                  d.modelo, d.plataforma, d.app_version AS "appVersion", d.ultimo_ip AS "ip",
                  left(d.token, 8) AS "tokenHint"
             FROM dispositivo d JOIN negocio n ON n.id = d.negocio_id
            WHERE n.slug = $1
            ORDER BY d.fecha_alta DESC`,
          [slug]
        ).then((r) => r.rows)
      );
      return NextResponse.json({ devices: rows });
    }

    // Control de uso del QR de cobro de la empresa: cuánto facturó cada negocio
    // y cuánto de eso entró por QR, en un rango de fechas (hora de Bolivia).
    // Recorre la base de CADA negocio; si una no responde, el reporte sigue y
    // esa fila sale marcada con el error (mejor un hueco visible que nada).
    if (action === "reporteQr") {
      const hoy = new Date().toISOString().slice(0, 10);
      const desde = /^\d{4}-\d{2}-\d{2}$/.test(body.desde ?? "") ? body.desde : hoy.slice(0, 8) + "01";
      const hasta = /^\d{4}-\d{2}-\d{2}$/.test(body.hasta ?? "") ? body.hasta : hoy;

      const negocios = await withPool(centralUrl(), (p) =>
        p.query<{ id: string; nombre: string; slug: string; db_name: string; estado: string }>(
          `SELECT id, nombre, slug, db_name, estado FROM negocio WHERE estado <> 'baja' ORDER BY nombre`
        ).then((r) => r.rows)
      );

      const filas = await Promise.all(
        negocios.map(async (n) => {
          try {
            const row = await withPool(urlForDb(n.db_name), (p) =>
              p.query(
                `SELECT count(*)::int                                            AS ventas,
                        COALESCE(sum(total), 0)::float8                          AS total,
                        count(*) FILTER (WHERE pay_method ILIKE '%qr%')::int     AS "qrVentas",
                        COALESCE(sum(total) FILTER (WHERE pay_method ILIKE '%qr%'), 0)::float8 AS "qrTotal"
                   FROM sales
                  WHERE kind = 'factura'
                    AND (created_at AT TIME ZONE 'America/La_Paz')::date BETWEEN $1::date AND $2::date`,
                [desde, hasta]
              ).then((r) => r.rows[0])
            );
            return { nombre: n.nombre, slug: n.slug, estado: n.estado, ...row };
          } catch (e) {
            return {
              nombre: n.nombre,
              slug: n.slug,
              estado: n.estado,
              ventas: 0,
              total: 0,
              qrVentas: 0,
              qrTotal: 0,
              error: (e as Error).message,
            };
          }
        })
      );

      return NextResponse.json({ desde, hasta, negocios: filas });
    }

    // Dashboard/Ventas del panel: agrega las ventas de TODOS los negocios (o de
    // uno si viene `slug`) en un rango, con las series para las gráficas. Mismo
    // patrón cross-tenant que reporteQr; una base caída se ignora. La comisión
    // generada = Σ recaudado_qr × comision_qr% de cada negocio.
    if (action === "dashboard") {
      const hoy = new Date().toISOString().slice(0, 10);
      const desde = /^\d{4}-\d{2}-\d{2}$/.test(body.desde ?? "") ? body.desde : hoy.slice(0, 8) + "01";
      const hasta = /^\d{4}-\d{2}-\d{2}$/.test(body.hasta ?? "") ? body.hasta : hoy;
      const soloSlug = body.slug ? cleanSlug(body.slug) : "";

      const negocios = await withPool(centralUrl(), (p) =>
        p.query<{ nombre: string; slug: string; db_name: string; comision_qr: number }>(
          `SELECT nombre, slug, db_name, comision_qr::float8 AS comision_qr
             FROM negocio
            WHERE estado <> 'baja' ${soloSlug ? "AND slug = $1" : ""}
            ORDER BY nombre`,
          soloSlug ? [soloSlug] : []
        ).then((r) => r.rows)
      );

      const porDia = new Map<string, { total: number; qr: number; efectivo: number; otros: number }>();
      const porComercio: { nombre: string; slug: string; total: number; qr: number }[] = [];
      let ventasTotales = 0, ventasQR = 0, efectivoTotal = 0, otrosTotal = 0, numVentas = 0, comisionGenerada = 0;

      await Promise.all(
        negocios.map(async (n) => {
          try {
            const rows = await withPool(urlForDb(n.db_name), (p) =>
              p.query<{ fecha: string; total: number; qr: number; efectivo: number; ventas: number }>(
                `SELECT (created_at AT TIME ZONE 'America/La_Paz')::date::text AS fecha,
                        COALESCE(sum(total),0)::float8 AS total,
                        COALESCE(sum(total) FILTER (WHERE pay_method ILIKE '%qr%'),0)::float8 AS qr,
                        COALESCE(sum(total) FILTER (WHERE pay_method ILIKE '%efec%'),0)::float8 AS efectivo,
                        count(*)::int AS ventas
                   FROM sales
                  WHERE kind = 'factura' AND NOT voided
                    AND (created_at AT TIME ZONE 'America/La_Paz')::date BETWEEN $1::date AND $2::date
                  GROUP BY 1`,
                [desde, hasta]
              ).then((r) => r.rows)
            );
            let negTotal = 0, negQr = 0;
            for (const r of rows) {
              const otros = Math.max(0, r.total - r.qr - r.efectivo);
              const cur = porDia.get(r.fecha) ?? { total: 0, qr: 0, efectivo: 0, otros: 0 };
              cur.total += r.total; cur.qr += r.qr; cur.efectivo += r.efectivo; cur.otros += otros;
              porDia.set(r.fecha, cur);
              ventasTotales += r.total; ventasQR += r.qr; efectivoTotal += r.efectivo; otrosTotal += otros;
              numVentas += r.ventas; negTotal += r.total; negQr += r.qr;
            }
            comisionGenerada += negQr * (n.comision_qr / 100);
            porComercio.push({ nombre: n.nombre, slug: n.slug, total: negTotal, qr: negQr });
          } catch {
            /* base caída: se ignora */
          }
        })
      );

      const ventasPorDia = [...porDia.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([fecha, v]) => ({ fecha, total: v.total, qr: v.qr, efectivo: v.efectivo, otros: v.otros }));

      return NextResponse.json({
        desde, hasta,
        soloSlug: soloSlug || null,
        ventasTotales, ventasQR, numVentas, comisionGenerada,
        ticketPromedio: numVentas > 0 ? ventasTotales / numVentas : 0,
        pagosPorMetodo: { qr: ventasQR, efectivo: efectivoTotal, otros: otrosTotal },
        ventasPorDia,
        porComercio: porComercio.sort((a, b) => b.total - a.total),
      });
    }

    // Estado de la plataforma (solo datos de la central, rápido): conteos por
    // estado, altas por mes y lo que "requiere atención" (suspendidos). Las
    // facturas vencidas entran cuando exista la facturación de suscripciones.
    if (action === "estadoPlataforma") {
      const [conteos, altas, suspendidos] = await withPool(centralUrl(), async (p) => {
        const c = await p.query<{ estado: string; n: number }>(
          `SELECT estado, count(*)::int AS n FROM negocio GROUP BY estado`
        );
        const a = await p.query<{ mes: string; n: number }>(
          `SELECT to_char(date_trunc('month', fecha_alta), 'YYYY-MM') AS mes, count(*)::int AS n
             FROM negocio
            WHERE fecha_alta >= (now() - interval '6 months')
            GROUP BY 1 ORDER BY 1`
        );
        const s = await p.query<{ nombre: string; slug: string }>(
          `SELECT nombre, slug FROM negocio WHERE estado = 'suspendido' ORDER BY nombre`
        );
        return [c.rows, a.rows, s.rows] as const;
      });
      const cnt = (e: string) => conteos.find((r) => r.estado === e)?.n ?? 0;
      return NextResponse.json({
        activos: cnt("activo"),
        prueba: cnt("prueba"),
        suspendidos: cnt("suspendido"),
        baja: cnt("baja"),
        total: conteos.reduce((s, r) => s + r.n, 0),
        altasPorMes: altas.map((r) => ({ mes: r.mes, n: r.n })),
        requiereAtencion: suspendidos.map((r) => ({ tipo: "suspendido", nombre: r.nombre, slug: r.slug })),
      });
    }

    // Todos los dispositivos de todos los negocios: la vista "Vinculación QR"
    // del panel muestra el parque completo sin entrar ficha por ficha.
    if (action === "listAllDevices") {
      const rows = await withPool(centralUrl(), (p) =>
        p.query(
          `SELECT d.id, d.label, d.habilitado, d.last_seen AS "lastSeen", d.fecha_alta AS "altaAt",
                  d.modelo, d.plataforma, d.app_version AS "appVersion", left(d.token, 8) AS "tokenHint",
                  n.nombre AS negocio, n.slug
             FROM dispositivo d JOIN negocio n ON n.id = d.negocio_id
            ORDER BY d.last_seen DESC NULLS LAST, d.fecha_alta DESC`
        ).then((r) => r.rows)
      );
      return NextResponse.json({ devices: rows });
    }

    if (action === "listActividad") {
      const slug = cleanSlug(body.slug || "");
      const rows = await withPool(centralUrl(), (p) =>
        (slug
          ? p.query(
              `SELECT a.usuario, a.accion, a.detalle, a.created_at AS "fecha"
                 FROM actividad a JOIN negocio n ON n.id = a.negocio_id
                WHERE n.slug = $1 ORDER BY a.created_at DESC LIMIT 30`,
              [slug]
            )
          : p.query(
              `SELECT a.usuario, a.accion, a.detalle, a.created_at AS "fecha",
                      (SELECT n.nombre FROM negocio n WHERE n.id = a.negocio_id) AS negocio
                 FROM actividad a ORDER BY a.created_at DESC LIMIT 50`
            )
        ).then((r) => r.rows)
      );
      return NextResponse.json({ actividad: rows });
    }

    if (action === "getBaas" || action === "setBaas") {
      const slug = cleanSlug(body.slug);
      const neg = await withPool(centralUrl(), (p) =>
        p.query(`SELECT id, db_name FROM negocio WHERE slug = $1`, [slug]).then((r) => r.rows[0])
      );
      if (!neg) return NextResponse.json({ error: "Negocio no encontrado." }, { status: 404 });
      const tenantUrl = urlForDb(neg.db_name);

      if (action === "getBaas") {
        const row = await withPool(tenantUrl, (p) =>
          p.query(`SELECT value FROM settings WHERE key = 'baas'`).then((r) => r.rows[0])
        );
        const v = (row?.value ?? {}) as { user?: string; pass?: string; businessCode?: string; idnode?: string };
        // La clave NUNCA vuelve al navegador: solo se dice si está cargada.
        return NextResponse.json({
          user: v.user ?? "",
          businessCode: v.businessCode ?? "",
          idnode: v.idnode ?? "",
          hasPass: !!v.pass,
        });
      }

      // setBaas — guardado parcial: una clave vacía conserva la anterior.
      const user = (body.user ?? "").toString().trim();
      const pass = (body.pass ?? "").toString();
      const businessCode = (body.businessCode ?? "").toString().trim();
      const idnode = (body.idnode ?? "").toString().trim();
      await withPool(tenantUrl, async (p) => {
        const prev = await p.query(`SELECT value FROM settings WHERE key = 'baas'`).then(
          (r) => (r.rows[0]?.value ?? {}) as Record<string, string>
        );
        const merged = {
          user: user || prev.user || "",
          pass: pass || prev.pass || "",
          businessCode: businessCode || prev.businessCode || "",
          idnode: idnode || prev.idnode || "",
        };
        await p.query(
          `INSERT INTO settings (key, value, updated_at) VALUES ('baas', $1::jsonb, now())
           ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
          [JSON.stringify(merged)]
        );
      });
      logActividad(who, "credenciales-qr", neg.id, { slug });
      return NextResponse.json({ ok: true });
    }

    if (action === "blockDevice") {
      const id = (body.deviceId || "").toString();
      const blocked = body.blocked === true;
      const row = await withPool(centralUrl(), (p) =>
        p.query(
          `UPDATE dispositivo SET habilitado = $2 WHERE id = $1 RETURNING id, negocio_id`,
          [id, !blocked]
        ).then((r) => r.rows[0])
      );
      if (!row) return NextResponse.json({ error: "Dispositivo no encontrado." }, { status: 404 });
      logActividad(who, blocked ? "bloquear-dispositivo" : "habilitar-dispositivo", row.negocio_id, { deviceId: id });
      return NextResponse.json({ ok: true });
    }

    if (action === "deleteDevice") {
      const id = (body.deviceId || "").toString();
      const row = await withPool(centralUrl(), (p) =>
        p.query(`DELETE FROM dispositivo WHERE id = $1 RETURNING id, negocio_id`, [id]).then((r) => r.rows[0])
      );
      if (!row) return NextResponse.json({ error: "Dispositivo no encontrado." }, { status: 404 });
      logActividad(who, "borrar-dispositivo", row.negocio_id, { deviceId: id });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Acción desconocida." }, { status: 400 });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message || "Error en la provisión." },
      { status: 500 }
    );
  }
}
