"use client";

import { useRef, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import { Card } from "@/components/ui/card";
import { CHART_COLORS } from "@/lib/chart-colors";

export type GoalDataPoint = {
  month: string;
  actual: number;
};

type Props = {
  series: GoalDataPoint[];
  goal: number;
  onGoalChange: (v: number) => void;
  currency?: string;
};

function fmtShort(v: number) {
  if (v >= 1000) return `$${(v / 1000).toFixed(1)}k`;
  return `$${v}`;
}

function fmtFull(v: number, currency = "USD") {
  return v.toLocaleString("en-US", { style: "currency", currency, maximumFractionDigits: 0 });
}

export function GoalBarChart({ series, goal, onGoalChange, currency = "USD" }: Props) {
  const [inputVal, setInputVal] = useState(goal > 0 ? String(goal) : "");
  const inputRef = useRef<HTMLInputElement>(null);

  function handleBlur() {
    const n = Number(inputVal.replace(/[^0-9.]/g, ""));
    if (!isNaN(n) && n >= 0) {
      onGoalChange(n);
      localStorage.setItem("hb_monthly_revenue_goal", String(n));
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") inputRef.current?.blur();
  }

  return (
    <Card className="rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-border/50 flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span
              className="material-symbols-outlined text-[18px]"
              style={{ color: CHART_COLORS.orange, fontVariationSettings: "'FILL' 1" }}
            >
              flag
            </span>
            <p className="font-bold text-sm text-foreground">Actual vs. Goal</p>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">Monthly revenue vs. your target</p>
        </div>

        {/* Inline goal input */}
        <div className="flex items-center gap-1 shrink-0">
          <span className="text-xs text-muted-foreground font-semibold">Goal</span>
          <div className="flex items-center border border-border rounded-xl overflow-hidden bg-card">
            <span className="px-2 text-xs text-muted-foreground border-r border-border">$</span>
            <input
              ref={inputRef}
              type="text"
              inputMode="numeric"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              placeholder="0"
              className="w-20 px-2 py-1.5 text-xs font-bold bg-transparent text-foreground focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="p-4">
        <div className="h-44">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={series} margin={{ top: 8, right: 8, bottom: 0, left: -8 }} barSize={24}>
              <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.4} />

              <XAxis
                dataKey="month"
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
                  return [fmtFull(n, currency), "Revenue"];
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

              <Bar
                dataKey="actual"
                fill={CHART_COLORS.blue}
                radius={[6, 6, 0, 0]}
              />

              {goal > 0 && (
                <ReferenceLine
                  y={goal}
                  stroke={CHART_COLORS.orange}
                  strokeDasharray="4 3"
                  strokeWidth={1.5}
                  label={{
                    value: `Goal: ${fmtShort(goal)}`,
                    position: "insideTopRight",
                    fontSize: 10,
                    fill: CHART_COLORS.orange,
                    fontWeight: 600,
                  }}
                />
              )}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </Card>
  );
}
