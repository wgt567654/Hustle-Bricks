"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/badge";

type JobStatus = "scheduled" | "in_progress" | "completed" | "cancelled";

type MapJob = {
  id: string;
  status: JobStatus;
  total: number;
  scheduled_at: string | null;
  job_line_items: { description: string }[];
  clients: { name: string; address: string | null } | null;
};

type Pin = {
  job: MapJob;
  lat: number;
  lng: number;
};

const STATUS_COLORS: Record<JobStatus, string> = {
  scheduled: "#007AFF",
  in_progress: "#ea580c",
  completed: "#16a34a",
  cancelled: "#6b7280",
};

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
  const [pins, setPins] = useState<Pin[]>([]);
  const [loading, setLoading] = useState(true);
  const [geocoding, setGeocoding] = useState(false);
  const [progress, setProgress] = useState(0);
  const [total, setTotal] = useState(0);
  const [filterStatus, setFilterStatus] = useState<JobStatus | "all">("all");
  const [center, setCenter] = useState<[number, number]>([39.5, -98.35]);
  const [zoom, setZoom] = useState(4);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: business } = await supabase
        .from("businesses")
        .select("id")
        .eq("owner_id", user.id)
        .single();
      if (!business) return;

      const { data: jobs } = await supabase
        .from("jobs")
        .select("id, status, total, scheduled_at, job_line_items(description), clients(name, address)")
        .eq("business_id", business.id)
        .not("status", "eq", "cancelled")
        .order("scheduled_at", { ascending: false });

      setLoading(false);

      const jobList = (jobs as unknown as MapJob[]) ?? [];
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

  const filtered = filterStatus === "all" ? pins : pins.filter((p) => p.job.status === filterStatus);
  const counts = {
    scheduled: pins.filter((p) => p.job.status === "scheduled").length,
    in_progress: pins.filter((p) => p.job.status === "in_progress").length,
    completed: pins.filter((p) => p.job.status === "completed").length,
  };

  return (
    <div className="flex flex-col h-screen max-h-screen overflow-hidden">
      {/* Header */}
      <div className="px-4 py-4 flex flex-col gap-3 shrink-0 bg-background border-b border-border">
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
                  className="h-full rounded-full bg-[#007AFF] transition-all"
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
                    ? "bg-[#007AFF] text-white hover:bg-[#007AFF]/90"
                    : "bg-card text-muted-foreground border border-border hover:bg-muted font-medium"
                }`}
                variant={filterStatus === f.value ? "default" : "outline"}
              >
                {f.label}
              </Badge>
            </button>
          ))}
        </div>
      </div>

      {/* Map */}
      <div className="flex-1 relative">
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
            {filtered.map((pin) => (
              <Marker
                key={pin.job.id}
                position={[pin.lat, pin.lng]}
                icon={makeMarker(STATUS_COLORS[pin.job.status])}
              >
                <Popup>
                  <div style={{ minWidth: 180 }}>
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
                        background: "#007AFF",
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
            ))}
          </MapContainer>
        )}
      </div>

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
