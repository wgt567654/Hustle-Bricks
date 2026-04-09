"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  ResponsiveContainer,
} from "recharts";
import { createClient } from "@/lib/supabase/client";
import { CHART_COLORS } from "@/lib/status-colors";

// ─── Types ────────────────────────────────────────────────────────────────────

type Property = {
  id: string;
  status: string;
  visited_by: string | null;
  created_at: string;
  job_id: string | null;
  team_members: { id: string; name: string } | null;
  jobs: { total: number; status: string } | null;
};

type RepRow = {
  id: string;
  name: string;
  doors: number;
  booked: number;
  commissionEarned: number; // from linked jobs
  pendingCommission: number; // booked but no job linked yet
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt$(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
}

function pct(a: number, b: number) {
  if (b === 0) return "—";
  return `${Math.round((a / b) * 100)}%`;
}

// ─── Summary Card ─────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="rounded-2xl bg-card border border-border p-4 flex flex-col gap-1">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-2xl font-extrabold text-foreground" style={accent ? { color: accent } : undefined}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function CanvassingAnalyticsPage() {
  const router = useRouter();
  const [properties, setProperties] = useState<Property[]>([]);
  const [commissionRate, setCommissionRate] = useState(5);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: biz } = await supabase
        .from("businesses")
        .select("id, commission_rate")
        .eq("owner_id", user.id)
        .maybeSingle();
      if (!biz) return;

      setCommissionRate(Number(biz.commission_rate) || 5);

      const { data: props } = await supabase
        .from("canvassing_properties")
        .select("id, status, visited_by, created_at, job_id, team_members(id, name), jobs(total, status)")
        .eq("business_id", biz.id)
        .order("created_at", { ascending: false });

      setProperties(
        (props ?? []).map((p) => ({
          ...p,
          team_members: Array.isArray(p.team_members) ? p.team_members[0] ?? null : p.team_members,
          jobs: Array.isArray(p.jobs) ? p.jobs[0] ?? null : p.jobs,
        })) as Property[]
      );
      setLoading(false);
    }
    load();
  }, []);

  const stats = useMemo(() => {
    const visited = properties.filter((p) => p.status !== "not_visited");
    const booked  = properties.filter((p) => p.status === "booked");

    const totalCommission = booked.reduce((sum, p) => {
      if (!p.jobs) return sum;
      return sum + (p.jobs.total * commissionRate) / 100;
    }, 0);

    // Funnel data for chart
    const funnel = [
      { label: "No Answer",      count: properties.filter((p) => p.status === "no_answer").length,  color: "#F59E0B" },
      { label: "Not Interested", count: properties.filter((p) => p.status === "no").length,         color: "#EF4444" },
      { label: "Interested",     count: properties.filter((p) => p.status === "interested").length,  color: "#3B82F6" },
      { label: "Booked",         count: booked.length,                                               color: "#22C55E" },
    ];

    // Per-rep rollup
    const repMap = new Map<string, RepRow>();
    for (const p of properties) {
      if (!p.visited_by || !p.team_members) continue;
      const key = p.visited_by;
      if (!repMap.has(key)) {
        repMap.set(key, { id: key, name: p.team_members.name, doors: 0, booked: 0, commissionEarned: 0, pendingCommission: 0 });
      }
      const row = repMap.get(key)!;
      row.doors++;
      if (p.status === "booked") {
        row.booked++;
        if (p.jobs) {
          row.commissionEarned += (p.jobs.total * commissionRate) / 100;
        } else {
          // Booked but no job created yet — estimate using avg or show as pending
          row.pendingCommission += 0; // can't estimate without job total
        }
      }
    }
    const reps = [...repMap.values()].sort((a, b) => b.commissionEarned - a.commissionEarned);

    const repCount = reps.length;
    const avgCommission = repCount > 0 ? totalCommission / repCount : 0;

    return { visited, booked, totalCommission, funnel, reps, avgCommission };
  }, [properties, commissionRate]);

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border px-4 pt-4 pb-3">
        <div className="flex items-center gap-3 mb-1">
          <button
            onClick={() => router.back()}
            className="flex size-8 items-center justify-center rounded-full hover:bg-muted transition-colors active:scale-90"
          >
            <span className="material-symbols-outlined text-[20px] text-muted-foreground">arrow_back</span>
          </button>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-foreground">Canvassing Analytics</h1>
            <p className="text-xs text-muted-foreground">
              {loading ? "Loading…" : `${properties.length} doors · ${commissionRate}% commission rate`}
            </p>
          </div>
        </div>
        <div className="flex gap-2 ml-11">
          <Link href="/canvassing" className="text-xs font-semibold text-muted-foreground hover:text-foreground px-2 py-1 rounded-lg hover:bg-muted transition-colors">
            ← Map
          </Link>
          <Link href="/canvassing/follow-ups" className="text-xs font-semibold text-muted-foreground hover:text-foreground px-2 py-1 rounded-lg hover:bg-muted transition-colors">
            Follow-ups →
          </Link>
        </div>
      </div>

      <div className="flex-1 px-4 py-5 flex flex-col gap-6 max-w-xl mx-auto w-full pb-24">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <p className="text-sm text-muted-foreground">Loading…</p>
          </div>
        ) : properties.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
            <span className="material-symbols-outlined text-[52px] text-muted-foreground/25" style={{ fontVariationSettings: "'FILL' 1" }}>
              door_front
            </span>
            <p className="text-sm font-semibold text-foreground">No canvassing data yet</p>
            <p className="text-xs text-muted-foreground">Start knocking doors on the map to see analytics here.</p>
          </div>
        ) : (
          <>
            {/* ── Summary cards ── */}
            <div className="grid grid-cols-2 gap-3">
              <StatCard
                label="Doors Logged"
                value={properties.length.toString()}
                sub={`${stats.visited.length} visited`}
              />
              <StatCard
                label="Booked"
                value={stats.booked.length.toString()}
                sub={`${pct(stats.booked.length, stats.visited.length)} conversion`}
                accent={CHART_COLORS.green}
              />
              <StatCard
                label="Commission Earned"
                value={fmt$(stats.totalCommission)}
                sub={`${commissionRate}% of booked job totals`}
                accent={CHART_COLORS.green}
              />
              <StatCard
                label="Avg Per Rep"
                value={fmt$(stats.avgCommission)}
                sub={`${stats.reps.length} active rep${stats.reps.length !== 1 ? "s" : ""}`}
              />
            </div>

            {/* ── Conversion funnel chart ── */}
            <div className="rounded-2xl bg-card border border-border overflow-hidden">
              <div className="px-4 pt-4 pb-3 border-b border-border flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>
                  funnel
                </span>
                <h2 className="text-sm font-extrabold text-foreground">Outcome Breakdown</h2>
              </div>
              <div className="px-4 py-4">
                <div className="h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      layout="vertical"
                      data={stats.funnel}
                      margin={{ top: 0, right: 40, bottom: 0, left: 0 }}
                    >
                      <XAxis
                        type="number"
                        allowDecimals={false}
                        tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        type="category"
                        dataKey="label"
                        width={108}
                        tick={{ fontSize: 11, fill: "var(--foreground)" }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        formatter={(value) => [value, "Doors"]}
                        contentStyle={{
                          background: "var(--card)",
                          border: "1px solid var(--border)",
                          borderRadius: 12,
                          fontSize: 12,
                          color: "var(--foreground)",
                          boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
                        }}
                        cursor={{ fill: "rgba(0,0,0,0.03)" }}
                      />
                      <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                        {stats.funnel.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* ── Per-rep commission table ── */}
            <div className="rounded-2xl bg-card border border-border overflow-hidden">
              <div className="px-4 pt-4 pb-3 border-b border-border flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>
                  leaderboard
                </span>
                <h2 className="text-sm font-extrabold text-foreground">Rep Commissions</h2>
                <span className="text-xs text-muted-foreground ml-auto">{commissionRate}% rate</span>
              </div>

              {stats.reps.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <p className="text-sm text-muted-foreground">No rep data yet — doors need a logged visitor.</p>
                </div>
              ) : (
                <div className="divide-y divide-border/60">
                  {/* Table header */}
                  <div className="grid grid-cols-[1fr_auto_auto_auto] gap-3 px-4 py-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Rep</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground text-right">Doors</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground text-right">Conv</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground text-right">Commission</span>
                  </div>

                  {stats.reps.map((rep, i) => (
                    <div key={rep.id} className="grid grid-cols-[1fr_auto_auto_auto] gap-3 px-4 py-3 items-center">
                      <div className="flex items-center gap-2 min-w-0">
                        {/* rank badge */}
                        <span
                          className="size-5 rounded-full flex items-center justify-center text-[10px] font-extrabold text-white shrink-0"
                          style={{ background: i === 0 ? CHART_COLORS.amber : i === 1 ? CHART_COLORS.muted : CHART_COLORS.muted }}
                        >
                          {i + 1}
                        </span>
                        <span className="text-sm font-semibold text-foreground truncate">{rep.name}</span>
                      </div>
                      <span className="text-sm text-muted-foreground text-right tabular-nums">{rep.doors}</span>
                      <span className="text-sm text-muted-foreground text-right tabular-nums">
                        {pct(rep.booked, rep.doors)}
                      </span>
                      <span
                        className="text-sm font-bold text-right tabular-nums"
                        style={{ color: rep.commissionEarned > 0 ? CHART_COLORS.green : undefined }}
                      >
                        {rep.commissionEarned > 0 ? fmt$(rep.commissionEarned) : rep.booked > 0 ? "Pending" : "—"}
                      </span>
                    </div>
                  ))}

                  {/* Total row */}
                  <div className="grid grid-cols-[1fr_auto_auto_auto] gap-3 px-4 py-3 items-center bg-muted/30">
                    <span className="text-sm font-bold text-foreground">Total</span>
                    <span className="text-sm font-bold text-foreground text-right tabular-nums">{properties.length}</span>
                    <span className="text-sm font-bold text-foreground text-right tabular-nums">
                      {pct(stats.booked.length, stats.visited.length)}
                    </span>
                    <span className="text-sm font-extrabold text-right tabular-nums" style={{ color: CHART_COLORS.green }}>
                      {fmt$(stats.totalCommission)}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Commission rate note */}
            <p className="text-xs text-muted-foreground text-center pb-2">
              Commission rate is set in{" "}
              <Link href="/settings" className="text-primary font-semibold hover:underline">
                Settings
              </Link>
              . Only bookings with a linked job have confirmed amounts.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
