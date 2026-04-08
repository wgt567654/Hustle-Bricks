"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getBusinessId } from "@/lib/supabase/get-business";

import { SalesDashboardSkeleton } from "@/components/sales-dashboard/SalesDashboardSkeleton";
import { KpiCards, type KpiData } from "@/components/sales-dashboard/KpiCards";
import { RevenueTrendChart, type MonthDataPoint } from "@/components/sales-dashboard/RevenueTrendChart";
import { SalesPipelineCard, type PipelineStage } from "@/components/sales-dashboard/SalesPipelineCard";
import { SalesRepsTable, type SalesRep } from "@/components/sales-dashboard/SalesRepsTable";
import { ProductBreakdownChart, type ProductDataPoint } from "@/components/sales-dashboard/ProductBreakdownChart";
import { ActivityMetrics } from "@/components/sales-dashboard/ActivityMetrics";
import { ForecastCard } from "@/components/sales-dashboard/ForecastCard";

// ─── Types ────────────────────────────────────────────────────────────────────

type SalesDashJob = {
  id: string;
  status: string;
  total: number;
  created_at: string;
  payments: { status: string }[];
};

type SalesDashQuote = {
  id: string;
  status: "draft" | "sent" | "accepted" | "declined";
  total: number;
  created_at: string;
};

type SalesDashMember = {
  id: string;
  name: string;
  role: string;
};

// ─── Mock / sample constants ──────────────────────────────────────────────────

// Cycled over real team members — replace with real quota data when available
const MOCK_QUOTAS = [8000, 6000, 4500];

