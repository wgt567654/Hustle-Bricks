"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { Card } from "@/components/ui/card";
import { CHART_COLORS } from "@/lib/chart-colors";

export type MonthDataPoint = {
  month: string;   // "Jan", "Feb", etc.
  revenue: number;
};

type Props = {
  data: MonthDataPoint[];
};

function fmtCurrency(v: number) {
  if (v >= 1000) return `$${(v / 1000).toFixed(1)}k`;
  return `$${v}`;
}

export function RevenueTrendChart({ data }: Props) {
  const hasData = data.some((d) => d.revenue > 0);

  return (
    <Card className="rounded-2xl overflow-hidden">
      <div className="p-4 flex flex-col gap-0.5 border-b">
        <div className="flex items-center gap-2">
          <span
            className="material-symbols-outlined text-[20px]"
            style={{ color: CHART_COLORS.blue, fontVariationSettings: "'FILL' 1" }}
          >
            show_chart
          </span>
          <h3 className="text-sm font-extrabold">Revenue Trend</h3>
        </div>
        <p className="text-xs text-muted-foreground">Last 12 months of paid job revenue</p>
      </div>

      <div className="p-4">
        {hasData ? (
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -16 }}>
                {/* Gradient fill under the line */}
                <defs>
                  <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CHART_COLORS.blue} stopOpacity={0.18} />
                    <stop offset="95%" stopColor={CHART_COLORS.blue} stopOpacity={0} />
                  </linearGradient>
                </defs>

                <CartesianGrid
                  vertical={false}
                  stroke="var(--border)"
                  strokeOpacity={0.6}
                />

                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                />

                <YAxis
                  tickFormatter={fmtCurrency}
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                  width={48}
                />

                <Tooltip
                  formatter={(value) => {
                    const n = typeof value === "number" ? value : 0;
                    return [n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }), "Revenue"];
                  }}
                  contentStyle={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: 12,
                    fontSize: 12,
                    color: "var(--foreground)",
                    boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
                  }}
                  cursor={{ stroke: "var(--border)", strokeWidth: 1 }}
                />

                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke={CHART_COLORS.blue}
                  strokeWidth={2}
                  fill="url(#revenueGradient)"
                  dot={false}
                  activeDot={{ r: 5, fill: CHART_COLORS.blue, strokeWidth: 0 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-48 flex flex-col items-center justify-center gap-2">
            <span
              className="material-symbols-outlined text-[36px] text-muted-foreground/40"
              style={{ fontVariationSettings: "'FILL' 0" }}
            >
              show_chart
            </span>
            <p className="text-sm text-muted-foreground">No revenue data yet</p>
            <p className="text-xs text-muted-foreground">Complete and collect payment on jobs to see trends</p>
          </div>
        )}
      </div>
    </Card>
  );
}
