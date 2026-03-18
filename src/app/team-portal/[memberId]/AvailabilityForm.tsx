"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const HOURS = Array.from({ length: 17 }, (_, i) => {
  const h = i + 6;
  const label = `${h > 12 ? h - 12 : h === 0 ? 12 : h}:00 ${h >= 12 ? "PM" : "AM"}`;
  return { value: `${String(h).padStart(2, "0")}:00`, label };
});

type AvailRow = {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
};

type AssignedJob = {
  id: string;
  status: string;
  scheduled_at: string | null;
  total: number;
  job_line_items: { description: string }[];
  clients: { name: string } | null;
};

type Props = {
  memberId: string;
  businessId: string;
  memberName: string;
  memberRole: string;
  availability: AvailRow[];
  jobs: AssignedJob[];
};

function parseTime(t: string) {
  return t.slice(0, 5);
}

export default function AvailabilityForm({
  memberId,
  businessId,
  memberName,
  memberRole,
  availability: initialAvail,
  jobs,
}: Props) {
  const [avail, setAvail] = useState<AvailRow[]>(
    initialAvail.map((a) => ({
      ...a,
      start_time: parseTime(a.start_time),
      end_time: parseTime(a.end_time),
    }))
  );
  const [saving, setSaving] = useState<number | null>(null);
  const [saved, setSaved] = useState(false);

  const initials = memberName
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  function getRow(day: number) {
    return avail.find((a) => a.day_of_week === day);
  }

  function flashSaved() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function toggleDay(day: number) {
    setSaving(day);
    const supabase = createClient();
    const existing = getRow(day);
    if (existing) {
      await supabase.from("worker_availability").delete().eq("id", existing.id);
      setAvail((prev) => prev.filter((a) => a.day_of_week !== day));
    } else {
      const { data } = await supabase
        .from("worker_availability")
        .insert({
          business_id: businessId,
          team_member_id: memberId,
          day_of_week: day,
          start_time: "08:00",
          end_time: "17:00",
        })
        .select("id, day_of_week, start_time, end_time")
        .single();
      if (data) {
        setAvail((prev) => [
          ...prev,
          {
            ...data,
            start_time: parseTime(data.start_time),
            end_time: parseTime(data.end_time),
          },
        ]);
      }
    }
    setSaving(null);
    flashSaved();
  }

  async function updateHours(day: number, from: string, until: string) {
    const existing = getRow(day);
    if (!existing) return;
    const supabase = createClient();
    await supabase
      .from("worker_availability")
      .update({ start_time: from, end_time: until })
      .eq("id", existing.id);
    setAvail((prev) =>
      prev.map((a) =>
        a.day_of_week === day ? { ...a, start_time: from, end_time: until } : a
      )
    );
    flashSaved();
  }

  const upcomingJobs = jobs.filter(
    (j) => j.scheduled_at && new Date(j.scheduled_at) >= new Date()
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 bg-card/90 backdrop-blur-md border-b border-border">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-[#3581f3]/10 text-[#3581f3] font-extrabold text-sm border border-[#3581f3]/20">
              {initials}
            </div>
            <div>
              <p className="font-extrabold text-foreground text-sm leading-tight">
                {memberName}
              </p>
              <p className="text-xs text-muted-foreground capitalize">{memberRole}</p>
            </div>
          </div>
          {saved && (
            <span className="text-xs font-bold text-[#16a34a] flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                check_circle
              </span>
              Saved
            </span>
          )}
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-5 flex flex-col gap-5 pb-20">
        {/* Upcoming Jobs */}
        <div className="flex flex-col gap-3">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Your Upcoming Jobs
          </p>
          {upcomingJobs.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center bg-card rounded-2xl border border-border/50">
              <span className="material-symbols-outlined text-[36px] text-muted-foreground/30">
                event_available
              </span>
              <p className="text-sm font-medium text-muted-foreground">
                No upcoming jobs assigned yet
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {upcomingJobs.map((job) => {
                const title = job.job_line_items[0]?.description ?? "Service Job";
                const dt = job.scheduled_at ? new Date(job.scheduled_at) : null;
                const dateStr = dt
                  ? dt.toLocaleDateString("en-US", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })
                  : "—";
                const timeStr = dt
                  ? dt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
                  : "";
                const isToday = dt
                  ? dt.toDateString() === new Date().toDateString()
                  : false;
                return (
                  <div
                    key={job.id}
                    className={`rounded-2xl p-4 flex items-center gap-3 border ${
                      isToday
                        ? "bg-[#16a34a]/5 border-[#16a34a]/20"
                        : "bg-card border-border"
                    }`}
                  >
                    <div
                      className={`flex size-10 items-center justify-center rounded-xl shrink-0 ${
                        isToday
                          ? "bg-[#16a34a]/10 text-[#16a34a]"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      <span
                        className="material-symbols-outlined text-[20px]"
                        style={{ fontVariationSettings: "'FILL' 1" }}
                      >
                        home_repair_service
                      </span>
                    </div>
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="font-bold text-foreground text-sm truncate">
                        {title}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {job.clients?.name ? `${job.clients.name} · ` : ""}
                        {dateStr}
                        {timeStr ? ` at ${timeStr}` : ""}
                      </span>
                    </div>
                    {isToday && (
                      <span className="text-[10px] font-bold text-[#16a34a] bg-[#16a34a]/10 px-2 py-1 rounded-full shrink-0">
                        Today
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Weekly Availability */}
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="p-4 border-b border-border/50">
            <p className="font-bold text-sm text-foreground">Weekly Availability</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Toggle the days you&rsquo;re available and set your hours.
            </p>
          </div>
          <div className="flex flex-col divide-y divide-border/40">
            {DAYS.map((dayName, i) => {
              const row = getRow(i);
              const isAvail = !!row;
              const from = row ? parseTime(row.start_time) : "08:00";
              const until = row ? parseTime(row.end_time) : "17:00";
              return (
                <div key={i} className="flex items-center gap-3 px-4 py-3">
                  <button
                    onClick={() => toggleDay(i)}
                    disabled={saving === i}
                    className={`relative shrink-0 w-11 h-6 rounded-full transition-colors focus:outline-none overflow-hidden disabled:opacity-60 ${
                      isAvail ? "bg-[#16a34a]" : "bg-border"
                    }`}
                  >
                    <span
                      className={`absolute top-1 size-4 rounded-full bg-white shadow transition-all duration-200 ${
                        isAvail ? "left-6" : "left-1"
                      }`}
                    />
                  </button>
                  <span
                    className={`text-sm font-bold w-8 shrink-0 ${
                      isAvail ? "text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    {dayName}
                  </span>
                  {isAvail ? (
                    <div className="flex items-center gap-2 flex-1">
                      <select
                        value={from}
                        onChange={(e) => updateHours(i, e.target.value, until)}
                        className="flex-1 rounded-lg border border-border bg-background px-2 py-1.5 text-xs text-foreground font-medium focus:outline-none"
                      >
                        {HOURS.map((h) => (
                          <option key={h.value} value={h.value}>
                            {h.label}
                          </option>
                        ))}
                      </select>
                      <span className="text-muted-foreground text-xs font-bold shrink-0">→</span>
                      <select
                        value={until}
                        onChange={(e) => updateHours(i, from, e.target.value)}
                        className="flex-1 rounded-lg border border-border bg-background px-2 py-1.5 text-xs text-foreground font-medium focus:outline-none"
                      >
                        {HOURS.map((h) => (
                          <option key={h.value} value={h.value}>
                            {h.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground italic flex-1">
                      Day off
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <p className="text-xs text-muted-foreground text-center">
          Changes save automatically · Powered by HustleBricks
        </p>
      </div>
    </div>
  );
}
