"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  LabelList,
} from "recharts";
import { Card } from "@/components/ui/card";
import { CHART_COLORS } from "@/lib/chart-colors";

export type ClientData = {
  name: string;
  revenue: number;
};

type Props = {
  clients: ClientData[];
};

function fmtShort(v: number) {
  if (v >= 1000) return `$${(v / 1000).toFixed(1)}k`;
  return `$${v}`;
}

function fmtFull(v: number) {
  return v.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export function TopClientsChart({ clients }: Props) {
  return (
    <Card className="rounded-2xl overflow-hidden">
      <div className="p-4 border-b border-border/50">
        <p className="font-bold text-sm text-foreground">Top Clients</p>
        <p className="text-xs text-muted-foreground mt-0.5">By paid revenue</p>
      </div>

      <div className="p-4">
        {clients.length === 0 ? (
          <div className="h-40 flex flex-col items-center justify-center gap-2">
            <span
              className="material-symbols-outlined text-[36px] text-muted-foreground/30"
              style={{ fontVariationSettings: "'FILL' 0" }}
            >
              group
            </span>
            <p className="text-sm text-muted-foreground">No paid jobs yet</p>
          </div>
        ) : (
          <div style={{ height: clients.length * 44 + 8 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={clients}
                layout="vertical"
                margin={{ top: 0, right: 60, bottom: 0, left: 0 }}
                barSize={18}
              >
                <CartesianGrid horizontal={false} stroke="var(--border)" strokeOpacity={0.4} />

                <YAxis
                  type="category"
                  dataKey="name"
                  width={100}
                  tick={{ fontSize: 11, fill: "var(--foreground)" }}
                  axisLine={false}
                  tickLine={false}
                />

                <XAxis type="number" hide />

                <Tooltip
                  formatter={(value) => {
                    const n = typeof value === "number" ? value : 0;
                    return [fmtFull(n), "Revenue"];
                  }}
                  contentStyle={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: 12,
                    fontSize: 12,
                    color: "var(--foreground)",
                    boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
                  }}
                  cursor={{ fill: "var(--muted)", fillOpacity: 0.3 }}
                />

                <Bar dataKey="revenue" fill={CHART_COLORS.blue} radius={[0, 6, 6, 0]}>
                  <LabelList
                    dataKey="revenue"
                    position="right"
                    formatter={(v: number) => fmtShort(v)}
                    style={{ fontSize: 11, fill: "var(--muted-foreground)", fontWeight: 600 }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </Card>
  );
}
