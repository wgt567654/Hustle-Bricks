"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Job = {
  id: string;
  status: "scheduled" | "in_progress" | "completed" | "cancelled";
  scheduled_at: string | null;
  total: number;
  notes: string | null;
  route_order: number | null;
  clients: { name: string; address: string | null } | null;
  job_line_items: { description: string }[];
};

type GroupedJobs = { label: string; jobs: Job[] }[];

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString([], {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

function groupJobs(jobs: Job[]): GroupedJobs {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const weekEnd = new Date(today);
  weekEnd.setDate(today.getDate() + 7);

  const groups: Record<string, Job[]> = {};

  for (const job of jobs) {
    if (!job.scheduled_at) {
      const key = "Unscheduled";
      groups[key] = groups[key] ?? [];
      groups[key].push(job);
      continue;
    }

    const d = new Date(job.scheduled_at);
    d.setHours(0, 0, 0, 0);

    let label: string;
    if (d.getTime() === today.getTime()) {
      label = "Today";
    } else if (d.getTime() === tomorrow.getTime()) {
      label = "Tomorrow";
    } else if (d < weekEnd) {
      label = formatDate(job.scheduled_at);
    } else {
      label = formatDate(job.scheduled_at);
    }

    groups[label] = groups[label] ?? [];
    groups[label].push(job);
  }

  // Sort group keys: Today first, then Tomorrow, then by date
  const orderedKeys = Object.keys(groups).sort((a, b) => {
    if (a === "Today") return -1;
    if (b === "Today") return 1;
    if (a === "Tomorrow") return -1;
    if (b === "Tomorrow") return 1;
    if (a === "Unscheduled") return 1;
    if (b === "Unscheduled") return -1;
    return 0;
  });

  return orderedKeys.map((label) => ({
    label,
    // Within each day: routed jobs (non-null route_order) first, sorted by route_order; then unrouted by scheduled_at
    jobs: [
      ...groups[label].filter((j) => j.route_order !== null).sort((a, b) => a.route_order! - b.route_order!),
      ...groups[label].filter((j) => j.route_order === null),
    ],
  }));
}

export default function EmployeeSchedulePage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: tm } = await supabase
        .from("team_members")
        .select("id")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .single();

      if (!tm) return;

      const { data } = await supabase
        .from("jobs")
        .select("id, status, scheduled_at, total, notes, route_order, clients(name, address), job_line_items(description)")
        .eq("assigned_member_id", tm.id)
        .in("status", ["scheduled", "in_progress"])
        .order("scheduled_at", { ascending: true, nullsFirst: false });

      setJobs((data as unknown as Job[]) ?? []);
      setLoading(false);
    }
    load();
  }, []);

  const grouped = groupJobs(jobs);

  return (
    <div className="flex flex-col gap-5 px-4 py-5 max-w-xl mx-auto">
      <div className="flex flex-col gap-0.5 mb-1">
        <h1 className="text-2xl font-extrabold tracking-tight text-foreground">Schedule</h1>
        <p className="text-sm text-muted-foreground">Your upcoming assigned jobs</p>
      </div>

      {loading && (
        <p className="text-sm text-muted-foreground text-center py-10">Loading…</p>
      )}

      {!loading && jobs.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-16 text-center rounded-2xl border border-dashed border-border">
          <span className="material-symbols-outlined text-[48px] text-muted-foreground/30">
            event_available
          </span>
          <p className="text-sm font-semibold text-muted-foreground">No upcoming jobs</p>
          <p className="text-xs text-muted-foreground/60">Your manager will assign jobs here</p>
        </div>
      )}

      {grouped.map(({ label, jobs: groupJobs }) => (
        <div key={label} className="flex flex-col gap-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</h2>

          {groupJobs.map((job) => (
            <button
              key={job.id}
              onClick={() => router.push(`/employee/jobs/${job.id}`)}
              className="w-full rounded-2xl border border-border bg-card shadow-sm p-4 flex items-start gap-3 text-left hover:border-primary/30 active:scale-[0.99] transition-all"
            >
              <div className="relative shrink-0 mt-0.5">
                <div
                  className={`flex size-10 items-center justify-center rounded-xl ${
                    job.status === "in_progress"
                      ? "icon-orange "
                      : "bg-primary/10 text-primary"
                  }`}
                >
                  <span
                    className="material-symbols-outlined text-[18px]"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    {job.status === "in_progress" ? "play_circle" : "work"}
                  </span>
                </div>
                {job.route_order !== null && (
                  <div className="absolute -top-1.5 -right-1.5 size-5 rounded-full bg-primary border-2 border-background flex items-center justify-center text-[9px] font-extrabold text-white leading-none">
                    {job.route_order}
                  </div>
                )}
              </div>

              <div className="flex flex-col flex-1 min-w-0 gap-0.5">
                <span className="font-bold text-foreground text-sm leading-snug truncate">
                  {job.job_line_items[0]?.description ?? "Job"}
                </span>
                <span className="text-xs text-muted-foreground truncate">
                  {job.clients?.name ?? ""}
                </span>
                {job.clients?.address && (
                  <span className="text-xs text-muted-foreground/70 truncate">{job.clients.address}</span>
                )}
                {job.scheduled_at && (
                  <span className="text-xs font-semibold text-primary mt-0.5">
                    {formatTime(job.scheduled_at)}
                  </span>
                )}
              </div>

              <div className="flex flex-col items-end gap-1.5 shrink-0">
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    job.status === "in_progress"
                      ? "icon-orange "
                      : "bg-primary/10 text-primary"
                  }`}
                >
                  {job.status === "in_progress" ? "In Progress" : "Scheduled"}
                </span>
                <span className="material-symbols-outlined text-muted-foreground/40 text-[15px]">
                  chevron_right
                </span>
              </div>
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
