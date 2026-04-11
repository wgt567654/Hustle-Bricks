"use client";

import {
  AreaChart,
  Area,
  XAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { Card } from "@/components/ui/card";
import { CHART_COLORS } from "@/lib/chart-colors";

export type RevenueDataPoint = {
  label: string;
  revenue: number;
};

type Props = {
  totalRevenue: number;
  growthPct: number;
  series: RevenueDataPoint[];
  period: string;
};

function fmtCurrency(v: number) {
  return v.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export function RevenueHeroCard({ totalRevenue, growthPct, series, period }: Props) {
  const hasData = series.some((d) => d.revenue > 0);
  const growthPositive = growthPct >= 0;

  return (
    <Card className="rounded-2xl overflow-hidden">
      <div className="p-5 pb-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">{period} · Revenue</p>
        <div className="flex items-end gap-3">
          <span className="text-4xl font-extrabold tracking-tight">{fmtCurrency(totalRevenue)}</span>
          {growthPct !== 0 && (
            <span
              className={`mb-1 text-xs font-bold px-2 py-0.5 rounded-full ${
                growthPositive
                  ? "bg-green-500/10 text-green-600"
                  : "bg-red-500/10 text-red-600"
              }`}
            >
              {growthPositive ? "+" : ""}{growthPct.toFixed(1)}% vs prior
            </span>
          )}
        </div>
      </div>

      <div className="h-32">
        {hasData ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="analyticsRevenueGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={CHART_COLORS.blue} stopOpacity={0.15} />
                  <stop offset="95%" stopColor={CHART_COLORS.blue} stopOpacity={0}    />
                </linearGradient>
              </defs>

              <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.4} />

              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
              />

              <Tooltip
                formatter={(value) => {
                  const n = typeof value === "number" ? value : 0;
                  return [fmtCurrency(n), "Revenue"];
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
                fill="url(#analyticsRevenueGradient)"
                dot={false}
                activeDot={{ r: 4, fill: CHART_COLORS.blue, strokeWidth: 0 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center">
            <p className="text-sm text-muted-foreground">No revenue in this period</p>
          </div>
        )}
      </div>
    </Card>
  );
}
