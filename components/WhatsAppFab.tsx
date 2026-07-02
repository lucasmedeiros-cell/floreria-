"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { WhatsAppIcon } from "./WhatsAppIcon";

export function WhatsAppFab({ onClick }: { onClick: () => void }) {
  const [showBubble, setShowBubble] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShowBubble(true), 1400);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="fixed bottom-6 right-5 z-50 flex flex-col items-end">
      <div
        className={`mb-3 transition-opacity duration-300 ${
          showBubble ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <div className="flex max-w-[236px] items-start gap-1 rounded-2xl border border-line bg-white px-3.5 py-3 shadow-cardHover">
          <div>
            <p className="text-[13.5px] font-bold text-ink">¿Tienes una consulta?</p>
            <p className="text-[12px] text-ink2">Escríbenos por WhatsApp 🌷</p>
          </div>
          <button onClick={() => setShowBubble(false)} className="p-0.5 text-faint">
            <X size={16} />
          </button>
        </div>
      </div>
      <button
        onClick={onClick}
        className="flex h-[62px] w-[62px] items-center justify-center rounded-full border-[1.5px] border-white/25 text-white"
        style={{
          background: "linear-gradient(180deg,#2BE36E,#1FAE54)",
          boxShadow: "0 9px 18px rgba(31,174,84,0.5), 0 2px 5px rgba(31,174,84,0.3)",
        }}
        aria-label="WhatsApp"
      >
        <WhatsAppIcon size={32} />
      </button>
    </div>
  );
}
