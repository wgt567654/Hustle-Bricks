"use client";

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
  // Employees capture lead info (name, phone, notes) before booking.
  // The lead saves to the owner's leads list. No quote creation access.
  return <CanvassingMap onBookNow={() => {}} captureLeadOnBook />;
}
