"use client";

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useTheme } from 'next-themes';
import { createClient } from '@/lib/supabase/client';
import { STATUS_HEX } from '@/lib/status-colors';
import GlobalSearch from '@/components/GlobalSearch';

type NavSubItem = { href: string; label: string; icon: string; ownerOnly?: boolean };
type NavGroup = { label: string; icon: string; ownerOnly?: boolean; items: NavSubItem[] };

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Home",
    icon: "home",
    ownerOnly: true,
    items: [
      { href: "/home", label: "Home", icon: "home" },
    ],
  },
  {
    label: "Jobs",
    icon: "work",
    items: [
      { href: "/jobs",     label: "All Jobs",  icon: "list_alt"       },
      { href: "/calendar", label: "Calendar",  icon: "calendar_month" },
      { href: "/bookings", label: "Bookings",  icon: "book_online"    },
    ],
  },
  {
    label: "Clients",
    icon: "group",
    items: [
      { href: "/clients", label: "Clients", icon: "contacts"      },
      { href: "/leads",   label: "Leads",   icon: "person_search" },
      { href: "/inbox",   label: "Inbox",   icon: "chat"          },
      { href: "/plans",   label: "Plans",   icon: "autorenew"     },
    ],
  },
  {
    label: "Sales",
    icon: "trending_up",
    items: [
      { href: "/sales",     label: "Pipeline", icon: "trending_up"   },
      { href: "/quotes",    label: "Quotes",   icon: "request_quote" },
      { href: "/payments",  label: "Payments", icon: "attach_money"  },
    ],
  },
  {
    label: "Team",
    icon: "badge",
    ownerOnly: true,
    items: [
      { href: "/team",        label: "Members",    icon: "badge"    },
      { href: "/messages",    label: "Chat",       icon: "forum"    },
      { href: "/territories", label: "Territories",icon: "pin_drop" },
    ],
  },
  {
    label: "Reports",
    icon: "bar_chart",
    ownerOnly: true,
    items: [
      { href: "/analytics",            label: "Analytics",    icon: "leaderboard"       },
      { href: "/reports/mileage",      label: "Mileage",      icon: "local_gas_station" },
      { href: "/reports/profitability",label: "Profitability",icon: "trending_up"       },
      { href: "/reports/commission",   label: "Commission",   icon: "emoji_events"      },
    ],
  },
  {
    label: "Field",
    icon: "map",
    items: [
      { href: "/canvassing", label: "Map",       icon: "map"         },
      { href: "/heatmap",    label: "Heat Map",  icon: "whatshot",   ownerOnly: true },
      { href: "/intel",      label: "Intel",     icon: "visibility", ownerOnly: true },
      { href: "/inventory",  label: "Inventory", icon: "inventory_2",ownerOnly: true },
    ],
  },
];

type Notification = {
  id: string;
  icon: string;
  iconColor: string;
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
    { data: completedJobs }, { data: todayJobs }, { data: inProgressJobs },
    { data: pendingMembers }, { data: newLeads }, { data: pendingBookings },
    { data: stalledQuotes }, { data: unreadSms }, { data: employeeMessages },
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
      iconColor: "#f59e0b",
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
      iconColor: "#16a34a",
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
      iconColor: "#2E6A8E",
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
      iconColor: "#dc2626",
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
      iconColor: STATUS_HEX.in_progress,
      iconBg: "icon-orange",
      title: `${pending.length} employee${pending.length !== 1 ? "s" : ""} awaiting approval`,
      subtitle: pending.length === 1 ? `${pending[0].name} wants to join your team` : "Review and approve new team members",
      href: "/team?pending=true",
    });
  }

  const empMsgs = (employeeMessages ?? []) as unknown as { id: string; team_member_id: string; team_members: { name: string } | null }[];
  if (empMsgs.length > 0) {
    const senderNames = [...new Set(empMsgs.map((m) => m.team_members?.name).filter(Boolean))].slice(0, 2) as string[];
    notes.push({
      id: "employee-messages",
      icon: "chat",
      iconColor: "#2E6A8E",
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
      iconColor: STATUS_HEX.in_progress,
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
      iconColor: STATUS_HEX.in_progress,
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
      iconColor: STATUS_HEX.scheduled,
      iconBg: "icon-primary",
      title: `Today: ${job.job_line_items[0]?.description ?? "Job"}`,
      subtitle: `${time}${job.clients?.name ? ` · ${job.clients.name}` : ""}`,
      href: `/jobs/${job.id}`,
    });
  }

  return notes;
}

