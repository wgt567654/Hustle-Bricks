"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { MapContainer, TileLayer, Marker, Polyline, useMapEvents, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { nearestNeighborTSP, buildGoogleMapsRouteUrls } from "@/lib/routeOptimizer";

// ─── Types ────────────────────────────────────────────────────────────────────

type CanvassingStatus = "not_visited" | "no_answer" | "no" | "interested" | "booked";
type MapMode = "canvass" | "route";
type RouteFilter = CanvassingStatus | "visited";

type CanvassingProperty = {
  id: string;
  lat: number;
  lng: number;
  address: string | null;
  status: CanvassingStatus;
  notes: string | null;
  follow_up_needed: boolean;
  follow_up_date: string | null;
  follow_up_notes: string | null;
  last_visited_at: string | null;
  visited_by: string | null;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<CanvassingStatus, string> = {
  not_visited: "#9CA3AF",
  no_answer:   "#F59E0B",
  no:          "#EF4444",
  interested:  "#3B82F6",
  booked:      "#22C55E",
};

const STATUS_LABELS: Record<CanvassingStatus, string> = {
  not_visited: "Not Visited",
  no_answer:   "No Answer",
  no:          "Not Interested",
  interested:  "Interested",
  booked:      "Booked",
};

const TILE_LAYERS = {
  satellite: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "Tiles &copy; Esri &mdash; Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, GIS User Community",
  },
  street: {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  },
};

