"use client";

import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { formatCurrencyRounded } from "@/lib/currency";
import { CHART_COLORS } from "@/lib/status-colors";

// ─── Types ────────────────────────────────────────────────────────────────────

type TimeFilter = "week" | "month" | "year" | "all";

type Job = {
  id: string;
  status: string;
  total: number;
  scheduled_at: string | null;
  clients: { name: string } | null;
};

type TimeEntry = {
  clocked_in_at: string;
  clocked_out_at: string | null;
  odometer_start: number | null;
  odometer_end: number | null;
};

type Payment = {
  amount: number;
  method: string;
  status: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getRange(filter: TimeFilter): { start: Date; end: Date } | null {
  if (filter === "all") return null;
  const now = new Date();
  const start = new Date(now);
  if (filter === "week") {
    const day = now.getDay();
    start.setDate(now.getDate() - day);
  } else if (filter === "month") {
    start.setDate(1);
  } else if (filter === "year") {
    start.setMonth(0, 1);
  }
  start.setHours(0, 0, 0, 0);
  return { start, end: now };
}

function inRange(dateStr: string | null, range: { start: Date; end: Date } | null): boolean {
  if (!dateStr) return false;
  if (!range) return true;
  const t = new Date(dateStr).getTime();
  return t >= range.start.getTime() && t <= range.end.getTime();
}

function hoursFromEntries(entries: TimeEntry[]): number {
  return entries.reduce((sum, e) => {
    if (!e.clocked_out_at) return sum;
    const ms = new Date(e.clocked_out_at).getTime() - new Date(e.clocked_in_at).getTime();
    return sum + ms / 3_600_000;
  }, 0);
}

function milesFromEntries(entries: TimeEntry[]): number {
  return entries.reduce((sum, e) => {
    if (e.odometer_end == null || e.odometer_start == null) return sum;
    const diff = e.odometer_end - e.odometer_start;
    return sum + (diff > 0 ? diff : 0);
  }, 0);
}

function fmtHours(h: number): string {
  if (h < 1) return `${Math.round(h * 60)}m`;
  return `${h.toFixed(1)}h`;
}

function fmtDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString([], { month: "short", day: "numeric" });
}

type ChartBucket = { label: string; earnings: number; commission: number };

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function buildChartData(jobs: Job[], filter: TimeFilter, commissionRate: number): ChartBucket[] {
  const completed = jobs.filter((j) => j.status === "completed" && j.scheduled_at);
  const now = new Date();

  if (filter === "week") {
    const buckets: ChartBucket[] = DAY_LABELS.map((label) => ({ label, earnings: 0, commission: 0 }));
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    weekStart.setHours(0, 0, 0, 0);
    for (const job of completed) {
      const d = new Date(job.scheduled_at!);
      if (d >= weekStart && d <= now) {
        const idx = d.getDay();
        buckets[idx].earnings += job.total ?? 0;
      }
    }
    buckets.forEach((b) => { b.commission = b.earnings * commissionRate / 100; });
    return buckets;
  }

  if (filter === "month") {
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const weekCount = Math.ceil(daysInMonth / 7);
    const buckets: ChartBucket[] = Array.from({ length: weekCount }, (_, i) => ({
      label: `Wk ${i + 1}`,
      earnings: 0,
      commission: 0,
    }));
    for (const job of completed) {
      const d = new Date(job.scheduled_at!);
      if (d >= monthStart && d <= now) {
        const dayOfMonth = d.getDate() - 1;
        const weekIdx = Math.min(Math.floor(dayOfMonth / 7), weekCount - 1);
        buckets[weekIdx].earnings += job.total ?? 0;
      }
    }
    buckets.forEach((b) => { b.commission = b.earnings * commissionRate / 100; });
    return buckets;
  }

  // year or all — group by month
  const buckets: ChartBucket[] = MONTH_LABELS.map((label) => ({ label, earnings: 0, commission: 0 }));
  const yearStart = filter === "year" ? new Date(now.getFullYear(), 0, 1) : new Date(0);
  for (const job of completed) {
    const d = new Date(job.scheduled_at!);
    if (d >= yearStart && d <= now) {
      buckets[d.getMonth()].earnings += job.total ?? 0;
    }
  }
  buckets.forEach((b) => { b.commission = b.earnings * commissionRate / 100; });
  return filter === "year" ? buckets : buckets.filter((b) => b.earnings > 0);
}

// ─── KPI Card ────────────────────────────────────────────────────────────────

