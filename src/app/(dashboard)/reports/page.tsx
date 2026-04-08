"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";

type ReportJob = {
  id: string;
  status: string;
  total: number;
  created_at: string;
  scheduled_at: string | null;
  clients: { name: string } | null;
  payments: { status: string }[];
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function monthKey(dateStr: string) {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string) {
  const [, m] = key.split("-");
  return MONTHS[parseInt(m) - 1];
}

export default function ReportsPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<ReportJob[]>([]);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<"month" | "quarter" | "year">("month");

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: business } = await supabase
        .from("businesses")
        .select("id")
        .eq("owner_id", user.id)
        .single();
      if (!business) return;

      const [{ data }, { data: expData }] = await Promise.all([
        supabase
          .from("jobs")
          .select("id, status, total, created_at, scheduled_at, clients(name), payments(status)")
          .eq("business_id", business.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("expenses")
          .select("amount")
          .eq("business_id", business.id),
      ]);

      setJobs((data as unknown as ReportJob[]) ?? []);
      const expTotal = ((expData ?? []) as { amount: number }[]).reduce((s, e) => s + e.amount, 0);
      setTotalExpenses(expTotal);
      setLoading(false);
    }
    load();
  }, []);

  const stats = useMemo(() => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    const isPaid = (j: ReportJob) => j.payments?.some((p) => p.status === "paid");

    const thisMonthJobs = jobs.filter((j) => new Date(j.created_at) >= startOfMonth);
    const lastMonthJobs = jobs.filter((j) => {
      const d = new Date(j.created_at);
      return d >= startOfLastMonth && d <= endOfLastMonth;
    });

    const thisMonthRevenue = thisMonthJobs.filter(isPaid).reduce((s, j) => s + j.total, 0);
    const lastMonthRevenue = lastMonthJobs.filter(isPaid).reduce((s, j) => s + j.total, 0);
    const revenueChange = lastMonthRevenue > 0 ? ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100 : 0;

    const totalRevenue = jobs.filter(isPaid).reduce((s, j) => s + j.total, 0);
    const completedJobs = jobs.filter((j) => j.status === "completed");
    const avgJobValue = completedJobs.length > 0 ? completedJobs.reduce((s, j) => s + j.total, 0) / completedJobs.length : 0;

    const outstanding = jobs
      .filter((j) => j.status === "completed" && !isPaid(j))
      .reduce((s, j) => s + j.total, 0);

    return { thisMonthRevenue, lastMonthRevenue, revenueChange, totalRevenue, avgJobValue, outstanding };
  }, [jobs]);

  const monthlyRevenue = useMemo(() => {
    const months: string[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }

    const isPaid = (j: ReportJob) => j.payments?.some((p) => p.status === "paid");

    return months.map((key) => {
      const [yr, mo] = key.split("-").map(Number);
      const monthJobs = jobs.filter((j) => {
        const d = new Date(j.created_at);
        return d.getFullYear() === yr && d.getMonth() + 1 === mo;
      });
      const revenue = monthJobs.filter(isPaid).reduce((s, j) => s + j.total, 0);
      const jobCount = monthJobs.length;
      return { key, label: monthLabel(key), revenue, jobCount };
    });
  }, [jobs]);

  const topClients = useMemo(() => {
    const isPaid = (j: ReportJob) => j.payments?.some((p) => p.status === "paid");
    const map: Record<string, { name: string; revenue: number; jobs: number }> = {};
    for (const j of jobs.filter(isPaid)) {
      const name = j.clients?.name ?? "Unknown";
      if (!map[name]) map[name] = { name, revenue: 0, jobs: 0 };
      map[name].revenue += j.total;
      map[name].jobs += 1;
    }
    return Object.values(map).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  }, [jobs]);

  const pipeline = useMemo(() => ({
    scheduled: jobs.filter((j) => j.status === "scheduled").length,
    in_progress: jobs.filter((j) => j.status === "in_progress").length,
    completed: jobs.filter((j) => j.status === "completed").length,
    cancelled: jobs.filter((j) => j.status === "cancelled").length,
  }), [jobs]);

  const maxRevenue = Math.max(...monthlyRevenue.map((m) => m.revenue), 1);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-sm text-muted-foreground">Loading reports…</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 px-4 py-6 max-w-xl mx-auto pb-32">
      <div className="flex items-start justify-between mb-2">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground">Reports</h1>
          <p className="text-sm text-muted-foreground">Revenue & performance analytics.</p>
        </div>
        <button
          onClick={() => router.push("/reports/payroll")}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary/10 text-primary text-xs font-bold hover:bg-primary/20 transition-colors"
        >
          <span className="material-symbols-outlined text-[15px]">badge</span>
          Payroll
        </button>
      </div>

      {/* Top stats */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4 rounded-2xl border-border shadow-sm flex flex-col gap-1 col-span-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">This Month</span>
            {stats.revenueChange !== 0 && (
              <Badge
                variant="secondary"
                className={`border-0 text-[10px] font-bold ${stats.revenueChange > 0 ? "icon-green " : "bg-red-100 text-red-600"}`}
              >
                {stats.revenueChange > 0 ? "↑" : "↓"} {Math.abs(stats.revenueChange).toFixed(0)}% vs last month
              </Badge>
            )}
          </div>
          <span className="text-3xl font-extrabold text-[var(--color-status-completed)] tracking-tight">
            ${stats.thisMonthRevenue.toLocaleString("en-US", { maximumFractionDigits: 0 })}
          </span>
          <span className="text-xs text-muted-foreground">
            Last month: ${stats.lastMonthRevenue.toLocaleString("en-US", { maximumFractionDigits: 0 })}
          </span>
        </Card>

        <Card className="p-4 rounded-2xl border-border shadow-sm flex flex-col gap-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">All-Time</span>
          <span className="text-xl font-extrabold text-foreground tracking-tight">
            ${stats.totalRevenue.toLocaleString("en-US", { maximumFractionDigits: 0 })}
          </span>
          <span className="text-[10px] text-muted-foreground">paid revenue</span>
        </Card>

        <Card className="p-4 rounded-2xl border-border shadow-sm flex flex-col gap-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Avg Job</span>
          <span className="text-xl font-extrabold text-foreground tracking-tight">
            ${stats.avgJobValue.toLocaleString("en-US", { maximumFractionDigits: 0 })}
          </span>
          <span className="text-[10px] text-muted-foreground">per job</span>
        </Card>

        {stats.outstanding > 0 && (
          <Card className="p-4 rounded-2xl border-[var(--color-status-in-progress)]/20 bg-status-in-progress/10 shadow-sm flex flex-col gap-1 col-span-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-status-in-progress)]">Outstanding</span>
            <span className="text-xl font-extrabold text-[var(--color-status-in-progress)] tracking-tight">
              ${stats.outstanding.toLocaleString("en-US", { maximumFractionDigits: 0 })}
            </span>
            <span className="text-[10px] text-muted-foreground">uncollected from completed jobs</span>
          </Card>
        )}

        {totalExpenses > 0 && (
          <>
            <Card className="p-4 rounded-2xl border-border shadow-sm flex flex-col gap-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Total Expenses</span>
              <span className="text-xl font-extrabold text-[var(--color-status-in-progress)] tracking-tight">
                ${totalExpenses.toLocaleString("en-US", { maximumFractionDigits: 0 })}
              </span>
              <span className="text-[10px] text-muted-foreground">all logged costs</span>
            </Card>
            <Card className="p-4 rounded-2xl border-border shadow-sm flex flex-col gap-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Net Profit</span>
              <span className={`text-xl font-extrabold tracking-tight ${stats.totalRevenue - totalExpenses >= 0 ? "text-[var(--color-status-completed)]" : "text-destructive"}`}>
                ${(stats.totalRevenue - totalExpenses).toLocaleString("en-US", { maximumFractionDigits: 0 })}
              </span>
              <span className="text-[10px] text-muted-foreground">revenue minus expenses</span>
            </Card>
          </>
        )}
      </div>

      {/* Revenue trend chart */}
      <Card className="rounded-2xl border-border shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border/50">
          <p className="font-bold text-sm text-foreground">Revenue Trend</p>
          <p className="text-xs text-muted-foreground mt-0.5">Last 6 months · paid jobs</p>
        </div>
        <div className="p-4">
          <div className="flex items-end gap-2 h-32">
            {monthlyRevenue.map((m) => (
              <div key={m.key} className="flex flex-col items-center gap-1.5 flex-1">
                <span className="text-[9px] font-bold text-muted-foreground">
                  {m.revenue > 0 ? `$${(m.revenue / 1000).toFixed(m.revenue >= 1000 ? 1 : 0)}${m.revenue >= 1000 ? "k" : ""}` : ""}
                </span>
                <div className="w-full flex flex-col justify-end" style={{ height: 80 }}>
                  <div
                    className="w-full rounded-t-lg transition-all"
                    style={{
                      height: `${Math.max((m.revenue / maxRevenue) * 100, m.revenue > 0 ? 4 : 0)}%`,
                      minHeight: m.revenue > 0 ? 4 : 0,
                      background: m.key === monthKey(new Date().toISOString()) ? "#007AFF" : "#007AFF/60",
                      backgroundColor: m.key === monthKey(new Date().toISOString()) ? "#007AFF" : "#93c5fd",
                    }}
                  />
                </div>
                <span className="text-[9px] font-bold text-muted-foreground uppercase">{m.label}</span>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Pipeline */}
      <Card className="rounded-2xl border-border shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border/50">
          <p className="font-bold text-sm text-foreground">Job Pipeline</p>
          <p className="text-xs text-muted-foreground mt-0.5">All-time breakdown by status</p>
        </div>
        <div className="p-4 grid grid-cols-4 gap-3">
          {([
            { label: "Scheduled", count: pipeline.scheduled, color: "#007AFF" },
            { label: "In Progress", count: pipeline.in_progress, color: "#ea580c" },
            { label: "Completed", count: pipeline.completed, color: "#16a34a" },
            { label: "Cancelled", count: pipeline.cancelled, color: "#6b7280" },
          ]).map((s) => (
            <div key={s.label} className="flex flex-col items-center gap-1 text-center">
              <span className="text-2xl font-extrabold" style={{ color: s.color }}>{s.count}</span>
              <span className="text-[9px] font-bold text-muted-foreground uppercase leading-tight">{s.label}</span>
            </div>
          ))}
        </div>
        {/* Progress bar */}
        <div className="px-4 pb-4">
          <div className="flex rounded-full overflow-hidden h-2">
            {([
              { count: pipeline.scheduled, color: "#007AFF" },
              { count: pipeline.in_progress, color: "#ea580c" },
              { count: pipeline.completed, color: "#16a34a" },
              { count: pipeline.cancelled, color: "#6b7280" },
            ]).map((s, i) => {
              const total = Object.values(pipeline).reduce((a, b) => a + b, 0);
              const pct = total > 0 ? (s.count / total) * 100 : 0;
              return pct > 0 ? (
                <div key={i} style={{ width: `${pct}%`, backgroundColor: s.color }} />
              ) : null;
            })}
          </div>
        </div>
      </Card>

      {/* Top Clients */}
      {topClients.length > 0 && (
        <Card className="rounded-2xl border-border shadow-sm overflow-hidden">
          <div className="p-4 border-b border-border/50">
            <p className="font-bold text-sm text-foreground">Top Clients</p>
            <p className="text-xs text-muted-foreground mt-0.5">By paid revenue</p>
          </div>
          <div className="flex flex-col divide-y divide-border/40">
            {topClients.map((client, i) => {
              const maxClientRevenue = topClients[0].revenue;
              return (
                <div key={client.name} className="px-4 py-3 flex items-center gap-3">
                  <span className="text-sm font-extrabold text-muted-foreground w-5 text-center">{i + 1}</span>
                  <div className="flex flex-col flex-1 min-w-0 gap-1">
                    <span className="font-bold text-sm text-foreground truncate">{client.name}</span>
                    <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${(client.revenue / maxClientRevenue) * 100}%` }}
                      />
                    </div>
                  </div>
                  <div className="flex flex-col items-end shrink-0">
                    <span className="font-extrabold text-sm text-foreground">
                      ${client.revenue.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                    </span>
                    <span className="text-[10px] text-muted-foreground">{client.jobs} job{client.jobs !== 1 ? "s" : ""}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {jobs.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <span className="material-symbols-outlined text-[56px] text-muted-foreground/30">bar_chart</span>
          <p className="text-sm font-medium text-muted-foreground">No data yet</p>
          <p className="text-xs text-muted-foreground/60">Reports will appear as you complete jobs</p>
        </div>
      )}
    </div>
  );
}
