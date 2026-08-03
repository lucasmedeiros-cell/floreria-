"use client";

import { apiUrl } from "./apiBase";
import { useEffect, useState } from "react";
import type { Client } from "./adminData";

/**
 * Libreta de clientes real (tabla `clients`), no una lista de ejemplo.
 * Una instalación nueva arranca sin clientes: se cargan al crear pedidos o al
 * vincular el negocio.
 */
export function useClients(): { clients: Client[]; loading: boolean; reload: () => void } {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetch(apiUrl("/api/clients"), { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: Client[]) => {
        if (alive) setClients(Array.isArray(rows) ? rows : []);
      })
      .catch(() => {
        /* sin sesión o sin BD: la lista queda vacía */
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [tick]);

  return { clients, loading, reload: () => setTick((t) => t + 1) };
}

/** Datos con los que se da de alta un cliente desde el CRM. */
export interface ClientInput {
  name: string;
  phone?: string;
  address?: string;
  reference?: string;
  notes?: string;
}

/** Alta de un cliente en la libreta. El nombre es lo único obligatorio. */
export async function apiCreateClient(input: ClientInput): Promise<void> {
  const r = await fetch(apiUrl("/api/clients"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!r.ok) {
    const body = await r.json().catch(() => null);
    throw new Error(body?.error ?? "No se pudo guardar el cliente.");
  }
}
