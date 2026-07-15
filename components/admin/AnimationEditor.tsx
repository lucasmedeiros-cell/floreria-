"use client";

import { apiUrl } from "@/lib/apiBase";
import { useEffect, useState } from "react";
import { Loader2, Play, Save, Sparkles } from "lucide-react";
import { defaultAnimConfig, type AnimConfig } from "@/lib/anim";
import { useToast } from "@/context/StoreProvider";
import { PrimaryButton } from "@/components/ui";

/** Editor de animaciones de inicio (web pública y panel admin). */
export function AnimationEditor() {
  const { showToast } = useToast();
  const [cfg, setCfg] = useState<AnimConfig>(defaultAnimConfig);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch(apiUrl("/api/anim"))
      .then((r) => r.json())
      .then((data: AnimConfig) => {
        if (alive) setCfg({ ...defaultAnimConfig, ...data });
      })
      .catch(() => showToast("No se pudo cargar la configuración"))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [showToast]);

  const set = (key: keyof AnimConfig, value: boolean) =>
    setCfg((c) => ({ ...c, [key]: value }));

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(apiUrl("/api/anim"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cfg),
      });
      if (!res.ok) throw new Error();
      const saved = (await res.json()) as AnimConfig;
      setCfg({ ...defaultAnimConfig, ...saved });
      showToast("Animaciones guardadas");
    } catch {
      showToast("No se pudo guardar. Revisa tu sesión.");
    } finally {
      setSaving(false);
    }
  };

  const replay = (which: "web" | "admin") => {
    if (which === "admin") {
      showToast("Recarga el panel (F5) para ver la animación");
    } else {
      window.open("/", "_blank");
    }
  };

  return (
    <div className="rounded-[18px] border border-line bg-surface p-5 shadow-soft">
      <h3 className="flex items-center gap-2 text-[15px] font-semibold text-ink">
        <span className="text-pink">
          <Sparkles size={18} />
        </span>
        Animaciones de inicio
      </h3>
      <p className="mt-2 text-[12.5px] text-ink2">
        Controla las animaciones que aparecen al abrir la web y el panel. Se
        muestran una vez por sesión de navegación.
      </p>

      {loading ? (
        <div className="mt-4 flex items-center gap-2 text-[13px] text-ink2">
          <Loader2 size={16} className="animate-spin" /> Cargando…
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-3">
          <ToggleRow
            title="Animación de la web (intro con el logo del rubro)"
            desc="Se muestra al abrir la página pública (inicio)."
            checked={cfg.web}
            onChange={() => set("web", !cfg.web)}
            onPreview={() => replay("web")}
          />
          <ToggleRow
            title="Splash del panel (logo de easy pos)"
            desc="Se muestra al entrar al CRM, con el negocio y su rubro."
            checked={cfg.admin}
            onChange={() => set("admin", !cfg.admin)}
            onPreview={() => replay("admin")}
          />

          <div className="mt-2">
            <PrimaryButton
              label={saving ? "Guardando…" : "Guardar animaciones"}
              icon={
                saving ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <Save size={18} />
                )
              }
              onClick={save}
              disabled={saving}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function ToggleRow({
  title,
  desc,
  checked,
  onChange,
  onPreview,
}: {
  title: string;
  desc: string;
  checked: boolean;
  onChange: () => void;
  onPreview: () => void;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-line bg-surface2 p-3.5">
      <div className="flex-1">
        <p className="text-[13.5px] font-semibold text-ink">{title}</p>
        <p className="mt-0.5 text-[12px] text-ink2">{desc}</p>
        <button
          onClick={onPreview}
          className="mt-2 inline-flex items-center gap-1.5 text-[12px] font-semibold text-pink"
        >
          <Play size={13} /> Previsualizar
        </button>
      </div>
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="mt-1 h-5 w-9 accent-pink"
        aria-label={title}
      />
    </div>
  );
}
