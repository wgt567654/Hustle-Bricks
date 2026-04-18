export function AnalyticsSkeleton() {
  return (
    <div className="flex flex-col gap-6 animate-pulse">
      {/* Hero revenue card */}
      <div className="rounded-2xl bg-muted h-52" />

      {/* Two-column grid */}
      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-2">
        {/* Left */}
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-2xl bg-muted h-20" />
            <div className="rounded-2xl bg-muted h-20" />
            <div className="rounded-2xl bg-muted h-20" />
          </div>
          <div className="rounded-2xl bg-muted h-36" />
          <div className="rounded-2xl bg-muted h-56" />
        </div>
        {/* Right */}
        <div className="flex flex-col gap-6">
          <div className="rounded-2xl bg-muted h-28" />
          <div className="rounded-2xl bg-muted h-44" />
          <div className="rounded-2xl bg-muted h-64" />
        </div>
      </div>

      {/* Full-width charts */}
      <div className="rounded-2xl bg-muted h-56" />
      <div className="rounded-2xl bg-muted h-52" />
    </div>
  );
}
