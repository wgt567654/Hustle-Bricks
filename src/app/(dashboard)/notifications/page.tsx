"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { STATUS_HEX } from "@/lib/status-colors";

type Notification = {
  id: string;
  icon: string;
  iconBg: string;
  title: string;
  subtitle: string;
  href: string;
};

async function fetchNotifications(): Promise<Notification[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: business } = await supabase
    .from("businesses")
    .select("id, stale_quote_days")
    .eq("owner_id", user.id)
    .single();
  if (!business) return [];
  const staleQuoteDays = (business as unknown as { stale_quote_days: number | null }).stale_quote_days ?? 7;

  const now = new Date();
  const startOfToday = new Date(now); startOfToday.setHours(0, 0, 0, 0);
  const endOfToday   = new Date(now); endOfToday.setHours(23, 59, 59, 999);
  const staleThreshold = new Date(now.getTime() - staleQuoteDays * 24 * 60 * 60 * 1000);

  const [
    { data: completedJobs },
    { data: todayJobs },
    { data: inProgressJobs },
    { data: pendingMembers },
    { data: newLeads },
    { data: pendingBookings },
    { data: stalledQuotes },
    { data: unreadSms },
    { data: employeeMessages },
  ] = await Promise.all([
    supabase.from("jobs").select("id, total, clients(name), payments(id)")
      .eq("business_id", business.id).eq("status", "completed"),
    supabase.from("jobs").select("id, scheduled_at, job_line_items(description), clients(name)")
      .eq("business_id", business.id).eq("status", "scheduled")
      .gte("scheduled_at", startOfToday.toISOString())
      .lte("scheduled_at", endOfToday.toISOString())
      .order("scheduled_at"),
    supabase.from("jobs").select("id, job_line_items(description), clients(name)")
      .eq("business_id", business.id).eq("status", "in_progress"),
    supabase.from("team_members").select("id, name")
      .eq("business_id", business.id).eq("is_active", false).eq("is_pending", true),
    supabase.from("leads").select("id, name")
      .eq("business_id", business.id).eq("stage", "new")
      .order("created_at", { ascending: false }).limit(10),
    supabase.from("booking_requests").select("id, requested_date, requested_time, clients(name)")
      .eq("business_id", business.id).eq("status", "pending")
      .order("created_at", { ascending: false }).limit(5),
    supabase.from("quotes").select("id, total, sent_at, clients(name)")
      .eq("business_id", business.id).eq("status", "sent")
      .not("sent_at", "is", null)
      .lt("sent_at", staleThreshold.toISOString()),
    supabase.from("sms_messages").select("id, clients(name)")
      .eq("business_id", business.id).eq("direction", "inbound").is("read_at", null),
    supabase.from("team_messages").select("id, team_member_id, team_members(name)")
      .eq("business_id", business.id).eq("sender_role", "employee").eq("is_read", false),
  ]);

  const notes: Notification[] = [];

  const bookings = (pendingBookings ?? []) as unknown as { id: string; requested_date: string; requested_time: string; clients: { name: string } | null }[];
  if (bookings.length > 0) {
    const first = bookings[0];
    const dateLabel = new Date(first.requested_date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const [h] = first.requested_time.split(":").map(Number);
    const timeLabel = `${h % 12 === 0 ? 12 : h % 12} ${h >= 12 ? "PM" : "AM"}`;
    notes.push({
      id: "pending-bookings",
      icon: "calendar_clock",
      iconBg: "icon-orange",
      title: `${bookings.length} booking request${bookings.length !== 1 ? "s" : ""} to review`,
      subtitle: bookings.length === 1
        ? `${first.clients?.name ?? "Client"} wants ${dateLabel} at ${timeLabel}`
        : `${first.clients?.name ?? "Client"} and ${bookings.length - 1} more need approval`,
      href: "/bookings",
    });
  }

  const leads = (newLeads ?? []) as { id: string; name: string }[];
  if (leads.length > 0) {
    notes.push({
      id: "new-leads",
      icon: "person_search",
      iconBg: "icon-green",
      title: `${leads.length} new lead${leads.length !== 1 ? "s" : ""} from website`,
      subtitle: leads.length === 1 ? `${leads[0].name} submitted a quote request` : `${leads[0].name} and ${leads.length - 1} more submitted quote requests`,
      href: "/leads",
    });
  }

  const unread = (unreadSms ?? []) as unknown as { id: string; clients: { name: string } | null }[];
  if (unread.length > 0) {
    const senderNames = [...new Set(unread.map((m) => m.clients?.name).filter(Boolean))].slice(0, 2);
    notes.push({
      id: "unread-sms",
      icon: "chat",
      iconBg: "icon-primary",
      title: `${unread.length} unread message${unread.length !== 1 ? "s" : ""}`,
      subtitle: senderNames.length > 0 ? `From ${senderNames.join(", ")}${unread.length > senderNames.length ? " and others" : ""}` : "Open inbox to reply",
      href: "/inbox",
    });
  }

  const stalled = (stalledQuotes ?? []) as unknown as { id: string; total: number; sent_at: string; clients: { name: string } | null }[];
  if (stalled.length > 0) {
    const totalValue = stalled.reduce((s, q) => s + (q.total ?? 0), 0);
    const oldest = stalled.reduce((a, b) => new Date(a.sent_at) < new Date(b.sent_at) ? a : b);
    const daysAgo = Math.floor((now.getTime() - new Date(oldest.sent_at).getTime()) / 86400000);
    notes.push({
      id: "stalled-quotes",
      icon: "timer",
      iconBg: "icon-red",
      title: `${stalled.length} stalled quote${stalled.length !== 1 ? "s" : ""} need attention`,
      subtitle: `$${totalValue.toFixed(0)} at risk · oldest is ${daysAgo} days old`,
      href: "/sales",
    });
  }

  const pending = (pendingMembers ?? []) as { id: string; name: string }[];
  if (pending.length > 0) {
    notes.push({
      id: "pending-employees",
      icon: "badge",
      iconBg: "icon-orange",
      title: `${pending.length} employee${pending.length !== 1 ? "s" : ""} awaiting approval`,
      subtitle: pending.length === 1 ? `${pending[0].name} wants to join your team` : "Review and approve new team members",
      href: "/team",
    });
  }

  const empMsgs = (employeeMessages ?? []) as unknown as { id: string; team_member_id: string; team_members: { name: string } | null }[];
  if (empMsgs.length > 0) {
    const senderNames = [...new Set(empMsgs.map((m) => m.team_members?.name).filter(Boolean))].slice(0, 2) as string[];
    notes.push({
      id: "employee-messages",
      icon: "chat",
      iconBg: "icon-primary",
      title: `${empMsgs.length} message${empMsgs.length !== 1 ? "s" : ""} from your team`,
      subtitle: senderNames.length > 0 ? `From ${senderNames.join(", ")}${empMsgs.length > senderNames.length ? " and others" : ""}` : "Open Messages to reply",
      href: "/messages",
    });
  }

  const unpaid = (completedJobs ?? []).filter(
    (j: { payments: { id: string }[] }) => !j.payments || j.payments.length === 0
  );
  if (unpaid.length > 0) {
    notes.push({
      id: "unpaid",
      icon: "payments",
      iconBg: "icon-orange",
      title: `${unpaid.length} unpaid job${unpaid.length !== 1 ? "s" : ""}`,
      subtitle: `Collect $${(unpaid as { total: number }[]).reduce((s, j) => s + j.total, 0).toFixed(2)} outstanding`,
      href: "/payments",
    });
  }

  for (const job of (inProgressJobs ?? []) as unknown as { id: string; job_line_items: { description: string }[]; clients: { name: string } | null }[]) {
    notes.push({
      id: `inprogress-${job.id}`,
      icon: "play_circle",
      iconBg: "icon-orange",
      title: `In progress: ${job.job_line_items[0]?.description ?? "Job"}`,
      subtitle: job.clients?.name ?? "Unknown client",
      href: `/jobs/${job.id}`,
    });
  }

  for (const job of (todayJobs ?? []) as unknown as { id: string; scheduled_at: string | null; job_line_items: { description: string }[]; clients: { name: string } | null }[]) {
    const time = job.scheduled_at
      ? new Date(job.scheduled_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
      : "";
    notes.push({
      id: `today-${job.id}`,
      icon: "event",
      iconBg: "icon-primary",
      title: `Today: ${job.job_line_items[0]?.description ?? "Job"}`,
      subtitle: `${time}${job.clients?.name ? ` · ${job.clients.name}` : ""}`,
      href: `/jobs/${job.id}`,
    });
  }

  return notes;
}

export default function NotificationsPage() {
  const router = useRouter();
  const [notes, setNotes] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNotifications().then((n) => {
      setNotes(n);
      setLoading(false);
    });
  }, []);

  return (
    <div className="flex flex-col gap-5 px-4 py-5 max-w-xl mx-auto">
      <div className="flex flex-col gap-0.5 mb-1">
        <h1 className="text-2xl font-extrabold tracking-tight text-foreground">Notifications</h1>
        <p className="text-sm text-muted-foreground">Actions and alerts for your business</p>
      </div>

      {loading && (
        <div className="flex flex-col gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 rounded-2xl bg-muted/50 animate-pulse" />
          ))}
        </div>
      )}

      {!loading && notes.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <span
            className="material-symbols-outlined text-[48px] text-muted-foreground/25"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            notifications_active
          </span>
          <p className="text-base font-semibold text-foreground">All caught up</p>
          <p className="text-sm text-muted-foreground">No pending actions right now.</p>
        </div>
      )}

      {!loading && notes.length > 0 && (
        <div className="flex flex-col gap-3">
          {notes.map((note) => (
            <button
              key={note.id}
              onClick={() => router.push(note.href)}
              className="w-full rounded-2xl border border-border bg-card shadow-sm p-4 flex items-start gap-3 text-left hover:border-primary/30 active:scale-[0.99] transition-all cursor-pointer"
            >
              <div className={`flex size-10 shrink-0 items-center justify-center rounded-xl mt-0.5 ${note.iconBg}`}>
                <span
                  className="material-symbols-outlined text-[20px]"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  {note.icon}
                </span>
              </div>
              <div className="flex flex-col flex-1 min-w-0 gap-0.5">
                <span className="font-bold text-sm text-foreground leading-snug">{note.title}</span>
                <span className="text-xs text-muted-foreground">{note.subtitle}</span>
              </div>
              <span className="material-symbols-outlined text-muted-foreground/40 text-[15px] shrink-0 mt-1">chevron_right</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
