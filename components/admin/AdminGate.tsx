"use client";

import { useAuth } from "@/context/StoreProvider";
import { AdminLogin } from "./AdminLogin";
import { AdminShell } from "./AdminShell";

export function AdminGate({ adminIntro = true }: { adminIntro?: boolean }) {
  const auth = useAuth();
  return auth.loggedIn ? <AdminShell adminIntro={adminIntro} /> : <AdminLogin />;
}
