"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { getBusinessId } from "@/lib/supabase/get-business";

type BookingRequest = {
  id: string;
  requested_date: string;
  requested_time: string;
  notes: string | null;
  created_at: string;
  client_id: string;
  clients: { id: string; name: string; address: string | null } | null;
};

function formatRequestedTime(time: string) {
  const [h] = time.split(":").map(Number);
  return `${h % 12 === 0 ? 12 : h % 12}:00 ${h >= 12 ? "PM" : "AM"}`;
}

function formatRequestedDate(date: string) {
  return new Date(date + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric",
  });
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function BookingsPage() {
  const router = useRouter();
  const [requests, setRequests] = useState<BookingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actioning, setActioning] = useState<string | null>(null);
  const [businessId, setBusinessId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const bizId = await getBusinessId(supabase);
      if (!bizId) { setLoading(false); return; }
      setBusinessId(bizId);

      const { data } = await supabase
        .from("booking_requests")
        .select("id, requested_date, requested_time, notes, created_at, client_id, clients(id, name, address)")
        .eq("business_id", bizId)
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      setRequests((data as unknown as BookingRequest[]) ?? []);
      setLoading(false);
    }
    load();
  }, []);

  async function approve(req: BookingRequest) {
    if (!businessId) return;
    setActioning(req.id);
    const supabase = createClient();
    const scheduledAt = new Date(`${req.requested_date}T${req.requested_time}:00`).toISOString();
    const [{ data: newJob }] = await Promise.all([
      supabase.from("jobs").insert({
        business_id: businessId,
        client_id: req.client_id,
        status: "scheduled",
        scheduled_at: scheduledAt,
        total: 0,
        notes: req.notes || null,
      }).select("id").single(),
      supabase.from("booking_requests").update({ status: "accepted" }).eq("id", req.id),
    ]);
    setRequests((prev) => prev.filter((r) => r.id !== req.id));
    setActioning(null);
    if (newJob?.id) router.push(`/jobs/${newJob.id}`);
  }

  async function decline(reqId: string) {
    setActioning(reqId);
    const supabase = createClient();
    await supabase.from("booking_requests").update({ status: "declined" }).eq("id", reqId);
    setRequests((prev) => prev.filter((r) => r.id !== reqId));
    setActioning(null);
  }

  return (
    <div className="flex flex-col gap-4 px-4 lg:px-8 py-4 max-w-xl mx-auto lg:max-w-2xl pb-8">
      <div className="flex flex-col gap-0.5 mb-1">
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Inbox</p>
        <h1 className="text-xl font-extrabold tracking-tight text-foreground">Booking Requests</h1>
      </div>

      {loading && (
        <p className="text-sm text-muted-foreground text-center py-12">Loading…</p>
      )}

      {!loading && requests.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <span className="material-symbols-outlined text-[52px] text-muted-foreground/30" style={{ fontVariationSettings: "'FILL' 1" }}>
            event_available
          </span>
          <p className="text-sm font-semibold text-foreground">No pending requests</p>
          <p className="text-xs text-muted-foreground/60">New booking requests from clients will appear here</p>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {requests.map((req) => {
          const isActioning = actioning === req.id;
          return (
            <Card key={req.id} className="rounded-2xl border-border shadow-sm overflow-hidden">
              {/* Amber top bar */}
              <div className="h-1 w-full bg-amber-400" />
              <div className="p-4 flex flex-col gap-4">

                {/* Client + timestamp */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-xl icon-orange">
                      <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                        calendar_clock
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <span className="font-bold text-foreground leading-tight">
                        {req.clients?.name ?? "Unknown client"}
                      </span>
                      {req.clients?.address && (
                        <span className="text-xs text-muted-foreground truncate">{req.clients.address}</span>
                      )}
                    </div>
                  </div>
                  <span className="text-[10px] font-semibold text-muted-foreground shrink-0 mt-1">
                    {timeAgo(req.created_at)}
                  </span>
                </div>

                {/* Requested date/time */}
                <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-800/40 rounded-xl px-3 py-2.5">
                  <span className="material-symbols-outlined text-[16px] text-amber-500 shrink-0">schedule</span>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-amber-700 dark:text-amber-400">
                      {formatRequestedDate(req.requested_date)}
                    </span>
                    <span className="text-xs text-amber-600/80 dark:text-amber-500/80">
                      {formatRequestedTime(req.requested_time)}
                    </span>
                  </div>
                </div>

                {/* Client notes */}
                {req.notes && (
                  <div className="flex items-start gap-2 bg-muted/40 rounded-xl px-3 py-2.5">
                    <span className="material-symbols-outlined text-[14px] text-muted-foreground mt-0.5 shrink-0">sticky_note_2</span>
                    <p className="text-xs text-muted-foreground leading-relaxed">{req.notes}</p>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={() => decline(req.id)}
                    disabled={isActioning}
                    className="flex-1 py-2.5 rounded-xl border border-border text-sm font-bold text-muted-foreground hover:bg-muted/50 disabled:opacity-50 transition-colors"
                  >
                    Decline
                  </button>
                  <button
                    onClick={() => approve(req)}
                    disabled={isActioning}
                    className="flex-[2] py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-[16px]">check_circle</span>
                    {isActioning ? "Scheduling…" : "Approve & Schedule"}
                  </button>
                </div>

              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
