"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

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

function makePin(color: string) {
  return L.divIcon({
    html: `<div style="width:16px;height:16px;border-radius:50%;background:${color};border:2.5px solid white;box-shadow:0 2px 6px rgba(0,0,0,.35)"></div>`,
    className: "",
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

export default function TerritoryMapContent() {
  const router = useRouter();
  const [pins, setPins] = useState<Pin[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [geocoding, setGeocoding] = useState(false);
  const [progress, setProgress] = useState(0);
  const [total, setTotal] = useState(0);
  const [center, setCenter] = useState<[number, number]>([39.5, -98.35]);
  const [zoom, setZoom] = useState(4);
  const [filterMember, setFilterMember] = useState<string>("all");

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

      const [{ data: jobs }, { data: teamMembers }, { data: territories }] = await Promise.all([
        supabase
          .from("jobs")
          .select("id, status, total, job_line_items(description), clients(name, address)")
          .eq("business_id", business.id)
          .not("status", "eq", "cancelled")
          .order("created_at", { ascending: false }),
        supabase
          .from("team_members")
          .select("id, name")
          .eq("business_id", business.id)
          .eq("is_active", true)
          .eq("is_pending", false)
          .order("name"),
        supabase
          .from("territory_assignments")
          .select("team_member_id, zip_code")
          .eq("business_id", business.id),
      ]);

      setLoading(false);

      const zipToMember = new Map<string, string>();
      const memberZips: Record<string, string[]> = {};
      for (const t of territories ?? []) {
        zipToMember.set(t.zip_code, t.team_member_id);
        if (!memberZips[t.team_member_id]) memberZips[t.team_member_id] = [];
        memberZips[t.team_member_id].push(t.zip_code);
      }

      const memberList: Member[] = (teamMembers ?? []).map((m, i) => ({
        id: m.id,
        name: m.name,
        zips: (memberZips[m.id] ?? []).sort(),
        color: PALETTE[i % PALETTE.length],
        jobCount: 0,
      }));
      const memberById = new Map<string, Member>(memberList.map((m) => [m.id, m]));
      setMembers(memberList);

      const jobList = (jobs ?? []) as unknown as TerritoryJob[];
      const withAddress = jobList.filter((j) => j.clients?.address);
      setTotal(withAddress.length);
      if (withAddress.length === 0) return;

      setGeocoding(true);
      const newPins: Pin[] = [];

      for (let i = 0; i < withAddress.length; i++) {
        const job = withAddress[i];
        const address = job.clients!.address!;
        const zip = extractZip(address);
        const memberId = zip ? (zipToMember.get(zip) ?? null) : null;

        const coords = await geocode(address);
        setProgress(i + 1);
        if (coords) {
          newPins.push({ job, lat: coords[0], lng: coords[1], memberId });
          if (memberId) {
            const m = memberById.get(memberId);
            if (m) m.jobCount++;
          }
          if (newPins.length === 1) { setCenter(coords); setZoom(11); }
        }
        setPins([...newPins]);
        if (i < withAddress.length - 1) await sleep(1100);
      }

      setMembers([...memberList]);
      setGeocoding(false);
    }
    load();
  }, []);

  const filtered =
    filterMember === "all"        ? pins :
    filterMember === "unassigned" ? pins.filter((p) => !p.memberId) :
                                    pins.filter((p) => p.memberId === filterMember);

  function pinColor(pin: Pin): string {
    if (!pin.memberId) return UNASSIGNED_COLOR;
    return members.find((m) => m.id === pin.memberId)?.color ?? UNASSIGNED_COLOR;
  }

  const membersWithZips = members.filter((m) => m.zips.length > 0);
  const unassignedCount = pins.filter((p) => !p.memberId).length;

  return (
    <div className="flex flex-col h-screen max-h-screen overflow-hidden">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 flex flex-col gap-3 shrink-0 bg-background border-b border-border">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-foreground">Territory Zones</h1>
            <p className="text-xs text-muted-foreground">
              {loading ? "Loading…" : geocoding ? `Plotting ${progress}/${total}…` : `${pins.length} jobs mapped`}
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

        {/* Filter pills */}
        <div className="flex gap-2 overflow-x-auto scrollbar-none">
          <button onClick={() => setFilterMember("all")}>
            <span className={`px-3 py-1 rounded-full text-xs font-bold border transition-colors whitespace-nowrap ${filterMember === "all" ? "bg-primary text-white border-primary" : "border-border text-muted-foreground bg-card hover:bg-muted"}`}>
              All ({pins.length})
            </span>
          </button>
          {membersWithZips.map((m) => (
            <button key={m.id} onClick={() => setFilterMember(m.id)}>
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold border transition-colors whitespace-nowrap flex items-center gap-1.5 ${filterMember === m.id ? "text-white border-transparent" : "border-border text-foreground bg-card hover:bg-muted"}`}
                style={filterMember === m.id ? { background: m.color, borderColor: m.color } : {}}
              >
                <span className="size-2 rounded-full shrink-0" style={{ background: m.color }} />
                {m.name.split(" ")[0]} ({m.jobCount})
              </span>
            </button>
          ))}
          {unassignedCount > 0 && (
            <button onClick={() => setFilterMember("unassigned")}>
              <span className={`px-3 py-1 rounded-full text-xs font-bold border transition-colors whitespace-nowrap ${filterMember === "unassigned" ? "bg-gray-500 text-white border-transparent" : "border-border text-muted-foreground bg-card hover:bg-muted"}`}>
                No Zone ({unassignedCount})
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Map */}
      <div className="flex-1 min-h-0 relative">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-muted-foreground">Loading…</p>
          </div>
        ) : pins.length === 0 && !geocoding ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-6">
            <span className="material-symbols-outlined text-[56px] text-muted-foreground/30">pin_drop</span>
            <p className="text-sm font-medium text-muted-foreground">No jobs with addresses to plot</p>
            <p className="text-xs text-muted-foreground/60">
              Add addresses to clients and assign ZIPs on the{" "}
              <a href="/team" className="text-primary underline-offset-2 hover:underline">Team page</a>
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
            {filtered.map((pin) => (
              <Marker key={pin.job.id} position={[pin.lat, pin.lng]} icon={makePin(pinColor(pin))}>
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
                    {pin.memberId ? (
                      <div style={{ fontSize: 11, fontWeight: 700, color: pinColor(pin), marginBottom: 6 }}>
                        Zone: {members.find((m) => m.id === pin.memberId)?.name}
                      </div>
                    ) : (
                      <div style={{ fontSize: 11, color: UNASSIGNED_COLOR, marginBottom: 6 }}>
                        No territory assigned
                      </div>
                    )}
                    <button
                      onClick={() => router.push(`/jobs/${pin.job.id}`)}
                      style={{ width: "100%", padding: "6px 0", background: "#007AFF", color: "white", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer" }}
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
      {(membersWithZips.length > 0 || unassignedCount > 0) && (
        <div className="shrink-0 px-4 py-3 bg-background border-t border-border flex items-center gap-4 flex-wrap">
          {membersWithZips.map((m) => (
            <div key={m.id} className="flex items-center gap-1.5">
              <div className="size-3 rounded-full border-2 border-white shadow-sm" style={{ background: m.color }} />
              <span className="text-xs text-muted-foreground font-medium">{m.name}</span>
              <span className="text-[10px] text-muted-foreground/50">({m.zips.length} ZIP{m.zips.length !== 1 ? "s" : ""})</span>
            </div>
          ))}
          {unassignedCount > 0 && (
            <div className="flex items-center gap-1.5">
              <div className="size-3 rounded-full border-2 border-white shadow-sm" style={{ background: UNASSIGNED_COLOR }} />
              <span className="text-xs text-muted-foreground font-medium">No zone</span>
            </div>
          )}
          {membersWithZips.length === 0 && (
            <span className="text-xs text-muted-foreground">
              Assign ZIP codes on the{" "}
              <a href="/team" className="text-primary underline-offset-2 hover:underline">Team page</a>{" "}
              to color-code these pins by territory.
            </span>
          )}
          <span className="text-xs text-muted-foreground/50 ml-auto">OpenStreetMap</span>
        </div>
      )}
    </div>
  );
}
