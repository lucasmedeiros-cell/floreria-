import { clearSessionCookie } from "@/lib/auth";
import { handler, ok } from "@/lib/api";

export const runtime = "nodejs";

export const POST = handler(async () => {
  clearSessionCookie("customer");
  return ok({ ok: true });
});
