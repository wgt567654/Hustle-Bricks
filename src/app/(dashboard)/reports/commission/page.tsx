"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";

type Member = {
  id: string;
  name: string;
  role: string;
  commission_rate: number | null;
};

type Job = {
  id: string;
  total: number;
  completed_at: string | null;
  assigned_member_id: string | null;
};

type RepRow = {
  id: string;
  name: string;
  jobs: number;
  revenue: number;
  rate: number;
  commission: number;
};

const MEDALS = ["🥇", "🥈", "🥉"];

function fmt$(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export default function CommissionPage() {
  const router = useRouter();
  const [members, setMembers] = useState<Member[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [defaultRate, setDefaultRate] = useState(5);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<"week" | "month" | "ytd" | "custom">("month");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const now = new Date();

  const { startDate, endDate } = useMemo(() => {
    if (range === "week") {
      const start = new Date(now);
      start.setDate(now.getDate() - now.getDay());
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
      return { startDate: start, endDate: end };
    }
    if (range === "month") {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      return { startDate: start, endDate: end };
    }
    if (range === "ytd") {
      const start = new Date(now.getFullYear(), 0, 1);
      return { startDate: start, endDate: now };
    }
    const start = customStart ? new Date(customStart) : new Date(now.getFullYear(), now.getMonth(), 1);
    const end = customEnd ? new Date(customEnd + "T23:59:59") : new Date();
    return { startDate: start, endDate: end };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, customStart, customEnd]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: biz } = await supabase
        .from("businesses")
        .select("id, commission_rate")
        .eq("owner_id", user.id)
        .single();
      if (!biz) return;

      setDefaultRate(biz.commission_rate ?? 5);

      const [{ data: memberData }, { data: jobData }] = await Promise.all([
        supabase
          .from("team_members")
          .select("id, name, role, commission_rate")
          .eq("business_id", biz.id)
          .eq("is_active", true),
        supabase
          .from("jobs")
          .select("id, total, completed_at, assigned_member_id")
          .eq("business_id", biz.id)
          .eq("status", "completed")
          .not("assigned_member_id", "is", null)
          .not("completed_at", "is", null)
          .gte("completed_at", startDate.toISOString())
          .lte("completed_at", endDate.toISOString()),
      ]);

      setMembers((memberData as Member[]) ?? []);
      setJobs((jobData as Job[]) ?? []);
      setLoading(false);
    }
    load();
  }, [startDate, endDate]);

  const rows = useMemo((): RepRow[] => {
    const memberMap = Object.fromEntries(members.map((m) => [m.id, m]));
    const map: Record<string, { jobs: number; revenue: number; rate: number }> = {};

    for (const j of jobs) {
      const memberId = j.assigned_member_id!;
      const member = memberMap[memberId];
      if (!member) continue;
      const rate = member.commission_rate ?? defaultRate;
      if (!map[memberId]) map[memberId] = { jobs: 0, revenue: 0, rate };
      map[memberId].jobs++;
      map[memberId].revenue += j.total ?? 0;
    }

    return Object.entries(map)
      .map(([id, { jobs, revenue, rate }]) => ({
        id,
        name: memberMap[id]?.name ?? "Unknown",
        jobs,
        revenue,
        rate,
        commission: (revenue * rate) / 100,
      }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [jobs, members, defaultRate]);

  const totals = useMemo(() => ({
    revenue: rows.reduce((s, r) => s + r.revenue, 0),
    commission: rows.reduce((s, r) => s + r.commission, 0),
    jobs: rows.reduce((s, r) => s + r.jobs, 0),
  }), [rows]);

  const rangeLabel = useMemo(() => {
    const fmt = (d: Date) => d.toLocaleDateString([], { month: "short", day: "numeric" });
    if (range === "ytd") return `Jan 1 – ${fmt(now)}`;
    return `${fmt(startDate)} – ${fmt(endDate)}`;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, startDate, endDate]);

  return (
    <div className="flex flex-col gap-6 px-4 py-6 max-w-2xl mx-auto pb-32 lg:pb-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push("/analytics")}
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-card shadow-sm border border-border text-foreground hover:bg-muted/50 transition-colors"
        >
          <span className="material-symbols-outlined text-[20px]">arrow_back</span>
        </button>
        <div className="flex flex-col flex-1">
          <h1 className="text-xl font-extrabold tracking-tight text-foreground">Commission Leaderboard</h1>
          <p className="text-xs text-muted-foreground">{rangeLabel} · Default rate: {defaultRate}%</p>
        </div>
      </div>

      {/* Range selector */}
      <div className="flex gap-2">
        {(["week", "month", "ytd", "custom"] as const).map((r) => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
              range === r
                ? "bg-primary text-white shadow-sm"
                : "bg-muted text-foreground border border-border hover:bg-muted/80"
            }`}
          >
            {r === "week" ? "Week" : r === "month" ? "Month" : r === "ytd" ? "YTD" : "Custom"}
          </button>
        ))}
      </div>

      {range === "custom" && (
        <div className="flex gap-3">
          <div className="flex-1 flex flex-col gap-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">From</label>
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30"
            />
          </div>
          <div className="flex-1 flex flex-col gap-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">To</label>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30"
            />
          </div>
        </div>
      )}

      {/* Summary totals */}
      {!loading && rows.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <Card className="p-4 rounded-2xl border-border shadow-sm flex flex-col gap-0.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Revenue</span>
            <span className="text-lg font-extrabold text-foreground">{fmt$(totals.revenue)}</span>
          </Card>
          <Card className="p-4 rounded-2xl border-border shadow-sm flex flex-col gap-0.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Commission</span>
            <span className="text-lg font-extrabold text-green-600">{fmt$(totals.commission)}</span>
          </Card>
          <Card className="p-4 rounded-2xl border-border shadow-sm flex flex-col gap-0.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Jobs</span>
            <span className="text-lg font-extrabold text-foreground">{totals.jobs}</span>
          </Card>
        </div>
      )}

      {/* Leaderboard */}
      {loading ? (
        <p className="text-sm text-muted-foreground text-center py-8">Loading…</p>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center rounded-2xl border border-dashed border-border">
          <span className="material-symbols-outlined text-[48px] text-muted-foreground/30">emoji_events</span>
          <p className="text-sm font-semibold text-muted-foreground">No completed jobs in this period</p>
          <p className="text-xs text-muted-foreground/60">Assign team members to jobs to start tracking commissions</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Rankings</h3>

          {/* Top 3 podium cards */}
          {rows.slice(0, 3).map((rep, i) => (
            <Card
              key={rep.id}
              className={`rounded-2xl border-border shadow-sm p-4 flex items-center gap-4 ${
                i === 0 ? "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800" : ""
              }`}
            >
              <div className="text-3xl shrink-0 w-10 text-center">{MEDALS[i]}</div>
              <div className="flex flex-col flex-1 min-w-0">
                <span className="font-extrabold text-foreground truncate">{rep.name}</span>
                <span className="text-xs text-muted-foreground">
                  {rep.jobs} job{rep.jobs !== 1 ? "s" : ""} · {rep.rate}% rate
                </span>
              </div>
              <div className="flex flex-col items-end shrink-0">
                <span className="font-extrabold text-foreground">{fmt$(rep.revenue)}</span>
                <span className="text-xs font-bold text-green-600">{fmt$(rep.commission)} commission</span>
              </div>
            </Card>
          ))}

          {/* Remaining reps */}
          {rows.length > 3 && (
            <Card className="rounded-2xl border-border shadow-sm overflow-hidden">
              {rows.slice(3).map((rep, i) => (
                <div
                  key={rep.id}
                  className={`grid grid-cols-[auto_1fr_auto] gap-3 px-4 py-3.5 items-center ${i < rows.length - 4 ? "border-b border-border/40" : ""}`}
                >
                  <span className="text-sm font-bold text-muted-foreground w-6 text-center">{i + 4}</span>
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-bold text-foreground truncate">{rep.name}</span>
                    <span className="text-xs text-muted-foreground">{rep.jobs} job{rep.jobs !== 1 ? "s" : ""} · {rep.rate}%</span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-sm font-bold text-foreground">{fmt$(rep.revenue)}</span>
                    <span className="text-xs font-bold text-green-600">{fmt$(rep.commission)}</span>
                  </div>
                </div>
              ))}
            </Card>
          )}

          <p className="text-[11px] text-muted-foreground text-center">
            Commission rates can be set per-rep in{" "}
            <button onClick={() => router.push("/team")} className="underline font-medium">Team settings</button>.
            Business default is {defaultRate}%.
          </p>
        </div>
      )}
    </div>
  );
}
