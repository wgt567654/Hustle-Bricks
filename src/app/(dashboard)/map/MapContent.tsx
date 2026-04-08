"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/badge";
import { nearestNeighborTSP } from "@/lib/routeOptimizer";
import { STATUS_HEX } from "@/lib/status-colors";

type JobStatus = "scheduled" | "in_progress" | "completed" | "cancelled";

type MapJob = {
  id: string;
  status: JobStatus;
  total: number;
  scheduled_at: string | null;
  assigned_member_id: string | null;
  route_order: number | null;
  job_line_items: { description: string }[];
  clients: { name: string; address: string | null } | null;
};

type Pin = {
  job: MapJob;
  lat: number;
  lng: number;
};

type TeamMember = {
  id: string;
  name: string;
};

const STATUS_COLORS = STATUS_HEX;

const STATUS_LABELS: Record<JobStatus, string> = {
  scheduled: "Scheduled",
  in_progress: "In Progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

function makeMarker(color: string) {
  return L.divIcon({
    html: `<div style="width:16px;height:16px;border-radius:50%;background:${color};border:2.5px solid white;box-shadow:0 2px 6px rgba(0,0,0,.35)"></div>`,
    className: "",
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

function makeNumberedMarker(n: number, color: string) {
  return L.divIcon({
    html: `<div style="width:26px;height:26px;border-radius:50%;background:${color};border:2.5px solid white;box-shadow:0 2px 8px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;color:white;font-family:system-ui,sans-serif">${n}</div>`,
    className: "",
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
}

async function geocode(address: string): Promise<[number, number] | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`,
      { headers: { "User-Agent": "HustleBricks/1.0 (service scheduling app)" } }
    );
    const data = await res.json();
    if (data.length > 0) {
      return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
    }
  } catch {}
  return null;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function MapContent() {
  const router = useRouter();
  const [allJobs, setAllJobs] = useState<MapJob[]>([]);
  const [pins, setPins] = useState<Pin[]>([]);
  const [loading, setLoading] = useState(true);
  const [geocoding, setGeocoding] = useState(false);
  const [progress, setProgress] = useState(0);
  const [total, setTotal] = useState(0);
  const [filterStatus, setFilterStatus] = useState<JobStatus | "all">("all");
  const [center, setCenter] = useState<[number, number]>([39.5, -98.35]);
  const [zoom, setZoom] = useState(4);

  // Route planner state
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [routeEmployee, setRouteEmployee] = useState("");
  const [routeDate, setRouteDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [routeStartAddress, setRouteStartAddress] = useState("");
  const [routeStartCoords, setRouteStartCoords] = useState<[number, number] | null>(null);
  const [routeStops, setRouteStops] = useState<Pin[]>([]);
  const [routePlanning, setRoutePlanning] = useState(false);
  const [routeSaving, setRouteSaving] = useState(false);
  const [routeSaved, setRouteSaved] = useState(false);
  const [noAddressCount, setNoAddressCount] = useState(0);
  const [inProgressCount, setInProgressCount] = useState(0);
  const [routeError, setRouteError] = useState("");

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: bizList } = await supabase
        .from("businesses")
        .select("id")
        .eq("owner_id", user.id)
        .limit(1);
      const business = bizList?.[0];
      if (!business) return;

      const [{ data: jobs }, { data: members }] = await Promise.all([
        supabase
          .from("jobs")
          .select("id, status, total, scheduled_at, assigned_member_id, route_order, job_line_items(description), clients(name, address)")
          .eq("business_id", business.id)
          .not("status", "eq", "cancelled")
          .order("scheduled_at", { ascending: false }),
        supabase
          .from("team_members")
          .select("id, name")
          .eq("business_id", business.id)
          .eq("is_active", true)
          .eq("is_pending", false)
          .order("name"),
      ]);

      setLoading(false);
      setTeamMembers((members as TeamMember[]) ?? []);

      const jobList = (jobs as unknown as MapJob[]) ?? [];
      setAllJobs(jobList);

      const withAddress = jobList.filter((j) => j.clients?.address);
      setTotal(withAddress.length);

      if (withAddress.length === 0) return;

      setGeocoding(true);
      const newPins: Pin[] = [];

      for (let i = 0; i < withAddress.length; i++) {
        const job = withAddress[i];
        const address = job.clients!.address!;
        const coords = await geocode(address);
        setProgress(i + 1);
        if (coords) {
          newPins.push({ job, lat: coords[0], lng: coords[1] });
          if (newPins.length === 1) {
            setCenter(coords);
            setZoom(12);
          }
        }
        setPins([...newPins]);
        if (i < withAddress.length - 1) await sleep(1100); // Nominatim rate limit
      }

      setGeocoding(false);
    }
    load();
  }, []);

  async function handlePlanRoute() {
    if (!routeEmployee || !routeDate) return;
    setRoutePlanning(true);
    setRouteSaved(false);
    setRouteError("");

    const dayStart = new Date(routeDate + "T00:00:00");
    const dayEnd = new Date(routeDate + "T23:59:59");

    // Jobs for this employee on this date
    const employeeJobs = allJobs.filter(
      (j) =>
        j.assigned_member_id === routeEmployee &&
        j.scheduled_at &&
        new Date(j.scheduled_at) >= dayStart &&
        new Date(j.scheduled_at) <= dayEnd
    );

    if (employeeJobs.length === 0) {
      setRouteError("No jobs found for this employee on the selected date.");
      setRoutePlanning(false);
      setRouteStops([]);
      return;
    }

    const withoutAddress = employeeJobs.filter((j) => !j.clients?.address);
    setNoAddressCount(withoutAddress.length);

    const inProg = employeeJobs.filter(
      (j) => j.status === "in_progress" || j.status === "completed"
    );
    setInProgressCount(inProg.length);

    // Match with already-geocoded pins
    const employeePins = pins.filter((p) =>
      p.job.assigned_member_id === routeEmployee &&
      p.job.scheduled_at &&
      new Date(p.job.scheduled_at) >= dayStart &&
      new Date(p.job.scheduled_at) <= dayEnd
    );

    if (employeePins.length === 0) {
      setRouteError("No jobs with addresses could be geocoded for this employee on the selected date. Make sure addresses are added to client profiles.");
      setRoutePlanning(false);
      setRouteStops([]);
      return;
    }

    if (geocoding) {
      setRouteError("Still geocoding addresses — please wait for the map to finish loading, then try again.");
      setRoutePlanning(false);
      return;
    }

    // Geocode start address if provided, use as anchor for TSP
    let startPin: { lat: number; lng: number } | null = null;
    if (routeStartAddress.trim()) {
      const coords = await geocode(routeStartAddress.trim());
      if (coords) {
        startPin = { lat: coords[0], lng: coords[1] };
        setRouteStartCoords(coords);
        setCenter(coords);
        setZoom(11);
      } else {
        setRouteError("Could not find the start address — check the spelling and try again.");
        setRoutePlanning(false);
        return;
      }
    } else {
      setRouteStartCoords(null);
    }

    const optimized = nearestNeighborTSP(employeePins, startPin ?? undefined);
    setRouteStops(optimized);
    setRoutePlanning(false);
  }

  async function handleSaveRoute() {
    if (routeStops.length === 0) return;
    setRouteSaving(true);
    const supabase = createClient();
    for (let i = 0; i < routeStops.length; i++) {
      await supabase
        .from("jobs")
        .update({ route_order: i + 1 })
        .eq("id", routeStops[i].job.id);
    }
    setRouteSaving(false);
    setRouteSaved(true);
  }

  function moveStop(from: number, to: number) {
    const next = [...routeStops];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    setRouteStops(next);
    setRouteSaved(false);
  }

  const filtered = filterStatus === "all" ? pins : pins.filter((p) => p.job.status === filterStatus);
  const counts = {
    scheduled: pins.filter((p) => p.job.status === "scheduled").length,
    in_progress: pins.filter((p) => p.job.status === "in_progress").length,
    completed: pins.filter((p) => p.job.status === "completed").length,
  };

  const routeStopIds = new Set(routeStops.map((s) => s.job.id));

  return (
    <div className="flex flex-col h-screen max-h-screen overflow-hidden">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 flex flex-col gap-3 shrink-0 bg-background border-b border-border">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-foreground">Job Map</h1>
            <p className="text-xs text-muted-foreground">
              {loading ? "Loading…" : geocoding ? `Locating ${progress}/${total}…` : `${pins.length} jobs plotted`}
            </p>
          </div>
          {geocoding && (
            <div className="flex items-center gap-2">
              <div className="w-24 h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${total > 0 ? (progress / total) * 100 : 0}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Status filter */}
        <div className="flex gap-2 overflow-x-auto scrollbar-none">
          {([
            { label: "All", value: "all" as const },
            { label: `Scheduled (${counts.scheduled})`, value: "scheduled" as const },
            { label: `In Progress (${counts.in_progress})`, value: "in_progress" as const },
            { label: `Completed (${counts.completed})`, value: "completed" as const },
          ]).map((f) => (
            <button key={f.value} onClick={() => setFilterStatus(f.value)}>
              <Badge
                className={`px-3 py-1 text-xs rounded-full shrink-0 cursor-pointer transition-colors ${
                  filterStatus === f.value
                    ? "bg-primary text-white hover:bg-primary/90"
                    : "bg-card text-muted-foreground border border-border hover:bg-muted font-medium"
                }`}
                variant={filterStatus === f.value ? "default" : "outline"}
              >
                {f.label}
              </Badge>
            </button>
          ))}
        </div>

        {/* Route planner controls */}
        {teamMembers.length > 0 && (
          <div className="flex flex-col gap-2 pt-1">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Route Planner</p>
            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={routeEmployee}
                onChange={(e) => { setRouteEmployee(e.target.value); setRouteStops([]); setRouteSaved(false); setRouteError(""); }}
                className="flex-1 min-w-0 text-sm rounded-xl border border-border bg-card px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-ring/40"
              >
                <option value="">Select employee…</option>
                {teamMembers.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
              <input
                type="date"
                value={routeDate}
                onChange={(e) => { setRouteDate(e.target.value); setRouteStops([]); setRouteSaved(false); setRouteError(""); }}
                className="text-sm rounded-xl border border-border bg-card px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-ring/40"
              />
            </div>
            <input
              type="text"
              value={routeStartAddress}
              onChange={(e) => { setRouteStartAddress(e.target.value); setRouteStops([]); setRouteStartCoords(null); setRouteSaved(false); setRouteError(""); }}
              placeholder="Start address (optional) — e.g. shop or home"
              className="w-full text-sm rounded-xl border border-border bg-card px-3 py-2 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring/40"
            />
            <button
              onClick={handlePlanRoute}
              disabled={!routeEmployee || routePlanning || geocoding}
              className="w-full px-4 py-2 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 active:scale-95 transition-all disabled:opacity-40"
            >
              {routePlanning ? "Planning…" : "Plan Route"}
            </button>

            {routeError && (
              <p className="text-xs text-destructive">{routeError}</p>
            )}
            {!routeError && noAddressCount > 0 && (
              <p className="text-xs text-amber-600">
                {noAddressCount} job{noAddressCount > 1 ? "s" : ""} excluded — no address on file
              </p>
            )}
            {!routeError && inProgressCount > 0 && (
              <p className="text-xs text-amber-600">
                {inProgressCount} in-progress/completed job{inProgressCount > 1 ? "s" : ""} will not be updated when saving
              </p>
            )}
          </div>
        )}
      </div>

      {/* Map */}
      <div className="flex-1 min-h-0 relative">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-muted-foreground">Loading jobs…</p>
          </div>
        ) : pins.length === 0 && !geocoding ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-6">
            <span className="material-symbols-outlined text-[56px] text-muted-foreground/30">map</span>
            <p className="text-sm font-medium text-muted-foreground">No jobs with addresses to plot</p>
            <p className="text-xs text-muted-foreground/60">Add addresses to your clients to see them here</p>
          </div>
        ) : (
          <MapContainer
            center={center}
            zoom={zoom}
            style={{ height: "100%", width: "100%" }}
            zoomControl={false}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {/* Route polyline */}
            {routeStops.length > 0 && (
              <Polyline
                positions={[
                  ...(routeStartCoords ? [routeStartCoords] : []),
                  ...routeStops.map((s) => [s.lat, s.lng] as [number, number]),
                ]}
                pathOptions={{ color: "#007AFF", weight: 3, opacity: 0.75, dashArray: "8 5" }}
              />
            )}

            {/* Start position marker */}
            {routeStartCoords && (
              <Marker
                position={routeStartCoords}
                icon={L.divIcon({
                  html: `<div style="width:28px;height:28px;border-radius:50%;background:${STATUS_HEX.completed};border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;font-size:13px;color:white;font-family:system-ui,sans-serif">S</div>`,
                  className: "",
                  iconSize: [28, 28],
                  iconAnchor: [14, 14],
                })}
              >
                <Popup>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>Start</div>
                  <div style={{ fontSize: 12, color: "#666" }}>{routeStartAddress}</div>
                </Popup>
              </Marker>
            )}

            {filtered.map((pin) => {
              const routeIdx = routeStops.findIndex((s) => s.job.id === pin.job.id);
              const icon =
                routeIdx >= 0
                  ? makeNumberedMarker(routeIdx + 1, STATUS_COLORS[pin.job.status])
                  : makeMarker(STATUS_COLORS[pin.job.status]);
              return (
                <Marker
                  key={pin.job.id}
                  position={[pin.lat, pin.lng]}
                  icon={icon}
                  zIndexOffset={routeStopIds.has(pin.job.id) ? 1000 : 0}
                >
                  <Popup>
                    <div style={{ minWidth: 180 }}>
                      {routeIdx >= 0 && (
                        <div style={{ fontSize: 11, fontWeight: 700, color: STATUS_HEX.scheduled, marginBottom: 4 }}>
                          Stop #{routeIdx + 1}
                        </div>
                      )}
                      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>
                        {pin.job.job_line_items[0]?.description ?? "Service Job"}
                      </div>
                      <div style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>
                        {pin.job.clients?.name}
                      </div>
                      <div style={{ fontSize: 11, color: "#888", marginBottom: 6 }}>
                        {pin.job.clients?.address}
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: STATUS_COLORS[pin.job.status] }}>
                          {STATUS_LABELS[pin.job.status]}
                        </span>
                        <span style={{ fontSize: 13, fontWeight: 700 }}>
                          ${pin.job.total.toFixed(2)}
                        </span>
                      </div>
                      <button
                        onClick={() => router.push(`/jobs/${pin.job.id}`)}
                        style={{
                          marginTop: 8,
                          width: "100%",
                          padding: "6px 0",
                          background: STATUS_HEX.scheduled,
                          color: "white",
                          border: "none",
                          borderRadius: 8,
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        View Job →
                      </button>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>
        )}
      </div>

      {/* Route stops list — shown after "Plan Route" */}
      {routeStops.length > 0 && (
        <div className="shrink-0 max-h-60 overflow-y-auto border-t border-border bg-background">
          <div className="px-4 py-2.5 flex items-center justify-between sticky top-0 bg-background border-b border-border z-10">
            <span className="text-sm font-bold text-foreground">
              Optimized Route · {routeStops.length} stop{routeStops.length > 1 ? "s" : ""}
            </span>
            <button
              onClick={handleSaveRoute}
              disabled={routeSaving || routeSaved}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-95 ${
                routeSaved
                  ? "icon-green"
                  : "bg-primary text-white hover:bg-primary/90 disabled:opacity-50"
              }`}
            >
              {routeSaved ? "✓ Saved" : routeSaving ? "Saving…" : "Save Route"}
            </button>
          </div>

          {routeStops.map((stop, i) => (
            <div
              key={stop.job.id}
              className="flex items-center gap-3 px-4 py-2.5 border-b border-border/40 last:border-0"
            >
              <div
                className="size-6 rounded-full flex items-center justify-center text-[11px] font-extrabold text-white shrink-0"
                style={{ background: STATUS_COLORS[stop.job.status] }}
              >
                {i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">
                  {stop.job.job_line_items[0]?.description ?? "Service Job"}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {stop.job.clients?.name}
                  {stop.job.clients?.address && ` · ${stop.job.clients.address}`}
                </p>
              </div>
              <div className="flex gap-0.5 shrink-0">
                <button
                  onClick={() => i > 0 && moveStop(i, i - 1)}
                  disabled={i === 0}
                  className="p-1 rounded-lg hover:bg-muted transition-colors disabled:opacity-20"
                  aria-label="Move up"
                >
                  <span className="material-symbols-outlined text-[18px] text-muted-foreground">arrow_upward</span>
                </button>
                <button
                  onClick={() => i < routeStops.length - 1 && moveStop(i, i + 1)}
                  disabled={i === routeStops.length - 1}
                  className="p-1 rounded-lg hover:bg-muted transition-colors disabled:opacity-20"
                  aria-label="Move down"
                >
                  <span className="material-symbols-outlined text-[18px] text-muted-foreground">arrow_downward</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Legend */}
      <div className="shrink-0 px-4 py-3 bg-background border-t border-border flex items-center gap-4 flex-wrap">
        {(["scheduled", "in_progress", "completed"] as JobStatus[]).map((s) => (
          <div key={s} className="flex items-center gap-1.5">
            <div className="size-3 rounded-full border-2 border-white shadow-sm" style={{ background: STATUS_COLORS[s] }} />
            <span className="text-xs text-muted-foreground font-medium capitalize">{s.replace("_", " ")}</span>
          </div>
        ))}
        <span className="text-xs text-muted-foreground/50 ml-auto">OpenStreetMap</span>
      </div>
    </div>
  );
}
