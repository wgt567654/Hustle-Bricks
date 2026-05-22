"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Note = {
  id: string;
  icon: string;
  iconColor: string;
  title: string;
  body: string;
  href?: string;
  timestamp?: string;
};

async function buildNotifications(): Promise<Note[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: tm } = await supabase
    .from("team_members")
    .select("id")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .single();
  if (!tm) return [];

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const [
    { data: recentJobs },
    { data: openEntry },
    { data: todayJobs },
  ] = await Promise.all([
    supabase
      .from("jobs")
      .select("id, created_at, scheduled_at, job_line_items(description), clients(name)")
      .eq("assigned_member_id", tm.id)
      .in("status", ["scheduled", "in_progress"])
      .gte("created_at", sevenDaysAgo.toISOString())
      .order("created_at", { ascending: false }),
    supabase
      .from("time_entries")
      .select("id, clocked_in_at, job_id")
      .eq("employee_id", tm.id)
      .is("clocked_out_at", null)
      .lt("clocked_in_at", todayStart.toISOString())
      .order("clocked_in_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("jobs")
      .select("id, scheduled_at, job_line_items(description), clients(name)")
      .eq("assigned_member_id", tm.id)
      .in("status", ["scheduled", "in_progress"])
      .gte("scheduled_at", todayStart.toISOString())
      .lte("scheduled_at", todayEnd.toISOString())
      .order("scheduled_at"),
  ]);

  const notes: Note[] = [];

  // Forgotten clock-out (open entry from a previous day)
  if (openEntry) {
    const clockedInAt = new Date((openEntry as { clocked_in_at: string }).clocked_in_at);
    notes.push({
      id: "forgot-clock-out",
      icon: "timer_off",
      iconColor: "text-red-500",
      title: "Forgot to clock out",
      body: `You still have an open clock-in from ${clockedInAt.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}. Tap to go to today's page and clock out.`,
      href: "/employee",
      timestamp: clockedInAt.toISOString(),
    });
  }

  // Today's schedule reminder
  const todayJobsTyped = (todayJobs ?? []) as unknown as { id: string; scheduled_at: string | null; job_line_items: { description: string }[]; clients: { name: string } | null }[];
  if (todayJobsTyped.length > 0) {
    const first = todayJobsTyped[0];
    const title = first.job_line_items[0]?.description ?? "Job";
    const client = first.clients?.name ?? "";
    notes.push({
      id: "today-schedule",
      icon: "today",
      iconColor: "text-primary",
      title: todayJobsTyped.length === 1
        ? `1 job today — ${title}`
        : `${todayJobsTyped.length} jobs scheduled today`,
      body: todayJobsTyped.length === 1
        ? `${client}${first.scheduled_at ? " at " + new Date(first.scheduled_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : ""}`
        : todayJobsTyped.map((j) => j.job_line_items[0]?.description ?? "Job").join(", "),
      href: "/employee",
      timestamp: new Date().toISOString(),
    });
  }

  // Recently assigned jobs (last 7 days)
  const recentTyped = (recentJobs ?? []) as unknown as { id: string; created_at: string; scheduled_at: string | null; job_line_items: { description: string }[]; clients: { name: string } | null }[];
  for (const job of recentTyped) {
    const title = job.job_line_items[0]?.description ?? "New Job";
    const client = job.clients?.name ?? "";
    const createdAt = new Date(job.created_at);
    const daysAgo = Math.floor((Date.now() - createdAt.getTime()) / 86_400_000);
    const when = daysAgo === 0 ? "today" : daysAgo === 1 ? "yesterday" : `${daysAgo} days ago`;
    notes.push({
      id: `new-job-${job.id}`,
      icon: "work",
      iconColor: "text-blue-500",
      title: `New job assigned — ${title}`,
      body: `${client ? client + " · " : ""}Assigned ${when}${job.scheduled_at ? " · " + new Date(job.scheduled_at).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) : ""}`,
      href: `/employee/jobs/${job.id}`,
      timestamp: job.created_at,
    });
  }

  if (notes.length === 0) {
    notes.push({
      id: "all-clear",
      icon: "check_circle",
      iconColor: "text-green-500",
      title: "You're all caught up",
      body: "No new notifications. Check back after your next job is assigned.",
    });
  }

  return notes;
}

export default function EmployeeNotificationsPage() {
  const router = useRouter();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    buildNotifications().then((n) => {
      setNotes(n);
      setLoading(false);
    });
  }, []);

  return (
    <div className="flex flex-col gap-5 px-4 py-5 max-w-xl mx-auto">
      <div className="flex flex-col gap-0.5 mb-1">
        <h1 className="text-2xl font-extrabold tracking-tight text-foreground">Notifications</h1>
        <p className="text-sm text-muted-foreground">Updates and alerts for you</p>
      </div>

      {loading && (
        <div className="flex flex-col gap-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-20 rounded-2xl bg-muted/50 animate-pulse" />
          ))}
        </div>
      )}

      {!loading && (
        <div className="flex flex-col gap-3">
          {notes.map((note) => {
            const Wrapper = note.href ? "button" : "div";
            return (
              <Wrapper
                key={note.id}
                onClick={note.href ? () => router.push(note.href!) : undefined}
                className={`w-full rounded-2xl border border-border bg-card shadow-sm p-4 flex items-start gap-3 text-left ${note.href ? "hover:border-primary/30 active:scale-[0.99] transition-all cursor-pointer" : ""}`}
              >
                <div className={`flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted/60 mt-0.5`}>
                  <span
                    className={`material-symbols-outlined text-[20px] ${note.iconColor}`}
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    {note.icon}
                  </span>
                </div>
                <div className="flex flex-col flex-1 min-w-0 gap-0.5">
                  <span className="font-bold text-sm text-foreground leading-snug">{note.title}</span>
                  <span className="text-xs text-muted-foreground">{note.body}</span>
                  {note.timestamp && (
                    <span className="text-[10px] text-muted-foreground/50 mt-0.5">
                      {new Date(note.timestamp).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                    </span>
                  )}
                </div>
                {note.href && (
                  <span className="material-symbols-outlined text-muted-foreground/40 text-[15px] shrink-0 mt-1">chevron_right</span>
                )}
              </Wrapper>
            );
          })}
        </div>
      )}
    </div>
  );
}
