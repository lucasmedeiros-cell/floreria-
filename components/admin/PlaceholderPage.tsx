"use client";

import React from "react";

export function PlaceholderPage({
  icon,
  title,
  message,
}: {
  icon: React.ReactNode;
  title: string;
  message: string;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="px-7 pt-6">
        <h1 className="font-serif text-[30px] font-semibold text-ink">{title}</h1>
      </div>
      <div className="flex flex-1 items-center justify-center px-6">
        <div className="max-w-[360px] text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-line bg-surface text-rose shadow-soft">
            {icon}
          </div>
          <h2 className="mt-4.5 mt-5 font-serif text-[24px] font-semibold text-ink">
            Próximamente
          </h2>
          <p className="mt-2 text-[13.5px] leading-relaxed text-ink2">{message}</p>
        </div>
      </div>
    </div>
  );
}
