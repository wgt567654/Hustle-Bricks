"use client";

import { useEffect, useState } from "react";
import { subscribeToToasts, type ToastItem } from "@/lib/toast";

const DURATION_MS = 4000;

const KIND_STYLES: Record<ToastItem["kind"], { icon: string; iconClass: string }> = {
  success: { icon: "check_circle", iconClass: "text-[var(--color-status-completed)]" },
  error: { icon: "error", iconClass: "text-red-500" },
  info: { icon: "info", iconClass: "text-primary" },
};

export default function Toaster() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    return subscribeToToasts((t) => {
      setToasts((prev) => [...prev.slice(-2), t]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((x) => x.id !== t.id));
      }, DURATION_MS);
    });
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 z-[100] flex flex-col items-center gap-2 px-4"
      style={{ bottom: "calc(1.25rem + env(safe-area-inset-bottom, 0px))" }}
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className="pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-2xl border border-border bg-card/95 px-4 py-3 shadow-card backdrop-blur"
        >
          <span
            className={`material-symbols-outlined text-[20px] shrink-0 ${KIND_STYLES[t.kind].iconClass}`}
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            {KIND_STYLES[t.kind].icon}
          </span>
          <p className="text-sm font-medium text-foreground">{t.message}</p>
        </div>
      ))}
    </div>
  );
}
