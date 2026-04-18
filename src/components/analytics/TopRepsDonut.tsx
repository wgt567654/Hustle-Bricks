"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { Card } from "@/components/ui/card";
import { CHART_PALETTE } from "@/lib/status-colors";

export type RepRevenue = {
  name: string;
  revenue: number;
};

type Props = {
  reps: RepRevenue[];
  currency?: string;
};

function fmtCurrency(v: number, currency = "USD") {
  return v.toLocaleString("en-US", { style: "currency", currency, maximumFractionDigits: 0 });
}

function fmtShort(v: number) {
  if (v >= 1000) return `$${(v / 1000).toFixed(1)}k`;
  return `$${v}`;
}

export function TopRepsDonut({ reps, currency = "USD" }: Props) {
  const data  = reps.filter((r) => r.revenue > 0);
  const total = data.reduce((s, r) => s + r.revenue, 0);
  const top   = data[0];

  return (
    <Card className="rounded-2xl overflow-hidden">
      <div className="p-4 border-b border-border/50">
        <p className="font-bold text-sm text-foreground">Top Sales Reps</p>
        <p className="text-xs text-muted-foreground mt-0.5">Revenue from assigned jobs</p>
      </div>

      <div className="p-4">
        {data.length === 0 ? (
          <div className="h-44 flex flex-col items-center justify-center gap-2">
            <span
              className="material-symbols-outlined text-[36px] text-muted-foreground/30"
              style={{ fontVariationSettings: "'FILL' 0" }}
            >
              person_pin
            </span>
            <p className="text-sm text-muted-foreground">No assigned job revenue yet</p>
            <p className="text-xs text-muted-foreground/60">Assign jobs to team members to track rep performance</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {/* Donut */}
            <div className="relative h-44">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data}
                    dataKey="revenue"
                    nameKey="name"
                    innerRadius={52}
                    outerRadius={72}
                    paddingAngle={2}
                    startAngle={90}
                    endAngle={-270}
                  >
                    {data.map((_, i) => (
                      <Cell key={i} fill={CHART_PALETTE[i % CHART_PALETTE.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => {
                      const n = typeof value === "number" ? value : 0;
                      return [fmtCurrency(n, currency), "Revenue"];
                    }}
                    contentStyle={{
                      background: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: 12,
                      fontSize: 12,
                      color: "var(--foreground)",
                      boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>

              {/* Center label */}
              {top && (
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-xs font-semibold text-muted-foreground text-center leading-tight max-w-[80px] truncate">
                    {top.name.split(" ")[0]}
                  </span>
                  <span className="text-base font-extrabold tracking-tight">
                    {total > 0 ? `${((top.revenue / total) * 100).toFixed(0)}%` : "—"}
                  </span>
                </div>
              )}
            </div>

            {/* Legend */}
            <div className="flex flex-col gap-1.5">
              {data.map((rep, i) => (
                <div key={rep.name} className="flex items-center gap-2">
                  <div
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ background: CHART_PALETTE[i % CHART_PALETTE.length] }}
                  />
                  <span className="text-xs text-foreground flex-1 truncate">{rep.name}</span>
                  <span className="text-xs font-bold text-foreground">{fmtShort(rep.revenue)}</span>
                  <span className="text-[10px] text-muted-foreground w-8 text-right">
                    {total > 0 ? `${((rep.revenue / total) * 100).toFixed(0)}%` : "—"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
