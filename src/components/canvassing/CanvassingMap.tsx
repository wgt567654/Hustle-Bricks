"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { MapContainer, TileLayer, Marker, Polyline, useMapEvents, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { nearestNeighborTSP, buildGoogleMapsRouteUrls } from "@/lib/routeOptimizer";
import { STATUS_HEX } from "@/lib/status-colors";
import { Badge } from "@/components/ui/badge";

// ─── Types ────────────────────────────────────────────────────────────────────

type CanvassingStatus = "not_visited" | "no_answer" | "no" | "interested" | "booked";
type ViewMode = "canvass" | "jobs";

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

type JobPin = { job: MapJob; lat: number; lng: number };

type TeamMember = { id: string; name: string };

type CanvassingVisit = {
  id: string;
  status: CanvassingStatus;
  notes: string | null;
  follow_up_date: string | null;
  visited_at: string;
  team_members: { name: string } | null;
};

type CustomField = {
  id: string;
  label: string;
  field_type: "text" | "number" | "boolean" | "select";
  options: string[] | null;
  required: boolean;
  position: number;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const TIME_SLOTS = [
  { label: "8 AM",  value: "08:00", hour: 8  },
  { label: "9 AM",  value: "09:00", hour: 9  },
  { label: "10 AM", value: "10:00", hour: 10 },
  { label: "11 AM", value: "11:00", hour: 11 },
  { label: "12 PM", value: "12:00", hour: 12 },
  { label: "1 PM",  value: "13:00", hour: 13 },
  { label: "2 PM",  value: "14:00", hour: 14 },
  { label: "3 PM",  value: "15:00", hour: 15 },
  { label: "4 PM",  value: "16:00", hour: 16 },
  { label: "5 PM",  value: "17:00", hour: 17 },
];

const CANVASS_COLORS: Record<CanvassingStatus, string> = {
  not_visited: "#9CA3AF",
  no_answer:   "#F59E0B",
  no:          "#EF4444",
  interested:  "#3B82F6",
  booked:      "#22C55E",
};

const CANVASS_LABELS: Record<CanvassingStatus, string> = {
  not_visited: "Not Visited",
  no_answer:   "No Answer",
  no:          "Not Interested",
  interested:  "Interested",
  booked:      "Booked",
};

const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  scheduled:   "Scheduled",
  in_progress: "In Progress",
  completed:   "Completed",
  cancelled:   "Cancelled",
};

const TILE_LAYERS = {
  satellite: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "Tiles &copy; Esri",
  },
  street: {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  },
};


// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeCanvassMarker(color: string, opacity = 1) {
  return L.divIcon({
    html: `<div style="width:18px;height:18px;border-radius:50%;background:${color};border:2.5px solid white;box-shadow:0 2px 6px rgba(0,0,0,.35);opacity:${opacity}"></div>`,
    className: "", iconSize: [18, 18], iconAnchor: [9, 9],
  });
}

function makeJobMarker(color: string) {
  return L.divIcon({
    html: `<div style="width:16px;height:16px;border-radius:50%;background:${color};border:2.5px solid white;box-shadow:0 2px 6px rgba(0,0,0,.35)"></div>`,
    className: "", iconSize: [16, 16], iconAnchor: [8, 8],
  });
}

function makeNumberedMarker(n: number, color: string) {
  return L.divIcon({
    html: `<div style="width:26px;height:26px;border-radius:50%;background:${color};border:2.5px solid white;box-shadow:0 2px 8px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;color:white;font-family:system-ui,sans-serif">${n}</div>`,
    className: "", iconSize: [26, 26], iconAnchor: [13, 13],
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
    className: "", iconSize: [24, 24], iconAnchor: [12, 12],
  });
}

