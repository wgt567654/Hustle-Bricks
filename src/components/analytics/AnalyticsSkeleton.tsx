export function AnalyticsSkeleton() {
  return (
    <div className="flex flex-col gap-6 animate-pulse">
      {/* Hero revenue card */}
      <div className="rounded-2xl bg-muted h-52" />

      {/* KPI row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl bg-muted h-20" />
        <div className="rounded-2xl bg-muted h-20" />
        <div className="rounded-2xl bg-muted h-20" />
      </div>

      {/* Sales pipeline */}
      <div className="rounded-2xl bg-muted h-36" />

      {/* Forecast */}
      <div className="rounded-2xl bg-muted h-28" />

      {/* Top clients chart */}
      <div className="rounded-2xl bg-muted h-56" />

      {/* Team performance chart */}
      <div className="rounded-2xl bg-muted h-44" />
    </div>
  );
}
