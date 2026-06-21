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
  return <Chart data={data} />;
}