const ROUTE_FILTER_OPTIONS: { value: RouteFilter; label: string }[] = [
  { value: "interested", label: "Interested" },
  { value: "no_answer",  label: "No Answer" },
  { value: "booked",     label: "Booked" },
  { value: "visited",    label: "All Visited" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeMarker(color: string, opacity = 1) {
  return L.divIcon({
    html: `<div style="width:18px;height:18px;border-radius:50%;background:${color};border:2.5px solid white;box-shadow:0 2px 6px rgba(0,0,0,.35);opacity:${opacity}"></div>`,
    className: "",
    iconSize: [18, 18],
    iconAnchor: [9, 9],
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

function makeLocationMarker() {
  return L.divIcon({
    html: `
      <div style="position:relative;width:24px;height:24px">
        <div class="canvass-pulse" style="position:absolute;inset:-6px;border-radius:50%;background:#3B82F6;opacity:0.25"></div>
        <div style="position:absolute;inset:3px;border-radius:50%;background:#3B82F6;border:2.5px solid white;box-shadow:0 2px 8px rgba(59,130,246,.6)"></div>
      </div>
    `,
    className: "",
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}

async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
      { headers: { "User-Agent": "HustleBricks/1.0 (service scheduling app)" } }
    );
    const data = await res.json();
    return (data.display_name as string) ?? null;
  } catch {
    return null;
  }
}

function normalizeProperty(raw: Record<string, unknown>): CanvassingProperty {
  return {
    ...(raw as CanvassingProperty),
    lat: typeof raw.lat === "string" ? parseFloat(raw.lat) : (raw.lat as number),
    lng: typeof raw.lng === "string" ? parseFloat(raw.lng) : (raw.lng as number),
  };
}

function filterForRoute(properties: CanvassingProperty[], filter: RouteFilter): CanvassingProperty[] {
  if (filter === "visited") return properties.filter((p) => p.status !== "not_visited");
  return properties.filter((p) => p.status === filter);
}

// ─── Inner map components ─────────────────────────────────────────────────────

function MapClickHandler({
  onMapClick,
  skipRef,
  enabled,
}: {
  onMapClick: (lat: number, lng: number) => void;
  skipRef: React.RefObject<boolean>;
  enabled: boolean;
}) {
  useMapEvents({
    click(e) {
      if (!enabled) return;
      if (skipRef.current) { skipRef.current = false; return; }
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function FlyToController({ target }: { target: { coords: [number, number]; zoom: number } | null }) {
  const map = useMap();
  const prevRef = useRef<{ coords: [number, number]; zoom: number } | null>(null);
  useEffect(() => {
    if (target && target !== prevRef.current) {
      prevRef.current = target;
      map.flyTo(target.coords, target.zoom, { animate: true, duration: 0.8 });
    }
  }, [target, map]);
  return null;
}

// ─── Quick Action Sheet ───────────────────────────────────────────────────────

function QuickActionSheet({
  property,
  onClose,
  onStatusUpdate,
  onBookNow,
}: {
  property: CanvassingProperty;
  onClose: () => void;
  onStatusUpdate: (updates: Partial<CanvassingProperty>) => Promise<void>;
  onBookNow: () => void;
}) {
  const [mode, setMode] = useState<"actions" | "interested">("actions");
  const [notes, setNotes] = useState(property.notes ?? "");
  const [followUpDate, setFollowUpDate] = useState(property.follow_up_date ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSimpleStatus(status: CanvassingStatus) {
    setSaving(true);
    await onStatusUpdate({ status });
    setSaving(false);
    onClose();
  }

  async function handleInterestedSave() {
    setSaving(true);
    await onStatusUpdate({
      status: "interested",
      notes: notes.trim() || null,
      follow_up_needed: !!followUpDate,
      follow_up_date: followUpDate || null,
    });
    setSaving(false);
    onClose();
  }

  async function handleBookNow() {
    setSaving(true);
    await onStatusUpdate({ status: "booked" });
    setSaving(false);
    onBookNow();
  }

  const displayStatus = property.status !== "not_visited" ? property.status : null;

  return (
    <div
      className="fixed inset-0 z-[2000]"
      style={{ background: "rgba(0,0,0,0.25)", backdropFilter: "blur(2px)", WebkitBackdropFilter: "blur(2px)" }}
      onClick={onClose}
    >
      <div
        className="absolute bottom-0 left-0 w-full bg-background rounded-t-[28px] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-9 h-1 rounded-full bg-muted-foreground/25" />
        </div>
        <div className="px-5 pb-10 pt-3">
          {displayStatus && (
            <div className="flex items-center gap-1.5 mb-1.5">
              <span className="size-2 rounded-full inline-block shrink-0" style={{ background: STATUS_COLORS[displayStatus] }} />
              <span className="text-xs font-semibold" style={{ color: STATUS_COLORS[displayStatus] }}>
                {STATUS_LABELS[displayStatus]}
              </span>
            </div>
          )}
          <p className="text-sm font-semibold text-foreground mb-5 leading-snug line-clamp-3">
            {property.address ?? `${property.lat.toFixed(5)}, ${property.lng.toFixed(5)}`}
          </p>

          {mode === "actions" && (
            <div className="flex flex-col gap-2.5">
              <div className="grid grid-cols-2 gap-2.5">
                <button onClick={() => handleSimpleStatus("no_answer")} disabled={saving}
                  className="py-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 font-bold text-sm active:scale-95 transition-all disabled:opacity-50">
                  No Answer
                </button>
                <button onClick={() => handleSimpleStatus("no")} disabled={saving}
                  className="py-4 rounded-2xl bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 font-bold text-sm active:scale-95 transition-all disabled:opacity-50">
                  Not Interested
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <button onClick={() => setMode("interested")} disabled={saving}
                  className="py-4 rounded-2xl bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 font-bold text-sm active:scale-95 transition-all disabled:opacity-50">
                  Interested
                </button>
                <button onClick={handleBookNow} disabled={saving}
                  className="py-4 rounded-2xl bg-green-500 text-white font-bold text-sm active:scale-95 transition-all disabled:opacity-50"
                  style={{ boxShadow: "0 4px 14px rgba(34,197,94,.4)" }}>
                  {saving ? "Saving…" : "Book Now →"}
                </button>
              </div>
            </div>
          )}

          {mode === "interested" && (
            <div className="flex flex-col gap-3">
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
                placeholder="Notes (optional)…" rows={3} autoFocus
                className="w-full rounded-xl border border-border bg-muted/40 px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring/40 resize-none" />
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-muted-foreground">Follow-up date (optional)</label>
                <input type="date" value={followUpDate} onChange={(e) => setFollowUpDate(e.target.value)}
                  className="w-full rounded-xl border border-border bg-muted/40 px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/40" />
              </div>
              <div className="flex gap-2 mt-1">
                <button onClick={() => setMode("actions")} disabled={saving}
                  className="flex-1 py-3.5 rounded-2xl border border-border text-muted-foreground font-bold text-sm active:scale-95 transition-all disabled:opacity-50">
                  Back
                </button>
                <button onClick={handleInterestedSave} disabled={saving}
                  className="flex-[2] py-3.5 rounded-2xl bg-blue-500 text-white font-bold text-sm active:scale-95 transition-all disabled:opacity-50">
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CanvassingMap() {
  const router = useRouter();

  // Core state
  const [businessId, setBusinessId]     = useState<string | null>(null);
  const [teamMemberId, setTeamMemberId] = useState<string | null>(null);
  const [properties, setProperties]     = useState<CanvassingProperty[]>([]);
  const [selected, setSelected]         = useState<CanvassingProperty | null>(null);
  const [loading, setLoading]           = useState(true);
  const [creating, setCreating]         = useState(false);
  const [filterStatus, setFilterStatus] = useState<CanvassingStatus | "all">("all");
  const [center, setCenter]             = useState<[number, number]>([39.5, -98.35]);
  const [zoom, setZoom]                 = useState(4);
  const [userPosition, setUserPosition] = useState<[number, number] | null>(null);
  const [flyTarget, setFlyTarget]       = useState<{ coords: [number, number]; zoom: number } | null>(null);
  const [mapLayer, setMapLayer]         = useState<"satellite" | "street">("satellite");

  // Mode toggle
  const [mapMode, setMapMode]               = useState<MapMode>("canvass");

  // Route mode state
  const [routeFilter, setRouteFilter]       = useState<RouteFilter>("interested");
  const [routeStops, setRouteStops]         = useState<CanvassingProperty[]>([]);
  const [routeOptimizing, setRouteOptimizing] = useState(false);
  const [routeUrls, setRouteUrls]           = useState<string[]>([]);

  const skipClickRef = useRef(false);
  const watchIdRef   = useRef<number | null>(null);

  // Pulse animation CSS
  useEffect(() => {
    const style = document.createElement("style");
    style.id = "canvass-pulse-style";
    style.textContent = `
      @keyframes canvass-pulse {
        0%   { transform: scale(0.8); opacity: 0.5; }
        100% { transform: scale(2.4); opacity: 0; }
      }
      .canvass-pulse { animation: canvass-pulse 2s ease-out infinite; }
    `;
    if (!document.getElementById("canvass-pulse-style")) document.head.appendChild(style);
    return () => document.getElementById("canvass-pulse-style")?.remove();
  }, []);

  // Data load + GPS
  useEffect(() => {
    async function init() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: biz } = await supabase.from("businesses").select("id").eq("owner_id", user.id).maybeSingle();
      let bizId: string;

      if (biz) {
        bizId = biz.id;
        setBusinessId(bizId);
      } else {
        const { data: tm } = await supabase.from("team_members").select("id, business_id")
          .eq("user_id", user.id).eq("is_active", true).single();
        if (!tm) return;
        bizId = (tm as { id: string; business_id: string }).business_id;
        setBusinessId(bizId);
        setTeamMemberId((tm as { id: string; business_id: string }).id);
      }

      const { data: props } = await supabase.from("canvassing_properties").select("*")
        .eq("business_id", bizId).order("created_at", { ascending: false });

      const propList = (props ?? []).map((p) => normalizeProperty(p as Record<string, unknown>));
      setProperties(propList);

      const geoCoords = await new Promise<[number, number] | null>((resolve) => {
        if (!navigator.geolocation) return resolve(null);
        const t = setTimeout(() => resolve(null), 4000);
        navigator.geolocation.getCurrentPosition(
          (pos) => { clearTimeout(t); resolve([pos.coords.latitude, pos.coords.longitude]); },
          () => { clearTimeout(t); resolve(null); },
          { enableHighAccuracy: true, timeout: 4000 }
        );
      });

      if (geoCoords) {
        setUserPosition(geoCoords);
        setCenter(geoCoords);
        setZoom(17);
      } else if (propList.length > 0) {
        setCenter([propList[0].lat, propList[0].lng]);
        setZoom(15);
      }

      setLoading(false);

      watchIdRef.current = navigator.geolocation?.watchPosition(
        (pos) => setUserPosition([pos.coords.latitude, pos.coords.longitude]),
        () => {},
        { enableHighAccuracy: true }
      ) ?? null;
    }

    init();
    return () => { if (watchIdRef.current !== null) navigator.geolocation?.clearWatch(watchIdRef.current); };
  }, []);

  // Map click — only in canvass mode
  const handleMapClick = useCallback(async (lat: number, lng: number) => {
    if (!businessId || creating) return;
    setCreating(true);
    const address = await reverseGeocode(lat, lng);
    const supabase = createClient();
    const { data: newProp } = await supabase.from("canvassing_properties")
      .insert({ business_id: businessId, lat, lng, address, status: "not_visited" })
      .select("*").single();
    if (newProp) {
      const prop = normalizeProperty(newProp as Record<string, unknown>);
      setProperties((prev) => [prop, ...prev]);
      setSelected(prop);
    }
    setCreating(false);
  }, [businessId, creating]);

  // Status update
  async function handleStatusUpdate(id: string, updates: Partial<CanvassingProperty>) {
    const supabase = createClient();
    const payload: Record<string, unknown> = { ...updates, last_visited_at: new Date().toISOString() };
    if (teamMemberId) payload.visited_by = teamMemberId;
    const { data: updated } = await supabase.from("canvassing_properties")
      .update(payload).eq("id", id).select("*").single();
    if (updated) {
      const prop = normalizeProperty(updated as Record<string, unknown>);
      setProperties((prev) => prev.map((p) => (p.id === id ? prop : p)));
    }
  }

  // Route optimization
  async function handleOptimize() {
    const candidates = filterForRoute(properties, routeFilter);
    if (candidates.length === 0) return;
    setRouteOptimizing(true);

    const startPoint = userPosition ? { lat: userPosition[0], lng: userPosition[1] } : undefined;
    const optimized = nearestNeighborTSP(candidates, startPoint);

    // Ensure all stops have an address for Google Maps
    const withAddresses = await Promise.all(
      optimized.map(async (p) => {
        if (p.address) return p;
        const addr = await reverseGeocode(p.lat, p.lng);
        return { ...p, address: addr };
      })
    );

    const urls = buildGoogleMapsRouteUrls(
      withAddresses.map((p) => p.address ?? `${p.lat},${p.lng}`)
    );

    setRouteStops(withAddresses);
    setRouteUrls(urls);
    setRouteOptimizing(false);
  }

  function moveStop(from: number, to: number) {
    const next = [...routeStops];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    setRouteStops(next);
    // Recalculate URLs with new order
    const urls = buildGoogleMapsRouteUrls(next.map((p) => p.address ?? `${p.lat},${p.lng}`));
    setRouteUrls(urls);
  }

  function switchMode(mode: MapMode) {
    setMapMode(mode);
    if (mode === "canvass") {
      setRouteStops([]);
      setRouteUrls([]);
    }
  }

  function recenterOnUser() {
    if (!userPosition) return;
    setFlyTarget({ coords: userPosition, zoom: 17 });
  }

  // Derived
  const filtered = filterStatus === "all" ? properties : properties.filter((p) => p.status === filterStatus);
  const counts = {
    all: properties.length,
    no_answer: properties.filter((p) => p.status === "no_answer").length,
    no: properties.filter((p) => p.status === "no").length,
    interested: properties.filter((p) => p.status === "interested").length,
    booked: properties.filter((p) => p.status === "booked").length,
  };
  const tile = TILE_LAYERS[mapLayer];
  const candidateCount = filterForRoute(properties, routeFilter).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-sm text-muted-foreground">Loading map…</p>
      </div>
    );
  }

  const glassStyle = { background: "rgba(0,0,0,0.45)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" } as const;
  const chipActive  = { background: "rgba(255,255,255,0.95)", color: "#111" } as const;
  const chipInactive = { background: "rgba(0,0,0,0.40)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", color: "rgba(255,255,255,0.85)" } as const;

  return (
    <div className="fixed inset-0 overflow-hidden" style={{ touchAction: "none" }}>
      {/* ── Map (full screen) ── */}
      <div className="absolute inset-0">
        <MapContainer center={center} zoom={zoom} style={{ height: "100%", width: "100%" }} zoomControl={false}>
          <TileLayer url={tile.url} attribution={tile.attribution} />
          <MapClickHandler onMapClick={handleMapClick} skipRef={skipClickRef} enabled={mapMode === "canvass"} />
          <FlyToController target={flyTarget} />

          {/* Route polyline */}
          {mapMode === "route" && routeStops.length > 1 && (
            <Polyline
              positions={[
                ...(userPosition ? [userPosition] : []),
                ...routeStops.map((s) => [s.lat, s.lng] as [number, number]),
              ]}
              pathOptions={{ color: "#3B82F6", weight: 3, opacity: 0.8, dashArray: "8 5" }}
            />
          )}

          {/* Live location dot */}
          {userPosition && (
            <Marker position={userPosition} icon={makeLocationMarker()} interactive={false} zIndexOffset={-500} />
          )}

          {/* Property pins */}
          {(mapMode === "canvass" ? filtered : properties).map((prop) => {
            const routeIdx = routeStops.findIndex((s) => s.id === prop.id);
            const inRoute  = routeIdx >= 0;
            const dimmed   = mapMode === "route" && routeStops.length > 0 && !inRoute;

            const icon = inRoute
              ? makeNumberedMarker(routeIdx + 1, STATUS_COLORS[prop.status])
              : makeMarker(STATUS_COLORS[prop.status], dimmed ? 0.3 : 1);

            return (
              <Marker
                key={prop.id}
                position={[prop.lat, prop.lng]}
                icon={icon}
                zIndexOffset={inRoute ? 1000 : 0}
                eventHandlers={{
                  click: (e) => {
                    e.originalEvent.stopPropagation();
                    skipClickRef.current = true;
                    if (mapMode === "canvass") {
                      setSelected(properties.find((p) => p.id === prop.id) ?? prop);
                    }
                  },
                }}
              />
            );
          })}
        </MapContainer>

        {/* ── Floating top bar ── */}
        <div className="absolute top-3 left-3 right-3 z-[400] flex flex-col gap-2 pointer-events-none">

          {/* Mode toggle — always on top */}
          <div className="flex justify-center pointer-events-auto">
            <div className="flex rounded-2xl overflow-hidden" style={glassStyle}>
              <button
                onClick={() => switchMode("canvass")}
                className="px-5 py-2 text-xs font-extrabold transition-all active:scale-95"
                style={mapMode === "canvass" ? { background: "white", color: "#111" } : { color: "rgba(255,255,255,0.7)" }}
              >
                Canvass
              </button>
              <button
                onClick={() => switchMode("route")}
                className="px-5 py-2 text-xs font-extrabold transition-all active:scale-95"
                style={mapMode === "route" ? { background: "#3B82F6", color: "white" } : { color: "rgba(255,255,255,0.7)" }}
              >
                Route
              </button>
            </div>
          </div>

          {/* ── CANVASS MODE overlay ── */}
          {mapMode === "canvass" && (
            <>
              <div className="flex items-center justify-between gap-2">
                <div className="flex flex-col px-3 py-2 rounded-2xl pointer-events-auto" style={glassStyle}>
                  <span className="text-sm font-extrabold text-white leading-tight">Canvassing</span>
                  <span className="text-[10px] text-white/70 leading-tight">
                    {creating ? "Dropping pin…" : `${properties.length} door${properties.length !== 1 ? "s" : ""} · Tap to log`}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 pointer-events-auto">
                  <Link href="/canvassing/follow-ups"
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold active:scale-95 transition-all"
                    style={{ ...glassStyle, color: "#FCD34D" }}>
                    <span className="material-symbols-outlined text-[13px]" style={{ fontVariationSettings: "'FILL' 1" }}>calendar_today</span>
                    Follow-ups
                  </Link>
                  <Link href="/canvassing/analytics"
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold active:scale-95 transition-all"
                    style={{ ...glassStyle, color: "#93C5FD" }}>
                    <span className="material-symbols-outlined text-[13px]" style={{ fontVariationSettings: "'FILL' 1" }}>leaderboard</span>
                    Analytics
                  </Link>
                </div>
              </div>

              <div className="flex gap-1.5 overflow-x-auto scrollbar-none pointer-events-auto">
                {(["all", "no_answer", "no", "interested", "booked"] as const).map((s) => (
                  <button key={s} onClick={() => setFilterStatus(s)}
                    className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded-full transition-all active:scale-95"
                    style={filterStatus === s ? chipActive : chipInactive}>
                    {s !== "all" && (
                      <span className="size-1.5 rounded-full shrink-0" style={{ background: STATUS_COLORS[s], display: "inline-block" }} />
                    )}
                    {s === "all" ? `All (${counts.all})` : `${STATUS_LABELS[s]} (${counts[s as keyof typeof counts]})`}
                  </button>
                ))}
              </div>
            </>
          )}

          {/* ── ROUTE MODE overlay ── */}
          {mapMode === "route" && (
            <>
              <div className="flex items-center justify-between gap-2">
                <div className="flex flex-col px-3 py-2 rounded-2xl pointer-events-auto" style={glassStyle}>
                  <span className="text-sm font-extrabold text-white leading-tight">Plan Route</span>
                  <span className="text-[10px] text-white/70 leading-tight">
                    {routeStops.length > 0 ? `${routeStops.length} stops optimized` : `${candidateCount} candidate${candidateCount !== 1 ? "s" : ""}`}
                  </span>
                </div>
              </div>

              {/* Status filter + optimize button */}
              <div className="flex gap-1.5 overflow-x-auto scrollbar-none pointer-events-auto">
                {ROUTE_FILTER_OPTIONS.map((opt) => (
                  <button key={opt.value} onClick={() => { setRouteFilter(opt.value); setRouteStops([]); setRouteUrls([]); }}
                    className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded-full transition-all active:scale-95"
                    style={routeFilter === opt.value ? chipActive : chipInactive}>
                    {opt.value !== "visited" && (
                      <span className="size-1.5 rounded-full shrink-0" style={{ background: STATUS_COLORS[opt.value as CanvassingStatus], display: "inline-block" }} />
                    )}
                    {opt.label}
                  </button>
                ))}
              </div>

              <button
                onClick={handleOptimize}
                disabled={routeOptimizing || candidateCount === 0}
                className="pointer-events-auto self-start flex items-center gap-1.5 px-4 py-2 rounded-2xl text-xs font-extrabold active:scale-95 transition-all disabled:opacity-40"
                style={{ background: "#3B82F6", color: "white", boxShadow: "0 4px 14px rgba(59,130,246,.5)" }}
              >
                <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>route</span>
                {routeOptimizing ? "Optimizing…" : `Optimize ${candidateCount} Stop${candidateCount !== 1 ? "s" : ""}`}
              </button>
            </>
          )}
        </div>

        {/* Satellite / Street toggle */}
        <div className="absolute bottom-24 left-3 z-[400] flex rounded-xl overflow-hidden shadow-lg border border-white/20">
          <button onClick={() => setMapLayer("satellite")}
            className={`px-3 py-1.5 text-xs font-bold transition-colors ${mapLayer === "satellite" ? "bg-primary text-white" : "bg-background/90 text-muted-foreground hover:bg-background"}`}>
            Satellite
          </button>
          <button onClick={() => setMapLayer("street")}
            className={`px-3 py-1.5 text-xs font-bold transition-colors ${mapLayer === "street" ? "bg-primary text-white" : "bg-background/90 text-muted-foreground hover:bg-background"}`}>
            Street
          </button>
        </div>

        {/* My location button */}
        <button onClick={recenterOnUser} disabled={!userPosition}
          className="absolute bottom-24 right-3 z-[400] size-10 flex items-center justify-center rounded-full bg-background shadow-lg border border-border active:scale-90 transition-all disabled:opacity-40"
          title="Go to my location">
          <span className="material-symbols-outlined text-[20px] text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>my_location</span>
        </button>
      </div>

      {/* ── Route stop list (slides up from bottom in route mode) ── */}
      {mapMode === "route" && routeStops.length > 0 && (
        <div className="absolute bottom-0 left-0 right-0 z-[500] bg-background rounded-t-[24px] shadow-2xl"
          style={{ maxHeight: "38vh" }}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-border sticky top-0 bg-background rounded-t-[24px]">
            <div className="flex items-center gap-2">
              <div className="w-8 h-1 rounded-full bg-muted-foreground/25 mx-auto absolute left-1/2 -translate-x-1/2 top-3" />
              <span className="text-sm font-bold text-foreground">
                {routeStops.length} stop{routeStops.length !== 1 ? "s" : ""} · Optimized
              </span>
            </div>
            <div className="flex gap-2">
              {routeUrls.map((url, i) => (
                <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-blue-500 text-white text-xs font-bold active:scale-95 transition-all">
                  <span className="material-symbols-outlined text-[13px]">navigation</span>
                  {routeUrls.length > 1 ? `Part ${i + 1}` : "Navigate"}
                </a>
              ))}
            </div>
          </div>

          <div className="overflow-y-auto divide-y divide-border/40" style={{ maxHeight: "calc(38vh - 56px)" }}>
            {routeStops.map((stop, i) => (
              <div key={stop.id} className="flex items-center gap-3 px-4 py-2.5">
                <div className="size-6 rounded-full flex items-center justify-center text-[11px] font-extrabold text-white shrink-0"
                  style={{ background: STATUS_COLORS[stop.status] }}>
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">
                    {stop.address?.split(",")[0] ?? `${stop.lat.toFixed(4)}, ${stop.lng.toFixed(4)}`}
                  </p>
                  <p className="text-xs text-muted-foreground">{STATUS_LABELS[stop.status]}</p>
                </div>
                <div className="flex gap-0.5 shrink-0">
                  <button onClick={() => i > 0 && moveStop(i, i - 1)} disabled={i === 0}
                    className="p-1 rounded-lg hover:bg-muted transition-colors disabled:opacity-20">
                    <span className="material-symbols-outlined text-[18px] text-muted-foreground">arrow_upward</span>
                  </button>
                  <button onClick={() => i < routeStops.length - 1 && moveStop(i, i + 1)} disabled={i === routeStops.length - 1}
                    className="p-1 rounded-lg hover:bg-muted transition-colors disabled:opacity-20">
                    <span className="material-symbols-outlined text-[18px] text-muted-foreground">arrow_downward</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Floating bottom nav ── */}
      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-[500] pointer-events-auto"
        style={{ width: "calc(100% - 32px)", maxWidth: 420 }}>
        <div className="flex items-center justify-around px-4 py-3 rounded-[28px] shadow-2xl"
          style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", border: "1px solid rgba(255,255,255,0.12)" }}>
          {[
            { href: "/",                label: "Home",     icon: "home"           },
            { href: "/calendar",        label: "Schedule", icon: "calendar_month" },
            { href: "/clients",         label: "Clients",  icon: "group"          },
            { href: "/sales-dashboard", label: "Sales",    icon: "leaderboard"    },
            { href: "/map",             label: "Job Map",  icon: "map"            },
          ].map(({ href, label, icon }) => (
            <Link key={href} href={href}
              className="flex flex-col items-center gap-1 active:scale-90 transition-transform">
              <span className="material-symbols-outlined text-[22px] text-white/80" style={{ fontVariationSettings: "'FILL' 0" }}>
                {icon}
              </span>
              <span className="text-[9px] font-semibold text-white/60 leading-none">{label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* ── Quick Action Sheet (canvass mode only) ── */}
      {selected && mapMode === "canvass" && (
        <QuickActionSheet
          property={selected}
          onClose={() => setSelected(null)}
          onStatusUpdate={async (updates) => { await handleStatusUpdate(selected.id, updates); }}
          onBookNow={() => {
            router.push(`/quotes/new?address=${encodeURIComponent(selected.address ?? "")}`);
            setSelected(null);
          }}
        />
      )}
    </div>
  );
}
