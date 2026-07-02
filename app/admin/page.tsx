import { AdminGate } from "@/components/admin/AdminGate";
import { readAnimConfig } from "@/lib/animStore";

export const dynamic = "force-dynamic";

export default async function AdminRoute() {
  const anim = await readAnimConfig();
  return <AdminGate adminIntro={anim.admin} />;
}
