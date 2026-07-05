"use client";

import dynamic from "next/dynamic";
import type { SparklinePoint } from "./RevenueChartImpl";

// recharts is heavy (~360KB). Load it lazily on the client only, so it stays
// out of the server-rendered page's initial JS bundle.
const Chart = dynamic(() => import("./RevenueChartImpl"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full animate-pulse rounded-xl bg-muted/40" />
  ),
});

export default function RevenueChart({ data }: { data: SparklinePoint[] }) {
  const hasRevenue = data.some((d) => d.revenue > 0);

  if (!hasRevenue) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 text-center">
        <span className="material-symbols-outlined text-[32px] text-muted-foreground/40">
          bar_chart
        </span>
        <p className="text-sm font-medium text-muted-foreground">
          No revenue in the last 7 days
        </p>
        <p className="text-xs text-muted-foreground/60">
          Collected payments will chart here
        </p>
      </div>
    );
  }

  return <Chart data={data} />;
}
