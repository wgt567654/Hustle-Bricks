"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";

type FollowUp = {
  id: string;
  address: string | null;
  lat: number;
  lng: number;
  status: string;
  notes: string | null;
  follow_up_date: string | null;
  follow_up_notes: string | null;
  last_visited_at: string | null;
  team_members: { name: string } | null;
};

const STATUS_COLORS: Record<string, string> = {
  not_visited: "#9CA3AF",
  no_answer:   "#F59E0B",
  no:          "#EF4444",
  interested:  "#3B82F6",
  booked:      "#22C55E",
};

const STATUS_LABELS: Record<string, string> = {
  not_visited: "Not Visited",
  no_answer:   "No Answer",
  no:          "Not Interested",
  interested:  "Interested",
  booked:      "Booked",
};

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function mapsUrl(prop: FollowUp) {
  if (prop.address) return `https://maps.google.com/?q=${encodeURIComponent(prop.address)}`;
  return `https://maps.google.com/?q=${prop.lat},${prop.lng}`;
}

function FollowUpCard({ prop, urgency }: { prop: FollowUp; urgency: "overdue" | "today" | "upcoming" | "none" }) {
  return (
    <div
      className={`rounded-2xl border bg-card p-4 flex flex-col gap-2 ${
        urgency === "today" ? "border-amber-400 dark:border-amber-500" :
        urgency === "overdue" ? "border-red-400 dark:border-red-500" :
        "border-border"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-foreground leading-snug flex-1 line-clamp-2">
          {prop.address ?? `${prop.lat.toFixed(4)}, ${prop.lng.toFixed(4)}`}
        </p>
        <span
          className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full"
          style={{
            background: `${STATUS_COLORS[prop.status]}20`,
            color: STATUS_COLORS[prop.status],
          }}
        >
          {STATUS_LABELS[prop.status] ?? prop.status}
        </span>
      </div>

      {prop.notes && (
        <p className="text-xs text-muted-foreground line-clamp-2">{prop.notes}</p>
      )}
      {prop.follow_up_notes && prop.follow_up_notes !== prop.notes && (
        <p className="text-xs text-muted-foreground italic line-clamp-2">"{prop.follow_up_notes}"</p>
      )}

      <div className="flex items-center justify-between mt-1">
        <div className="flex items-center gap-3">
          {prop.team_members?.name && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <span className="material-symbols-outlined text-[13px]">person</span>
              {prop.team_members.name.split(" ")[0]}
            </span>
          )}
          {prop.follow_up_date && (
            <span
              className={`text-xs font-semibold flex items-center gap-1 ${
                urgency === "overdue" ? "text-red-500" :
                urgency === "today" ? "text-amber-600 dark:text-amber-400" :
                "text-muted-foreground"
              }`}
            >
              <span className="material-symbols-outlined text-[13px]">calendar_today</span>
              {formatDate(prop.follow_up_date)}
            </span>
          )}
        </div>

        <a
          href={mapsUrl(prop)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline active:scale-95 transition-transform"
        >
          <span className="material-symbols-outlined text-[14px]">directions</span>
          Navigate
        </a>
      </div>
    </div>
  );
}

function Section({ title, items, urgency, emptyText }: {
  title: string;
  items: FollowUp[];
  urgency: "overdue" | "today" | "upcoming" | "none";
  emptyText?: string;
}) {
  if (items.length === 0 && !emptyText) return null;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{title}</h2>
        {items.length > 0 && (
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
            urgency === "overdue" ? "bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-400" :
            urgency === "today" ? "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400" :
            "bg-muted text-muted-foreground"
          }`}>
            {items.length}
          </span>
        )}
      </div>
      {items.length === 0 && emptyText ? (
        <p className="text-sm text-muted-foreground/60 py-2">{emptyText}</p>
      ) : (
        items.map((p) => <FollowUpCard key={p.id} prop={p} urgency={urgency} />)
      )}
    </div>
  );
}

export default function FollowUpsPage() {
  const router = useRouter();
  const [items, setItems] = useState<FollowUp[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: biz } = await supabase
        .from("businesses")
        .select("id")
        .eq("owner_id", user.id)
        .maybeSingle();
      if (!biz) return;

      const { data } = await supabase
        .from("canvassing_properties")
        .select("id, address, lat, lng, status, notes, follow_up_date, follow_up_notes, last_visited_at, team_members(name)")
        .eq("business_id", biz.id)
        .eq("follow_up_needed", true)
        .order("follow_up_date", { ascending: true, nullsFirst: false });

      setItems(
        (data ?? []).map((p) => ({
          ...p,
          lat: typeof p.lat === "string" ? parseFloat(p.lat) : p.lat,
          lng: typeof p.lng === "string" ? parseFloat(p.lng) : p.lng,
          team_members: Array.isArray(p.team_members) ? p.team_members[0] ?? null : p.team_members,
        })) as FollowUp[]
      );
      setLoading(false);
    }
    load();
  }, []);

  const todayStr = new Date().toISOString().slice(0, 10);

  const overdue  = items.filter((p) => p.follow_up_date && p.follow_up_date < todayStr);
  const dueToday = items.filter((p) => p.follow_up_date === todayStr);
  const upcoming = items.filter((p) => p.follow_up_date && p.follow_up_date > todayStr);
  const noDate   = items.filter((p) => !p.follow_up_date);

  const totalDue = overdue.length + dueToday.length;

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border px-4 pt-4 pb-3">
        <div className="flex items-center gap-3 mb-1">
          <button
            onClick={() => router.back()}
            className="flex size-8 items-center justify-center rounded-full hover:bg-muted transition-colors active:scale-90"
          >
            <span className="material-symbols-outlined text-[20px] text-muted-foreground">arrow_back</span>
          </button>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-foreground">Follow-Ups</h1>
            <p className="text-xs text-muted-foreground">
              {loading ? "Loading…" : totalDue > 0 ? `${totalDue} due today or overdue` : "All caught up"}
            </p>
          </div>
        </div>

        {/* Quick nav */}
        <div className="flex gap-2 ml-11">
          <Link
            href="/canvassing"
            className="text-xs font-semibold text-muted-foreground hover:text-foreground px-2 py-1 rounded-lg hover:bg-muted transition-colors"
          >
            ← Map
          </Link>
          <Link
            href="/canvassing/analytics"
            className="text-xs font-semibold text-muted-foreground hover:text-foreground px-2 py-1 rounded-lg hover:bg-muted transition-colors"
          >
            Analytics →
          </Link>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-4 py-5 flex flex-col gap-6 max-w-xl mx-auto w-full pb-24">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <p className="text-sm text-muted-foreground">Loading…</p>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
            <span className="material-symbols-outlined text-[52px] text-muted-foreground/25" style={{ fontVariationSettings: "'FILL' 1" }}>
              check_circle
            </span>
            <p className="text-sm font-semibold text-foreground">No follow-ups pending</p>
            <p className="text-xs text-muted-foreground">Mark doors as "Interested" in the canvassing map to create follow-ups.</p>
          </div>
        ) : (
          <>
            <Section title="Overdue" items={overdue} urgency="overdue" />
            <Section title="Today" items={dueToday} urgency="today" emptyText="Nothing due today." />
            <Section title="Upcoming" items={upcoming} urgency="upcoming" />
            <Section title="No Date Set" items={noDate} urgency="none" />
          </>
        )}
      </div>
    </div>
  );
}
