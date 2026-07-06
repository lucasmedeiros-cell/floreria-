// ════════════════════════════════════════════════════════════════════════
//  COMANDER · Datos de "FloresOnline" (CRM floreria) + sintetizador
//
//  Se pega en:  ~/comander/backend/floreria-data.js
//
//  - getResumen() / getRanking(): consultan la API del CRM floreria (caché 30 s).
//  - buildFloreriaTransactions(resumen): convierte los agregados en
//    transacciones COMANDER (INCOME = ventas por período, EXPENSE = gastos),
//    de modo que las tarjetas, el Inicio y los rankings se llenen con datos
//    reales y en vivo. Mismo mecanismo que telopresto-data.js.
// ════════════════════════════════════════════════════════════════════════
export const FLORERIA_BUSINESS_ID = 'floreria';

// En bilbo el CRM corre en pm2 puerto 3090, así que COMANDER lo alcanza por localhost.
const BASE = process.env.FLORERIA_BASE || 'http://127.0.0.1:3090';
const TOKEN = process.env.FLORERIA_TOKEN || '';
const CACHE_MS = 30_000;

const cache = new Map(); // path -> { at, data }

async function fetchExternal(path) {
  const hit = cache.get(path);
  const now = Date.now();
  if (hit && now - hit.at < CACHE_MS) return hit.data;
  if (!TOKEN) {
    const err = new Error('FLORERIA_TOKEN no configurado en el backend');
    err.status = 503;
    throw err;
  }
  const sep = path.includes('?') ? '&' : '?';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25_000);
  try {
    const res = await fetch(`${BASE}${path}${sep}token=${encodeURIComponent(TOKEN)}`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      const err = new Error(`La API de FloresOnline respondió ${res.status}`);
      err.status = 502;
      throw err;
    }
    const data = await res.json();
    cache.set(path, { at: now, data });
    return data;
  } catch (e) {
    if (e.name === 'AbortError') {
      const err = new Error('La API de FloresOnline no respondió a tiempo');
      err.status = 504;
      throw err;
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

export const getResumen = () => fetchExternal('/api/central/resumen');
export const getRanking = (periodo = 'mes') =>
  fetchExternal(`/api/central/ranking?periodo=${encodeURIComponent(periodo)}`);

/**
 * Convierte el resumen (agregados hoy/semana/mes/año de ingresos y gastos) en
 * transacciones cuyas sumas por rango reproducen exactamente los montos del
 * resumen: hoy ⊆ semana ⊆ mes ⊆ año. Se colocan en fechas "ancla" dentro de
 * cada ventana y por diferencia acumulada, para que al sumar por rango cuadre.
 */
export function buildFloreriaTransactions(resumen) {
  if (!resumen) return [];
  const day = 86400000;
  const now = new Date();
  const today = new Date(now); today.setHours(12, 0, 0, 0);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 12, 0, 0, 0);
  const yearStart = new Date(now.getFullYear(), 0, 1, 12, 0, 0, 0);

  // Fechas ancla: cada una cae dentro de su ventana padre pero fuera de la hija.
  const dHoy = today;
  const dSemana = new Date(today.getTime() - 3 * day);
  let dMes = new Date(today.getTime() - 12 * day);
  if (dMes < monthStart) dMes = new Date(monthStart.getTime());
  let dAnio = new Date(monthStart.getTime() - 15 * day);
  if (dAnio < yearStart) dAnio = new Date(yearStart.getTime());

  const r = resumen;
  const tx = (id, type, amount, category, description, date) => ({
    id, business_id: FLORERIA_BUSINESS_ID, type, amount,
    category, description, date: date.toISOString(),
  });

  const rows = [
    // Ventas (INCOME)
    tx('fl_inc_hoy',  'INCOME', round2(r.ingresos_hoy),                          'Ventas', 'Ventas (FloresOnline)', dHoy),
    tx('fl_inc_sem',  'INCOME', round2(diff(r.ingresos_semana, r.ingresos_hoy)), 'Ventas', 'Ventas (FloresOnline)', dSemana),
    tx('fl_inc_mes',  'INCOME', round2(diff(r.ingresos_mes, r.ingresos_semana)), 'Ventas', 'Ventas (FloresOnline)', dMes),
    tx('fl_inc_anio', 'INCOME', round2(diff(r.ingresos_anio, r.ingresos_mes)),   'Ventas', 'Ventas (FloresOnline)', dAnio),
    // Gastos (EXPENSE)
    tx('fl_exp_hoy',  'EXPENSE', round2(r.gastos_hoy),                        'Gastos', 'Gastos operativos (FloresOnline)', dHoy),
    tx('fl_exp_sem',  'EXPENSE', round2(diff(r.gastos_semana, r.gastos_hoy)), 'Gastos', 'Gastos operativos (FloresOnline)', dSemana),
    tx('fl_exp_mes',  'EXPENSE', round2(diff(r.gastos_mes, r.gastos_semana)), 'Gastos', 'Gastos operativos (FloresOnline)', dMes),
    tx('fl_exp_anio', 'EXPENSE', round2(diff(r.gastos_anio, r.gastos_mes)),   'Gastos', 'Gastos operativos (FloresOnline)', dAnio),
  ];
  // Conserva egresos aunque sean 0 (para que la tarjeta "Costos" exista);
  // descarta ingresos en 0 para no ensuciar el conteo.
  return rows.filter((t) => t.type === 'EXPENSE' || t.amount > 0);
}

const diff = (a, b) => Math.max(0, (Number(a) || 0) - (Number(b) || 0));
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
