import { handler, ok } from "@/lib/api";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";

export const GET = handler(async () => {
  const s = getSession("employee");
  if (!s) return ok({ user: null });
  return ok({ user: { id: s.sub, name: s.name, email: s.email, role: s.role } });
});
