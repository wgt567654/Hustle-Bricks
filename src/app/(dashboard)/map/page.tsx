"use client";

import dynamic from "next/dynamic";

const MapContent = dynamic(() => import("./MapContent"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center min-h-[60vh]">
      <p className="text-sm text-muted-foreground">Loading map…</p>
    </div>
  ),
});

export default function MapPage() {
  return <MapContent />;
}