function KpiCard({ icon, label, value, sub }: { icon: string; label: string; value: string; sub?: string }) {
  return (
    <Card className="rounded-2xl p-4 flex flex-col gap-1">
      <div className="flex items-center gap-2 mb-1">
        <span
          className="material-symbols-outlined text-[20px] text-primary"
          style={{ fontVariationSettings: "'FILL' 1" }}
        >
          {icon}
        </span>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</p>
      </div>
      <p className="text-2xl font-black text-foreground leading-none">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function EmployeeAnalyticsPage() {
  const [filter, setFilter] = useState<TimeFilter>("month");
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [commissionRate, setCommissionRate] = useState(5);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: member } = await supabase
        .from("team_members")
        .select("id, businesses(commission_rate)")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .single();
      if (!member) return;

      const rawBiz = (member as unknown as { businesses: { commission_rate: number } | { commission_rate: number }[] | null }).businesses;
      const biz = Array.isArray(rawBiz) ? rawBiz[0] ?? null : rawBiz;
      if (biz?.commission_rate) setCommissionRate(Number(biz.commission_rate));

      const [{ data: jobsData }, { data: entriesData }, { data: paymentsData }] = await Promise.all([
        supabase
          .from("jobs")
          .select("id, status, total, scheduled_at, clients(name)")
          .eq("assigned_member_id", member.id)
          .order("scheduled_at", { ascending: false }),
        supabase
          .from("time_entries")
          .select("clocked_in_at, clocked_out_at, odometer_start, odometer_end")
          .eq("employee_id", member.id),
        supabase
          .from("payments")
          .select("amount, method, status, job_id")
          .in("job_id", []),  // populated after jobs load
      ]);

      setJobs((jobsData as unknown as Job[]) ?? []);
      setTimeEntries(entriesData ?? []);

      // Re-fetch payments scoped to this employee's jobs
      if (jobsData && jobsData.length > 0) {
        const jobIds = jobsData.map((j: { id: string }) => j.id);
        const { data: pData } = await supabase
          .from("payments")
          .select("amount, method, status")
          .in("job_id", jobIds);
        setPayments(pData ?? []);
      }

      setLoading(false);
    }
    load();
  }, []);

  const range = getRange(filter);

  const filteredJobs = jobs.filter((j) => inRange(j.scheduled_at, range));
  const completedJobs = filteredJobs.filter((j) => j.status === "completed");
  const scheduledJobs = filteredJobs.filter((j) => j.status === "scheduled");
  const inProgressJobs = filteredJobs.filter((j) => j.status === "in_progress");

  const filteredEntries = timeEntries.filter((e) => inRange(e.clocked_in_at, range));
  const hoursWorked = hoursFromEntries(filteredEntries);
  const milesDriven = milesFromEntries(filteredEntries);

  const revenueGenerated = completedJobs.reduce((sum, j) => sum + (j.total ?? 0), 0);

  const paidPayments = payments.filter((p) => p.status === "paid");
  const tipsCollected = paidPayments
    .filter((p) => p.method === "tip")
    .reduce((sum, p) => sum + p.amount, 0);

  const FILTER_TABS: { label: string; value: TimeFilter }[] = [
    { label: "This Week", value: "week" },
    { label: "This Month", value: "month" },
    { label: "This Year", value: "year" },
    { label: "All Time", value: "all" },
  ];

  const recentCompleted = jobs
    .filter((j) => j.status === "completed")
    .slice(0, 10);

  return (
    <div className="flex flex-col gap-5 px-4 lg:px-8 py-6 max-w-xl mx-auto lg:max-w-2xl pb-32 lg:pb-8">

      {/* Header */}
      <div>
        <p className="font-black text-xl text-foreground">My Stats</p>
        <p className="text-sm text-muted-foreground mt-0.5">Your personal performance snapshot</p>
      </div>

      {/* Time filter */}
      <div className="flex gap-2 overflow-x-auto pb-0.5 -mx-4 px-4 lg:mx-0 lg:px-0">
        {FILTER_TABS.map(({ label, value }) => (
          <button
            key={value}
            onClick={() => setFilter(value)}
            className={`shrink-0 px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
              filter === value
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex flex-col gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 rounded-2xl bg-muted/50 animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          {/* KPI grid */}
          <div className="grid grid-cols-2 gap-3">
            <KpiCard
              icon="check_circle"
              label="Jobs Done"
              value={String(completedJobs.length)}
              sub={`${scheduledJobs.length + inProgressJobs.length} upcoming`}
            />
            <KpiCard
              icon="payments"
              label="Revenue"
              value={revenueGenerated > 0 ? formatCurrencyRounded(revenueGenerated) : "$0"}
              sub="from completed jobs"
            />
            <KpiCard
              icon="schedule"
              label="Hours Worked"
              value={hoursWorked > 0 ? fmtHours(hoursWorked) : "—"}
              sub={hoursWorked > 0 ? "clocked time" : "no clock data"}
            />
            {milesDriven > 0 ? (
              <KpiCard
                icon="directions_car"
                label="Miles Driven"
                value={`${Math.round(milesDriven)} mi`}
                sub="odometer readings"
              />
            ) : (
              <KpiCard
                icon="star"
                label="Tips Earned"
                value={tipsCollected > 0 ? formatCurrencyRounded(tipsCollected) : "$0"}
                sub="from clients"
              />
            )}
          </div>

          {/* Charts */}
          {(() => {
            const chartData = buildChartData(filteredJobs, filter, commissionRate);
            const tooltipStyle = {
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              fontSize: 12,
              color: "var(--foreground)",
              boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
            };
            return (
              <>
                <Card className="rounded-2xl overflow-hidden">
                  <div className="p-4 border-b border-border/50">
                    <p className="font-bold text-sm text-foreground">Earnings</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Revenue from your completed jobs</p>
                  </div>
                  <div className="p-4 h-44">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                        <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} width={40} />
                        <Tooltip
                          formatter={(v: unknown) => [formatCurrencyRounded(v as number), "Earnings"]}
                          contentStyle={tooltipStyle}
                          cursor={{ fill: "rgba(0,0,0,0.04)" }}
                        />
                        <Bar dataKey="earnings" fill={CHART_COLORS.blue} radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>

                <Card className="rounded-2xl overflow-hidden">
                  <div className="p-4 border-b border-border/50">
                    <p className="font-bold text-sm text-foreground">Commission Earned</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{commissionRate}% of your earnings</p>
                  </div>
                  <div className="p-4 h-44">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                        <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} width={40} />
                        <Tooltip
                          formatter={(v: unknown) => [formatCurrencyRounded(v as number), "Commission"]}
                          contentStyle={tooltipStyle}
                          cursor={{ fill: "rgba(0,0,0,0.04)" }}
                        />
                        <Bar dataKey="commission" fill={CHART_COLORS.green} radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              </>
            );
          })()}

          {/* Avg job value */}
          {completedJobs.length > 0 && (
            <Card className="rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Avg Job Value</p>
                  <p className="text-2xl font-black text-foreground mt-0.5">
                    {formatCurrencyRounded(revenueGenerated / completedJobs.length)}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1 text-xs text-muted-foreground">
                  <span>{completedJobs.length} jobs completed</span>
                  {hoursWorked > 0 && (
                    <span>
                      {formatCurrencyRounded(revenueGenerated / hoursWorked)}/hr revenue rate
                    </span>
                  )}
                </div>
              </div>
            </Card>
          )}

          {/* Job status breakdown */}
          {filteredJobs.length > 0 && (
            <Card className="rounded-2xl overflow-hidden">
              <div className="p-4 border-b border-border/50">
                <p className="font-bold text-sm text-foreground">Job Breakdown</p>
                <p className="text-xs text-muted-foreground mt-0.5">{filteredJobs.length} total in period</p>
              </div>
              <div className="p-4 flex flex-col gap-2">
                {[
                  { label: "Completed",   count: completedJobs.length,                                   color: "bg-green-500" },
                  { label: "Scheduled",   count: scheduledJobs.length,                                   color: "bg-blue-500" },
                  { label: "In Progress", count: inProgressJobs.length,                                   color: "bg-orange-500" },
                  { label: "Cancelled",   count: filteredJobs.filter((j) => j.status === "cancelled").length, color: "bg-muted-foreground" },
                ]
                  .filter((row) => row.count > 0)
                  .map(({ label, count, color }) => {
                    const pct = Math.round((count / filteredJobs.length) * 100);
                    return (
                      <div key={label} className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full shrink-0 ${color}`} />
                        <div className="flex-1">
                          <div className="flex justify-between text-xs mb-1">
                            <span className="font-medium text-foreground">{label}</span>
                            <span className="text-muted-foreground">{count} ({pct}%)</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                            <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </Card>
          )}

          {/* Recent completed jobs */}
          {recentCompleted.length > 0 && (
            <Card className="rounded-2xl overflow-hidden">
              <div className="p-4 border-b border-border/50">
                <p className="font-bold text-sm text-foreground">Recent Completed Jobs</p>
                <p className="text-xs text-muted-foreground mt-0.5">Latest {recentCompleted.length} finished</p>
              </div>
              <div className="divide-y divide-border/40">
                {recentCompleted.map((job) => (
                  <div key={job.id} className="flex items-center justify-between px-4 py-3 gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {job.clients?.name ?? "Unknown client"}
                      </p>
                      <p className="text-xs text-muted-foreground">{fmtDate(job.scheduled_at)}</p>
                    </div>
                    <p className="text-sm font-bold text-foreground shrink-0">
                      {formatCurrencyRounded(job.total)}
                    </p>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Empty state */}
          {filteredJobs.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-3 py-16">
              <span
                className="material-symbols-outlined text-[48px] text-muted-foreground/30"
                style={{ fontVariationSettings: "'FILL' 0" }}
              >
                leaderboard
              </span>
              <p className="text-sm text-muted-foreground text-center">No jobs found for this period</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
