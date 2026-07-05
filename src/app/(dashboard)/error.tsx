"use client";

import { useEffect } from "react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[dashboard]", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center gap-4 px-4 py-24 text-center max-w-xl mx-auto">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-red-50 dark:bg-red-950/30 text-red-500">
        <span className="material-symbols-outlined text-[32px]">error</span>
      </div>
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-extrabold tracking-tight text-foreground">
          Something went wrong
        </h2>
        <p className="text-sm text-muted-foreground">
          We couldn&apos;t load this page. Your data is safe — try again in a moment.
        </p>
      </div>
      <button
        onClick={reset}
        className="rounded-full bg-primary px-6 py-2.5 text-sm font-bold text-white shadow-md shadow-primary/25 hover:bg-primary/90 active:scale-95 transition-all"
      >
        Try again
      </button>
    </div>
  );
}
