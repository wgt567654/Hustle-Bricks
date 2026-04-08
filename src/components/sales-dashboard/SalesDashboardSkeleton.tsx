"use client";

export function SalesDashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 h-28 rounded-2xl bg-muted/40 animate-pulse" />
        <div className="h-24 rounded-2xl bg-muted/40 animate-pulse" />
        <div className="h-24 rounded-2xl bg-muted/40 animate-pulse" />
        <div className="h-24 rounded-2xl bg-muted/40 animate-pulse" />
        <div className="h-24 rounded-2xl bg-muted/40 animate-pulse" />
      </div>

      {/* Revenue chart */}
      <div className="h-64 rounded-2xl bg-muted/40 animate-pulse" />

      {/* Pipeline */}
      <div className="h-40 rounded-2xl bg-muted/40 animate-pulse" />

      {/* Forecast */}
      <div className="h-28 rounded-2xl bg-muted/40 animate-pulse" />

      {/* Reps table */}
      <div className="h-52 rounded-2xl bg-muted/40 animate-pulse" />

      {/* Product chart */}
      <div className="h-64 rounded-2xl bg-muted/40 animate-pulse" />

      {/* Activity */}
      <div className="h-28 rounded-2xl bg-muted/40 animate-pulse" />
    </div>
  );
}
