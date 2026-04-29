"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { getBusinessId } from "@/lib/supabase/get-business";
import { formatCurrencyRounded } from "@/lib/currency";

import {
  AnalyticsTimeFilter,
  type DateFilter,
  getPresetRange,
} from "@/components/analytics/AnalyticsTimeFilter";
import { AnalyticsSkeleton } from "@/components/analytics/AnalyticsSkeleton";
import { RevenueHeroCard, type RevenueDataPoint } from "@/components/analytics/RevenueHeroCard";
import { TopRepsDonut, type RepRevenue } from "@/components/analytics/TopRepsDonut";
import { RevenueBreakdownDonut, type BreakdownEntry } from "@/components/analytics/RevenueBreakdownDonut";
import { GoalBarChart, type GoalDataPoint } from "@/components/analytics/GoalBarChart";
import { MrrChart, type ServicePlan } from "@/components/analytics/MrrChart";
import { CustomersOverTimeChart, type CustomerDataPoint } from "@/components/analytics/CustomersOverTimeChart";
import { SalesPipelineCard, type PipelineStage } from "@/components/sales-dashboard/SalesPipelineCard";
import { ForecastCard } from "@/components/sales-dashboard/ForecastCard";

// ─── Types ────────────────────────────────────────────────────────────────────

type Job = {
  id: string;
  status: string;
  total: number;
  created_at: string;
  service_type: string | null;
  assigned_member_id: string | null;
  clients: { name: string; lead_source: string | null } | null;
  payments: { status: string }[];
};

type Quote = {
  id: string;
  status: "draft" | "sent" | "accepted" | "declined";
  total: number;
  created_at: string;
};

type Member = {
  id: string;
  name: string;
  role: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isPaid(job: Job) {
  return job.payments.some((p) => p.status === "paid");
}

function inRange(dateStr: string, start: Date, end: Date): boolean {
  const t = new Date(dateStr).getTime();
  return t >= start.getTime() && t <= end.getTime();
}

const MONTH_LABELS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DAY_LABELS   = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

function buildSeries(paidJobs: Job[], filter: DateFilter): RevenueDataPoint[] {
  if (isNaN(filter.start.getTime()) || isNaN(filter.end.getTime())) return [];

  const spanDays = Math.round((filter.end.getTime() - filter.start.getTime()) / (1000 * 60 * 60 * 24));

  if (filter.preset === "week") {
    const buckets: RevenueDataPoint[] = DAY_LABELS.map((label) => ({ label, revenue: 0 }));
    for (const j of paidJobs) {
      const dow = (new Date(j.created_at).getDay() + 6) % 7;
      buckets[dow].revenue += j.total;
    }
    return buckets;
  }

  if (filter.preset === "month") {
    const buckets: RevenueDataPoint[] = [];
    const monthStart = new Date(filter.start.getFullYear(), filter.start.getMonth(), 1);
    for (let w = 0; w < 5; w++) {
      const weekStart = new Date(monthStart);
      weekStart.setDate(1 + w * 7);
      if (weekStart > filter.end) break;
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);
      const revenue = paidJobs
        .filter((j) => inRange(j.created_at, weekStart, weekEnd))
        .reduce((s, j) => s + j.total, 0);
      buckets.push({ label: `Wk ${w + 1}`, revenue });
    }
    return buckets;
  }

  if (filter.preset === "year") {
    const buckets: RevenueDataPoint[] = MONTH_LABELS.map((label) => ({ label, revenue: 0 }));
    for (const j of paidJobs) {
      const month = new Date(j.created_at).getMonth();
      buckets[month].revenue += j.total;
    }
    return buckets;
  }

  // custom — pick granularity by span
  if (spanDays <= 14) {
    const buckets: RevenueDataPoint[] = [];
    for (let i = 0; i <= spanDays; i++) {
      const d = new Date(filter.start);
      d.setDate(filter.start.getDate() + i);
      d.setHours(0, 0, 0, 0);
      const dayEnd = new Date(d);
      dayEnd.setHours(23, 59, 59, 999);
      const revenue = paidJobs
        .filter((j) => inRange(j.created_at, d, dayEnd))
        .reduce((s, j) => s + j.total, 0);
      buckets.push({ label: `${d.getMonth() + 1}/${d.getDate()}`, revenue });
    }
    return buckets;
  }

  if (spanDays <= 90) {
    const buckets: RevenueDataPoint[] = [];
    let weekStart = new Date(filter.start);
    let wNum = 1;
    while (weekStart <= filter.end) {
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);
      const revenue = paidJobs
        .filter((j) => inRange(j.created_at, weekStart, weekEnd))
        .reduce((s, j) => s + j.total, 0);
      buckets.push({ label: `Wk ${wNum}`, revenue });
      weekStart = new Date(weekEnd);
      weekStart.setDate(weekEnd.getDate() + 1);
      weekStart.setHours(0, 0, 0, 0);
      wNum++;
    }
    return buckets;
  }

  const buckets: RevenueDataPoint[] = [];
  let cur = new Date(filter.start.getFullYear(), filter.start.getMonth(), 1);
  while (cur <= filter.end) {
    const monthEnd = new Date(cur.getFullYear(), cur.getMonth() + 1, 0, 23, 59, 59, 999);
    const revenue = paidJobs
      .filter((j) => inRange(j.created_at, cur, monthEnd))
      .reduce((s, j) => s + j.total, 0);
    buckets.push({ label: MONTH_LABELS[cur.getMonth()], revenue });
    cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
  }
  return buckets;
}

