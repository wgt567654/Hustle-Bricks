"use client";

import { Card } from "@/components/ui/card";

export type PipelineStage = {
  label: string;
  count: number;
  value: number;
  color: string;
};

type Props = { stages: PipelineStage[] };

function fmt(n: number) {
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`;
  return `$${n}`;
}

export function SalesPipelineCard({ stages }: Props) {
  const totalValue = stages.reduce((s, st) => s + st.value, 0);
  const totalCount = stages.reduce((s, st) => s + st.count, 0);

  return (
    <Card className="rounded-2xl overflow-hidden">
      <div className="p-4 flex items-center justify-between border-b">
        <div className="flex items-center gap-2">
          <span
            className="material-symbols-outlined text-[20px]"
            style={{ color: "var(--color-primary)", fontVariationSettings: "'FILL' 1" }}
          >
            funnel
          </span>
          <h3 className="text-sm font-extrabold">Sales Pipeline</h3>
        </div>
        <span className="text-xs text-muted-foreground">
          {totalCount} deal{totalCount !== 1 ? "s" : ""} · {fmt(totalValue)} total
        </span>
      </div>

      {/* Proportional bar */}
      {totalValue > 0 && (
        <div className="flex h-1.5">
          {stages
            .filter((s) => s.value > 0)
            .map((stage) => (
              <div
                key={stage.label}
                style={{
                  width: `${(stage.value / totalValue) * 100}%`,
                  background: stage.color,
                }}
              />
            ))}
        </div>
      )}

      {/* Stage columns */}
      <div className="grid grid-cols-4 divide-x">
        {stages.map((stage) => (
          <div key={stage.label} className="p-3 flex flex-col gap-1">
            {/* Color dot + label */}
            <div className="flex items-center gap-1.5">
              <div
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ background: stage.color }}
              />
              <span className="text-[11px] font-semibold text-muted-foreground truncate">
                {stage.label}
              </span>
            </div>

            {/* Count */}
            <p className="text-lg font-extrabold leading-none">{stage.count}</p>

            {/* Value */}
            <p className="text-[11px] text-muted-foreground">{fmt(stage.value)}</p>
          </div>
        ))}
      </div>

      {/* Empty state */}
      {totalCount === 0 && (
        <div className="p-6 flex flex-col items-center gap-2 text-center">
          <span
            className="material-symbols-outlined text-[32px] text-muted-foreground/40"
            style={{ fontVariationSettings: "'FILL' 0" }}
          >
            funnel
          </span>
          <p className="text-sm text-muted-foreground">No quotes in the pipeline yet</p>
          <p className="text-xs text-muted-foreground">Create quotes to track your sales stages</p>
        </div>
      )}
    </Card>
  );
}
