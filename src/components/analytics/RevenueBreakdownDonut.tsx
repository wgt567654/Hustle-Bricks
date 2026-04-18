"use client";

import { useState } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { Card } from "@/components/ui/card";
import { CHART_PALETTE } from "@/lib/status-colors";

export type BreakdownEntry = {
  label: string;
  value: number;
};

type Props = {
  byService: BreakdownEntry[];
  bySource:  BreakdownEntry[];
  currency?: string;
};

type Tab = "service" | "source";

function fmtCurrency(v: number, currency = "USD") {
  return v.toLocaleString("en-US", { style: "currency", currency, maximumFractionDigits: 0 });
}

function fmtShort(v: number) {
  if (v >= 1000) return `$${(v / 1000).toFixed(1)}k`;
  return `$${v}`;
}

function DonutChart({ data, currency = "USD" }: { data: BreakdownEntry[]; currency?: string }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const top   = data[0];

  if (data.length === 0 || total === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-44 gap-2">
        <span
          className="material-symbols-outlined text-[36px] text-muted-foreground/30"
          style={{ fontVariationSettings: "'FILL' 0" }}
        >
          donut_large
        </span>
        <p className="text-sm text-muted-foreground">No data for this period</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Donut */}
      <div className="relative h-44">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="label"
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
              {top.label}
            </span>
            <span className="text-base font-extrabold tracking-tight">
              {total > 0 ? `${((top.value / total) * 100).toFixed(0)}%` : "—"}
            </span>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-col gap-1.5">
        {data.map((entry, i) => (
          <div key={entry.label} className="flex items-center gap-2">
            <div
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ background: CHART_PALETTE[i % CHART_PALETTE.length] }}
            />
            <span className="text-xs text-foreground flex-1 truncate">{entry.label}</span>
            <span className="text-xs font-bold text-foreground">{fmtShort(entry.value)}</span>
            <span className="text-[10px] text-muted-foreground w-8 text-right">
              {total > 0 ? `${((entry.value / total) * 100).toFixed(0)}%` : "—"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function RevenueBreakdownDonut({ byService, bySource, currency = "USD" }: Props) {
  const [tab, setTab] = useState<Tab>("service");

  return (
    <Card className="rounded-2xl overflow-hidden">
      <div className="p-4 border-b border-border/50">
        <p className="font-bold text-sm text-foreground">Revenue Breakdown</p>
        <p className="text-xs text-muted-foreground mt-0.5">Where your revenue is coming from</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-3 border-b border-border/50">
        {([ { key: "service", label: "By Service" }, { key: "source", label: "By Lead Source" } ] as const).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-colors ${
              tab === key
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="p-4">
        <DonutChart data={tab === "service" ? byService : bySource} currency={currency} />
      </div>
    </Card>
  );
}