function buildPeriodLabel(filter: DateFilter): string {
  if (filter.preset === "week")  return "This Week";
  if (filter.preset === "month") return "This Month";
  if (filter.preset === "year")  return "This Year";
  const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  if (isNaN(filter.start.getTime()) || isNaN(filter.end.getTime())) return "Custom";
  return `${fmt(filter.start)} – ${fmt(filter.end)}`;
}

function buildCustomerSeries(allJobs: Job[], filter: DateFilter): CustomerDataPoint[] {
  if (isNaN(filter.start.getTime()) || isNaN(filter.end.getTime())) return [];

  const spanDays = Math.round((filter.end.getTime() - filter.start.getTime()) / (1000 * 60 * 60 * 24));

  // Earliest job date per client across ALL time
  const clientFirstDate = new Map<string, Date>();
  for (const j of allJobs) {
    const key = j.clients?.name;
    if (!key) continue;
    const d = new Date(j.created_at);
    const existing = clientFirstDate.get(key);
    if (!existing || d < existing) clientFirstDate.set(key, d);
  }

  const inRangeJobs = allJobs.filter((j) => inRange(j.created_at, filter.start, filter.end));

  function countBucket(bucketStart: Date, bucketEnd: Date): { firstTime: number; recurring: number } {
    const seen = new Set<string>();
    let firstTime = 0;
    let recurring = 0;
    for (const j of inRangeJobs) {
      const key = j.clients?.name;
      if (!key) continue;
      const d = new Date(j.created_at);
      if (d < bucketStart || d > bucketEnd || seen.has(key)) continue;
      seen.add(key);
      const first = clientFirstDate.get(key)!;
      if (first >= bucketStart && first <= bucketEnd) firstTime++;
      else recurring++;
    }
    return { firstTime, recurring };
  }

  if (filter.preset === "week") {
    return DAY_LABELS.map((label, i) => {
      const start = new Date(filter.start);
      start.setDate(filter.start.getDate() + i);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setHours(23, 59, 59, 999);
      return { label, ...countBucket(start, end) };
    });
  }

  if (filter.preset === "month") {
    const monthStart = new Date(filter.start.getFullYear(), filter.start.getMonth(), 1);
    const result: CustomerDataPoint[] = [];
    for (let w = 0; w < 5; w++) {
      const weekStart = new Date(monthStart);
      weekStart.setDate(1 + w * 7);
      if (weekStart > filter.end) break;
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);
      result.push({ label: `Wk ${w + 1}`, ...countBucket(weekStart, weekEnd) });
    }
    return result;
  }

  if (filter.preset === "year") {
    return MONTH_LABELS.map((label, i) => {
      const start = new Date(filter.start.getFullYear(), i, 1);
      const end = new Date(filter.start.getFullYear(), i + 1, 0, 23, 59, 59, 999);
      return { label, ...countBucket(start, end) };
    });
  }

  if (spanDays <= 14) {
    const result: CustomerDataPoint[] = [];
    for (let i = 0; i <= spanDays; i++) {
      const d = new Date(filter.start);
      d.setDate(filter.start.getDate() + i);
      d.setHours(0, 0, 0, 0);
      const end = new Date(d);
      end.setHours(23, 59, 59, 999);
      result.push({ label: `${d.getMonth() + 1}/${d.getDate()}`, ...countBucket(d, end) });
    }
    return result;
  }

  if (spanDays <= 90) {
    const result: CustomerDataPoint[] = [];
    let weekStart = new Date(filter.start);
    let wNum = 1;
    while (weekStart <= filter.end) {
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);
      result.push({ label: `Wk ${wNum}`, ...countBucket(weekStart, weekEnd) });
      weekStart = new Date(weekEnd);
      weekStart.setDate(weekEnd.getDate() + 1);
      weekStart.setHours(0, 0, 0, 0);
      wNum++;
    }
    return result;
  }

  const result: CustomerDataPoint[] = [];
  let cur = new Date(filter.start.getFullYear(), filter.start.getMonth(), 1);
  while (cur <= filter.end) {
    const monthEnd = new Date(cur.getFullYear(), cur.getMonth() + 1, 0, 23, 59, 59, 999);
    result.push({ label: MONTH_LABELS[cur.getMonth()], ...countBucket(cur, monthEnd) });
    cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
  }
  return result;
}

