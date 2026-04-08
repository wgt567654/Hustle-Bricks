"use client";

import { Card } from "@/components/ui/card";

type Props = {
  pipelineValue: number;   // sum of all "sent" quote totals
  closeRate: number;        // conversion rate % (0–100)
  forecastedRevenue: number; // pipelineValue * (closeRate / 100)
};

function fmt(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export function ForecastCard({ pipelineValue, closeRate, forecastedRevenue }: Props) {
  const hasData = pipelineValue > 0;

  return (
    <Card className="rounded-2xl overflow-hidden">
      <div className="p-4 flex items-center gap-2 border-b">
        <span
          className="material-symbols-outlined text-[20px]"
          style={{ color: "#ea580c", fontVariationSettings: "'FILL' 1" }}
        >
          insights
        </span>
        <div>
          <h3 className="text-sm font-extrabold">Revenue Forecast</h3>
          <p className="text-xs text-muted-foreground">Based on open pipeline × historical close rate</p>
        </div>
      </div>

      <div className="grid grid-cols-3 divide-x">
        {/* Pipeline Value */}
        <div className="p-4 flex flex-col gap-0.5">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Pipeline</p>
          <p className="text-xl font-extrabold" style={{ color: "#007AFF" }}>
            {hasData ? fmt(pipelineValue) : "—"}
          </p>
          <p className="text-[11px] text-muted-foreground">Active quotes</p>
        </div>

        {/* Close Rate */}
        <div className="p-4 flex flex-col gap-0.5">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Close Rate</p>
          <p className="text-xl font-extrabold" style={{ color: "#ea580c" }}>
            {isFinite(closeRate) && closeRate > 0 ? `${closeRate.toFixed(0)}%` : "—"}
          </p>
          <p className="text-[11px] text-muted-foreground">Historical win rate</p>
        </div>

        {/* Forecasted Revenue */}
        <div className="p-4 flex flex-col gap-0.5">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Forecast</p>
          <p className="text-xl font-extrabold" style={{ color: "#16a34a" }}>
            {forecastedRevenue > 0 ? fmt(forecastedRevenue) : "—"}
          </p>
          <p className="text-[11px] text-muted-foreground">Expected revenue</p>
        </div>
      </div>

      {!hasData && (
        <div className="px-4 pb-4 pt-0">
          <p className="text-xs text-muted-foreground text-center">
            Send quotes to clients to build your pipeline forecast
          </p>
        </div>
      )}
    </Card>
  );
}
