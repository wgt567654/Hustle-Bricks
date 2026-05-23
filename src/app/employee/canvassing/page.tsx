"use client";

import Link from "next/link";
import dynamic from "next/dynamic";

const CanvassingMap = dynamic(
  () => import("@/components/canvassing/CanvassingMap"),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-sm text-muted-foreground">Loading map…</p>
      </div>
    ),
  }
);

export default function EmployeeCanvassingPage() {
  return (
    <div className="relative w-full h-full">
      <CanvassingMap onBookNow={() => {}} captureLeadOnBook />
      <Link
        href="/employee/leads/new"
        className="fixed bottom-6 right-4 z-[2001] flex size-14 items-center justify-center rounded-full bg-primary text-white shadow-lg active:scale-90 transition-all"
        style={{ boxShadow: "0 4px 16px color-mix(in srgb, var(--color-primary) 40%, transparent)" }}
      >
        <span className="material-symbols-outlined text-[24px]" style={{ fontVariationSettings: "'FILL' 1" }}>add</span>
      </Link>
    </div>
  );
}
