import { queryOne } from "@/lib/db";
import { handler, ok } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handler(async () => {
  const row = await queryOne<{ now: string; db: string }>(
    `SELECT now() AS now, current_database() AS db`
  );
  return ok({ ok: true, db: row?.db, time: row?.now });
});
