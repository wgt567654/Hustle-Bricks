"use client";

import { useEffect, useState, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useRouter } from "next/navigation";

const PALETTE = [
  "#007AFF", "#FF9500", "#34C759", "#FF2D55",
  "#AF52DE", "#5AC8FA", "#FF6B35", "#00C7BE",
  "#30D158", "#BF5AF2", "#FF3A30", "#FFCC00",
];
const UNASSIGNED_COLOR = "#9CA3AF";

type TerritoryJob = {
  id: string;
  status: string;
  total: number;
  job_line_items: { description: string }[];
  clients: { name: string; address: string | null } | null;
};

type Pin = {
  job: TerritoryJob;
  lat: number;
  lng: number;
  memberId: string | null;
};

type Member = {
  id: string;
  name: string;
  zips: string[];
  color: string;
  jobCount: number;
};

function extractZip(address: string): string | null {
  return address.match(/\b(\d{5})\b/)?.[1] ?? null;
}

async function geocode(address: string): Promise<[number, number] | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`,
      { headers: { "User-Agent": "HustleBricks/1.0 (service scheduling app)" } }
    );
    const data = await res.json();
    if (data.length > 0) return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
  } catch {}
  return null;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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
      { id: "background", type: "background", paint: { "background-color": "#1a1a2e" } },
      { id: "base-layer", type: "raster", source: "base-tiles" },
    ],
  };
}

function makePinEl(color: string): HTMLElement {
  const el = document.createElement("div");
  el.style.cssText = `width:16px;height:16px;border-radius:50%;background:${color};border:2.5px solid white;box-shadow:0 2px 6px rgba(0,0,0,.35);cursor:pointer;`;
  return el;
}

export default function TerritoryMapContent({
  initialJobs,
  initialMembers,
  initialZipToMember,
}: {
  initialJobs: TerritoryJob[];
  initialMembers: Member[];
  initialZipToMember: Record<string, string>;
}) {
  const router = useRouter();

  const [pins, setPins] = useState<Pin[]>([]);
  const [members, setMembers] = useState<Member[]>(initialMembers);
  const [loading] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [progress, setProgress] = useState(0);
  const [total, setTotal] = useState(0);
  const [filterMember, setFilterMember] = useState<string>("all");
  const [selectedPin, setSelectedPin] = useState<Pin | null>(null);
  const [mapLayer, setMapLayer] = useState<"satellite" | "street">("street");
  const [mapLoaded, setMapLoaded] = useState(false);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);

  // Map init
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: buildMapStyle("street"),
      center: [-98.35, 39.5],
      zoom: 4,
      attributionControl: false,
    });

    mapRef.current = map;
    map.on("load", () => { map.resize(); setMapLoaded(true); });

    return () => {
      markersRef.current.forEach((m) => m.remove());
      map.remove();
      mapRef.current = null;
      setMapLoaded(false);
    };
  }, []);

  // Data loading (initial data is server-rendered via props; geocoding stays client-side)
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const zipToMember = new Map<string, string>(Object.entries(initialZipToMember));

      const memberList: Member[] = initialMembers.map((m) => ({ ...m, jobCount: 0 }));
      const memberById = new Map<string, Member>(memberList.map((m) => [m.id, m]));
      setMembers(memberList);

      const withAddress = initialJobs.filter((j) => j.clients?.address);
      setTotal(withAddress.length);
      if (withAddress.length === 0) return;

      setGeocoding(true);
      const newPins: Pin[] = [];

      for (let i = 0; i < withAddress.length; i++) {
        if (cancelled) return;
        const job = withAddress[i];
        const address = job.clients!.address!;
        const zip = extractZip(address);
        const memberId = zip ? (zipToMember.get(zip) ?? null) : null;

        const coords = await geocode(address);
        if (cancelled) return;
        setProgress(i + 1);
        if (coords) {
          newPins.push({ job, lat: coords[0], lng: coords[1], memberId });
          if (memberId) { const m = memberById.get(memberId); if (m) m.jobCount++; }
          if (newPins.length === 1 && mapRef.current) {
            mapRef.current.flyTo({ center: [coords[1], coords[0]], zoom: 11, duration: 800 });
          }
        }
        setPins([...newPins]);
        if (i < withAddress.length - 1) await sleep(1100);
      }

      setMembers([...memberList]);
      setGeocoding(false);
    }
    load();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    const filtered =
      filterMember === "all" ? pins :
      filterMember === "unassigned" ? pins.filter((p) => !p.memberId) :
      pins.filter((p) => p.memberId === filterMember);

    filtered.forEach((pin) => {
      const color = pin.memberId
        ? (members.find((m) => m.id === pin.memberId)?.color ?? UNASSIGNED_COLOR)
        : UNASSIGNED_COLOR;

      const el = makePinEl(color);
      el.addEventListener("click", (e) => { e.stopPropagation(); setSelectedPin(pin); });

      const marker = new maplibregl.Marker({ element: el, anchor: "center" })
        .setLngLat([pin.lng, pin.lat])
        .addTo(map);
      markersRef.current.push(marker);
    });
  }, [mapLoaded, pins, filterMember, members]);

  // Tile layer switching — markers survive style changes (they're DOM elements)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    setMapLoaded(false);
    map.setStyle(buildMapStyle(mapLayer));
    map.once("style.load", () => setMapLoaded(true));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapLayer]);

  const membersWithZips = members.filter((m) => m.zips.length > 0);
  const unassignedCount = pins.filter((p) => !p.memberId).length;

  const glassStyle = { background: "rgba(0,0,0,0.45)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" } as const;
  const chipActive   = { background: "rgba(255,255,255,0.95)", color: "#111" } as const;
  const chipInactive = { background: "rgba(0,0,0,0.40)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", color: "rgba(255,255,255,0.85)" } as const;

  const selectedMember = selectedPin?.memberId ? members.find((m) => m.id === selectedPin.memberId) : null;

  return (
    <div style={{ position: "fixed", inset: 0, width: "100vw", height: "100dvh", overflow: "hidden", touchAction: "none" }}>

      {/* Map */}
      <div ref={mapContainerRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />

      {/* Loading overlay */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-50">
          <p className="text-sm text-muted-foreground">Loading map…</p>
        </div>
      )}

      {/* Floating overlays */}
      <div className="absolute inset-0 pointer-events-none">

        {/* Top bar */}
        <div className="absolute top-3 left-3 right-3 z-[400] flex flex-col gap-2 pointer-events-none">

          {/* Row 1: back + title */}
          <div className="flex items-center gap-2 pointer-events-auto">
            <button
              onClick={() => router.back()}
              className="size-9 rounded-full flex items-center justify-center shrink-0 active:scale-90 transition-all"
              style={glassStyle}
            >
              <span className="material-symbols-outlined text-[18px] text-white">arrow_back</span>
            </button>
            <div className="flex-1 flex items-center justify-between px-3 py-2 rounded-2xl" style={glassStyle}>
              <div>
                <span className="text-sm font-extrabold text-white leading-tight block">Territory Zones</span>
                <span className="text-[10px] text-white/70 leading-tight">
                  {loading ? "Loading…" : geocoding ? `Plotting ${progress}/${total}…` : `${pins.length} jobs mapped`}
                </span>
              </div>
              {geocoding && (
                <div className="w-20 h-1.5 rounded-full bg-white/20 overflow-hidden ml-3">
                  <div className="h-full rounded-full bg-white transition-all"
                    style={{ width: `${total > 0 ? (progress / total) * 100 : 0}%` }} />
                </div>
              )}
            </div>
          </div>

          {/* Row 2: filter pills */}
          <div className="flex gap-1.5 overflow-x-auto scrollbar-none pointer-events-auto">
            <button
              onClick={() => setFilterMember("all")}
              className="shrink-0 px-3 py-1 rounded-full text-xs font-bold transition-all active:scale-95"
              style={filterMember === "all" ? chipActive : chipInactive}
            >
              All ({pins.length})
            </button>
            {membersWithZips.map((m) => (
              <button key={m.id}
                onClick={() => setFilterMember(m.id)}
                className="shrink-0 flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all active:scale-95"
                style={filterMember === m.id ? { background: m.color, color: "white" } : chipInactive}
              >
                <span className="size-2 rounded-full shrink-0"
                  style={{ background: filterMember === m.id ? "rgba(255,255,255,0.7)" : m.color }} />
                {m.name.split(" ")[0]} ({m.jobCount})
              </button>
            ))}
            {unassignedCount > 0 && (
              <button
                onClick={() => setFilterMember("unassigned")}
                className="shrink-0 px-3 py-1 rounded-full text-xs font-bold transition-all active:scale-95"
                style={filterMember === "unassigned" ? { background: UNASSIGNED_COLOR, color: "white" } : chipInactive}
              >
                No Zone ({unassignedCount})
              </button>
            )}
          </div>
        </div>

        {/* Satellite / Street toggle */}
        <div className="absolute bottom-14 left-3 z-[400] flex rounded-xl overflow-hidden shadow-lg border border-white/20 pointer-events-auto">
          <button
            onClick={() => setMapLayer("satellite")}
            className={`px-2.5 py-1 text-xs font-bold transition-colors ${mapLayer === "satellite" ? "bg-primary text-white" : "bg-background/90 text-muted-foreground hover:bg-background"}`}
          >
            Satellite
          </button>
          <button
            onClick={() => setMapLayer("street")}
            className={`px-2.5 py-1 text-xs font-bold transition-colors ${mapLayer === "street" ? "bg-primary text-white" : "bg-background/90 text-muted-foreground hover:bg-background"}`}
          >
            Street
          </button>
        </div>

        {/* Bottom legend */}
        {(membersWithZips.length > 0 || unassignedCount > 0) && (
          <div
            className="absolute bottom-0 left-0 right-0 z-[400] pointer-events-auto px-4 py-3 flex items-center gap-4 flex-wrap"
            style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" }}
          >
            {membersWithZips.map((m) => (
              <div key={m.id} className="flex items-center gap-1.5">
                <div className="size-3 rounded-full border-2 shrink-0" style={{ background: m.color, borderColor: "rgba(255,255,255,0.5)" }} />
                <span className="text-xs text-white/80 font-medium">{m.name}</span>
                <span className="text-[10px] text-white/40">({m.zips.length} ZIP{m.zips.length !== 1 ? "s" : ""})</span>
              </div>
            ))}
            {unassignedCount > 0 && (
              <div className="flex items-center gap-1.5">
                <div className="size-3 rounded-full border-2 shrink-0" style={{ background: UNASSIGNED_COLOR, borderColor: "rgba(255,255,255,0.5)" }} />
                <span className="text-xs text-white/80 font-medium">No zone</span>
              </div>
            )}
            {membersWithZips.length === 0 && (
              <span className="text-xs text-white/60">
                Assign ZIP codes on the{" "}
                <a href="/team" className="text-primary underline-offset-2 hover:underline">Team page</a>{" "}
                to color-code these pins by territory.
              </span>
            )}
          </div>
        )}
      </div>

      {/* Job bottom sheet */}
      {selectedPin && (
        <div
          className="fixed inset-0 z-[2000]"
          style={{ background: "rgba(0,0,0,0.25)", backdropFilter: "blur(2px)", WebkitBackdropFilter: "blur(2px)" }}
          onClick={() => setSelectedPin(null)}
        >
          <div
            className="absolute bottom-0 left-0 w-full bg-background rounded-t-[28px] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-center pt-3 pb-1 px-4">
              <div className="w-9 h-1 rounded-full bg-muted-foreground/25" />
            </div>
            <div className="px-5 pt-3 pb-10">
              {selectedMember ? (
                <div className="flex items-center gap-1.5 mb-2">
                  <span className="size-2 rounded-full inline-block shrink-0" style={{ background: selectedMember.color }} />
                  <span className="text-xs font-semibold" style={{ color: selectedMember.color }}>{selectedMember.name}</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 mb-2">
                  <span className="size-2 rounded-full inline-block shrink-0" style={{ background: UNASSIGNED_COLOR }} />
                  <span className="text-xs font-semibold text-muted-foreground">No territory</span>
                </div>
              )}
              <p className="text-base font-bold text-foreground mb-0.5">
                {selectedPin.job.job_line_items[0]?.description ?? "Service Job"}
              </p>
              <p className="text-sm text-muted-foreground mb-0.5">{selectedPin.job.clients?.name}</p>
              <p className="text-xs text-muted-foreground/60 mb-5">{selectedPin.job.clients?.address}</p>
              {!selectedMember && (
                <p className="text-xs text-muted-foreground/50 mb-4">
                  <a href="/team" className="text-primary underline-offset-2 hover:underline">Assign ZIP codes on the Team page</a> to add this to a territory.
                </p>
              )}
              <button
                onClick={() => router.push(`/jobs/${selectedPin.job.id}`)}
                className="w-full py-3 rounded-2xl bg-primary text-white font-bold text-sm active:scale-95 transition-all"
              >
                View Job →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
