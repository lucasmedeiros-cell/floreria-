"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LayoutGrid, Loader2, Save } from "lucide-react";
import { apiUrl } from "@/lib/apiBase";
import { MODULE_LIST, type Modules } from "@/lib/modules";
import { useBusiness, useToast } from "@/context/StoreProvider";
import { PrimaryButton } from "@/components/ui";

/**
 * Qué secciones usa este negocio.
 *
 * No todos los comercios necesitan lo mismo: una tienda de repuestos vende sobre
 * el mostrador y no reparte nada, así que apaga Entregas y la sección desaparece
 * del menú. Los datos NO se borran: prenderlo de nuevo devuelve todo tal cual.
 *
 * Inicio, Pedidos y Configuración no se pueden apagar: son el mínimo con el que
 * el CRM sigue siendo usable (y sin Configuración no habría cómo volver a
 * prender lo apagado).
 */
export function ModulosEditor() {
  const router = useRouter();
  const { showToast } = useToast();
  const current = useBusiness();

  const [modules, setModules] = useState<Modules>(() => ({ ...current.modules }));
  const [saving, setSaving] = useState(false);

  const prendidos = MODULE_LIST.filter((m) => modules[m.id]).length;

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(apiUrl("/api/business"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Guardado parcial: solo los módulos. El resto del negocio queda igual.
        body: JSON.stringify({ modules }),
      });
      if (!res.ok) throw new Error("save failed");
      showToast("Módulos actualizados");
      // El menú lateral se arma con esto, así que hay que releer el negocio.
      router.refresh();
    } catch {
      showToast("No se pudieron guardar los módulos");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-[18px] border border-line bg-surface p-5 shadow-soft">
      <h3 className="flex items-center gap-2 text-[15px] font-semibold text-ink">
        <span className="text-pink">
          <LayoutGrid size={18} />
        </span>
        Módulos del CRM
      </h3>
      <p className="mt-1 text-[12.5px] text-ink2">
        Apagá lo que este negocio no usa y desaparece del menú. Nada se borra:
        volver a prenderlo trae los datos intactos. Inicio, Pedidos y
        Configuración siempre están.
      </p>

      <div className="mt-4 flex flex-col gap-2">
        {MODULE_LIST.map((m) => {
          const on = modules[m.id];
          return (
            <label
              key={m.id}
              className={`flex cursor-pointer items-start gap-3 rounded-[13px] border p-3.5 transition-colors ${
                on ? "border-pink/35 bg-pinkSoft/40" : "border-line bg-bg"
              }`}
            >
              <input
                type="checkbox"
                checked={on}
                onChange={() => setModules({ ...modules, [m.id]: !on })}
                className="mt-0.5 h-5 w-9 shrink-0 accent-pink"
              />
              <span className="min-w-0">
                <span
                  className={`block text-[13.5px] font-semibold ${
                    on ? "text-ink" : "text-ink2"
                  }`}
                >
                  {m.label}
                </span>
                <span className="mt-0.5 block text-[12px] leading-relaxed text-ink2">
                  {m.hint}
                </span>
              </span>
            </label>
          );
        })}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <span className="text-[12px] text-faint">
          {prendidos} de {MODULE_LIST.length} módulos activos
        </span>
        <PrimaryButton
          label={saving ? "Guardando…" : "Guardar módulos"}
          icon={saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
          onClick={save}
        />
      </div>
    </div>
  );
}
