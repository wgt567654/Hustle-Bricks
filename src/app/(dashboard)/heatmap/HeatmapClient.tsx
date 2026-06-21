"use client";

import dynamic from "next/dynamic";

type ZoneData = {
  zip: string;
  jobCount: number;
  completedCount: number;
  totalRevenue: number;
  avgRevenue: number;
  lastJobDate: string | null;
  daysSinceLastJob: number | null;
  canvassTotal: number;
  canvassBooked: number;
  conversionRate: number | null;
};

const HeatmapContent = dynamic(() => import("./HeatmapContent"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center min-h-[60vh]">
      <p className="text-sm text-muted-foreground">Loading map…</p>
    </div>
  ),
});

export default function HeatmapClient({ initialZones }: { initialZones: ZoneData[] }) {
  return <HeatmapContent initialZones={initialZones} />;
}
