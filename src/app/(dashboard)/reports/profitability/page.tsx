"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";

type TimeEntry = {
  job_id: string;
  clocked_in_at: string;
  clocked_out_at: string | null;
  team_members: { hourly_rate: number | null } | null;
};

type Expense = {
  job_id: string;
  amount: number;
};

type Job = {
  id: string;
  total: number;
  completed_at: string | null;
  clients: { name: string } | null;
};

type JobRow = {
  id: string;
  clientName: string;
  completedAt: string;
  revenue: number;
  laborCost: number;
  expenses: number;
  profit: number;
  margin: number;
};

function fmt$(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function marginColor(m: number) {
  if (m >= 50) return "text-green-600";
  if (m >= 25) return "text-amber-600";
  return "text-red-500";
}

export default function ProfitabilityPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<"week" | "month" | "custom">("month");
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

      const { data: business } = await supabase
        .from("businesses")
        .select("id")
        .eq("owner_id", user.id)
        .single();
      if (!business) return;

      const [{ data: jobData }, { data: entryData }, { data: expenseData }] = await Promise.all([
        supabase
          .from("jobs")
          .select("id, total, completed_at, clients(name)")
          .eq("business_id", business.id)
          .eq("status", "completed")
          .not("completed_at", "is", null)
          .gte("completed_at", startDate.toISOString())
          .lte("completed_at", endDate.toISOString())
          .order("completed_at", { ascending: false }),
        supabase
          .from("time_entries")
          .select("job_id, clocked_in_at, clocked_out_at, team_members(hourly_rate)")
          .eq("business_id", business.id)
          .not("clocked_out_at", "is", null),
        supabase
          .from("expenses")
          .select("job_id, amount")
          .eq("business_id", business.id),
      ]);

      setJobs((jobData as unknown as Job[]) ?? []);
      setTimeEntries((entryData as unknown as TimeEntry[]) ?? []);
      setExpenses((expenseData as Expense[]) ?? []);
      setLoading(false);
    }
    load();
  }, [startDate, endDate]);

  const rows = useMemo((): JobRow[] => {
    const laborByJob: Record<string, number> = {};
    for (const e of timeEntries) {
      if (!e.clocked_out_at) continue;
      const rate = e.team_members?.hourly_rate ?? 0;
      if (!rate) continue;
      const hours = (new Date(e.clocked_out_at).getTime() - new Date(e.clocked_in_at).getTime()) / 3_600_000;
      laborByJob[e.job_id] = (laborByJob[e.job_id] ?? 0) + hours * rate;
    }

    const expenseByJob: Record<string, number> = {};
    for (const ex of expenses) {
      expenseByJob[ex.job_id] = (expenseByJob[ex.job_id] ?? 0) + ex.amount;
    }

    return jobs.map((j) => {
      const revenue = j.total ?? 0;
      const laborCost = laborByJob[j.id] ?? 0;
      const expTotal = expenseByJob[j.id] ?? 0;
      const profit = revenue - laborCost - expTotal;
      const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
      return {
        id: j.id,
        clientName: (j.clients as { name: string } | null)?.name ?? "Unknown",
        completedAt: j.completed_at!,
        revenue,
        laborCost,
        expenses: expTotal,
        profit,
        margin,
      };
    });
  }, [jobs, timeEntries, expenses]);

  const totals = useMemo(() => {
    const revenue = rows.reduce((s, r) => s + r.revenue, 0);
    const laborCost = rows.reduce((s, r) => s + r.laborCost, 0);
    const expenses = rows.reduce((s, r) => s + r.expenses, 0);
    const profit = rows.reduce((s, r) => s + r.profit, 0);
    const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
    return { revenue, laborCost, expenses, profit, margin };
  }, [rows]);

  const rangeLabel = useMemo(() => {
    const fmt = (d: Date) => d.toLocaleDateString([], { month: "short", day: "numeric" });
    return `${fmt(startDate)} – ${fmt(endDate)}`;
  }, [startDate, endDate]);

  const missingRates = useMemo(() => {
    const jobIds = new Set(jobs.map((j) => j.id));
    const coveredIds = new Set(
      timeEntries
        .filter((e) => jobIds.has(e.job_id) && (e.team_members?.hourly_rate ?? 0) > 0)
        .map((e) => e.job_id)
    );
    const jobsWithEntries = new Set(timeEntries.filter((e) => jobIds.has(e.job_id)).map((e) => e.job_id));
    return [...jobsWithEntries].filter((id) => !coveredIds.has(id)).length;
  }, [jobs, timeEntries]);

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
          <h1 className="text-xl font-extrabold tracking-tight text-foreground">Job Profitability</h1>
          <p className="text-xs text-muted-foreground">{rangeLabel}</p>
        </div>
      </div>

      {/* Range selector */}
      <div className="flex gap-2">
        {(["week", "month", "custom"] as const).map((r) => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
              range === r
                ? "bg-primary text-white shadow-sm"
                : "bg-muted text-foreground border border-border hover:bg-muted/80"
            }`}
          >
            {r === "week" ? "This Week" : r === "month" ? "This Month" : "Custom"}
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

      {/* Missing rates banner */}
      {!loading && missingRates > 0 && (
        <div
          className="flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 cursor-pointer"
          onClick={() => router.push("/team")}
        >
          <span className="material-symbols-outlined text-amber-600 text-[20px] shrink-0">warning</span>
          <p className="text-xs text-amber-700 dark:text-amber-300 font-medium flex-1">
            {missingRates} job{missingRates > 1 ? "s have" : " has"} time entries without hourly rates set. Labor costs may be understated.
          </p>
          <span className="text-xs font-bold text-amber-700 dark:text-amber-300 shrink-0">Set rates →</span>
        </div>
      )}

      {/* Summary cards */}
      {!loading && rows.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <Card className="p-4 rounded-2xl border-border shadow-sm flex flex-col gap-0.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Revenue</span>
            <span className="text-xl font-extrabold text-foreground">{fmt$(totals.revenue)}</span>
          </Card>
          <Card className="p-4 rounded-2xl border-border shadow-sm flex flex-col gap-0.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Profit</span>
            <span className={`text-xl font-extrabold ${totals.profit >= 0 ? "text-green-600" : "text-red-500"}`}>{fmt$(totals.profit)}</span>
          </Card>
          <Card className="p-4 rounded-2xl border-border shadow-sm flex flex-col gap-0.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Labor Cost</span>
            <span className="text-xl font-extrabold text-foreground">{fmt$(totals.laborCost)}</span>
          </Card>
          <Card className="p-4 rounded-2xl border-border shadow-sm flex flex-col gap-0.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Avg Margin</span>
            <span className={`text-xl font-extrabold ${marginColor(totals.margin)}`}>{totals.margin.toFixed(1)}%</span>
          </Card>
        </div>
      )}

      {/* Jobs table */}
      {loading ? (
        <p className="text-sm text-muted-foreground text-center py-8">Loading…</p>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center rounded-2xl border border-dashed border-border">
          <span className="material-symbols-outlined text-[48px] text-muted-foreground/30">bar_chart</span>
          <p className="text-sm font-semibold text-muted-foreground">No completed jobs in this period</p>
          <p className="text-xs text-muted-foreground/60">Profitability data will appear as jobs are marked complete</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">By Job</h3>
          <Card className="rounded-2xl border-border shadow-sm overflow-hidden">
            {/* Header row */}
            <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 px-4 py-2.5 border-b border-border bg-muted/30">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Client</span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground text-right w-16">Revenue</span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground text-right w-14">Profit</span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground text-right w-12">Margin</span>
            </div>

            {rows.map((row, i) => (
              <div
                key={row.id}
                className={`grid grid-cols-[1fr_auto_auto_auto] gap-2 px-4 py-3.5 items-center ${i < rows.length - 1 ? "border-b border-border/40" : ""}`}
              >
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-bold text-foreground truncate">{row.clientName}</span>
                  <span className="text-[11px] text-muted-foreground">
                    {new Date(row.completedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    {row.laborCost > 0 && ` · ${fmt$(row.laborCost)} labor`}
                    {row.expenses > 0 && ` · ${fmt$(row.expenses)} exp`}
                  </span>
                </div>
                <span className="text-sm font-bold text-foreground text-right w-16">{fmt$(row.revenue)}</span>
                <span className={`text-sm font-bold text-right w-14 ${row.profit >= 0 ? "text-green-600" : "text-red-500"}`}>
                  {fmt$(row.profit)}
                </span>
                <span className={`text-sm font-bold text-right w-12 ${marginColor(row.margin)}`}>
                  {row.margin.toFixed(0)}%
                </span>
              </div>
            ))}
          </Card>
        </div>
      )}
    </div>
  );
}