// Revenue by service category — sample data (no category field on jobs table yet)
const MOCK_PRODUCT_DATA: ProductDataPoint[] = [
  { category: "Window Cleaning",  revenue: 4200 },
  { category: "Gutter Cleaning",  revenue: 3100 },
  { category: "Pressure Washing", revenue: 2600 },
  { category: "Deep Cleaning",    revenue: 1800 },
  { category: "Other",            revenue: 900  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MONTH_LABELS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

/** Returns true if any payment on the job has status "paid" */
function isPaid(job: SalesDashJob) {
  return job.payments.some((p) => p.status === "paid");
}

/** Builds a 12-month revenue series ending at the current month */
function buildMonthlySeries(jobs: SalesDashJob[]): MonthDataPoint[] {
  const now = new Date();
  const points: MonthDataPoint[] = [];

  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = MONTH_LABELS[d.getMonth()];

    const revenue = jobs
      .filter((j) => isPaid(j) && j.created_at.startsWith(key))
      .reduce((s, j) => s + (j.total ?? 0), 0);

    points.push({ month: label, revenue });
  }

  return points;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SalesDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState<SalesDashJob[]>([]);
  const [quotes, setQuotes] = useState<SalesDashQuote[]>([]);
  const [teamMembers, setTeamMembers] = useState<SalesDashMember[]>([]);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const businessId = await getBusinessId(supabase);
      if (!businessId) { setLoading(false); return; }

      const [jobsRes, quotesRes, membersRes] = await Promise.all([
        supabase
          .from("jobs")
          .select("id, status, total, created_at, payments(status)")
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
      ]);

      setJobs((jobsRes.data as SalesDashJob[]) ?? []);
      setQuotes((quotesRes.data as SalesDashQuote[]) ?? []);
      setTeamMembers((membersRes.data as SalesDashMember[]) ?? []);
      setLoading(false);
    }

    load();
  }, []);

  // ── KPI derivations ──────────────────────────────────────────────────────

  const kpiData = useMemo((): KpiData => {
    const now = new Date();
    const curKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevKey = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}`;

    const paidJobs = jobs.filter(isPaid);
    const totalRevenue = paidJobs.reduce((s, j) => s + (j.total ?? 0), 0);

    const currentMonthRev = paidJobs
      .filter((j) => j.created_at.startsWith(curKey))
      .reduce((s, j) => s + j.total, 0);
    const priorMonthRev = paidJobs
      .filter((j) => j.created_at.startsWith(prevKey))
      .reduce((s, j) => s + j.total, 0);
    const revenueGrowthPct = priorMonthRev > 0
      ? ((currentMonthRev - priorMonthRev) / priorMonthRev) * 100
      : 0;

    const accepted = quotes.filter((q) => q.status === "accepted").length;
    const declined = quotes.filter((q) => q.status === "declined").length;
    const conversionRate = accepted + declined > 0
      ? (accepted / (accepted + declined)) * 100
      : 0;

    const avgDealSize = accepted > 0 ? totalRevenue / accepted : 0;

    return { totalRevenue, revenueGrowthPct, dealsClosed: accepted, conversionRate, avgDealSize };
  }, [jobs, quotes]);

  // ── Monthly series ────────────────────────────────────────────────────────

  const monthlyRevenueSeries = useMemo(() => buildMonthlySeries(jobs), [jobs]);

  // ── Pipeline stages ───────────────────────────────────────────────────────

  const pipelineStages = useMemo((): PipelineStage[] => {
    function stageData(filter: (q: SalesDashQuote) => boolean, label: string, color: string): PipelineStage {
      const subset = quotes.filter(filter);
      return {
        label,
        count: subset.length,
        value: subset.reduce((s, q) => s + (q.total ?? 0), 0),
        color,
      };
    }

    return [
      stageData((q) => q.status === "draft",    "Lead",     "#6b7280"),
      stageData((q) => q.status === "sent",      "Proposal", "#007AFF"),
      stageData((q) => q.status === "accepted",  "Closed",   "#16a34a"),
      stageData((q) => q.status === "declined",  "Lost",     "#ef4444"),
    ];
  }, [quotes]);

  // ── Forecast ──────────────────────────────────────────────────────────────

  const forecastData = useMemo(() => {
    const proposalStage = pipelineStages.find((s) => s.label === "Proposal");
    const pipelineValue = proposalStage?.value ?? 0;
    const closeRate = kpiData.conversionRate;
    const forecastedRevenue = pipelineValue * (closeRate / 100);
    return { pipelineValue, closeRate, forecastedRevenue };
  }, [pipelineStages, kpiData.conversionRate]);

  // ── Sales reps ────────────────────────────────────────────────────────────

  const salesReps = useMemo((): SalesRep[] => {
    return teamMembers.map((m, i) => ({
      name:   m.name,
      role:   m.role ?? "team member",
      actual: 0,                                         // no per-rep revenue in schema yet
      quota:  MOCK_QUOTAS[i % MOCK_QUOTAS.length],
      deals:  0,
    }));
  }, [teamMembers]);

  // ── Open pipeline KPI patch ───────────────────────────────────────────────
  // The KpiCards component has an "Open Pipeline" slot — pass the value via CSS or
  // as a computed override. For now it reads from the forecast pipelineValue.

  return (
    <div className="flex flex-col gap-6 px-4 py-6 max-w-xl mx-auto pb-32">
      {/* Header */}
      <div className="flex flex-col gap-0.5">
        <h1 className="text-2xl font-extrabold tracking-tight">Sales Dashboard</h1>
        <p className="text-sm text-muted-foreground">Revenue, pipeline, and performance at a glance</p>
      </div>

      {loading ? (
        <SalesDashboardSkeleton />
      ) : (
        <>
          {/* 1 · KPI Cards */}
          <KpiCards data={kpiData} />

          {/* 2 · Revenue Trend Chart */}
          <RevenueTrendChart data={monthlyRevenueSeries} />

          {/* 3 · Sales Pipeline */}
          <SalesPipelineCard stages={pipelineStages} />

          {/* 4 · Forecast */}
          <ForecastCard
            pipelineValue={forecastData.pipelineValue}
            closeRate={forecastData.closeRate}
            forecastedRevenue={forecastData.forecastedRevenue}
          />

          {/* 5 · Sales Reps */}
          <SalesRepsTable reps={salesReps} />

          {/* 6 · Product Breakdown (sample) */}
          <ProductBreakdownChart data={MOCK_PRODUCT_DATA} />

          {/* 7 · Activity Metrics (sample) */}
          <ActivityMetrics />
        </>
      )}
    </div>
  );
}
