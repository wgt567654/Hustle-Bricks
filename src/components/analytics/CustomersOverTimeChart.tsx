"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import { Card } from "@/components/ui/card";
import { CHART_COLORS } from "@/lib/chart-colors";

export type CustomerDataPoint = {
  label: string;
  firstTime: number;
  recurring: number;
};

type Props = {
  series: CustomerDataPoint[];
};

export function CustomersOverTimeChart({ series }: Props) {
  const hasData = series.some((d) => d.firstTime > 0 || d.recurring > 0);

  return (
    <Card className="rounded-2xl p-5">
      <p className="text-sm font-bold tracking-tight mb-4">Customers over time</p>

      {hasData ? (
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series} margin={{ top: 4, right: 4, bottom: 0, left: -8 }}>
              <defs>
                <linearGradient id="custRecurringGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={CHART_COLORS.violet} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={CHART_COLORS.violet} stopOpacity={0.05} />
                </linearGradient>
                <linearGradient id="custFirstTimeGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={CHART_COLORS.sky} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={CHART_COLORS.sky} stopOpacity={0.05} />
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

              <YAxis
                tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                axisLine={false}
                tickLine={false}
                width={36}
                allowDecimals={false}
              />

              <Tooltip
                formatter={(value, name) => [
                  value,
                  name === "firstTime" ? "First time" : "Recurring",
                ]}
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

              {/* recurring renders first (behind) since it's typically the larger area */}
              <Area
                type="monotone"
                dataKey="recurring"
                stroke={CHART_COLORS.violet}
                strokeWidth={2}
                fill="url(#custRecurringGrad)"
                dot={false}
                activeDot={{ r: 4, fill: CHART_COLORS.violet, strokeWidth: 0 }}
              />

              {/* firstTime renders on top */}
              <Area
                type="monotone"
                dataKey="firstTime"
                stroke={CHART_COLORS.sky}
                strokeWidth={2}
                fill="url(#custFirstTimeGrad)"
                dot={false}
                activeDot={{ r: 4, fill: CHART_COLORS.sky, strokeWidth: 0 }}
              />

              <Legend
                iconType="plainline"
                iconSize={16}
                formatter={(value) => (
                  <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
                    {value === "firstTime" ? "First time" : "Recurring"}
                  </span>
                )}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="h-52 flex items-center justify-center">
          <p className="text-sm text-muted-foreground">No customer data in this period</p>
        </div>
      )}
    </Card>
  );
}
