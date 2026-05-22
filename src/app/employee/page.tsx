"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { buildGoogleMapsRouteUrls } from "@/lib/routeOptimizer";

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

type TimeEntry = {
  id: string;
  job_id: string;
  clocked_in_at: string;
  clocked_out_at: string | null;
};

type WeatherDay = { date: string; weathercode: number; precipitation_sum: number; hasRisk: boolean };

function wmoLabel(code: number): string {
  if (code === 0) return "Clear";
  if (code <= 2) return "Mostly Clear";
  if (code === 3) return "Overcast";
  if (code <= 48) return "Foggy";
  if (code <= 55) return "Drizzle";
  if (code <= 65) return "Rain";
  if (code <= 77) return "Snow";
  if (code <= 82) return "Showers";
  if (code <= 86) return "Snow Showers";
  return "Thunderstorm";
}

function wmoIcon(code: number): string {
  if (code === 0) return "light_mode";
  if (code <= 2) return "partly_cloudy_day";
  if (code === 3) return "cloud";
  if (code <= 48) return "foggy";
  if (code <= 55) return "water_drop";
  if (code <= 82) return "rainy";
  if (code <= 86) return "weather_snowy";
  return "thunderstorm";
}

function formatTime(dateStr: string | null) {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export default function EmployeeHomePage() {
  const router = useRouter();
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [activeEntry, setActiveEntry] = useState<TimeEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [clockingIn, setClockingIn] = useState(false);
  const [clockingOut, setClockingOut] = useState(false);
  const [odometerStart, setOdometerStart] = useState("");
  const [odometerEnd, setOdometerEnd] = useState("");
  const [todayWeather, setTodayWeather] = useState<WeatherDay | null>(null);

  const now = new Date();
  const greeting =
    now.getHours() < 12 ? "Good morning" : now.getHours() < 17 ? "Good afternoon" : "Good evening";

  const todayLabel = now.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: tm } = await supabase
        .from("team_members")
        .select("id, name, business_id")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .single();

      if (!tm) return;
      setEmployeeId(tm.id);
      setBusinessId(tm.business_id);

      // Fetch weather in parallel with jobs
      const weatherPromise = supabase
        .from("businesses")
        .select("service_areas, city")
        .eq("id", tm.business_id)
        .single()
        .then(async ({ data: biz }) => {
          if (!biz) return;
          const areas: string[] = (biz as unknown as { service_areas: string[] | null }).service_areas ?? [];
          const legacyCity = (biz as unknown as { city: string | null }).city;
          const allAreas = areas.length > 0 ? areas : legacyCity ? [legacyCity] : [];
          if (!allAreas.length) return;
          const params = new URLSearchParams();
          allAreas.forEach((a) => params.append("city", a));
          const res = await fetch(`/api/weather-alerts?${params}`);
          if (!res.ok) return;
          const json = await res.json() as { risk: WeatherDay[] };
          const todayStr = new Date().toISOString().slice(0, 10);
          const todayData = json.risk.find((d) => d.date === todayStr);
          if (todayData) setTodayWeather(todayData);
        });

      const startOfToday = new Date(now);
      startOfToday.setHours(0, 0, 0, 0);
      const endOfToday = new Date(now);
      endOfToday.setHours(23, 59, 59, 999);

      const [{ data: todayJobs }, { data: openEntry }] = await Promise.all([
        supabase
          .from("jobs")
          .select("id, status, scheduled_at, total, notes, route_order, clients(name, address), job_line_items(description)")
          .eq("assigned_member_id", tm.id)
          .in("status", ["scheduled", "in_progress"])
          .gte("scheduled_at", startOfToday.toISOString())
          .lte("scheduled_at", endOfToday.toISOString())
          .order("scheduled_at"),
        supabase
          .from("time_entries")
          .select("id, job_id, clocked_in_at, clocked_out_at")
          .eq("employee_id", tm.id)
          .is("clocked_out_at", null)
          .order("clocked_in_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        weatherPromise,
      ]);

      const rawJobs = (todayJobs as unknown as Job[]) ?? [];
      // Sort: routed jobs (non-null route_order) by route_order, then unrouted by scheduled_at
      const sortedJobs = [
        ...rawJobs.filter((j) => j.route_order !== null).sort((a, b) => a.route_order! - b.route_order!),
        ...rawJobs.filter((j) => j.route_order === null),
      ];
      setJobs(sortedJobs);
      setActiveEntry(openEntry as TimeEntry | null);
      setLoading(false);
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function getLocation(): Promise<{ lat: number; lng: number } | null> {
    return new Promise((resolve) => {
      if (!navigator.geolocation) return resolve(null);
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve(null),
        { timeout: 5000 }
      );
    });
  }

  async function clockIn(jobId: string) {
    if (!employeeId || !businessId) return;
    setClockingIn(true);
    const [supabase, coords] = await Promise.all([
      Promise.resolve(createClient()),
      getLocation(),
    ]);
    const payload: Record<string, unknown> = {
      employee_id: employeeId,
      job_id: jobId,
      business_id: businessId,
    };
    if (coords) {
      payload.check_in_lat = coords.lat;
      payload.check_in_lng = coords.lng;
    }
    const startMiles = parseInt(odometerStart, 10);
    if (!isNaN(startMiles)) payload.odometer_start = startMiles;

    const { data } = await supabase
      .from("time_entries")
      .insert(payload)
      .select("id, job_id, clocked_in_at, clocked_out_at")
      .single();
    if (data) setActiveEntry(data as TimeEntry);
    setOdometerStart("");
    setClockingIn(false);
  }

  async function clockOut() {
    if (!activeEntry) return;
    setClockingOut(true);
    const supabase = createClient();
    const update: Record<string, unknown> = { clocked_out_at: new Date().toISOString() };
    const endMiles = parseInt(odometerEnd, 10);
    if (!isNaN(endMiles)) update.odometer_end = endMiles;
    await supabase.from("time_entries").update(update).eq("id", activeEntry.id);
    setActiveEntry(null);
    setOdometerEnd("");
    setClockingOut(false);
  }

  const activeJob = activeEntry ? jobs.find((j) => j.id === activeEntry.job_id) : null;

  // Build navigate button data
  const routedJobs = jobs.filter((j) => j.route_order !== null && j.clients?.address);
  const routeUrls = routedJobs.length >= 2
    ? buildGoogleMapsRouteUrls(routedJobs.map((j) => j.clients!.address!))
    : [];

  return (
    <div className="flex flex-col gap-5 px-4 py-5 max-w-xl mx-auto">

      {/* Greeting */}
      <div className="flex flex-col gap-0.5">
        <h1 className="text-2xl font-extrabold tracking-tight text-foreground">{greeting}</h1>
        <p className="text-sm text-muted-foreground">{todayLabel}</p>
      </div>

      {/* Weather widget */}
      {todayWeather && (
        <div
          className={`rounded-2xl px-4 py-3 flex items-center gap-3 border ${
            todayWeather.hasRisk
              ? "bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800/40"
              : "bg-muted/40 border-border"
          }`}
        >
          <span
            className={`material-symbols-outlined text-[28px] shrink-0 ${
              todayWeather.hasRisk ? "text-amber-500" : "text-muted-foreground"
            }`}
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            {wmoIcon(todayWeather.weathercode)}
          </span>
          <div className="flex flex-col flex-1 min-w-0">
            <span className={`font-bold text-sm ${todayWeather.hasRisk ? "text-amber-800 dark:text-amber-300" : "text-foreground"}`}>
              {wmoLabel(todayWeather.weathercode)} today
            </span>
            {todayWeather.precipitation_sum > 0 && (
              <span className="text-xs text-muted-foreground">
                {todayWeather.precipitation_sum.toFixed(1)} mm precipitation expected
              </span>
            )}
          </div>
          {todayWeather.hasRisk && (
            <span className="shrink-0 text-[10px] font-bold px-2 py-1 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
              Weather Alert
            </span>
          )}
        </div>
      )}

      {/* Clock in/out card */}
      {!loading && (
        <div
          className={`rounded-2xl p-4 flex items-center gap-4 border ${
            activeEntry
              ? "bg-status-completed/10 border-[var(--color-status-completed)]/20"
              : "bg-muted/40 border-border"
          }`}
        >
          <div
            className={`flex size-12 shrink-0 items-center justify-center rounded-xl ${
              activeEntry ? "icon-green " : "bg-muted text-muted-foreground"
            }`}
          >
            <span
              className="material-symbols-outlined text-[22px]"
              style={{ fontVariationSettings: activeEntry ? "'FILL' 1" : "'FILL' 0" }}
            >
              schedule
            </span>
          </div>

          <div className="flex flex-col flex-1 min-w-0">
            {activeEntry ? (
              <>
                <span className="font-bold text-[var(--color-status-completed)] text-sm">Clocked in</span>
                <span className="text-xs text-muted-foreground truncate">
                  {activeJob
                    ? (activeJob.job_line_items[0]?.description ?? "Job") + " · " + (activeJob.clients?.name ?? "")
                    : "Since " + formatTime(activeEntry.clocked_in_at)}
                </span>
              </>
            ) : (
              <>
                <span className="font-bold text-foreground text-sm">Not clocked in</span>
                <span className="text-xs text-muted-foreground">Tap a job below to clock in</span>
              </>
            )}
          </div>

          {activeEntry && (
            <div className="flex flex-col items-end gap-1.5 shrink-0">
              <input
                type="number"
                inputMode="numeric"
                placeholder="End odometer"
                value={odometerEnd}
                onChange={(e) => setOdometerEnd(e.target.value)}
                className="w-28 text-xs px-2.5 py-1.5 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <button
                onClick={clockOut}
                disabled={clockingOut}
                className="w-28 py-2 rounded-xl bg-[var(--color-status-completed)] text-white font-bold text-xs hover:opacity-90 active:scale-95 transition-all disabled:opacity-50"
              >
                {clockingOut ? "…" : "Clock Out"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Navigate Route button — shown when owner has planned a route with 2+ stops */}
      {!loading && routeUrls.length > 0 && (
        <div className="flex flex-col gap-2">
          {routeUrls.map((url, i) => (
            <a
              key={i}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 rounded-2xl border border-primary/30 bg-primary/8 px-4 py-3.5 hover:bg-primary/12 active:scale-[0.99] transition-all"
            >
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                  directions_car
                </span>
              </div>
              <div className="flex flex-col flex-1 min-w-0">
                <span className="font-bold text-primary text-sm leading-snug">
                  {routeUrls.length > 1 ? `Navigate Route — Part ${i + 1}` : "Navigate Today's Route"}
                </span>
                <span className="text-xs text-muted-foreground">
                  {routeUrls.length > 1
                    ? `Opens in Google Maps`
                    : `${routedJobs.length} stops · Opens in Google Maps`}
                </span>
              </div>
              <span className="material-symbols-outlined text-primary/60 text-[18px]">open_in_new</span>
            </a>
          ))}
        </div>
      )}

      {/* Today's jobs */}
      <div className="flex flex-col gap-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Today&apos;s Jobs</h2>

        {loading && (
          <p className="text-sm text-muted-foreground py-6 text-center">Loading…</p>
        )}

        {!loading && jobs.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-12 text-center rounded-2xl border border-dashed border-border">
            <span className="material-symbols-outlined text-[40px] text-muted-foreground/30">event_available</span>
            <p className="text-sm font-semibold text-muted-foreground">No jobs today</p>
            <p className="text-xs text-muted-foreground/60">Check your schedule for upcoming work</p>
          </div>
        )}

        {jobs.map((job) => {
          const isClockedIntoThis = activeEntry?.job_id === job.id;
          return (
            <div
              key={job.id}
              className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden"
            >
              <button
                onClick={() => router.push(`/employee/jobs/${job.id}`)}
                className="w-full p-4 flex items-start gap-3 text-left hover:bg-muted/20 active:bg-muted/40 transition-colors"
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

                <div className="flex flex-col flex-1 min-w-0">
                  <span className="font-bold text-foreground text-sm leading-snug truncate">
                    {job.job_line_items[0]?.description ?? "Job"}
                  </span>
                  <span className="text-xs text-muted-foreground">{job.clients?.name ?? ""}</span>
                  {job.clients?.address && (
                    <span className="text-xs text-muted-foreground truncate mt-0.5">{job.clients.address}</span>
                  )}
                  {job.scheduled_at && (
                    <span className="text-xs font-medium text-primary mt-1">{formatTime(job.scheduled_at)}</span>
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
                  <span className="material-symbols-outlined text-muted-foreground/40 text-[15px]">chevron_right</span>
                </div>
              </button>

              {/* Clock in strip — only when not already clocked into anything */}
              {!activeEntry && (
                <div className="border-t border-border/40 bg-muted/20 flex items-center gap-2 px-3 py-2">
                  <input
                    type="number"
                    inputMode="numeric"
                    placeholder="Start odometer"
                    value={odometerStart}
                    onChange={(e) => setOdometerStart(e.target.value)}
                    className="flex-1 text-xs px-2.5 py-1.5 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                  <button
                    onClick={() => clockIn(job.id)}
                    disabled={clockingIn}
                    className="shrink-0 px-3.5 py-1.5 rounded-xl bg-[var(--color-status-completed)] text-white font-bold text-xs flex items-center gap-1 hover:opacity-90 active:scale-95 transition-all disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-[15px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                      login
                    </span>
                    {clockingIn ? "…" : "Clock In"}
                  </button>
                </div>
              )}

              {/* Clocked into this job indicator */}
              {isClockedIntoThis && (
                <div className="border-t border-[var(--color-status-completed)]/20 bg-status-completed/10 px-4 py-2 flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-[var(--color-status-completed)] animate-pulse" />
                  <span className="text-xs font-bold text-[var(--color-status-completed)]">Clocked in since {formatTime(activeEntry.clocked_in_at)}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

    </div>
  );
}
