import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";
import { readFile } from "fs/promises";
import path from "path";
import { randomBytes } from "crypto";
import QRCode from "qrcode";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Clave simple para proteger la provisión (crear negocios / dispositivos).
// SIN la env var el endpoint queda apagado: nunca una clave por defecto en el
// código, porque este panel crea bases y admins de todos los negocios.
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
function authorized(req: NextRequest, body?: { key?: string }): boolean {
  if (!KEY) return false; // sin PROVISION_KEY configurada, la provisión está apagada
  const k = req.headers.get("x-provision-key") || body?.key || "";
  return k === KEY;
}
function serverBase(req: NextRequest): string {
  const proto = req.headers.get("x-forwarded-proto") || "https";
  const host = req.headers.get("host") || "";
  return `${proto}://${host}`;
}
const cleanSlug = (s: string) =>
  (s || "").toString().trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");

// GET /api/provision  → lista los negocios easy pos (para el selector).
export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  try {
    const rows = await withPool(centralUrl(), (p) =>
      p.query(
        `SELECT n.id, n.nombre, n.slug, n.db_name, n.estado,
                (SELECT count(*) FROM dispositivo d WHERE d.negocio_id = n.id)::int AS dispositivos
           FROM negocio n WHERE n.producto = 'easypos'
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
  if (!authorized(req, body)) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
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
            `INSERT INTO negocio (nombre, slug, db_name, producto, estado, rubro)
             VALUES ($1,$2,$3,'easypos','activo',$4)
             RETURNING id, nombre, slug, db_name, estado`,
            [nombre, slug, dbName, rubro]
          ).then((r) => r.rows[0])
        );
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

    if (action === "createDevice") {
      const slug = cleanSlug(body.slug);
      const label = (body.label || "Dispositivo").toString().trim();
      if (!slug) return NextResponse.json({ error: "Elegí un negocio." }, { status: 400 });

      const neg = await withPool(centralUrl(), (p) =>
        p.query(`SELECT id, nombre FROM negocio WHERE slug = $1 AND producto = 'easypos'`, [slug]).then((r) => r.rows[0])
      );
      if (!neg) return NextResponse.json({ error: "Negocio no encontrado." }, { status: 404 });

      const token = randomBytes(24).toString("hex");
      await withPool(centralUrl(), (p) =>
        p.query(
          `INSERT INTO dispositivo (id, negocio_id, token, habilitado, fecha_alta, label)
           VALUES (gen_random_uuid()::text, $1, $2, true, now(), $3)`,
          [neg.id, token, label]
        )
      );

      const server = serverBase(req);
      const qrContent = JSON.stringify({ token, server });
      const qrImage = await QRCode.toDataURL(qrContent, { margin: 1, width: 320 });
      return NextResponse.json({ token, server, negocio: neg.nombre, label, qrImage });
    }

    if (action === "listEmployees" || action === "createEmployee" || action === "setRole") {
      const slug = cleanSlug(body.slug);
      const neg = await withPool(centralUrl(), (p) =>
        p.query(`SELECT db_name FROM negocio WHERE slug = $1 AND producto = 'easypos'`, [slug]).then((r) => r.rows[0])
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
        return NextResponse.json({ ok: true });
      }

      if (action === "setRole") {
        const id = (body.employeeId || "").toString();
        const role = ROLES.includes(body.role) ? body.role : null;
        if (!id || !role) return NextResponse.json({ error: "Falta usuario o rol válido." }, { status: 400 });
        const upd = await withPool(tenantUrl, (p) =>
          p.query(`UPDATE employees SET role = $2 WHERE id = $1 RETURNING id`, [id, role]).then((r) => r.rowCount)
        );
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
            WHERE n.slug = $1 AND n.producto = 'easypos'
            ORDER BY d.fecha_alta DESC`,
          [slug]
        ).then((r) => r.rows)
      );
      return NextResponse.json({ devices: rows });
    }

    if (action === "getBaas" || action === "setBaas") {
      const slug = cleanSlug(body.slug);
      const neg = await withPool(centralUrl(), (p) =>
        p.query(`SELECT db_name FROM negocio WHERE slug = $1 AND producto = 'easypos'`, [slug]).then((r) => r.rows[0])
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
      return NextResponse.json({ ok: true });
    }

    // La tabla `dispositivo` de la central es COMPARTIDA con otros productos
    // (Case): estas acciones solo pueden tocar dispositivos de negocios easypos.
    const soloEasypos = `EXISTS (SELECT 1 FROM negocio n
                                  WHERE n.id = dispositivo.negocio_id AND n.producto = 'easypos')`;

    if (action === "blockDevice") {
      const id = (body.deviceId || "").toString();
      const blocked = body.blocked === true;
      const upd = await withPool(centralUrl(), (p) =>
        p.query(
          `UPDATE dispositivo SET habilitado = $2 WHERE id = $1 AND ${soloEasypos} RETURNING id`,
          [id, !blocked]
        ).then((r) => r.rowCount)
      );
      return upd ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Dispositivo no encontrado." }, { status: 404 });
    }

    if (action === "deleteDevice") {
      const id = (body.deviceId || "").toString();
      const del = await withPool(centralUrl(), (p) =>
        p.query(`DELETE FROM dispositivo WHERE id = $1 AND ${soloEasypos} RETURNING id`, [id]).then((r) => r.rowCount)
      );
      return del ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Dispositivo no encontrado." }, { status: 404 });
    }

    return NextResponse.json({ error: "Acción desconocida." }, { status: 400 });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message || "Error en la provisión." },
      { status: 500 }
    );
  }
}