export default function Shell({ children, role = "owner" }: { children: React.ReactNode; role?: string }) {
  const pathname    = usePathname();
  const router      = useRouter();
  const { theme, setTheme } = useTheme();
  const [open,            setOpen]            = useState(false);
  const [settingsOpen,    setSettingsOpen]    = useState(false);
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded,  setLoaded]  = useState(false);
  const drawerRef   = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);

  const isOwner   = role === "owner";
  const isMapPage = pathname === "/canvassing" || pathname.startsWith("/canvassing/")
    || pathname === "/map" || pathname.startsWith("/map/");

  const visibleGroups = NAV_GROUPS.filter(g => !g.ownerOnly || isOwner);

  const activeGroup = visibleGroups.find(g =>
    g.items.some(item => pathname === item.href || pathname.startsWith(item.href + "/"))
  );

  const visibleSubItems = (activeGroup?.items ?? []).filter(item => !item.ownerOnly || isOwner);
  const hasSubNav = !isMapPage && visibleSubItems.length > 1;

  useEffect(() => {
    setLoaded(false);
    setOpen(false);
    setSettingsOpen(false);
  }, [pathname]);

  async function openPanel() {
    setOpen(true);
    if (!loaded) {
      setLoading(true);
      const notes = await fetchNotifications();
      setNotifications(notes);
      setLoading(false);
      setLoaded(true);
    }
  }

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  useEffect(() => {
    if (!settingsOpen) return;
    const handler = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) setSettingsOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [settingsOpen]);

  async function handleSignOut() {
    setSettingsOpen(false);
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  const unreadCount = notifications.length;

  return (
    <div className="relative flex flex-col min-h-screen w-full">

      {/* ── TOP NAVIGATION BAR ── */}
      {!isMapPage && (
        <header
          className="sticky top-0 z-[450] border-b border-border/40 bg-background/[0.95] backdrop-blur-[16px] backdrop-saturate-[1.4]"
          style={{
            paddingTop: "env(safe-area-inset-top, 0px)",
            WebkitBackdropFilter: "blur(16px) saturate(1.4)",
          }}
        >
          <div className="flex items-center h-14 px-3 gap-2">

            {/* Logo */}
            <Link href="/home" className="flex items-center gap-2 shrink-0 mr-1">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary select-none">
                <svg viewBox="0 0 22 13" className="w-[18px] h-auto" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="0"  y="0"   width="9"  height="5.5" rx="0.75" fill="white" fillOpacity="0.95" />
                  <rect x="11" y="0"   width="11" height="5.5" rx="0.75" fill="white" fillOpacity="0.95" />
                  <rect x="0"  y="7.5" width="5"  height="5.5" rx="0.75" fill="white" fillOpacity="0.95" />
                  <rect x="7"  y="7.5" width="9"  height="5.5" rx="0.75" fill="white" fillOpacity="0.95" />
                  <rect x="18" y="7.5" width="4"  height="5.5" rx="0.75" fill="white" fillOpacity="0.95" />
                </svg>
              </div>
              <span
                className="hidden sm:block text-[13px] font-extrabold tracking-wide uppercase text-foreground"
                style={{ fontFamily: "var(--font-display)", letterSpacing: "0.08em" }}
              >
                Hustle Bricks
              </span>
            </Link>

            {/* Category tabs — horizontal scrollable */}
            <nav className="flex-1 flex items-center overflow-x-auto scrollbar-none gap-0.5 min-w-0">
              {visibleGroups.map((group) => {
                const active = activeGroup?.label === group.label;
                const firstVisible = group.items.find(i => !i.ownerOnly || isOwner) ?? group.items[0];
                return (
                  <Link
                    key={group.label}
                    href={firstVisible.href}
                    className={`flex items-center gap-1.5 h-9 px-3 rounded-xl whitespace-nowrap text-sm font-semibold transition-all active:scale-95 shrink-0 ${
                      active
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                    }`}
                  >
                    <span
                      className="material-symbols-outlined text-[16px] shrink-0"
                      style={{ fontVariationSettings: active ? "'FILL' 1, 'wght' 500" : "'FILL' 0" }}
                    >
                      {group.icon}
                    </span>
                    <span className="hidden md:block">{group.label}</span>
                  </Link>
                );
              })}
            </nav>

            {/* Right action buttons */}
            <div className="flex items-center gap-1 shrink-0">
              <GlobalSearch />

              {isOwner && !pathname.startsWith("/assistant") && (
                <Link
                  href="/assistant"
                  className="flex size-9 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted/60 transition-all active:scale-95"
                >
                  <span
                    className="material-symbols-outlined text-[20px]"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    auto_awesome
                  </span>
                </Link>
              )}
              <button
                onClick={() => { open ? setOpen(false) : openPanel(); setSettingsOpen(false); }}
                className="relative flex size-9 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted/60 transition-all active:scale-95"
              >
                <span
                  className="material-symbols-outlined text-[20px]"
                  style={{ fontVariationSettings: open ? "'FILL' 1" : "'FILL' 0" }}
                >
                  notifications
                </span>
                {(!open || !loaded) && (
                  <span className="absolute top-2 right-2 size-[6px] rounded-full bg-[var(--color-status-in-progress)]" />
                )}
              </button>
              <button
                onClick={() => { setSettingsOpen((v) => !v); setOpen(false); }}
                className="flex size-9 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted/60 transition-all active:scale-95"
              >
                <span
                  className="material-symbols-outlined text-[20px]"
                  style={{ fontVariationSettings: settingsOpen ? "'FILL' 1" : "'FILL' 0" }}
                >
                  settings
                </span>
              </button>
            </div>
          </div>
        </header>
      )}


      {/* ── MOBILE SUB-NAVIGATION BAR — below top bar, hidden on desktop ── */}
      {hasSubNav && (
        <div
          className="lg:hidden sticky z-[440] bg-background/90 border-b border-border/30 backdrop-blur-[12px] backdrop-saturate-[1.4]"
          style={{
            top: "calc(3.5rem + env(safe-area-inset-top, 0px))",
            WebkitBackdropFilter: "blur(12px) saturate(1.4)",
          }}
        >
          <div className="flex items-center px-3 gap-0.5 overflow-x-auto scrollbar-none h-10">
            {visibleSubItems.map((item) => {
              const active = pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center h-7 px-3 rounded-lg text-sm font-semibold whitespace-nowrap transition-all active:scale-95 ${
                    active
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* ── FLOATING CONTROLS — map page only ── */}
      {isMapPage && (
        <>
          {/* Back button — top left */}
          <div
            className="fixed left-2.5 z-[450]"
            style={{ top: "calc(0.625rem + env(safe-area-inset-top, 0px))" }}
          >
            <button
              onClick={() => router.back()}
              className="flex size-8 items-center justify-center rounded-full active:scale-90 transition-all"
              style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}
            >
              <span className="material-symbols-outlined text-[17px] text-white">arrow_back</span>
            </button>
          </div>

          {/* Settings + Notifications — top right */}
          <div
            className="fixed right-2.5 z-[450] flex items-center gap-1.5"
            style={{ top: "calc(0.625rem + env(safe-area-inset-top, 0px))" }}
          >
            <button
              onClick={() => { setSettingsOpen((v) => !v); setOpen(false); }}
              className="flex size-8 items-center justify-center rounded-full active:scale-90 transition-all"
              style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}
            >
              <span className="material-symbols-outlined text-[17px] text-white" style={{ fontVariationSettings: settingsOpen ? "'FILL' 1" : "'FILL' 0" }}>
                settings
              </span>
            </button>
            <button
              onClick={() => { open ? setOpen(false) : openPanel(); setSettingsOpen(false); }}
              className="relative flex size-8 items-center justify-center rounded-full active:scale-90 transition-all"
              style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}
            >
              <span className="material-symbols-outlined text-[17px] text-white" style={{ fontVariationSettings: open ? "'FILL' 1" : "'FILL' 0" }}>
                notifications
              </span>
              {(!open || !loaded) && (
                <span className="absolute top-1 right-1 size-[6px] rounded-full bg-[var(--color-status-in-progress)]" />
              )}
            </button>
          </div>
        </>
      )}

      {/* ── SETTINGS PANEL ── */}
      {settingsOpen && (
        <div
          className="fixed inset-0 z-[460]"
          style={{ top: isMapPage ? 0 : "calc(3.5rem + env(safe-area-inset-top, 0px))" }}
        >
          <div className="absolute inset-0" onClick={() => setSettingsOpen(false)} />
          <div className="absolute right-3 top-2 w-72 max-w-[calc(100vw-24px)] lg:right-3">
            <div ref={settingsRef} className="rounded-2xl overflow-hidden glass-panel animate-in-down">
              <div className="px-3 pt-3 pb-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70 mb-2">Appearance</p>
                <div className="grid grid-cols-3 gap-1.5">
                  {(["light", "dark", "system"] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setTheme(t)}
                      className={`flex flex-col items-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold transition-all active:scale-95 ${
                        theme === t
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted/60 text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      <span
                        className="material-symbols-outlined text-[17px]"
                        style={{ fontVariationSettings: theme === t ? "'FILL' 1" : "'FILL' 0" }}
                      >
                        {t === "light" ? "light_mode" : t === "dark" ? "dark_mode" : "brightness_auto"}
                      </span>
                      <span className="capitalize">{t}</span>
                    </button>
                  ))}
                </div>
              </div>

              {isOwner && (
                <>
                  <div className="h-px bg-border/40" />
                  <button
                    onClick={() => { setSettingsOpen(false); router.push("/settings"); }}
                    className="flex w-full items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors text-left"
                  >
                    <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted/80 text-foreground">
                      <span className="material-symbols-outlined text-[14px]">tune</span>
                    </div>
                    <span className="font-medium text-sm text-foreground flex-1">App Settings</span>
                    <span className="material-symbols-outlined text-muted-foreground/40 text-[15px]">chevron_right</span>
                  </button>
                </>
              )}

              <div className="h-px bg-border/40" />
              <button
                onClick={handleSignOut}
                className="flex w-full items-center gap-3 px-4 py-3 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors text-left"
              >
                <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-red-500/10 text-red-500">
                  <span className="material-symbols-outlined text-[14px]">logout</span>
                </div>
                <span className="font-medium text-sm text-red-500 flex-1">Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── NOTIFICATION DRAWER ── */}
      {open && (
        <div
          className="fixed inset-0 z-[460]"
          style={{ top: isMapPage ? 0 : "calc(3.5rem + env(safe-area-inset-top, 0px))" }}
        >
          <div className="absolute inset-0" onClick={() => setOpen(false)} />
          <div className="absolute right-3 top-2 w-80 max-w-[calc(100vw-24px)]">
            <div ref={drawerRef} className="rounded-2xl overflow-hidden glass-panel animate-in-down">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border/40">
                <span className="font-bold text-sm text-foreground">Notifications</span>
                {unreadCount > 0 && (
                  <span className="text-[10px] font-bold bg-[var(--color-status-in-progress)] text-white px-2 py-0.5 rounded-full tabular-nums">
                    {unreadCount}
                  </span>
                )}
              </div>

              <div className="flex flex-col max-h-[54vh] overflow-y-auto divide-y divide-border/30">
                {loading && (
                  <div className="px-4 py-8 flex items-center justify-center">
                    <p className="text-sm text-muted-foreground">Loading…</p>
                  </div>
                )}
                {!loading && notifications.length === 0 && (
                  <div className="px-4 py-10 flex flex-col items-center gap-2 text-center">
                    <span
                      className="material-symbols-outlined text-[40px] text-muted-foreground/25"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      notifications_active
                    </span>
                    <p className="text-sm font-semibold text-foreground">All caught up</p>
                    <p className="text-xs text-muted-foreground">No pending actions right now.</p>
                  </div>
                )}
                {!loading && notifications.map((note) => (
                  <button
                    key={note.id}
                    onClick={() => { setOpen(false); router.push(note.href); }}
                    className="flex items-start gap-3 px-4 py-3.5 hover:bg-muted/30 transition-colors text-left w-full active:scale-[0.99]"
                  >
                    <div className={`flex size-8 shrink-0 items-center justify-center rounded-xl ${note.iconBg}`}>
                      <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                        {note.icon}
                      </span>
                    </div>
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="font-semibold text-sm text-foreground leading-snug">{note.title}</span>
                      <span className="text-xs text-muted-foreground mt-0.5 truncate">{note.subtitle}</span>
                    </div>
                    <span className="material-symbols-outlined text-muted-foreground/35 text-[15px] shrink-0 mt-0.5">chevron_right</span>
                  </button>
                ))}
              </div>

              {isOwner && (
                <div className="px-4 py-2.5 border-t border-border/40">
                  <button
                    onClick={() => { setOpen(false); router.push("/notifications"); }}
                    className="w-full text-center text-xs font-semibold text-primary hover:underline py-0.5"
                  >
                    View all notifications →
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── CONTENT ROW: sidebar + main ── */}
      <div className="flex flex-1 min-h-0">

        {/* Desktop sidebar — sticky, sub-items of active group, lg+ only */}
        {!isMapPage && (
          <div
            onMouseEnter={() => setSidebarExpanded(true)}
            onMouseLeave={() => setSidebarExpanded(false)}
            className="hidden lg:flex flex-col sticky shrink-0 z-40 border-r border-border/40 overflow-hidden"
            style={{
              background: "var(--card)",
              top: "calc(3.5rem + env(safe-area-inset-top, 0px))",
              height: "calc(100vh - 3.5rem - env(safe-area-inset-top, 0px))",
              width: sidebarExpanded ? 220 : 60,
              transition: "width 200ms ease-in-out",
            }}
          >
            {activeGroup && visibleSubItems.length > 1 && (
              <>
                <div className="flex items-center h-10 shrink-0 px-[14px] gap-3">
                  <span
                    className="material-symbols-outlined text-[18px] shrink-0"
                    style={{ color: "var(--color-primary)", fontVariationSettings: "'FILL' 1, 'wght' 500" }}
                  >
                    {activeGroup.icon}
                  </span>
                  <span
                    className={`whitespace-nowrap text-[11px] font-extrabold tracking-widest uppercase text-muted-foreground transition-opacity duration-100 ${sidebarExpanded ? "opacity-100" : "opacity-0"}`}
                  >
                    {activeGroup.label}
                  </span>
                </div>
                <div className="h-px bg-border/40 mx-2 shrink-0" />
              </>
            )}

            <nav className="flex flex-col gap-0.5 flex-1 min-h-0 overflow-y-auto py-2 px-2 scrollbar-none">
              {visibleSubItems.map(({ href, label, icon }) => {
                const active = pathname === href || pathname.startsWith(href + "/");
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`flex items-center gap-3 h-10 rounded-xl px-[11px] transition-colors active:scale-95 ${
                      active ? "bg-primary/10" : "hover:bg-muted/60"
                    }`}
                  >
                    <span
                      className="material-symbols-outlined text-[20px] shrink-0"
                      style={{
                        color: active ? "var(--color-primary)" : "var(--muted-foreground)",
                        fontVariationSettings: active ? "'FILL' 1, 'wght' 500" : "'FILL' 0",
                      }}
                    >
                      {icon}
                    </span>
                    <span
                      className={`whitespace-nowrap text-sm font-semibold transition-opacity duration-100 ${sidebarExpanded ? "opacity-100" : "opacity-0"} ${active ? "text-primary" : "text-muted-foreground"}`}
                    >
                      {label}
                    </span>
                  </Link>
                );
              })}
            </nav>
          </div>
        )}

        <main className="flex-1 min-w-0 overflow-x-hidden">{children}</main>
      </div>
    </div>
  );
}
