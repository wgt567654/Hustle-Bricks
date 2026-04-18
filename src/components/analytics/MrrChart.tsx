"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from "recharts";
import { Card } from "@/components/ui/card";
import { CHART_PALETTE } from "@/lib/status-colors";

export type ServicePlan = {
  frequency: string;
  price: number;
  status: string;
};

type Props = {
  plans: ServicePlan[];
  currency?: string;
};

const FREQ_TO_MONTHLY: Record<string, number> = {
  weekly:    4.33,
  biweekly:  2.165,
  monthly:   1,
  quarterly: 1 / 3,
  annually:  1 / 12,
};

const FREQ_LABELS: Record<string, string> = {
  weekly:    "Weekly",
  biweekly:  "Bi-Weekly",
  monthly:   "Monthly",
  quarterly: "Quarterly",
  annually:  "Annual",
};

function planMonthlyValue(plan: ServicePlan): number {
  return plan.price * (FREQ_TO_MONTHLY[plan.frequency] ?? 1);
}

function fmtShort(v: number) {
  if (v >= 1000) return `$${(v / 1000).toFixed(1)}k`;
  return `$${Math.round(v)}`;
}

function fmtFull(v: number, currency = "USD") {
  return v.toLocaleString("en-US", { style: "currency", currency, maximumFractionDigits: 0 });
}

export function MrrChart({ plans, currency = "USD" }: Props) {
  const activePlans = plans.filter((p) => p.status === "active");

  const totalMrr = activePlans.reduce((s, p) => s + planMonthlyValue(p), 0);

  // Group by frequency
  const byFreq: Record<string, number> = {};
  for (const p of activePlans) {
    const key = p.frequency;
    byFreq[key] = (byFreq[key] ?? 0) + planMonthlyValue(p);
  }

  const data = Object.entries(byFreq)
    .sort((a, b) => b[1] - a[1])
    .map(([freq, mrr]) => ({
      label: FREQ_LABELS[freq] ?? freq,
      mrr,
    }));

  return (
    <Card className="rounded-2xl overflow-hidden">
      {/* Header with MRR KPI */}
      <div className="p-4 border-b border-border/50 flex items-start justify-between">
        <div>
          <p className="font-bold text-sm text-foreground">Monthly Recurring Revenue</p>
          <p className="text-xs text-muted-foreground mt-0.5">From active service plans</p>
        </div>
        <div className="text-right">
          <p className="text-xl font-extrabold tracking-tight">
            {totalMrr > 0 ? fmtFull(totalMrr, currency) : "—"}
          </p>
          <p className="text-[10px] text-muted-foreground">per month</p>
        </div>
      </div>

      <div className="p-4">
        {data.length === 0 ? (
          <div className="h-40 flex flex-col items-center justify-center gap-2">
            <span
              className="material-symbols-outlined text-[36px] text-muted-foreground/30"
              style={{ fontVariationSettings: "'FILL' 0" }}
            >
              autorenew
            </span>
            <p className="text-sm text-muted-foreground">No active service plans</p>
            <p className="text-xs text-muted-foreground/60">Create plans to track recurring revenue</p>
          </div>
        ) : (
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -8 }} barSize={36}>
                <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.4} />

                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                />

                <YAxis
                  tickFormatter={fmtShort}
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                  width={40}
                />

                <Tooltip
                  formatter={(value) => {
                    const n = typeof value === "number" ? value : 0;
                    return [fmtFull(n, currency) + "/mo", "MRR"];
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

                <Bar dataKey="mrr" radius={[6, 6, 0, 0]}>
                  {data.map((_, i) => (
                    <Cell key={i} fill={CHART_PALETTE[i % CHART_PALETTE.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </Card>
  );
}
