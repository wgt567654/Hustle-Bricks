"use client";

import { Card } from "@/components/ui/card";

export type KpiData = {
  totalRevenue: number;
  revenueGrowthPct: number;
  dealsClosed: number;
  conversionRate: number;
  avgDealSize: number;
};

function fmt(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function pct(n: number) {
  return isFinite(n) ? `${n >= 0 ? "+" : ""}${n.toFixed(1)}%` : "—";
}

type Props = { data: KpiData; loading?: boolean };

export function KpiCards({ data, loading }: Props) {
  if (loading) return null;

  const { totalRevenue, revenueGrowthPct, dealsClosed, conversionRate, avgDealSize } = data;
  const growthPositive = revenueGrowthPct >= 0;
  const conversionGood = conversionRate >= 50;

  return (
    <div className="grid grid-cols-2 gap-3">
      {/* Total Revenue — full width */}
      <Card className="col-span-2 rounded-2xl p-4 flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className="material-symbols-outlined text-[20px]"
              style={{ color: "#16a34a", fontVariationSettings: "'FILL' 1" }}
            >
              payments
            </span>
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Total Revenue</span>
          </div>
          {/* Growth badge */}
          <span
            className="text-xs font-bold px-2 py-0.5 rounded-full"
            style={{
              background: growthPositive ? "rgba(22,163,74,0.12)" : "rgba(239,68,68,0.12)",
              color: growthPositive ? "#16a34a" : "#ef4444",
            }}
          >
            {pct(revenueGrowthPct)} vs last month
          </span>
        </div>
        <p className="text-3xl font-extrabold tracking-tight">{fmt(totalRevenue)}</p>
        <p className="text-xs text-muted-foreground">All-time from paid jobs</p>
      </Card>

      {/* Deals Closed */}
      <KpiSmallCard
        icon="handshake"
        iconColor="#007AFF"
        label="Deals Closed"
        value={dealsClosed.toString()}
        sub="Accepted quotes"
      />

      {/* Conversion Rate */}
      <KpiSmallCard
        icon="conversion_path"
        iconColor={conversionGood ? "#16a34a" : "#ea580c"}
        label="Conversion Rate"
        value={isFinite(conversionRate) ? `${conversionRate.toFixed(0)}%` : "—"}
        sub="Quotes won vs lost"
      />

      {/* Avg Deal Size */}
      <KpiSmallCard
        icon="trending_up"
        iconColor="#8b5cf6"
        label="Avg Deal Size"
        value={dealsClosed > 0 ? fmt(avgDealSize) : "—"}
        sub="Revenue ÷ deals closed"
      />

      {/* Pipeline Value placeholder KPI */}
      <KpiSmallCard
        icon="account_balance_wallet"
        iconColor="#ea580c"
        label="Open Pipeline"
        value="—"
        sub="From active quotes"
        valueOverride
      />
    </div>
  );
}

type SmallProps = {
  icon: string;
  iconColor: string;
  label: string;
  value: string;
  sub: string;
  valueOverride?: boolean; // for slots filled by parent later
};

function KpiSmallCard({ icon, iconColor, label, value, sub }: SmallProps) {
  return (
    <Card className="rounded-2xl p-4 flex flex-col gap-1">
      <span
        className="material-symbols-outlined text-[20px] mb-0.5"
        style={{ color: iconColor, fontVariationSettings: "'FILL' 1" }}
      >
        {icon}
      </span>
      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="text-xl font-extrabold tracking-tight">{value}</p>
      <p className="text-[11px] text-muted-foreground">{sub}</p>
    </Card>
  );
}
