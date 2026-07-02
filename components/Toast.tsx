"use client";

import { useToast } from "@/context/StoreProvider";

export function ToastHost() {
  const { toast } = useToast();
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[100] flex justify-center px-4">
      <div
        className={`transition-all duration-300 ${
          toast ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
        }`}
      >
        {toast && (
          <div className="max-w-[280px] rounded-full bg-dark px-5 py-3 text-center text-[13px] font-medium text-white shadow-lg">
            {toast}
          </div>
        )}
      </div>
    </div>
  );
}
