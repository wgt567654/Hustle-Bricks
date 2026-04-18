"use client";

import { Card } from "@/components/ui/card";

type Props = {
  pipelineValue: number;
  closeRate: number;
  forecastedRevenue: number;
};

function fmt(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export function ForecastCard({ pipelineValue, closeRate, forecastedRevenue }: Props) {
  const hasData = pipelineValue > 0;

  return (
    <Card className="rounded-2xl overflow-hidden">
      <div className="p-4 border-b border-border/50">
        <p className="font-bold text-sm text-foreground">Revenue Forecast</p>
        <p className="text-xs text-muted-foreground mt-0.5">Open pipeline × historical close rate</p>
      </div>

      <div className="grid grid-cols-3 divide-x divide-border/40">
        <div className="p-4 flex flex-col gap-0.5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Pipeline</p>
          <p className="text-xl font-extrabold tracking-tight text-foreground">
            {hasData ? fmt(pipelineValue) : "—"}
          </p>
          <p className="text-[10px] text-muted-foreground">Active quotes</p>
        </div>

        <div className="p-4 flex flex-col gap-0.5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Close Rate</p>
          <p className="text-xl font-extrabold tracking-tight text-foreground">
            {isFinite(closeRate) && closeRate > 0 ? `${closeRate.toFixed(0)}%` : "—"}
          </p>
          <p className="text-[10px] text-muted-foreground">Historical win rate</p>
        </div>

        <div className="p-4 flex flex-col gap-0.5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Forecast</p>
          <p className="text-xl font-extrabold tracking-tight text-foreground">
            {forecastedRevenue > 0 ? fmt(forecastedRevenue) : "—"}
          </p>
          <p className="text-[10px] text-muted-foreground">Expected revenue</p>
        </div>
      </div>

      {!hasData && (
        <div className="px-4 pb-4">
          <p className="text-xs text-muted-foreground text-center">
            Send quotes to clients to build your pipeline forecast
          </p>
        </div>
      )}
    </Card>
  );
}
