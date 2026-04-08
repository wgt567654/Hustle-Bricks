"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  ResponsiveContainer,
} from "recharts";
import { Card } from "@/components/ui/card";
import { CHART_PALETTE } from "@/lib/chart-colors";

export type ProductDataPoint = {
  category: string;
  revenue: number;
};

type Props = { data: ProductDataPoint[] };

function fmtCurrency(v: number) {
  if (v >= 1000) return `$${(v / 1000).toFixed(1)}k`;
  return `$${v}`;
}

export function ProductBreakdownChart({ data }: Props) {
  const total = data.reduce((s, d) => s + d.revenue, 0);

  return (
    <Card className="rounded-2xl overflow-hidden">
      <div className="p-4 flex items-center justify-between border-b">
        <div className="flex items-center gap-2">
          <span
            className="material-symbols-outlined text-[20px]"
            style={{ color: "#ea580c", fontVariationSettings: "'FILL' 1" }}
          >
            category
          </span>
          <h3 className="text-sm font-extrabold">Revenue by Service</h3>
        </div>
        <span className="text-xs text-muted-foreground italic">Sample data</span>
      </div>

      <div className="p-4">
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              layout="vertical"
              data={data}
              margin={{ top: 0, right: 48, bottom: 0, left: 0 }}
            >
              <XAxis
                type="number"
                tickFormatter={fmtCurrency}
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                type="category"
                dataKey="category"
                width={110}
                tick={{ fontSize: 11, fill: "var(--foreground)" }}
                axisLine={false}
                tickLine={false}
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
                cursor={{ fill: "var(--muted)/0.1" }}
              />
              <Bar dataKey="revenue" radius={[0, 6, 6, 0]}>
                {data.map((_, index) => (
                  <Cell key={index} fill={CHART_PALETTE[index % CHART_PALETTE.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Legend with percentage breakdown */}
        <div className="mt-3 flex flex-col gap-1.5">
          {data.map((d, i) => (
            <div key={d.category} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <div
                  className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                  style={{ background: CHART_PALETTE[i % CHART_PALETTE.length] }}
                />
                <span className="text-muted-foreground">{d.category}</span>
              </div>
              <span className="font-semibold">
                {total > 0 ? `${((d.revenue / total) * 100).toFixed(0)}%` : "—"}
              </span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