async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`,
      { headers: { "User-Agent": "HustleBricks/1.0 (service scheduling app)" } }
    );
    const data = await res.json();
    // Build a clean "123 Main St, City, ST 12345" address from structured parts
    const a = data.address as Record<string, string> | undefined;
    if (a) {
      const houseNumber = a.house_number ?? "";
      const road       = a.road ?? a.pedestrian ?? a.path ?? "";
      const city       = a.city ?? a.town ?? a.village ?? a.hamlet ?? a.county ?? "";
      const state      = a.state ?? "";
      const postcode   = a.postcode ?? "";
      const street     = [houseNumber, road].filter(Boolean).join(" ");
      const cityLine   = [city, [state, postcode].filter(Boolean).join(" ")].filter(Boolean).join(", ");
      const full       = [street, cityLine].filter(Boolean).join(", ");
      if (full) return full;
    }
    return (data.display_name as string) ?? null;
  } catch { return null; }
}

async function forwardGeocode(address: string): Promise<[number, number] | null> {
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

function normalizeProperty(raw: Record<string, unknown>): CanvassingProperty {
  return {
    ...(raw as CanvassingProperty),
    lat: typeof raw.lat === "string" ? parseFloat(raw.lat) : (raw.lat as number),
    lng: typeof raw.lng === "string" ? parseFloat(raw.lng) : (raw.lng as number),
  };
}


// ─── Inner map components ─────────────────────────────────────────────────────

function MapClickHandler({ onMapClick, skipRef, enabled }: {
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

function formatVisitDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86_400_000);
  if (diffDays === 0) return "Today " + d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
  return d.toLocaleDateString([], { month: "short", day: "numeric", year: diffDays > 365 ? "numeric" : undefined });
}

function QuickActionSheet({ property, onClose, onStatusUpdate, onBookNow, onRemove, onAddressUpdate, businessId, captureLeadOnBook = false, visits = [] }: {
  property: CanvassingProperty;
  onClose: () => void;
  onStatusUpdate: (updates: Partial<CanvassingProperty>) => Promise<void>;
  onBookNow: () => void;
  onRemove?: () => Promise<void>;
  onAddressUpdate?: (address: string) => Promise<void>;
  businessId?: string;
  captureLeadOnBook?: boolean;
  visits?: CanvassingVisit[];
}) {
  const [mode, setMode] = useState<"actions" | "interested" | "confirm-remove" | "book" | "edit-address">("actions");
  const [notes, setNotes] = useState(property.notes ?? "");
  const [followUpDate, setFollowUpDate] = useState(property.follow_up_date ?? "");
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);

  // Booking form state — contact
  const [bookName, setBookName] = useState("");
  const [bookPhone, setBookPhone] = useState("");
  const [bookPhoneAlt, setBookPhoneAlt] = useState("");
  const [bookEmail, setBookEmail] = useState("");
  const [bookAddress, setBookAddress] = useState(property.address ?? "");
  // Booking form state — appointment
  const [bookPreferredDate, setBookPreferredDate] = useState("");
  const [bookPreferredTime, setBookPreferredTime] = useState("");
  const [bookedHours, setBookedHours] = useState<Set<number>>(new Set());
  const [slotsLoading, setSlotsLoading] = useState(false);
  // Booking form state — notes
  const [bookRapportNotes, setBookRapportNotes] = useState("");
  const [bookServiceNotes, setBookServiceNotes] = useState("");
  // Booking form state — custom fields
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string>>({});
  const [cfLoading, setCfLoading] = useState(false);
  const cfFetchedRef = useRef(false);
  // Booking form state — photos
  const [bookPhotos, setBookPhotos] = useState<File[]>([]);
  const [bookPhotoUrls, setBookPhotoUrls] = useState<string[]>([]);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // Address edit state
  const [editAddress, setEditAddress] = useState(property.address ?? "");
  const [savingAddress, setSavingAddress] = useState(false);

  // Load custom fields when book mode opens (once per sheet open)
  useEffect(() => {
    if (mode !== "book" || !businessId || cfFetchedRef.current) return;
    cfFetchedRef.current = true;
    setCfLoading(true);
    const supabase = createClient();
    supabase
      .from("canvassing_custom_fields")
      .select("id, label, field_type, options, required, position")
      .eq("business_id", businessId)
      .order("position")
      .then(({ data }) => {
        setCustomFields((data as CustomField[]) ?? []);
        setCfLoading(false);
      });
  }, [mode, businessId]);

  // Load booked hours when preferred date changes
  useEffect(() => {
    if (!bookPreferredDate || !businessId) { setBookedHours(new Set()); return; }
    setSlotsLoading(true);
    setBookPreferredTime(""); // reset time when date changes
    const supabase = createClient();
    const dayStart = new Date(bookPreferredDate + "T00:00:00").toISOString();
    const dayEnd   = new Date(bookPreferredDate + "T23:59:59").toISOString();
    supabase
      .from("jobs")
      .select("scheduled_at")
      .eq("business_id", businessId)
      .gte("scheduled_at", dayStart)
      .lte("scheduled_at", dayEnd)
      .neq("status", "cancelled")
      .then(({ data }) => {
        const hours = new Set<number>(
          (data ?? [])
            .filter((j): j is { scheduled_at: string } => !!j.scheduled_at)
            .map((j) => new Date(j.scheduled_at).getHours())
        );
        setBookedHours(hours);
        setSlotsLoading(false);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookPreferredDate, businessId]);

  // Revoke object URLs on unmount
  useEffect(() => {
    return () => { bookPhotoUrls.forEach((u) => URL.revokeObjectURL(u)); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    const remaining = 4 - bookPhotos.length;
    const toAdd = files.slice(0, remaining);
    setBookPhotos((prev) => [...prev, ...toAdd]);
    setBookPhotoUrls((prev) => [...prev, ...toAdd.map((f) => URL.createObjectURL(f))]);
    e.target.value = "";
  }

  function removePhoto(idx: number) {
    URL.revokeObjectURL(bookPhotoUrls[idx]);
    setBookPhotos((prev) => prev.filter((_, i) => i !== idx));
    setBookPhotoUrls((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleAddressSave() {
    const trimmed = editAddress.trim();
    if (!trimmed || !onAddressUpdate) return;
    setSavingAddress(true);
    await onAddressUpdate(trimmed);
    setSavingAddress(false);
    setMode("actions");
  }

  async function handleSimpleStatus(status: CanvassingStatus) {
    setSaving(true);
    await onStatusUpdate({ status });
    setSaving(false);
    onClose();
  }

  async function handleInterestedSave() {
    setSaving(true);
    await onStatusUpdate({ status: "interested", notes: notes.trim() || null, follow_up_needed: !!followUpDate, follow_up_date: followUpDate || null });
    setSaving(false);
    onClose();
  }

  async function handleBookNow() {
    if (captureLeadOnBook) {
      setMode("book");
      return;
    }
    setSaving(true);
    await onStatusUpdate({ status: "booked" });
    setSaving(false);
    onBookNow();
  }

  async function handleBookSubmit() {
    if (!bookName.trim()) return;
    setSaving(true);
    const supabase = createClient();
    let leadId: string | null = null;

    if (businessId) {
      // Build custom_field_values jsonb
      const cfValues: Record<string, string | number | boolean> = {};
      for (const cf of customFields) {
        const raw = customFieldValues[cf.id] ?? "";
        if (cf.field_type === "number") cfValues[cf.id] = raw === "" ? "" : Number(raw);
        else if (cf.field_type === "boolean") cfValues[cf.id] = raw === "true";
        else cfValues[cf.id] = raw;
      }

      const { data: lead } = await supabase.from("leads").insert({
        business_id: businessId,
        name: bookName.trim(),
        phone: bookPhone.trim() || null,
        phone_alt: bookPhoneAlt.trim() || null,
        email: bookEmail.trim() || null,
        address: bookAddress.trim() || null,
        rapport_notes: bookRapportNotes.trim() || null,
        service_notes: bookServiceNotes.trim() || null,
        preferred_date: bookPreferredDate || null,
        preferred_time: bookPreferredTime ? (TIME_SLOTS.find((s) => s.value === bookPreferredTime)?.label ?? bookPreferredTime) : null,
        custom_field_values: cfValues,
        stage: "new",
        source: "Canvassing",
      }).select("id").single();

      leadId = (lead as { id: string } | null)?.id ?? null;

      // Upload photos if any
      if (leadId && bookPhotos.length > 0) {
        for (const photo of bookPhotos) {
          const ext = photo.name.split(".").pop() ?? "jpg";
          const path = `${leadId}/${Date.now()}.${ext}`;
          const { data: uploaded } = await supabase.storage.from("lead-photos").upload(path, photo, { upsert: false });
          if (uploaded) {
            const { data: { publicUrl } } = supabase.storage.from("lead-photos").getPublicUrl(path);
            await supabase.from("lead_photos").insert({
              lead_id: leadId,
              business_id: businessId,
              url: publicUrl,
            });
          }
        }
      }
    }

    await onStatusUpdate({ status: "booked" });
    setSaving(false);
    onBookNow();
  }

  const displayStatus = property.status !== "not_visited" ? property.status : null;

  const inputCls = "w-full rounded-xl border border-border bg-muted/40 px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring/40";
  const labelCls = "text-[10px] font-bold uppercase tracking-widest text-muted-foreground";

  return (
    <div className="fixed inset-0 z-[2000]"
      style={{ background: "rgba(0,0,0,0.25)", backdropFilter: "blur(2px)", WebkitBackdropFilter: "blur(2px)" }}
      onClick={onClose}>
      <div className="absolute bottom-0 left-0 w-full bg-background rounded-t-[28px] shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between pt-3 pb-1 px-4">
          <div className="w-9 h-1 rounded-full bg-muted-foreground/25 mx-auto" />
          <button onClick={onClose} className="absolute right-4 top-3 flex size-7 items-center justify-center rounded-full bg-muted/60 text-muted-foreground hover:text-foreground transition-colors">
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>
        <div className={`px-5 pt-3 ${mode === "book" ? "pb-4 overflow-y-auto" : "pb-10"}`}
          style={mode === "book" ? { maxHeight: "85vh" } : undefined}>
          {displayStatus && (
            <div className="flex items-center gap-1.5 mb-1.5">
              <span className="size-2 rounded-full inline-block shrink-0" style={{ background: CANVASS_COLORS[displayStatus] }} />
              <span className="text-xs font-semibold" style={{ color: CANVASS_COLORS[displayStatus] }}>{CANVASS_LABELS[displayStatus]}</span>
            </div>
          )}
          <div className="flex items-start gap-1.5 mb-5">
            <p className="flex-1 text-sm font-semibold text-foreground leading-snug line-clamp-3">
              {property.address ?? `${property.lat.toFixed(5)}, ${property.lng.toFixed(5)}`}
            </p>
            {onAddressUpdate && mode !== "edit-address" && (
              <button onClick={() => { setEditAddress(property.address ?? ""); setMode("edit-address"); }}
                className="shrink-0 flex size-6 items-center justify-center rounded-lg bg-muted/60 text-muted-foreground hover:text-foreground transition-colors">
                <span className="material-symbols-outlined text-[13px]">edit</span>
              </button>
            )}
          </div>
          {mode === "actions" && (
            <div className="flex flex-col gap-2.5">
              <div className="grid grid-cols-2 gap-2.5">
                <button onClick={() => handleSimpleStatus("no_answer")} disabled={saving}
                  className="py-3 rounded-2xl bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 font-bold text-sm active:scale-95 transition-all disabled:opacity-50">
                  No Answer
                </button>
                <button onClick={() => handleSimpleStatus("no")} disabled={saving}
                  className="py-3 rounded-2xl bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 font-bold text-sm active:scale-95 transition-all disabled:opacity-50">
                  Not Interested
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <button onClick={() => setMode("interested")} disabled={saving}
                  className="py-3 rounded-2xl bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 font-bold text-sm active:scale-95 transition-all disabled:opacity-50">
                  Interested
                </button>
                <button onClick={handleBookNow} disabled={saving}
                  className="py-3 rounded-2xl bg-green-500 text-white font-bold text-sm active:scale-95 transition-all disabled:opacity-50"
                  style={{ boxShadow: "0 4px 14px rgba(34,197,94,.4)" }}>
                  {saving ? "Saving…" : "Book Now →"}
                </button>
              </div>
              {onRemove && (
                <button onClick={() => setMode("confirm-remove")} disabled={saving}
                  className="w-full py-3 rounded-2xl border border-border text-muted-foreground font-semibold text-sm flex items-center justify-center gap-1.5 active:scale-95 transition-all">
                  <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 0" }}>delete</span>
                  Remove Pin
                </button>
              )}

              {/* ── Visit history ── */}
              {visits.length > 0 && (
                <div className="mt-1 pt-4 border-t border-border/40">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2.5">Visit History</p>
                  <div className="flex flex-col gap-3 max-h-52 overflow-y-auto pr-1">
                    {visits.map((v) => (
                      <div key={v.id} className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className="size-2 rounded-full shrink-0" style={{ background: CANVASS_COLORS[v.status] }} />
                          <span className="text-xs font-semibold text-foreground">{CANVASS_LABELS[v.status]}</span>
                          <span className="text-[10px] text-muted-foreground ml-auto whitespace-nowrap">{formatVisitDate(v.visited_at)}</span>
                        </div>
                        {v.team_members?.name && (
                          <p className="text-[11px] text-muted-foreground pl-3.5">by {v.team_members.name}</p>
                        )}
                        {v.notes && (
                          <p className="text-[11px] text-foreground/80 pl-3.5 leading-snug">{v.notes}</p>
                        )}
                        {v.follow_up_date && (
                          <p className="text-[11px] text-blue-500 pl-3.5 flex items-center gap-1">
                            <span className="material-symbols-outlined text-[12px]" style={{ fontVariationSettings: "'FILL' 1" }}>event</span>
                            Follow-up {new Date(v.follow_up_date + "T00:00:00").toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          {mode === "confirm-remove" && (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col items-center gap-2 py-2">
                <span className="material-symbols-outlined text-[36px] text-destructive" style={{ fontVariationSettings: "'FILL' 0" }}>delete</span>
                <p className="text-sm font-semibold text-foreground text-center">Remove this pin?</p>
                <p className="text-xs text-muted-foreground text-center">This will permanently delete the pin from the map.</p>
              </div>
              <div className="flex gap-2 mt-1">
                <button onClick={() => setMode("actions")} disabled={removing}
                  className="flex-1 py-3 rounded-2xl border border-border text-muted-foreground font-bold text-sm active:scale-95 transition-all disabled:opacity-50">
                  Cancel
                </button>
                <button
                  onClick={async () => { setRemoving(true); await onRemove!(); }}
                  disabled={removing}
                  className="flex-[2] py-3 rounded-2xl bg-destructive text-white font-bold text-sm active:scale-95 transition-all disabled:opacity-50">
                  {removing ? "Removing…" : "Remove Pin"}
                </button>
              </div>
            </div>
          )}
          {mode === "edit-address" && (
            <div className="flex flex-col gap-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Edit Address</p>
              <textarea
                value={editAddress}
                onChange={(e) => setEditAddress(e.target.value)}
                autoFocus
                rows={2}
                className="w-full rounded-xl border border-border bg-muted/40 px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring/40 resize-none"
              />
              <div className="flex gap-2 mt-1">
                <button onClick={() => setMode("actions")} disabled={savingAddress}
                  className="flex-1 py-3 rounded-2xl border border-border text-muted-foreground font-bold text-sm active:scale-95 transition-all disabled:opacity-50">
                  Cancel
                </button>
                <button onClick={handleAddressSave} disabled={savingAddress || !editAddress.trim()}
                  className="flex-[2] py-3 rounded-2xl bg-primary text-white font-bold text-sm active:scale-95 transition-all disabled:opacity-50">
                  {savingAddress ? "Saving…" : "Save Address"}
                </button>
              </div>
            </div>
          )}
          {mode === "book" && (
            <div className="flex flex-col gap-4">

              {/* ── Section 1: Contact ── */}
              <div className="flex flex-col gap-2">
                <p className={labelCls}>Contact</p>
                <input type="text" placeholder="Name *" value={bookName} onChange={(e) => setBookName(e.target.value)} autoFocus className={inputCls} />
                <div className="grid grid-cols-2 gap-2">
                  <input type="tel" placeholder="Phone" value={bookPhone} onChange={(e) => setBookPhone(e.target.value)} className={inputCls} />
                  <input type="tel" placeholder="Alt phone" value={bookPhoneAlt} onChange={(e) => setBookPhoneAlt(e.target.value)} className={inputCls} />
                </div>
                <input type="email" placeholder="Email" value={bookEmail} onChange={(e) => setBookEmail(e.target.value)} className={inputCls} />
                <input type="text" placeholder="Address" value={bookAddress} onChange={(e) => setBookAddress(e.target.value)} className={inputCls} />
              </div>

              {/* ── Section 2: Appointment ── */}
              <div className="flex flex-col gap-2">
                <p className={labelCls}>Appointment</p>
                <input type="date" value={bookPreferredDate} onChange={(e) => setBookPreferredDate(e.target.value)} className={inputCls} />
                {bookPreferredDate && (
                  slotsLoading ? (
                    <p className="text-xs text-muted-foreground">Checking availability…</p>
                  ) : (
                    <div className="grid grid-cols-5 gap-1.5">
                      {TIME_SLOTS.map((slot) => {
                        const isBooked = bookedHours.has(slot.hour);
                        const isSelected = bookPreferredTime === slot.value;
                        return (
                          <button key={slot.value} type="button" disabled={isBooked}
                            onClick={() => setBookPreferredTime(isSelected ? "" : slot.value)}
                            className={`py-2.5 rounded-xl text-xs font-bold border transition-all active:scale-95 ${
                              isBooked
                                ? "bg-muted/20 text-muted-foreground/30 border-border/20 cursor-not-allowed line-through"
                                : isSelected
                                  ? "bg-primary text-white border-primary shadow-sm"
                                  : "bg-muted/40 text-foreground border-border hover:border-primary/40"
                            }`}>
                            {slot.label}
                          </button>
                        );
                      })}
                    </div>
                  )
                )}
                {!bookPreferredDate && (
                  <p className="text-xs text-muted-foreground/60">Pick a date to see available times</p>
                )}
              </div>

              {/* ── Section 3: Custom fields ── */}
              {cfLoading && (
                <p className="text-xs text-muted-foreground">Loading fields…</p>
              )}
              {!cfLoading && customFields.length > 0 && (
                <div className="flex flex-col gap-2">
                  <p className={labelCls}>Additional Info</p>
                  {customFields.map((cf) => (
                    <div key={cf.id} className="flex flex-col gap-1">
                      <label className="text-xs text-muted-foreground">
                        {cf.label}{cf.required && <span className="text-red-500 ml-0.5">*</span>}
                      </label>
                      {cf.field_type === "text" && (
                        <input type="text" value={customFieldValues[cf.id] ?? ""} onChange={(e) => setCustomFieldValues((p) => ({ ...p, [cf.id]: e.target.value }))} className={inputCls} />
                      )}
                      {cf.field_type === "number" && (
                        <input type="number" value={customFieldValues[cf.id] ?? ""} onChange={(e) => setCustomFieldValues((p) => ({ ...p, [cf.id]: e.target.value }))} className={inputCls} />
                      )}
                      {cf.field_type === "boolean" && (
                        <div className="flex gap-2">
                          {["true", "false"].map((v) => (
                            <button key={v} type="button"
                              onClick={() => setCustomFieldValues((p) => ({ ...p, [cf.id]: v }))}
                              className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition-all ${customFieldValues[cf.id] === v ? "bg-primary text-white border-primary" : "border-border text-muted-foreground"}`}>
                              {v === "true" ? "Yes" : "No"}
                            </button>
                          ))}
                        </div>
                      )}
                      {cf.field_type === "select" && (
                        <select value={customFieldValues[cf.id] ?? ""} onChange={(e) => setCustomFieldValues((p) => ({ ...p, [cf.id]: e.target.value }))}
                          className={inputCls}>
                          <option value="">Select…</option>
                          {(cf.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
                        </select>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* ── Section 4: Rapport Notes ── */}
              <div className="flex flex-col gap-2">
                <p className={labelCls}>Rapport Notes</p>
                <textarea placeholder="Customer's profession, pets, years in home…" value={bookRapportNotes} onChange={(e) => setBookRapportNotes(e.target.value)} rows={2}
                  className={`${inputCls} resize-none`} />
              </div>

              {/* ── Section 5: Service Notes ── */}
              <div className="flex flex-col gap-2">
                <p className={labelCls}>Service Notes</p>
                <textarea placeholder="Gate code, watch flower beds, 3 dogs…" value={bookServiceNotes} onChange={(e) => setBookServiceNotes(e.target.value)} rows={2}
                  className={`${inputCls} resize-none`} />
              </div>

              {/* ── Section 6: Photos ── */}
              <div className="flex flex-col gap-2">
                <p className={labelCls}>Photos</p>
                <div className="flex gap-2">
                  {bookPhotoUrls.map((url, i) => (
                    <div key={i} className="relative size-16 rounded-xl overflow-hidden border border-border shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt="" className="w-full h-full object-cover" />
                      <button type="button" onClick={() => removePhoto(i)}
                        className="absolute top-0.5 right-0.5 size-4 rounded-full bg-black/60 flex items-center justify-center">
                        <span className="material-symbols-outlined text-[10px] text-white">close</span>
                      </button>
                    </div>
                  ))}
                  {bookPhotos.length < 4 && (
                    <button type="button" onClick={() => photoInputRef.current?.click()}
                      className="size-16 rounded-xl border-2 border-dashed border-border flex items-center justify-center shrink-0 text-muted-foreground active:scale-95 transition-all hover:border-primary hover:text-primary">
                      <span className="material-symbols-outlined text-[22px]">add_a_photo</span>
                    </button>
                  )}
                </div>
                <input ref={photoInputRef} type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={handlePhotoSelect} />
              </div>

              {/* ── Submit ── */}
              <div className="flex gap-2 pt-1 pb-4">
                <button onClick={() => setMode("actions")} disabled={saving}
                  className="flex-1 py-3 rounded-2xl border border-border text-muted-foreground font-bold text-sm active:scale-95 transition-all disabled:opacity-50">
                  Back
                </button>
                <button onClick={handleBookSubmit} disabled={saving || !bookName.trim()}
                  className="flex-[2] py-3 rounded-2xl bg-green-500 text-white font-bold text-sm active:scale-95 transition-all disabled:opacity-50"
                  style={{ boxShadow: "0 4px 14px rgba(34,197,94,.4)" }}>
                  {saving ? "Saving…" : "Confirm Booking →"}
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
                  className="flex-1 py-3 rounded-2xl border border-border text-muted-foreground font-bold text-sm active:scale-95 transition-all disabled:opacity-50">
                  Back
                </button>
                <button onClick={handleInterestedSave} disabled={saving}
                  className="flex-[2] py-3 rounded-2xl bg-blue-500 text-white font-bold text-sm active:scale-95 transition-all disabled:opacity-50">
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

export default function CanvassingMap({ onBookNow, captureLeadOnBook = false }: { onBookNow: (address: string) => void; captureLeadOnBook?: boolean }) {
  const router = useRouter();

  // ── View mode (outer tab) ────────────────────────────────────────────────
  const [viewMode, setViewMode] = useState<ViewMode>("canvass");

  // ── Canvassing state ─────────────────────────────────────────────────────
  const [businessId, setBusinessId]     = useState<string | null>(null);
  const [teamMemberId, setTeamMemberId] = useState<string | null>(null);
  const [properties, setProperties]     = useState<CanvassingProperty[]>([]);
  const [selected, setSelected]         = useState<CanvassingProperty | null>(null);
  const [visits, setVisits]             = useState<CanvassingVisit[]>([]);
  const [loading, setLoading]           = useState(true);
  const [creating, setCreating]         = useState(false);

  // ── Jobs state ────────────────────────────────────────────────────────────
  const [jobsLoaded, setJobsLoaded]               = useState(false);
  const [allJobs, setAllJobs]                     = useState<MapJob[]>([]);
  const [jobPins, setJobPins]                     = useState<JobPin[]>([]);
  const [jobGeocoding, setJobGeocoding]           = useState(false);
  const [jobProgress, setJobProgress]             = useState(0);
  const [jobTotal, setJobTotal]                   = useState(0);
  const [jobFilterStatus, setJobFilterStatus]     = useState<JobStatus | "all">("all");
  const [teamMembers, setTeamMembers]             = useState<TeamMember[]>([]);

  // ── Job route planner state ───────────────────────────────────────────────
  const [routeEmployee, setRouteEmployee]         = useState("");
  const [routeDate, setRouteDate]                 = useState(() => new Date().toISOString().slice(0, 10));
  const [routeStartAddress, setRouteStartAddress] = useState("");
  const [routeStartCoords, setRouteStartCoords]   = useState<[number, number] | null>(null);
  const [jobRouteStops, setJobRouteStops]         = useState<JobPin[]>([]);
  const [jobRoutePlanning, setJobRoutePlanning]   = useState(false);
  const [jobRouteSaving, setJobRouteSaving]       = useState(false);
  const [jobRouteSaved, setJobRouteSaved]         = useState(false);
  const [jobRouteError, setJobRouteError]         = useState("");
  const [noAddressCount, setNoAddressCount]       = useState(0);

  // ── Shared map state ─────────────────────────────────────────────────────
  const [center, setCenter]             = useState<[number, number]>([39.5, -98.35]);
  const [zoom, setZoom]                 = useState(4);
  const [userPosition, setUserPosition] = useState<[number, number] | null>(null);
  const [flyTarget, setFlyTarget]       = useState<{ coords: [number, number]; zoom: number } | null>(null);
  const [mapLayer, setMapLayer]         = useState<"satellite" | "street">("satellite");

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

  // ── Init: canvassing data + GPS ──────────────────────────────────────────
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

      if (geoCoords) { setUserPosition(geoCoords); setCenter(geoCoords); setZoom(17); }
      else if (propList.length > 0) { setCenter([propList[0].lat, propList[0].lng]); setZoom(15); }

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

  // ── Lazy load jobs data (first time Jobs tab is opened) ──────────────────
  useEffect(() => {
    if (viewMode !== "jobs" || jobsLoaded || !businessId) return;

    async function loadJobs() {
      const supabase = createClient();

      const [{ data: jobs }, { data: members }] = await Promise.all([
        supabase
          .from("jobs")
          .select("id, status, total, scheduled_at, assigned_member_id, route_order, job_line_items(description), clients(name, address)")
          .eq("business_id", businessId!)
          .not("status", "eq", "cancelled")
          .order("scheduled_at", { ascending: false }),
        supabase
          .from("team_members")
          .select("id, name")
          .eq("business_id", businessId!)
          .eq("is_active", true)
          .eq("is_pending", false)
          .order("name"),
      ]);

      setTeamMembers((members as TeamMember[]) ?? []);

      const jobList = (jobs as unknown as MapJob[]) ?? [];
      setAllJobs(jobList);

      const withAddress = jobList.filter((j) => j.clients?.address);
      setJobTotal(withAddress.length);
      setJobsLoaded(true);

      if (withAddress.length === 0) return;

      setJobGeocoding(true);
      const newPins: JobPin[] = [];

      for (let i = 0; i < withAddress.length; i++) {
        const job = withAddress[i];
        const coords = await forwardGeocode(job.clients!.address!);
        setJobProgress(i + 1);
        if (coords) {
          newPins.push({ job, lat: coords[0], lng: coords[1] });
          if (newPins.length === 1) { setCenter(coords); setZoom(12); }
        }
        setJobPins([...newPins]);
        if (i < withAddress.length - 1) await sleep(1100);
      }
      setJobGeocoding(false);
    }

    loadJobs();
  }, [viewMode, jobsLoaded, businessId]);

  // ── Canvassing map click ─────────────────────────────────────────────────
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

  // ── Load visit history when a pin is selected ───────────────────────────
  useEffect(() => {
    if (!selected) { setVisits([]); return; }
    const supabase = createClient();
    supabase
      .from("canvassing_visits")
      .select("id, status, notes, follow_up_date, visited_at, team_members!employee_id(name)")
      .eq("property_id", selected.id)
      .order("visited_at", { ascending: false })
      .limit(20)
      .then(({ data }) => setVisits((data as unknown as CanvassingVisit[]) ?? []));
  }, [selected?.id]);

  // ── Canvassing status update ──────────────────────────────────────────────
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
    // Log this visit to history
    if (businessId && updates.status) {
      const { data: visit } = await supabase.from("canvassing_visits").insert({
        property_id: id,
        business_id: businessId,
        employee_id: teamMemberId ?? null,
        status: updates.status,
        notes: (updates.notes as string | undefined) ?? null,
        follow_up_date: (updates.follow_up_date as string | undefined) ?? null,
      }).select("id, status, notes, follow_up_date, visited_at, team_members!employee_id(name)").single();
      if (visit) setVisits((prev) => [visit as unknown as CanvassingVisit, ...prev]);
    }
  }

  // ── Remove canvassing pin ────────────────────────────────────────────────
  async function handleRemoveProperty(id: string) {
    const supabase = createClient();
    await supabase.from("canvassing_properties").delete().eq("id", id);
    setProperties((prev) => prev.filter((p) => p.id !== id));
  }

  // ── Update canvassing property address ───────────────────────────────────
  async function handleAddressUpdate(id: string, address: string) {
    const supabase = createClient();
    const { data: updated } = await supabase.from("canvassing_properties")
      .update({ address }).eq("id", id).select("*").single();
    if (updated) {
      const prop = normalizeProperty(updated as Record<string, unknown>);
      setProperties((prev) => prev.map((p) => (p.id === id ? prop : p)));
      setSelected(prop);
    }
  }

  // ── Job route planning ───────────────────────────────────────────────────
  async function handlePlanJobRoute() {
    if (!routeEmployee || !routeDate) return;
    setJobRoutePlanning(true);
    setJobRouteSaved(false);
    setJobRouteError("");

    const dayStart = new Date(routeDate + "T00:00:00");
    const dayEnd   = new Date(routeDate + "T23:59:59");

    const employeeJobs = allJobs.filter(
      (j) => j.assigned_member_id === routeEmployee && j.scheduled_at &&
        new Date(j.scheduled_at) >= dayStart && new Date(j.scheduled_at) <= dayEnd
    );

    if (employeeJobs.length === 0) {
      setJobRouteError("No jobs found for this employee on the selected date.");
      setJobRoutePlanning(false);
      setJobRouteStops([]);
      return;
    }

    setNoAddressCount(employeeJobs.filter((j) => !j.clients?.address).length);

    const employeePins = jobPins.filter((p) =>
      p.job.assigned_member_id === routeEmployee &&
      p.job.scheduled_at &&
      new Date(p.job.scheduled_at) >= dayStart &&
      new Date(p.job.scheduled_at) <= dayEnd
    );

    if (employeePins.length === 0) {
      setJobRouteError("No geocoded addresses found for this employee on this date. Ensure client addresses are on file.");
      setJobRoutePlanning(false);
      setJobRouteStops([]);
      return;
    }

    if (jobGeocoding) {
      setJobRouteError("Still loading addresses — wait for the map to finish, then try again.");
      setJobRoutePlanning(false);
      return;
    }

    let startPin: { lat: number; lng: number } | null = null;
    if (routeStartAddress.trim()) {
      const coords = await forwardGeocode(routeStartAddress.trim());
      if (coords) {
        startPin = { lat: coords[0], lng: coords[1] };
        setRouteStartCoords(coords);
        setCenter(coords);
        setZoom(11);
      } else {
        setJobRouteError("Could not find the start address — check the spelling and try again.");
        setJobRoutePlanning(false);
        return;
      }
    } else {
      setRouteStartCoords(null);
    }

    const optimized = nearestNeighborTSP(employeePins, startPin ?? undefined);
    setJobRouteStops(optimized);
    setJobRoutePlanning(false);
  }

  async function handleSaveJobRoute() {
    if (jobRouteStops.length === 0) return;
    setJobRouteSaving(true);
    const supabase = createClient();
    for (let i = 0; i < jobRouteStops.length; i++) {
      await supabase.from("jobs").update({ route_order: i + 1 }).eq("id", jobRouteStops[i].job.id);
    }
    setJobRouteSaving(false);
    setJobRouteSaved(true);
  }

  function moveJobStop(from: number, to: number) {
    const next = [...jobRouteStops];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    setJobRouteStops(next);
    setJobRouteSaved(false);
  }

  function recenterOnUser() {
    if (!userPosition) return;
    setFlyTarget({ coords: userPosition, zoom: 17 });
  }

  // ── Derived ──────────────────────────────────────────────────────────────

  const filteredJobs = jobFilterStatus === "all" ? jobPins : jobPins.filter((p) => p.job.status === jobFilterStatus);
  const jobCounts = {
    scheduled:   jobPins.filter((p) => p.job.status === "scheduled").length,
    in_progress: jobPins.filter((p) => p.job.status === "in_progress").length,
    completed:   jobPins.filter((p) => p.job.status === "completed").length,
  };

  const jobRouteStopIds = new Set(jobRouteStops.map((s) => s.job.id));
  const tile = TILE_LAYERS[mapLayer];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-sm text-muted-foreground">Loading map…</p>
      </div>
    );
  }

  const glassStyle = { background: "rgba(0,0,0,0.45)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" } as const;
  const chipActive   = { background: "rgba(255,255,255,0.95)", color: "#111" } as const;
  const chipInactive = { background: "rgba(0,0,0,0.40)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", color: "rgba(255,255,255,0.85)" } as const;

  return (
    <div className="fixed inset-0 overflow-hidden" style={{ touchAction: "none" }}>

      {/* ── Map (full screen) ── */}
      <div className="absolute inset-0">
        <MapContainer
          center={center}
          zoom={zoom}
          style={{ height: "100%", width: "100%" }}
          zoomControl={false}
          zoomSnap={0}
          wheelPxPerZoomLevel={10}
          inertia={false}
        >
          <TileLayer url={tile.url} attribution={tile.attribution} keepBuffer={4} />
          <MapClickHandler onMapClick={handleMapClick} skipRef={skipClickRef} enabled={viewMode === "canvass"} />
          <FlyToController target={flyTarget} />

          {/* Job route polyline */}
          {viewMode === "jobs" && jobRouteStops.length > 0 && (
            <Polyline
              positions={[
                ...(routeStartCoords ? [routeStartCoords] : []),
                ...jobRouteStops.map((s) => [s.lat, s.lng] as [number, number]),
              ]}
              pathOptions={{ color: "#007AFF", weight: 3, opacity: 0.75, dashArray: "8 5" }}
            />
          )}

          {/* Start position marker (job route) */}
          {viewMode === "jobs" && routeStartCoords && (
            <Marker
              position={routeStartCoords}
              icon={L.divIcon({
                html: `<div style="width:28px;height:28px;border-radius:50%;background:${STATUS_HEX.completed};border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;font-size:13px;color:white;font-family:system-ui,sans-serif">S</div>`,
                className: "", iconSize: [28, 28], iconAnchor: [14, 14],
              })}
            />
          )}

          {/* Live location dot */}
          {userPosition && (
            <Marker position={userPosition} icon={makeLocationMarker()} interactive={false} zIndexOffset={-500} />
          )}

          {/* Canvassing property pins */}
          {viewMode === "canvass" && properties.map((prop) => (
            <Marker key={prop.id} position={[prop.lat, prop.lng]} icon={makeCanvassMarker(CANVASS_COLORS[prop.status])}
              eventHandlers={{
                click: (e) => {
                  e.originalEvent.stopPropagation();
                  skipClickRef.current = true;
                  setSelected(properties.find((p) => p.id === prop.id) ?? prop);
                },
              }}
            />
          ))}

          {/* Job pins */}
          {viewMode === "jobs" && filteredJobs.map((pin) => {
            const routeIdx = jobRouteStops.findIndex((s) => s.job.id === pin.job.id);
            const color = STATUS_HEX[pin.job.status] ?? STATUS_HEX.scheduled;
            const icon = routeIdx >= 0
              ? makeNumberedMarker(routeIdx + 1, color)
              : makeJobMarker(color);
            return (
              <Marker key={pin.job.id} position={[pin.lat, pin.lng]} icon={icon}
                zIndexOffset={jobRouteStopIds.has(pin.job.id) ? 1000 : 0}
                eventHandlers={{
                  click: (e) => {
                    e.originalEvent.stopPropagation();
                    router.push(`/jobs/${pin.job.id}`);
                  },
                }}
              />
            );
          })}
        </MapContainer>

        {/* Follow-ups / Analytics — top right (canvass pin mode only) */}
        {viewMode === "canvass" && (
          <div className="absolute top-3 right-3 z-[500] hidden lg:flex flex-row gap-1.5">
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
        )}

        {/* ── Floating top bar ── */}
        <div className="absolute top-3 left-3 right-3 z-[400] flex flex-col gap-2 pointer-events-none">

          {/* Outer view mode toggle: Canvass | Jobs */}
          <div className="flex justify-center pointer-events-auto">
            <div className="flex rounded-2xl overflow-hidden" style={glassStyle}>
              <button onClick={() => setViewMode("canvass")}
                className="px-4 py-1.5 text-xs font-extrabold transition-all active:scale-95"
                style={viewMode === "canvass" ? { background: "white", color: "#111" } : { color: "rgba(255,255,255,0.7)" }}>
                Canvass
              </button>
              <button onClick={() => setViewMode("jobs")}
                className="px-4 py-1.5 text-xs font-extrabold transition-all active:scale-95"
                style={viewMode === "jobs" ? { background: "#007AFF", color: "white" } : { color: "rgba(255,255,255,0.7)" }}>
                Jobs
              </button>
            </div>
          </div>

          {/* ── CANVASS MODE overlay ── */}
          {viewMode === "canvass" && (
            <div className="flex lg:hidden items-center justify-end gap-1.5 pointer-events-auto">
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
          )}

          {/* ── JOBS MODE overlay ── */}
          {viewMode === "jobs" && (
            <>
              <div className="flex items-center justify-between gap-2">
                <div className="flex flex-col px-3 py-2 rounded-2xl pointer-events-auto" style={glassStyle}>
                  <span className="text-sm font-extrabold text-white leading-tight">Job Map</span>
                  <span className="text-[10px] text-white/70 leading-tight">
                    {!jobsLoaded ? "Loading…"
                      : jobGeocoding ? `Locating ${jobProgress}/${jobTotal}…`
                      : `${jobPins.length} job${jobPins.length !== 1 ? "s" : ""} plotted`}
                  </span>
                </div>
                {jobGeocoding && (
                  <div className="flex items-center pointer-events-auto" style={glassStyle}>
                    <div className="w-20 h-1.5 rounded-full bg-white/20 overflow-hidden mx-3">
                      <div className="h-full rounded-full bg-white transition-all"
                        style={{ width: `${jobTotal > 0 ? (jobProgress / jobTotal) * 100 : 0}%` }} />
                    </div>
                  </div>
                )}
              </div>

              {/* Job status filter chips */}
              <div className="flex gap-1.5 overflow-x-auto scrollbar-none pointer-events-auto">
                {([
                  { label: "All", value: "all" as const },
                  { label: `Scheduled (${jobCounts.scheduled})`, value: "scheduled" as const },
                  { label: `In Progress (${jobCounts.in_progress})`, value: "in_progress" as const },
                  { label: `Completed (${jobCounts.completed})`, value: "completed" as const },
                ]).map((f) => (
                  <button key={f.value} onClick={() => setJobFilterStatus(f.value)}
                    className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded-full transition-all active:scale-95"
                    style={jobFilterStatus === f.value ? chipActive : chipInactive}>
                    {f.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Satellite / Street toggle */}
        <div className="absolute bottom-20 lg:bottom-6 left-3 z-[400] flex rounded-xl overflow-hidden shadow-lg border border-white/20">
          <button onClick={() => setMapLayer("satellite")}
            className={`px-2.5 py-1 text-xs font-bold transition-colors ${mapLayer === "satellite" ? "bg-primary text-white" : "bg-background/90 text-muted-foreground hover:bg-background"}`}>
            Satellite
          </button>
          <button onClick={() => setMapLayer("street")}
            className={`px-2.5 py-1 text-xs font-bold transition-colors ${mapLayer === "street" ? "bg-primary text-white" : "bg-background/90 text-muted-foreground hover:bg-background"}`}>
            Street
          </button>
        </div>

        {/* My location button */}
        <button onClick={recenterOnUser} disabled={!userPosition}
          className="absolute bottom-20 lg:bottom-6 right-3 z-[400] size-9 flex items-center justify-center rounded-full bg-background shadow-lg border border-border active:scale-90 transition-all disabled:opacity-40">
          <span className="material-symbols-outlined text-[18px] text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>my_location</span>
        </button>
      </div>


      {/* ── Job route planner panel ── */}
      {viewMode === "jobs" && (
        <div className="absolute bottom-0 left-0 right-0 z-[500] bg-background border-t border-border shadow-2xl"
          style={{ maxHeight: jobRouteStops.length > 0 ? "55vh" : "auto" }}>

          {/* Route planner controls */}
          {teamMembers.length > 0 && (
            <div className="px-4 pt-3 pb-3 flex flex-col gap-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Job Route Planner</p>
              <div className="flex items-center gap-2">
                <select value={routeEmployee}
                  onChange={(e) => { setRouteEmployee(e.target.value); setJobRouteStops([]); setJobRouteSaved(false); setJobRouteError(""); }}
                  className="flex-1 text-sm rounded-xl border border-border bg-card px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-ring/40">
                  <option value="">Select employee…</option>
                  {teamMembers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
                <input type="date" value={routeDate}
                  onChange={(e) => { setRouteDate(e.target.value); setJobRouteStops([]); setJobRouteSaved(false); setJobRouteError(""); }}
                  className="text-sm rounded-xl border border-border bg-card px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-ring/40" />
              </div>
              <input type="text" value={routeStartAddress}
                onChange={(e) => { setRouteStartAddress(e.target.value); setJobRouteStops([]); setRouteStartCoords(null); setJobRouteSaved(false); setJobRouteError(""); }}
                placeholder="Start address (optional)"
                className="w-full text-sm rounded-xl border border-border bg-card px-3 py-2 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring/40" />
              <button onClick={handlePlanJobRoute} disabled={!routeEmployee || jobRoutePlanning || jobGeocoding}
                className="w-full px-4 py-2 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 active:scale-95 transition-all disabled:opacity-40">
                {jobRoutePlanning ? "Planning…" : "Plan Route"}
              </button>
              {jobRouteError && <p className="text-xs text-destructive">{jobRouteError}</p>}
              {!jobRouteError && noAddressCount > 0 && (
                <p className="text-xs text-amber-600">{noAddressCount} job{noAddressCount > 1 ? "s" : ""} excluded — no address on file</p>
              )}
            </div>
          )}

          {/* Route stops list */}
          {jobRouteStops.length > 0 && (
            <>
              <div className="px-4 py-2.5 flex items-center justify-between sticky top-0 bg-background border-t border-border z-10">
                <span className="text-sm font-bold text-foreground">
                  Optimized Route · {jobRouteStops.length} stop{jobRouteStops.length !== 1 ? "s" : ""}
                </span>
                <button onClick={handleSaveJobRoute} disabled={jobRouteSaving || jobRouteSaved}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-95 ${
                    jobRouteSaved ? "icon-green" : "bg-primary text-white hover:bg-primary/90 disabled:opacity-50"
                  }`}>
                  {jobRouteSaved ? "✓ Saved" : jobRouteSaving ? "Saving…" : "Save Route"}
                </button>
              </div>
              <div className="overflow-y-auto divide-y divide-border/40" style={{ maxHeight: "24vh" }}>
                {jobRouteStops.map((stop, i) => (
                  <div key={stop.job.id} className="flex items-center gap-3 px-4 py-2.5">
                    <div className="size-6 rounded-full flex items-center justify-center text-[11px] font-extrabold text-white shrink-0"
                      style={{ background: STATUS_HEX[stop.job.status] ?? STATUS_HEX.scheduled }}>
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {stop.job.job_line_items[0]?.description ?? "Service Job"}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {stop.job.clients?.name}{stop.job.clients?.address && ` · ${stop.job.clients.address}`}
                      </p>
                    </div>
                    <div className="flex gap-0.5 shrink-0">
                      <button onClick={() => i > 0 && moveJobStop(i, i - 1)} disabled={i === 0}
                        className="p-1 rounded-lg hover:bg-muted transition-colors disabled:opacity-20">
                        <span className="material-symbols-outlined text-[18px] text-muted-foreground">arrow_upward</span>
                      </button>
                      <button onClick={() => i < jobRouteStops.length - 1 && moveJobStop(i, i + 1)} disabled={i === jobRouteStops.length - 1}
                        className="p-1 rounded-lg hover:bg-muted transition-colors disabled:opacity-20">
                        <span className="material-symbols-outlined text-[18px] text-muted-foreground">arrow_downward</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Floating bottom nav (owner mobile only) ── */}
      {!captureLeadOnBook && <div className="lg:hidden absolute bottom-4 left-1/2 -translate-x-1/2 z-[500] pointer-events-auto"
        style={{ width: "calc(100% - 32px)", maxWidth: 420 }}>
        <div className="flex items-center justify-around px-4 py-2 rounded-[24px] shadow-2xl"
          style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", border: "1px solid rgba(255,255,255,0.12)" }}>
          {([
            { href: "/jobs",            label: "Jobs",      icon: "work"           },
            { href: "/analytics",       label: "Analytics", icon: "leaderboard"    },
            { href: "/canvassing",      label: "Map",       icon: "map"            },
            { href: "/calendar",        label: "Schedule",  icon: "calendar_month" },
          ] as const).map(({ href, label, icon }) => {
            const active = href === "/canvassing";
            return (
              <Link key={href} href={href} className="flex flex-col items-center gap-1 active:scale-90 transition-transform">
                <span className="material-symbols-outlined text-[20px]"
                  style={{ color: active ? "white" : "rgba(255,255,255,0.6)", fontVariationSettings: active ? "'FILL' 1" : "'FILL' 0" }}>
                  {icon}
                </span>
                <span className="text-[9px] font-semibold leading-none" style={{ color: active ? "white" : "rgba(255,255,255,0.5)" }}>{label}</span>
              </Link>
            );
          })}
        </div>
      </div>}

      {/* ── Desktop back button ── */}
      <button
        onClick={() => router.back()}
        className="hidden lg:flex absolute top-4 left-4 z-[500] items-center gap-2 px-3 py-2 rounded-xl pointer-events-auto transition-opacity hover:opacity-90"
        style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", border: "1px solid rgba(255,255,255,0.12)", color: "white" }}
      >
        <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 0" }}>arrow_back</span>
        <span className="text-sm font-medium">Back</span>
      </button>

      {/* ── Quick Action Sheet (canvass pin mode only) ── */}
      {selected && viewMode === "canvass" && (
        <QuickActionSheet
          property={selected}
          onClose={() => setSelected(null)}
          onStatusUpdate={async (updates) => { await handleStatusUpdate(selected.id, updates); }}
          onBookNow={() => {
            onBookNow(selected.address ?? "");
            setSelected(null);
          }}
          onRemove={async () => { await handleRemoveProperty(selected.id); setSelected(null); }}
          onAddressUpdate={async (address) => { await handleAddressUpdate(selected.id, address); }}
          businessId={businessId ?? undefined}
          captureLeadOnBook={captureLeadOnBook}
          visits={visits}
        />
      )}
    </div>
  );
}
