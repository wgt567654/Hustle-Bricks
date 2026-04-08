"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";
import { getBusinessId } from "@/lib/supabase/get-business";
import { STATUS_HEX, STATUS_CLASS } from "@/lib/status-colors";

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

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const businessId = await getBusinessId(supabase);
      if (!businessId) return;

      const { data } = await supabase
        .from("jobs")
        .select("id, status, total, scheduled_at, created_at, notes, clients(name, address), job_line_items(description)")
        .eq("business_id", businessId)
        .order("created_at", { ascending: false });

      setJobs((data as unknown as Job[]) ?? []);
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
    <div className="flex flex-col gap-6 px-4 py-6 max-w-xl mx-auto pb-40">
      <div className="flex flex-col gap-1 mb-2">
        <h1 className="text-2xl font-extrabold tracking-tight text-foreground">Schedule & Jobs</h1>
        <p className="text-sm text-muted-foreground">Manage your upcoming work and operations.</p>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-none">
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
      <div className="flex flex-col gap-4">
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
                  <span className="font-extrabold text-foreground">${job.total.toFixed(2)}</span>
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