function fmtCurrency(v: number, currency = "USD") {
  if (v === 0) return "—";
  return formatCurrencyRounded(v, currency);
}

// ─── Inline KPI mini-card ─────────────────────────────────────────────────────

function KpiMiniCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="rounded-2xl p-3 flex flex-col gap-1">
      <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className="text-lg font-extrabold tracking-tight">{value}</span>
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const router = useRouter();
  const [loading, setLoading]             = useState(true);
  const [currency, setCurrency]           = useState("USD");
  const [jobs, setJobs]                   = useState<Job[]>([]);
  const [quotes, setQuotes]               = useState<Quote[]>([]);
  const [teamMembers, setTeamMembers]     = useState<Member[]>([]);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [plans, setPlans]                 = useState<ServicePlan[]>([]);
  const [goal, setGoal]                   = useState(0);

  const [dateFilter, setDateFilter] = useState<DateFilter>(() => ({
    preset: "month",
    ...getPresetRange("month"),
  }));

  useEffect(() => {
    async function load() {
      const supabase   = createClient();
      const businessId = await getBusinessId(supabase);
      if (!businessId) { setLoading(false); return; }
      const { data: bizData } = await supabase.from("businesses").select("currency").eq("id", businessId).single();
      setCurrency(bizData?.currency ?? "USD");

      const [jobsRes, quotesRes, membersRes, expensesRes, plansRes] = await Promise.all([
        supabase
          .from("jobs")
          .select("id, status, total, created_at, service_type, assigned_member_id, clients(name, lead_source), payments(status)")
          .eq("business_id", businessId),
        supabase
          .from("quotes")
          .select("id, status, total, created_at")
          .eq("business_id", businessId),
        supabase
          .from("team_members")
          .select("id, name, role")
          .eq("business_id", businessId)
          .eq("is_active", true),
        supabase
          .from("expenses")
          .select("amount")
          .eq("business_id", businessId),
        supabase
          .from("service_plans")
          .select("frequency, price, status")
          .eq("business_id", businessId),
      ]);

      setJobs((jobsRes.data as unknown as Job[]) ?? []);
      setQuotes((quotesRes.data as Quote[]) ?? []);
      setTeamMembers((membersRes.data as Member[]) ?? []);
      const expTotal = ((expensesRes.data ?? []) as { amount: number }[]).reduce((s, e) => s + e.amount, 0);
      setTotalExpenses(expTotal);
      // service_plans table may not exist yet — handle gracefully
      if (!plansRes.error) setPlans((plansRes.data as ServicePlan[]) ?? []);

      const savedGoal = localStorage.getItem("hb_monthly_revenue_goal");
      if (savedGoal) setGoal(Number(savedGoal));

      setLoading(false);
    }
    load();
  }, []);

  // ── Filtered subsets ───────────────────────────────────────────────────────

  const filteredJobs = useMemo(() => {
    if (isNaN(dateFilter.start.getTime()) || isNaN(dateFilter.end.getTime())) return [];
    return jobs.filter((j) => inRange(j.created_at, dateFilter.start, dateFilter.end));
  }, [jobs, dateFilter]);

  const filteredQuotes = useMemo(() => {
    if (isNaN(dateFilter.start.getTime()) || isNaN(dateFilter.end.getTime())) return [];
    return quotes.filter((q) => inRange(q.created_at, dateFilter.start, dateFilter.end));
  }, [quotes, dateFilter]);

  const paidJobs = useMemo(() => filteredJobs.filter(isPaid), [filteredJobs]);

  // ── Revenue metrics ────────────────────────────────────────────────────────

  const totalRevenue = useMemo(
    () => paidJobs.reduce((s, j) => s + (j.total ?? 0), 0),
    [paidJobs],
  );

  const growthPct = useMemo(() => {
    if (isNaN(dateFilter.start.getTime()) || isNaN(dateFilter.end.getTime())) return 0;
    const spanMs     = dateFilter.end.getTime() - dateFilter.start.getTime();
    const priorEnd   = new Date(dateFilter.start.getTime() - 1);
    const priorStart = new Date(dateFilter.start.getTime() - spanMs);
    const priorRev   = jobs
      .filter((j) => isPaid(j) && inRange(j.created_at, priorStart, priorEnd))
      .reduce((s, j) => s + j.total, 0);
    if (priorRev === 0) return 0;
    return ((totalRevenue - priorRev) / priorRev) * 100;
  }, [jobs, totalRevenue, dateFilter]);

  const { dealsClosed, conversionRate, avgDealSize } = useMemo(() => {
    const accepted       = filteredQuotes.filter((q) => q.status === "accepted").length;
    const declined       = filteredQuotes.filter((q) => q.status === "declined").length;
    const conversionRate = accepted + declined > 0 ? (accepted / (accepted + declined)) * 100 : 0;
    const avgDealSize    = accepted > 0 ? totalRevenue / accepted : 0;
    return { dealsClosed: accepted, conversionRate, avgDealSize };
  }, [filteredQuotes, totalRevenue]);

  // ── Revenue series ─────────────────────────────────────────────────────────

  const revenueSeries = useMemo(
    () => buildSeries(paidJobs, dateFilter),
    [paidJobs, dateFilter],
  );

  // ── Sales pipeline (quote stages) ─────────────────────────────────────────

  const pipelineStages = useMemo((): PipelineStage[] => {
    function stage(filter: (q: Quote) => boolean, label: string, color: string): PipelineStage {
      const subset = filteredQuotes.filter(filter);
      return { label, count: subset.length, value: subset.reduce((s, q) => s + (q.total ?? 0), 0), color };
    }
    return [
      stage((q) => q.status === "draft",    "Lead",     "#6b7280"),
      stage((q) => q.status === "sent",     "Proposal", "#007AFF"),
      stage((q) => q.status === "accepted", "Closed",   "#16a34a"),
      stage((q) => q.status === "declined", "Lost",     "#ef4444"),
    ];
  }, [filteredQuotes]);

  // ── Forecast ──────────────────────────────────────────────────────────────

  const forecastData = useMemo(() => {
    const proposalStage    = pipelineStages.find((s) => s.label === "Proposal");
    const pipelineValue    = proposalStage?.value ?? 0;
    const closeRate        = conversionRate;
    const forecastedRevenue = pipelineValue * (closeRate / 100);
    return { pipelineValue, closeRate, forecastedRevenue };
  }, [pipelineStages, conversionRate]);

  // ── Outstanding ───────────────────────────────────────────────────────────

  const outstanding = useMemo(() => {
    return filteredJobs
      .filter((j) => j.status === "completed" && !isPaid(j))
      .reduce((s, j) => s + j.total, 0);
  }, [filteredJobs]);

  const netProfit = totalRevenue - totalExpenses;

  // ── Top clients ────────────────────────────────────────────────────────────

  // ── Top reps by revenue from assigned jobs ────────────────────────────────

  const repRevenue = useMemo((): RepRevenue[] => {
    const memberMap = Object.fromEntries(teamMembers.map((m) => [m.id, m.name]));
    const map: Record<string, { name: string; revenue: number }> = {};
    for (const j of paidJobs) {
      if (!j.assigned_member_id) continue;
      const name = memberMap[j.assigned_member_id] ?? "Unknown";
      if (!map[name]) map[name] = { name, revenue: 0 };
      map[name].revenue += j.total;
    }
    return Object.values(map).sort((a, b) => b.revenue - a.revenue);
  }, [paidJobs, teamMembers]);

  // ── Revenue by service type ────────────────────────────────────────────────

  const revenueByService = useMemo((): BreakdownEntry[] => {
    const map: Record<string, number> = {};
    for (const j of paidJobs) {
      const key = j.service_type ?? "Unspecified";
      map[key] = (map[key] ?? 0) + j.total;
    }
    return Object.entries(map)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);
  }, [paidJobs]);

  // ── Revenue by lead source ─────────────────────────────────────────────────

  const revenueBySource = useMemo((): BreakdownEntry[] => {
    const map: Record<string, number> = {};
    for (const j of paidJobs) {
      const key = j.clients?.lead_source ?? "Unspecified";
      map[key] = (map[key] ?? 0) + j.total;
    }
    return Object.entries(map)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);
  }, [paidJobs]);

  // ── Goal series (last 6 months, always from all jobs not filtered) ─────────

  const goalSeries = useMemo((): GoalDataPoint[] => {
    const now = new Date();
    const points: GoalDataPoint[] = [];
    for (let i = 5; i >= 0; i--) {
      const d     = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const start = new Date(d.getFullYear(), d.getMonth(), 1);
      const end   = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
      const actual = jobs
        .filter((j) => isPaid(j) && inRange(j.created_at, start, end))
        .reduce((s, j) => s + j.total, 0);
      points.push({ month: MONTH_LABELS[d.getMonth()], actual });
    }
    return points;
  }, [jobs]);

  // ── Period label ───────────────────────────────────────────────────────────

  const periodLabel = useMemo(() => buildPeriodLabel(dateFilter), [dateFilter]);

  const customerSeries = useMemo(
    () => buildCustomerSeries(jobs, dateFilter),
    [jobs, dateFilter],
  );

  const hasAnyData = jobs.length > 0 || quotes.length > 0;

  return (
    <div className="flex flex-col gap-4 px-4 lg:px-8 py-4 max-w-xl mx-auto lg:max-w-none pb-28 lg:pb-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight">Analytics</h1>
          <p className="text-xs text-muted-foreground">Revenue, pipeline, and performance</p>
        </div>
        <button
          onClick={() => router.push("/reports/payroll")}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary/10 text-primary text-xs font-bold hover:bg-primary/20 transition-colors"
        >
          <span className="material-symbols-outlined text-[15px]">badge</span>
          Payroll
        </button>
      </div>

      {/* Time filter */}
      <AnalyticsTimeFilter filter={dateFilter} onChange={setDateFilter} />

      {loading ? (
        <AnalyticsSkeleton />
      ) : !hasAnyData ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <span
            className="material-symbols-outlined text-[56px] text-muted-foreground/30"
            style={{ fontVariationSettings: "'FILL' 0" }}
          >
            bar_chart
          </span>
          <p className="text-sm font-medium text-muted-foreground">No data yet</p>
          <p className="text-xs text-muted-foreground/60">
            Analytics will appear as you complete jobs and close quotes
          </p>
        </div>
      ) : (
        <>
          {/* 1 · Hero revenue card — full width */}
          <RevenueHeroCard
            totalRevenue={totalRevenue}
            growthPct={growthPct}
            series={revenueSeries}
            period={periodLabel}
          />

          {/* 2–7 · Two-column grid on desktop */}
          <div className="flex flex-col gap-4 lg:grid lg:grid-cols-2 lg:items-start lg:gap-4">

            {/* Left column */}
            <div className="flex flex-col gap-4">
              {/* KPI mini-cards */}
              <div className="grid grid-cols-3 gap-2">
                <KpiMiniCard label="Deals Closed" value={dealsClosed.toString()} />
                <KpiMiniCard label="Avg Deal" value={fmtCurrency(avgDealSize, currency)} />
                <KpiMiniCard label="Conversion" value={conversionRate > 0 ? `${conversionRate.toFixed(0)}%` : "—"} />
              </div>

              {/* Sales Pipeline */}
              <SalesPipelineCard stages={pipelineStages} />

              {/* Top sales reps */}
              <TopRepsDonut reps={repRevenue} currency={currency} />
            </div>

            {/* Right column */}
            <div className="flex flex-col gap-4">
              {/* Forecast */}
              <ForecastCard
                pipelineValue={forecastData.pipelineValue}
                closeRate={forecastData.closeRate}
                forecastedRevenue={forecastData.forecastedRevenue}
              />

              {/* Outstanding + Net Profit */}
              {(outstanding > 0 || totalExpenses > 0) && (
                <div className="grid grid-cols-2 gap-2">
                  {outstanding > 0 && (
                    <Card
                      onClick={() => router.push("/payments")}
                      className="p-3 rounded-2xl border-[var(--color-status-in-progress)]/20 bg-status-in-progress/10 shadow-sm flex flex-col gap-1 cursor-pointer hover:opacity-90 transition-opacity"
                    >
                      <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--color-status-in-progress)]">Outstanding</span>
                      <span className="text-lg font-extrabold text-[var(--color-status-in-progress)] tracking-tight">
                        {formatCurrencyRounded(outstanding, currency)}
                      </span>
                      <span className="text-[9px] text-muted-foreground">uncollected · tap to collect</span>
                    </Card>
                  )}
                  {totalExpenses > 0 && (
                    <Card className="p-3 rounded-2xl shadow-sm flex flex-col gap-1">
                      <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Net Profit</span>
                      <span className={`text-lg font-extrabold tracking-tight ${netProfit >= 0 ? "text-[var(--color-status-completed)]" : "text-destructive"}`}>
                        {formatCurrencyRounded(netProfit, currency)}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {formatCurrencyRounded(totalExpenses, currency)} in expenses
                      </span>
                    </Card>
                  )}
                </div>
              )}

              {/* Revenue breakdown donut */}
              <RevenueBreakdownDonut
                byService={revenueByService}
                bySource={revenueBySource}
                currency={currency}
              />
            </div>

          </div>

          {/* ── Full-width charts below the two-column grid ── */}
          <GoalBarChart
            series={goalSeries}
            goal={goal}
            onGoalChange={setGoal}
            currency={currency}
          />

          <MrrChart plans={plans} currency={currency} />

          <CustomersOverTimeChart series={customerSeries} />
        </>
      )}
    </div>
  );
}
