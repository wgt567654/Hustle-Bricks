"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";

type ZoneData = {
  zip: string;
  jobCount: number;
  completedCount: number;
  totalRevenue: number;
  avgRevenue: number;
  lastJobDate: string | null;
  daysSinceLastJob: number | null;
  canvassTotal: number;
  canvassBooked: number;
  conversionRate: number | null;
};

type GeoZone = ZoneData & { lat: number; lng: number };

type Layer = "density" | "revenue" | "recency";

const LAYER_OPTIONS: { value: Layer; label: string; icon: string }[] = [
  { value: "density",  label: "Job Density",  icon: "heat_map"      },
  { value: "revenue",  label: "Avg Revenue",  icon: "attach_money"  },
  { value: "recency",  label: "Last Job",     icon: "schedule"      },
];

async function geocodeZip(zip: string): Promise<[number, number] | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?postalcode=${zip}&countrycodes=us&format=json&limit=1`,
      { headers: { "User-Agent": "HustleBricks/1.0 (service scheduling app)" } }
    );
    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) {
      return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
    }
  } catch {}
  return null;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function lerpColor(c1: string, c2: string, t: number): string {
  const p = (c: string) => [
    parseInt(c.slice(1, 3), 16),
    parseInt(c.slice(3, 5), 16),
    parseInt(c.slice(5, 7), 16),
  ] as [number, number, number];
  const [r1, g1, b1] = p(c1);
  const [r2, g2, b2] = p(c2);
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const b = Math.round(b1 + (b2 - b1) * t);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

function heatColor(t: number, layer: Layer): string {
  if (layer === "recency") {
    if (t < 0.5) return lerpColor("#22C55E", "#EAB308", t * 2);
    return lerpColor("#EAB308", "#EF4444", (t - 0.5) * 2);
  }
  if (t < 0.5) return lerpColor("#FCD34D", "#F97316", t * 2);
  return lerpColor("#F97316", "#EF4444", (t - 0.5) * 2);
}

function normalize(val: number, min: number, max: number): number {
  if (max === min) return 0.5;
  return Math.max(0, Math.min(1, (val - min) / (max - min)));
}

export default function HeatmapContent() {
  const [zones, setZones] = useState<ZoneData[]>([]);
  const [geoZones, setGeoZones] = useState<GeoZone[]>([]);
  const [loading, setLoading] = useState(true);
  const [geocoding, setGeocoding] = useState(false);
  const [progress, setProgress] = useState(0);
  const [total, setTotal] = useState(0);
  const [layer, setLayer] = useState<Layer>("density");
  const [center, setCenter] = useState<[number, number]>([39.5, -98.35]);
  const [zoom, setZoom] = useState(4);

  useEffect(() => {
    fetch("/api/heatmap-data")
      .then((r) => r.json())
      .then(async ({ zones: data }: { zones: ZoneData[] }) => {
        setLoading(false);
        setZones(data ?? []);
        if (!data || data.length === 0) return;
        setTotal(data.length);
        setGeocoding(true);
        const result: GeoZone[] = [];
        for (let i = 0; i < data.length; i++) {
          const zone = data[i];
          const coords = await geocodeZip(zone.zip);
          setProgress(i + 1);
          if (coords) {
            result.push({ ...zone, lat: coords[0], lng: coords[1] });
            if (result.length === 1) {
              setCenter(coords);
              setZoom(10);
            }
            setGeoZones([...result]);
          }
          if (i < data.length - 1) await sleep(1100);
        }
        setGeocoding(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const vals = geoZones.map((z) =>
    layer === "density" ? z.jobCount :
    layer === "revenue" ? z.avgRevenue :
    (z.daysSinceLastJob ?? 999)
  );
  const minVal = vals.length > 0 ? Math.min(...vals) : 0;
  const maxVal = vals.length > 0 ? Math.max(...vals) : 1;

  function circleColor(z: GeoZone): string {
    const val =
      layer === "density" ? z.jobCount :
      layer === "revenue" ? z.avgRevenue :
      (z.daysSinceLastJob ?? 999);
    return heatColor(normalize(val, minVal, maxVal), layer);
  }

  function circleRadius(z: GeoZone): number {
    if (layer === "density") return Math.max(14, Math.min(42, 14 + z.jobCount * 4));
    if (layer === "revenue") return Math.max(14, Math.min(42, 14 + Math.floor(z.avgRevenue / 50)));
    return 20;
  }

  return (
    <div className="flex flex-col h-screen max-h-screen overflow-hidden">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 flex flex-col gap-3 shrink-0 bg-background border-b border-border">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-foreground">Territory Heat Map</h1>
            <p className="text-xs text-muted-foreground">
              {loading
                ? "Loading…"
                : geocoding
                ? `Mapping ZIP ${progress}/${total}…`
                : `${geoZones.length} ZIP code${geoZones.length !== 1 ? "s" : ""} mapped`}
            </p>
          </div>
          {geocoding && (
            <div className="w-24 h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${total > 0 ? (progress / total) * 100 : 0}%` }}
              />
            </div>
          )}
        </div>

        {/* Layer toggle */}
        <div className="flex gap-2 overflow-x-auto scrollbar-none">
          {LAYER_OPTIONS.map((opt) => (
            <button key={opt.value} onClick={() => setLayer(opt.value)}>
              <span
                className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                  layer === opt.value
                    ? "bg-primary text-white border-primary"
                    : "border-border text-muted-foreground bg-card hover:bg-muted"
                }`}
              >
                <span className="material-symbols-outlined text-[14px]">{opt.icon}</span>
                {opt.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Map */}
      <div className="flex-1 min-h-0 relative">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-muted-foreground">Loading data…</p>
          </div>
        ) : zones.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-6">
            <span className="material-symbols-outlined text-[56px] text-muted-foreground/30">heat_map</span>
            <p className="text-sm font-medium text-muted-foreground">No job data to map yet</p>
            <p className="text-xs text-muted-foreground/60">
              Add addresses to your clients and complete jobs to see your territory intelligence here
            </p>
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
            {geoZones.map((z) => (
              <CircleMarker
                key={z.zip}
                center={[z.lat, z.lng]}
                radius={circleRadius(z)}
                pathOptions={{
                  color: circleColor(z),
                  fillColor: circleColor(z),
                  fillOpacity: 0.65,
                  weight: 2,
                }}
              >
                <Popup>
                  <div style={{ minWidth: 190 }}>
                    <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 10 }}>
                      ZIP {z.zip}
                    </div>
                    <div style={{ display: "grid", gap: 5 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                        <span style={{ color: "#666" }}>Jobs done</span>
                        <span style={{ fontWeight: 700 }}>{z.jobCount}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                        <span style={{ color: "#666" }}>Avg revenue</span>
                        <span style={{ fontWeight: 700 }}>
                          {z.completedCount > 0 ? `$${z.avgRevenue}` : "—"}
                        </span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                        <span style={{ color: "#666" }}>Total revenue</span>
                        <span style={{ fontWeight: 700 }}>
                          {z.completedCount > 0 ? `$${Math.round(z.totalRevenue).toLocaleString()}` : "—"}
                        </span>
                      </div>
                      {z.daysSinceLastJob !== null && (
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                          <span style={{ color: "#666" }}>Last job</span>
                          <span style={{ fontWeight: 700 }}>
                            {z.daysSinceLastJob === 0 ? "Today" : `${z.daysSinceLastJob}d ago`}
                          </span>
                        </div>
                      )}
                      {z.conversionRate !== null && (
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                          <span style={{ color: "#666" }}>D2D close rate</span>
                          <span style={{ fontWeight: 700 }}>{z.conversionRate}%</span>
                        </div>
                      )}
                    </div>
                    <div
                      style={{
                        marginTop: 10,
                        padding: "7px 10px",
                        background: "#F3F4F6",
                        borderRadius: 8,
                        fontSize: 11,
                        color: "#374151",
                        fontWeight: 600,
                        lineHeight: 1.5,
                      }}
                    >
                      {z.jobCount} job{z.jobCount !== 1 ? "s" : ""} done here
                      {z.completedCount > 0 && ` · $${z.avgRevenue} avg`}
                      {z.conversionRate !== null && ` · ${z.conversionRate}% close rate`}
                    </div>
                  </div>
                </Popup>
              </CircleMarker>
            ))}
          </MapContainer>
        )}
      </div>

      {/* Legend */}
      {geoZones.length > 0 && (
        <div className="shrink-0 px-4 py-3 bg-background border-t border-border flex items-center gap-4 flex-wrap">
          {layer === "recency" ? (
            <>
              <div className="flex items-center gap-1.5">
                <div className="size-3 rounded-full" style={{ background: "#22C55E" }} />
                <span className="text-xs text-muted-foreground">Recent</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="size-3 rounded-full" style={{ background: "#EAB308" }} />
                <span className="text-xs text-muted-foreground">30–90 days</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="size-3 rounded-full" style={{ background: "#EF4444" }} />
                <span className="text-xs text-muted-foreground">Stale (&gt;90d)</span>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-1.5">
                <div className="size-3 rounded-full" style={{ background: "#FCD34D" }} />
                <span className="text-xs text-muted-foreground">Low</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="size-3 rounded-full" style={{ background: "#F97316" }} />
                <span className="text-xs text-muted-foreground">Medium</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="size-3 rounded-full" style={{ background: "#EF4444" }} />
                <span className="text-xs text-muted-foreground">High</span>
              </div>
            </>
          )}
          <span className="text-xs text-muted-foreground/50 ml-auto">OpenStreetMap · Nominatim</span>
        </div>
      )}
    </div>
  );
}
