"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";
import { STATUS_HEX, STATUS_CLASS } from "@/lib/status-colors";
import { formatCurrency, formatCurrencyRounded } from "@/lib/currency";

type JobStatus = "scheduled" | "in_progress" | "completed" | "cancelled";

type Job = {
  id: string;
  status: JobStatus;
  total: number;
  scheduled_at: string | null;
  created_at: string;
  notes: string | null;
  clients: { name: string; address: string | null } | null;
  job_line_items: { description: string }[];
};

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function getTodayLabel() {
  return new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

const STATUS_FILTERS: { label: string; value: JobStatus | "all" }[] = [
  { label: "All", value: "all" },
  { label: "Scheduled", value: "scheduled" },
  { label: "In Progress", value: "in_progress" },
  { label: "Completed", value: "completed" },
];


function formatScheduled(dateStr: string | null) {
  if (!dateStr) return "Unscheduled";
  const d = new Date(dateStr);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  if (d.toDateString() === today.toDateString()) return `Today ${d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
  if (d.toDateString() === tomorrow.toDateString()) return `Tomorrow ${d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
  return d.toLocaleDateString([], { month: "short", day: "numeric" }) + " " + d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export default function JobsPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<JobStatus | "all">("all");
  const [firstName, setFirstName] = useState("");
  const [weekEarnings, setWeekEarnings] = useState(0);
  const [outstandingAmount, setOutstandingAmount] = useState(0);
  const [outstandingCount, setOutstandingCount] = useState(0);
  const [statsLoaded, setStatsLoaded] = useState(false);
  const [currency, setCurrency] = useState("USD");

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const fullName: string = user.user_metadata?.full_name ?? user.email ?? "";
      setFirstName(fullName.split(" ")[0] || "");

      const { data: biz } = await supabase
        .from("businesses")
        .select("id, currency")
        .eq("owner_id", user.id)
        .maybeSingle();
      if (!biz) return;
      const businessId = biz.id;
      setCurrency(biz.currency ?? "USD");

      const now = new Date();
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      startOfWeek.setHours(0, 0, 0, 0);

      const [{ data }, { data: weekPayments }, { data: completedJobs }] = await Promise.all([
        supabase
          .from("jobs")
          .select("id, status, total, scheduled_at, created_at, notes, clients(name, address), job_line_items(description)")
          .eq("business_id", businessId)
          .order("created_at", { ascending: false }),
        supabase.from("payments").select("amount").eq("business_id", businessId)
          .eq("status", "paid").gte("paid_at", startOfWeek.toISOString()),
        supabase.from("jobs").select("id, total, payments(id)")
          .eq("business_id", businessId).eq("status", "completed"),
      ]);

      setJobs((data as unknown as Job[]) ?? []);

      setWeekEarnings((weekPayments ?? []).reduce((s: number, p: { amount: number }) => s + p.amount, 0));
      const unpaid = (completedJobs ?? []).filter(
        (j: { payments: { id: string }[] }) => !j.payments || j.payments.length === 0
      );
      setOutstandingCount(unpaid.length);
      setOutstandingAmount((unpaid as { total: number }[]).reduce((s, j) => s + j.total, 0));
      setStatsLoaded(true);

      setLoading(false);
    }
    load();
  }, []);

  const filtered = activeFilter === "all" ? jobs : jobs.filter((j) => j.status === activeFilter);
  const counts = {
    all: jobs.length,
    scheduled: jobs.filter((j) => j.status === "scheduled").length,
    in_progress: jobs.filter((j) => j.status === "in_progress").length,
    completed: jobs.filter((j) => j.status === "completed").length,
  };


  return (
    <div className="flex flex-col gap-4 px-4 lg:px-8 py-6 max-w-xl mx-auto lg:max-w-none pb-40 lg:pb-8">
      {/* Greeting + compact stats */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-0.5">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{getTodayLabel()}</p>
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground">
            {getGreeting()}{firstName ? `, ${firstName}` : ""}
          </h1>
        </div>

        {/* Stats chips */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-card border border-border/60 shadow-sm">
            <span className="material-symbols-outlined text-[14px] text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>
              trending_up
            </span>
            <div className="flex flex-col">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide leading-none">This week</span>
              <span className="text-sm font-extrabold text-foreground leading-tight">
                {statsLoaded ? formatCurrencyRounded(weekEarnings, currency) : "—"}
              </span>
            </div>
          </div>

          <div
            onClick={() => outstandingCount > 0 && router.push("/payments")}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-2xl border border-border/60 shadow-sm ${
              outstandingCount > 0
                ? "bg-amber-50 dark:bg-amber-950/20 border-amber-200/60 dark:border-amber-800/40 cursor-pointer"
                : "bg-card"
            }`}
          >
            <span
              className="material-symbols-outlined text-[14px]"
              style={{
                fontVariationSettings: "'FILL' 1",
                color: outstandingCount > 0 ? "#f59e0b" : "var(--color-primary)",
              }}
            >
              {outstandingCount > 0 ? "pending_actions" : "check_circle"}
            </span>
            <div className="flex flex-col">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide leading-none">Outstanding</span>
              <span className={`text-sm font-extrabold leading-tight ${outstandingCount > 0 ? "text-amber-600 dark:text-amber-400" : "text-foreground"}`}>
                {!statsLoaded ? "—" : outstandingCount > 0 ? formatCurrencyRounded(outstandingAmount, currency) : "✓ Clear"}
              </span>
            </div>
          </div>

          <button
            onClick={() => router.push("/quotes/new")}
            className="ml-auto flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-primary text-white shadow-sm active:scale-95 transition-transform shrink-0"
            style={{ boxShadow: "0 2px 8px oklch(0.511 0.230 277 / 0.30)" }}
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            <span className="text-xs font-bold">New Quote</span>
          </button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 -mx-4 px-4 lg:mx-0 lg:px-0 scrollbar-none">
        {STATUS_FILTERS.map((tab) => {
          const count = counts[tab.value as keyof typeof counts] ?? jobs.length;
          return (
            <button key={tab.value} onClick={() => setActiveFilter(tab.value)}>
              <Badge
                className={`px-4 py-1.5 text-xs rounded-full shrink-0 cursor-pointer transition-colors ${
                  activeFilter === tab.value
                    ? "bg-primary text-white hover:bg-primary/90"
                    : "bg-card text-muted-foreground border border-border hover:bg-muted font-medium"
                }`}
                variant={activeFilter === tab.value ? "default" : "outline"}
              >
                {tab.label}{count > 0 ? ` (${count})` : ""}
              </Badge>
            </button>
          );
        })}
      </div>

      {/* Jobs list */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {loading && <p className="text-sm text-muted-foreground text-center py-8">Loading…</p>}

        {!loading && filtered.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-12 text-center">
            <span className="material-symbols-outlined text-[48px] text-muted-foreground/40">work_off</span>
            <p className="text-sm font-medium text-muted-foreground">No jobs here yet</p>
            <p className="text-xs text-muted-foreground/60">Mark a quote as won to create a job</p>
          </div>
        )}

        {filtered.map((job) => {
          const color = STATUS_HEX[job.status];
          const title = job.job_line_items[0]?.description ?? "Job";
          const extraItems = job.job_line_items.length - 1;

          return (
            <Card
              key={job.id}
              onClick={() => router.push(`/jobs/${job.id}`)}
              className="overflow-hidden rounded-2xl cursor-pointer flex flex-col press"
            >
              <div className="h-1.5 w-full" style={{ backgroundColor: color }} />
              <div className="p-4 flex flex-col gap-3">

                <div className="flex justify-between items-start">
                  <div className="flex items-start gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-xl text-white shadow-sm" style={{ backgroundColor: color }}>
                      <span className="material-symbols-outlined text-[20px]">home_repair_service</span>
                    </div>
                    <div className="flex flex-col">
                      <h3 className="font-bold text-foreground leading-tight">
                        {title}{extraItems > 0 ? ` +${extraItems} more` : ""}
                      </h3>
                      <span className="text-sm font-medium text-muted-foreground">{job.clients?.name ?? "Unknown client"}</span>
                    </div>
                  </div>
                  <span className="font-extrabold text-foreground">{formatCurrency(job.total, currency)}</span>
                </div>

                <div className="flex items-center gap-2 bg-muted/40 rounded-xl p-2.5 border border-border/50">
                  <span className="material-symbols-outlined text-[16px] text-muted-foreground">calendar_clock</span>
                  <span className="text-sm text-foreground font-medium">{formatScheduled(job.scheduled_at)}</span>
                  {job.clients?.address && (
                    <>
                      <span className="text-muted-foreground">·</span>
                      <span className="text-sm text-muted-foreground truncate">{job.clients.address}</span>
                    </>
                  )}
                </div>

                <div className="flex items-center justify-end">
                  {job.status === "in_progress" && <Badge variant="secondary" className={`${STATUS_CLASS.in_progress} border-0`}>In Progress</Badge>}
                  {job.status === "scheduled" && <Badge variant="secondary" className={`${STATUS_CLASS.scheduled} border-0`}>Scheduled</Badge>}
                  {job.status === "completed" && <Badge variant="secondary" className={`${STATUS_CLASS.completed} border-0`}>Completed ✓</Badge>}
                  {job.status === "cancelled" && <Badge variant="secondary" className={`${STATUS_CLASS.cancelled} border-0`}>Cancelled</Badge>}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
