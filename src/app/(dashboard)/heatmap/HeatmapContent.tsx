"use client";

import { useEffect, useState, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

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
  { value: "density",  label: "Job Density",  icon: "thermostat"   },
  { value: "revenue",  label: "Avg Revenue",  icon: "attach_money" },
  { value: "recency",  label: "Last Job",     icon: "schedule"     },
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

function circleRadius(z: GeoZone, layer: Layer): number {
  if (layer === "density") return Math.max(14, Math.min(42, 14 + z.jobCount * 4));
  if (layer === "revenue") return Math.max(14, Math.min(42, 14 + Math.floor(z.avgRevenue / 50)));
  return 20;
}

function buildMapStyle(layer: "satellite" | "street"): maplibregl.StyleSpecification {
  const tiles = layer === "satellite"
    ? ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"]
    : [
        "https://a.tile.openstreetmap.org/{z}/{x}/{y}.png",
        "https://b.tile.openstreetmap.org/{z}/{x}/{y}.png",
      ];
  return {
    version: 8,
    sources: {
      "base-tiles": {
        type: "raster",
        tiles,
        tileSize: 256,
        attribution: layer === "satellite" ? "Tiles &copy; Esri" : "&copy; OpenStreetMap contributors",
        maxzoom: 19,
      },
    },
    layers: [
      { id: "background", type: "background", paint: { "background-color": "#0d1b2a" } },
      { id: "base-layer", type: "raster", source: "base-tiles" },
    ],
  };
}

function buildPopupHTML(z: GeoZone): string {
  const lastJob = z.daysSinceLastJob !== null
    ? `<div style="display:flex;justify-content:space-between;font-size:12px;">
        <span style="color:rgba(255,255,255,0.5);">Last job</span>
        <span style="font-weight:700;color:rgba(255,255,255,0.9);">${z.daysSinceLastJob === 0 ? "Today" : `${z.daysSinceLastJob}d ago`}</span>
       </div>`
    : "";
  const closeRate = z.conversionRate !== null
    ? `<div style="display:flex;justify-content:space-between;font-size:12px;">
        <span style="color:rgba(255,255,255,0.5);">D2D close rate</span>
        <span style="font-weight:700;color:rgba(255,255,255,0.9);">${z.conversionRate}%</span>
       </div>`
    : "";
  const summary = [
    `${z.jobCount} job${z.jobCount !== 1 ? "s" : ""} done here`,
    z.completedCount > 0 ? `$${z.avgRevenue} avg` : "",
    z.conversionRate !== null ? `${z.conversionRate}% close rate` : "",
  ].filter(Boolean).join(" · ");

  return `
    <div style="min-width:190px;font-family:system-ui,sans-serif;color:rgba(255,255,255,0.9);">
      <div style="font-weight:800;font-size:15px;margin-bottom:10px;color:white;">ZIP ${z.zip}</div>
      <div style="display:grid;gap:6px;">
        <div style="display:flex;justify-content:space-between;font-size:12px;">
          <span style="color:rgba(255,255,255,0.5);">Jobs done</span>
          <span style="font-weight:700;color:rgba(255,255,255,0.9);">${z.jobCount}</span>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:12px;">
          <span style="color:rgba(255,255,255,0.5);">Avg revenue</span>
          <span style="font-weight:700;color:rgba(255,255,255,0.9);">${z.completedCount > 0 ? `$${z.avgRevenue}` : "—"}</span>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:12px;">
          <span style="color:rgba(255,255,255,0.5);">Total revenue</span>
          <span style="font-weight:700;color:rgba(255,255,255,0.9);">${z.completedCount > 0 ? `$${Math.round(z.totalRevenue).toLocaleString()}` : "—"}</span>
        </div>
        ${lastJob}
        ${closeRate}
      </div>
      <div style="margin-top:10px;padding:7px 10px;background:rgba(255,255,255,0.08);border-radius:8px;font-size:11px;color:rgba(255,255,255,0.6);font-weight:600;line-height:1.5;">
        ${summary}
      </div>
    </div>
  `;
}

const glassStyle = {
  background: "rgba(0,0,0,0.45)",
  backdropFilter: "blur(8px)",
  WebkitBackdropFilter: "blur(8px)",
} as const;

export default function HeatmapContent({ initialZones }: { initialZones: ZoneData[] }) {
  const [zones] = useState<ZoneData[]>(initialZones);
  const [geoZones, setGeoZones] = useState<GeoZone[]>([]);
  const [loading] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [progress, setProgress] = useState(0);
  const [total, setTotal] = useState(0);
  const [layer, setLayer] = useState<Layer>("density");
  const [mapLayer, setMapLayer] = useState<"satellite" | "street">("satellite");

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const hasFlownRef = useRef(false);

  // Inject CSS to fix global transition bleed into MapLibre's DOM + style the popup
  useEffect(() => {
    const el = document.createElement("style");
    el.id = "heatmap-maplibre-overrides";
    el.textContent = `
      .maplibregl-popup-content {
        background: rgba(10,18,28,0.92) !important;
        backdrop-filter: blur(12px) !important;
        -webkit-backdrop-filter: blur(12px) !important;
        border: 1px solid rgba(255,255,255,0.10) !important;
        border-radius: 12px !important;
        padding: 14px !important;
        box-shadow: 0 8px 32px rgba(0,0,0,0.55) !important;
        transition: none !important;
      }
      .maplibregl-popup-anchor-bottom .maplibregl-popup-tip { border-top-color: rgba(10,18,28,0.92) !important; }
      .maplibregl-popup-anchor-top .maplibregl-popup-tip { border-bottom-color: rgba(10,18,28,0.92) !important; }
      .maplibregl-popup-anchor-left .maplibregl-popup-tip { border-right-color: rgba(10,18,28,0.92) !important; }
      .maplibregl-popup-anchor-right .maplibregl-popup-tip { border-left-color: rgba(10,18,28,0.92) !important; }
      .maplibregl-popup-anchor-bottom-left .maplibregl-popup-tip { border-top-color: rgba(10,18,28,0.92) !important; }
      .maplibregl-popup-anchor-bottom-right .maplibregl-popup-tip { border-top-color: rgba(10,18,28,0.92) !important; }
      .maplibregl-popup-tip { transition: none !important; }
      .maplibregl-ctrl-group { background: rgba(0,0,0,0.45) !important; backdrop-filter: blur(8px) !important; border: 1px solid rgba(255,255,255,0.12) !important; }
      .maplibregl-ctrl-group button { background: transparent !important; color: white !important; transition: none !important; }
      .maplibregl-ctrl-group button:hover { background: rgba(255,255,255,0.15) !important; }
      .maplibregl-ctrl-attrib { background: rgba(0,0,0,0.4) !important; backdrop-filter: blur(4px) !important; border-radius: 6px !important; color: rgba(255,255,255,0.55) !important; }
      .maplibregl-ctrl-attrib a { color: rgba(255,255,255,0.55) !important; }
    `;
    if (!document.getElementById("heatmap-maplibre-overrides")) document.head.appendChild(el);
    return () => document.getElementById("heatmap-maplibre-overrides")?.remove();
  }, []);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: buildMapStyle("satellite"),
      center: [-98.35, 39.5],
      zoom: 4,
      attributionControl: false,
    });
    map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Swap tile layer when satellite/street toggle changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.setStyle(buildMapStyle(mapLayer));
    map.once("style.load", () => {
      markersRef.current.forEach((m) => m.addTo(map));
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapLayer]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    if (geoZones.length === 0) return;

    const vals = geoZones.map((z) =>
      layer === "density" ? z.jobCount :
      layer === "revenue" ? z.avgRevenue :
      (z.daysSinceLastJob ?? 999)
    );
    const minVal = Math.min(...vals);
    const maxVal = Math.max(...vals);

    for (const z of geoZones) {
      const val =
        layer === "density" ? z.jobCount :
        layer === "revenue" ? z.avgRevenue :
        (z.daysSinceLastJob ?? 999);
      const color = heatColor(normalize(val, minVal, maxVal), layer);
      const r = circleRadius(z, layer);
      const size = r * 2;

      const el = document.createElement("div");
      // transition:none overrides the global 250ms transition from globals.css
      el.style.cssText = `width:${size}px;height:${size}px;border-radius:50%;background:${color};border:2.5px solid rgba(255,255,255,0.85);opacity:0.85;box-shadow:0 2px 12px rgba(0,0,0,.55);cursor:pointer;transition:none;`;
      el.addEventListener("mouseenter", () => { el.style.transform = "scale(1.15)"; });
      el.addEventListener("mouseleave", () => { el.style.transform = ""; });

      const popup = new maplibregl.Popup({ closeButton: false, offset: r, maxWidth: "260px" })
        .setHTML(buildPopupHTML(z));

      const marker = new maplibregl.Marker({ element: el, anchor: "center" })
        .setLngLat([z.lng, z.lat])
        .setPopup(popup)
        .addTo(map);

      markersRef.current.push(marker);
    }
  }, [geoZones, layer]);

  useEffect(() => {
    if (geoZones.length > 0 && !hasFlownRef.current && mapRef.current) {
      mapRef.current.flyTo({ center: [geoZones[0].lng, geoZones[0].lat], zoom: 10, duration: 1500 });
      hasFlownRef.current = true;
    }
  }, [geoZones]);

  useEffect(() => {
    let cancelled = false;
    async function geocodeAll() {
      const data = initialZones;
      if (!data || data.length === 0) return;
      setTotal(data.length);
      setGeocoding(true);
      const result: GeoZone[] = [];
      for (let i = 0; i < data.length; i++) {
        if (cancelled) return;
        const zone = data[i];
        const coords = await geocodeZip(zone.zip);
        if (cancelled) return;
        setProgress(i + 1);
        if (coords) {
          result.push({ ...zone, lat: coords[0], lng: coords[1] });
          setGeoZones([...result]);
        }
        if (i < data.length - 1) await sleep(1100);
      }
      setGeocoding(false);
    }
    geocodeAll();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ position: "relative", flex: 1, minHeight: 0, height: "100dvh", overflow: "hidden" }}>
      {/* Map canvas */}
      <div ref={mapContainerRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />

      {/* Loading overlay */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center" style={{ background: "#0d1b2a" }}>
          <p className="text-sm text-white/60">Loading data…</p>
        </div>
      )}

      {/* Empty state overlay */}
      {!loading && zones.length === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center px-6" style={{ background: "#0d1b2a" }}>
          <span className="material-symbols-outlined text-[56px] text-white/20">thermostat</span>
          <p className="text-sm font-medium text-white/60">No job data to map yet</p>
          <p className="text-xs text-white/30">
            Add addresses to your clients and complete jobs to see your territory intelligence here
          </p>
        </div>
      )}

      {/* Floating controls — all in a single top-left column */}
      <div className="absolute top-3 left-3 z-[30] flex flex-col gap-2 pointer-events-none">

        {/* Satellite / Street toggle */}
        <div className="flex rounded-xl overflow-hidden pointer-events-auto" style={{ border: "1px solid rgba(255,255,255,0.15)", width: "fit-content" }}>
          <button
            onClick={() => setMapLayer("satellite")}
            className="px-2.5 py-1 text-[11px] font-bold transition-none"
            style={mapLayer === "satellite" ? { background: "rgba(255,255,255,0.25)", color: "white" } : { ...glassStyle, color: "rgba(255,255,255,0.55)" }}
          >
            Satellite
          </button>
          <button
            onClick={() => setMapLayer("street")}
            className="px-2.5 py-1 text-[11px] font-bold transition-none"
            style={mapLayer === "street" ? { background: "rgba(255,255,255,0.25)", color: "white" } : { ...glassStyle, color: "rgba(255,255,255,0.55)" }}
          >
            Street
          </button>
        </div>

        {/* Title card */}
        <div className="flex flex-col gap-0.5 px-3 py-2.5 rounded-2xl pointer-events-auto" style={glassStyle}>
          <span className="text-sm font-extrabold text-white tracking-tight">Territory Heat Map</span>
          <span className="text-[11px] font-medium" style={{ color: "rgba(255,255,255,0.55)" }}>
            {loading
              ? "Loading…"
              : geocoding
              ? `Mapping ZIP ${progress}/${total}…`
              : `${geoZones.length} ZIP code${geoZones.length !== 1 ? "s" : ""} mapped`}
          </span>
          {geocoding && (
            <div className="mt-1.5 h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.15)", width: 120 }}>
              <div
                className="h-full rounded-full"
                style={{
                  width: `${total > 0 ? (progress / total) * 100 : 0}%`,
                  background: "rgba(255,255,255,0.7)",
                  transition: "width 0.3s ease",
                }}
              />
            </div>
          )}
        </div>

        {/* Layer tabs */}
        <div className="flex rounded-xl overflow-hidden pointer-events-auto" style={glassStyle}>
          {LAYER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setLayer(opt.value)}
              className="flex items-center gap-1 px-3 py-1.5 text-[11px] font-extrabold transition-none active:scale-95"
              style={
                layer === opt.value
                  ? { color: "white", background: "rgba(255,255,255,0.18)" }
                  : { color: "rgba(255,255,255,0.55)" }
              }
            >
              <span className="material-symbols-outlined text-[13px]" style={{ fontVariationSettings: layer === opt.value ? "'FILL' 1" : "'FILL' 0" }}>
                {opt.icon}
              </span>
              {opt.label}
            </button>
          ))}
        </div>

        {/* Legend */}
        {geoZones.length > 0 && (
          <div className="flex items-center gap-3 px-3 py-2 rounded-xl pointer-events-auto" style={glassStyle}>
            {layer === "recency" ? (
              <>
                <div className="flex items-center gap-1.5">
                  <div className="size-2.5 rounded-full" style={{ background: "#22C55E" }} />
                  <span className="text-[11px] font-semibold" style={{ color: "rgba(255,255,255,0.7)" }}>Recent</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="size-2.5 rounded-full" style={{ background: "#EAB308" }} />
                  <span className="text-[11px] font-semibold" style={{ color: "rgba(255,255,255,0.7)" }}>30–90d</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="size-2.5 rounded-full" style={{ background: "#EF4444" }} />
                  <span className="text-[11px] font-semibold" style={{ color: "rgba(255,255,255,0.7)" }}>Stale</span>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-1.5">
                  <div className="size-2.5 rounded-full" style={{ background: "#FCD34D" }} />
                  <span className="text-[11px] font-semibold" style={{ color: "rgba(255,255,255,0.7)" }}>Low</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="size-2.5 rounded-full" style={{ background: "#F97316" }} />
                  <span className="text-[11px] font-semibold" style={{ color: "rgba(255,255,255,0.7)" }}>Mid</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="size-2.5 rounded-full" style={{ background: "#EF4444" }} />
                  <span className="text-[11px] font-semibold" style={{ color: "rgba(255,255,255,0.7)" }}>High</span>
                </div>
              </>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
