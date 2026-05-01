"use client";

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useTheme } from 'next-themes';
import { createClient } from '@/lib/supabase/client';
import { STATUS_HEX } from '@/lib/status-colors';

const NAV = [
  { href: "/jobs",            label: "Jobs",     icon: "work",           exact: false, ownerOnly: false },
  { href: "/analytics",       label: "Analytics", icon: "leaderboard",    exact: false, ownerOnly: true  },
  { href: "/canvassing",      label: "Map",      icon: "map",            exact: false, ownerOnly: false },
  { href: "/calendar",        label: "Schedule", icon: "calendar_month", exact: false, ownerOnly: false },
];

const MORE_GROUPS = [
  {
    label: "Money",
    items: [
      { href: "/payments", label: "Payments", icon: "attach_money", ownerOnly: false },
    ],
  },
  {
    label: "Business",
    items: [
      { href: "/clients", label: "Clients",  icon: "group",         ownerOnly: false },
      { href: "/leads",   label: "Leads",    icon: "person_search", ownerOnly: false },
      { href: "/plans",   label: "Plans",    icon: "autorenew",     ownerOnly: false },
      { href: "/team",    label: "Team",     icon: "badge",         ownerOnly: true  },
    ],
  },
];

const SIDEBAR_NAV = [
  ...NAV,
  { href: "/payments", label: "Payments", icon: "attach_money", exact: false, ownerOnly: false },
  { href: "/clients",  label: "Clients",  icon: "group",        exact: false, ownerOnly: false },
  { href: "/leads",    label: "Leads",    icon: "person_search", exact: false, ownerOnly: false },
  { href: "/plans",    label: "Plans",    icon: "autorenew",    exact: false, ownerOnly: false },
  { href: "/team",     label: "Team",     icon: "badge",        exact: false, ownerOnly: true  },
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
    .select("id")
    .eq("owner_id", user.id)
    .single();
  if (!business) return [];

  const now = new Date();
  const startOfToday = new Date(now); startOfToday.setHours(0, 0, 0, 0);
  const endOfToday   = new Date(now); endOfToday.setHours(23, 59, 59, 999);

  const [{ data: completedJobs }, { data: todayJobs }, { data: inProgressJobs }, { data: pendingMembers }, { data: newLeads }, { data: pendingBookings }] = await Promise.all([
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
  ]);

  const notes: Notification[] = [];

  // Pending booking requests from client portal
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

  // New leads from quote-request form
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

  // Pending employee approvals
  const pending = (pendingMembers ?? []) as { id: string; name: string }[];
  if (pending.length > 0) {
    notes.push({
      id: "pending-employees",
      icon: "badge",
      iconColor: STATUS_HEX.in_progress,
      iconBg: "icon-orange",
      title: `${pending.length} employee${pending.length !== 1 ? "s" : ""} awaiting approval`,
      subtitle: pending.length === 1 ? `${pending[0].name} wants to join your team` : "Review and approve new team members",
      href: "/team",
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
  const { theme, setTheme, resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const [open,          setOpen]          = useState(false);
  const [settingsOpen,  setSettingsOpen]  = useState(false);
  const [moreOpen,      setMoreOpen]      = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading,       setLoading]       = useState(false);
  const [loaded,        setLoaded]        = useState(false);
  const [isStandalone,  setIsStandalone]  = useState(false);
  const drawerRef   = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsStandalone(window.matchMedia("(display-mode: standalone)").matches);
  }, []);

  function isActive(href: string, exact: boolean) {
    if (exact) return pathname === href;
    return pathname === href || pathname.startsWith(href + "/");
  }

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

  useEffect(() => {
    setLoaded(false);
    setOpen(false);
    setSettingsOpen(false);
    setMoreOpen(false);
  }, [pathname]);

  async function handleSignOut() {
    setSettingsOpen(false);
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  const unreadCount        = notifications.length;
  const isOwner            = role === "owner";
  const visibleNav         = NAV.filter((n) => !n.ownerOnly || isOwner);
  const visibleSidebarNav  = SIDEBAR_NAV.filter((n) => !n.ownerOnly || isOwner);
  const isMapPage          = pathname === "/map" || pathname.startsWith("/map/") || pathname === "/canvassing" || pathname.startsWith("/canvassing/");

  return (
    <div className="relative flex h-full min-h-screen w-full flex-col overflow-x-hidden">

      {/* ── DESKTOP SIDEBAR — lg+ only, hidden on map ── */}
      {!isMapPage && (
        <div
          className="group hidden lg:flex flex-col fixed left-0 top-0 h-screen w-[60px] hover:w-[220px] z-40 border-r border-border/40 overflow-hidden"
          style={{
            background: "var(--card)",
            transition: "width 200ms ease-in-out",
          }}
        >
          {/* Logo */}
          <div className="flex items-center h-14 shrink-0 px-[14px] gap-3">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary select-none">
              <svg viewBox="0 0 22 13" className="w-[18px] h-auto" fill="none" xmlns="http://www.w3.org/2000/svg">
                {/* Top row — 2 bricks */}
                <rect x="0"  y="0"   width="9"  height="5.5" rx="0.75" fill="white" fillOpacity="0.95" />
                <rect x="11" y="0"   width="11" height="5.5" rx="0.75" fill="white" fillOpacity="0.95" />
                {/* Bottom row — offset bond (half + full + half) */}
                <rect x="0"  y="7.5" width="5"  height="5.5" rx="0.75" fill="white" fillOpacity="0.95" />
                <rect x="7"  y="7.5" width="9"  height="5.5" rx="0.75" fill="white" fillOpacity="0.95" />
                <rect x="18" y="7.5" width="4"  height="5.5" rx="0.75" fill="white" fillOpacity="0.95" />
              </svg>
            </div>
            <span
              className="whitespace-nowrap text-[13px] font-extrabold tracking-wide uppercase text-foreground opacity-0 group-hover:opacity-100 transition-opacity duration-100"
              style={{ fontFamily: "var(--font-display)", letterSpacing: "0.08em" }}
            >
              Hustle Bricks
            </span>
          </div>

          <div className="h-px bg-border/40 mx-2 shrink-0" />

          {/* Nav items */}
          <nav className="flex flex-col gap-0.5 flex-1 py-2 px-2">
            {visibleSidebarNav.map(({ href, label, icon, exact }) => {
              const active = isActive(href, exact);
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-3 h-10 rounded-xl px-[11px] transition-colors active:scale-95 ${
                    active ? "bg-primary/10" : "hover:bg-muted/60"
                  }`}
                >
                  <span
                    className="material-symbols-outlined text-[22px] shrink-0"
                    style={{
                      color: active ? "var(--color-primary)" : "var(--muted-foreground)",
                      fontVariationSettings: active ? "'FILL' 1, 'wght' 500" : "'FILL' 0",
                    }}
                  >
                    {icon}
                  </span>
                  <span className={`whitespace-nowrap text-sm font-semibold opacity-0 group-hover:opacity-100 transition-opacity duration-100 ${active ? "text-primary" : "text-muted-foreground"}`}>
                    {label}
                  </span>
                </Link>
              );
            })}
          </nav>

          <div className="h-px bg-border/40 mx-2 shrink-0" />

          {/* Notifications + Settings at bottom */}
          <div className="flex flex-col gap-0.5 py-2 px-2">
            <button
              onClick={() => { open ? setOpen(false) : openPanel(); setSettingsOpen(false); }}
              className="flex items-center gap-3 h-10 rounded-xl px-[11px] hover:bg-muted/60 transition-colors active:scale-95 w-full text-left"
            >
              <span className="relative shrink-0">
                <span
                  className="material-symbols-outlined text-[22px]"
                  style={{
                    color: "var(--muted-foreground)",
                    fontVariationSettings: open ? "'FILL' 1" : "'FILL' 0",
                  }}
                >
                  notifications
                </span>
                {(!open || !loaded) && (
                  <span className="absolute -top-0.5 -right-0.5 size-[7px] rounded-full bg-[var(--color-status-in-progress)]" />
                )}
              </span>
              <span className="whitespace-nowrap text-sm font-semibold text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity duration-100">Notifications</span>
            </button>

            <button
              onClick={() => { setSettingsOpen((v) => !v); setOpen(false); }}
              className="flex items-center gap-3 h-10 rounded-xl px-[11px] hover:bg-muted/60 transition-colors active:scale-95 w-full text-left"
            >
              <span
                className="material-symbols-outlined text-[22px] shrink-0"
                style={{
                  color: "var(--muted-foreground)",
                  fontVariationSettings: settingsOpen ? "'FILL' 1" : "'FILL' 0",
                }}
              >
                settings
              </span>
              <span className="whitespace-nowrap text-sm font-semibold text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity duration-100">Settings</span>
            </button>
          </div>
        </div>
      )}

      {/* ── STICKY TOP BAR — mobile only, non-map pages ── */}
      {!isMapPage && (
        <header
          className="sticky top-0 z-[450] lg:hidden border-b border-border/40 bg-background/[0.92] backdrop-blur-[16px] backdrop-saturate-[1.4]"
          style={{
            paddingTop: "env(safe-area-inset-top, 0px)",
            WebkitBackdropFilter: "blur(16px) saturate(1.4)",
          }}
        >
          <div className="flex items-center justify-end px-2 h-11">
            <div className="flex items-center gap-0.5">
              <button
                onClick={() => { setSettingsOpen((v) => !v); setOpen(false); }}
                className="flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted/60 active:scale-90 transition-all"
              >
                <span
                  className="material-symbols-outlined text-[17px]"
                  style={{ fontVariationSettings: settingsOpen ? "'FILL' 1" : "'FILL' 0" }}
                >
                  settings
                </span>
              </button>
              <button
                onClick={() => { open ? setOpen(false) : openPanel(); setSettingsOpen(false); }}
                className="relative flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted/60 active:scale-90 transition-all"
              >
                <span
                  className="material-symbols-outlined text-[17px]"
                  style={{ fontVariationSettings: open ? "'FILL' 1" : "'FILL' 0" }}
                >
                  notifications
                </span>
                {(!open || !loaded) && (
                  <span className="absolute top-1.5 right-1.5 size-[6px] rounded-full bg-[var(--color-status-in-progress)]" />
                )}
              </button>
            </div>
          </div>
        </header>
      )}

      {/* ── FLOATING icon buttons — map page only ── */}
      {isMapPage && (
        <div className="fixed right-2.5 z-[450] flex items-center gap-1.5 lg:hidden" style={{ top: "calc(0.625rem + env(safe-area-inset-top, 0px))" }}>
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
      )}

      {/* ── SETTINGS PANEL ── */}
      {settingsOpen && (
        <div className="fixed inset-0 z-40 lg:left-[60px]" style={{ top: "calc(2.75rem + env(safe-area-inset-top, 0px))" }}>
          <div className="absolute inset-0" onClick={() => setSettingsOpen(false)} />
          <div className="absolute right-3 top-2 w-72 max-w-[calc(100vw-24px)] lg:right-auto lg:left-3 lg:top-auto lg:bottom-14">
            <div
              ref={settingsRef}
              className="rounded-2xl overflow-hidden glass-panel animate-in-down"
            >
              {/* Appearance */}
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
        <div className="fixed inset-0 z-40 lg:left-[60px]" style={{ top: "calc(2.75rem + env(safe-area-inset-top, 0px))" }}>
          <div className="absolute inset-0" onClick={() => setOpen(false)} />
          <div className="absolute right-3 top-2 w-80 max-w-[calc(100vw-24px)] lg:right-auto lg:left-3 lg:top-3">
            <div
              ref={drawerRef}
              className="rounded-2xl overflow-hidden glass-panel animate-in-down"
            >
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
                    onClick={() => { setOpen(false); router.push("/payments"); }}
                    className="w-full text-center text-xs font-semibold text-primary hover:underline py-0.5"
                  >
                    View all activity →
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── MAIN CONTENT ── */}
      <main className="flex-1 lg:pb-0 lg:ml-[60px]" style={{ paddingBottom: "calc(5rem + env(safe-area-inset-bottom, 0px))" }}>{children}</main>

      {/* ── MORE BOTTOM SHEET ── */}
      {moreOpen && (
        <div
          className="fixed inset-0 z-[3000]"
          style={{ background: "rgba(0,0,0,0.28)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)" }}
          onClick={() => setMoreOpen(false)}
        >
          <div
            className="absolute bottom-0 left-0 w-full rounded-t-[28px] overflow-hidden bg-background/[0.92] backdrop-blur-[24px] backdrop-saturate-[1.6] border-t border-border"
            style={{
              WebkitBackdropFilter: "blur(24px) saturate(1.6)",
              boxShadow: "0 -8px 32px rgba(0,0,0,0.10)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-center pt-3">
              <div className="w-8 h-1 rounded-full bg-muted-foreground/25" />
            </div>
            <div className="flex flex-col px-4 pt-3 pb-8 gap-0">
              {MORE_GROUPS.map((group, gi) => (
                <div key={group.label}>
                  {gi > 0 && <div className="h-px bg-black/[0.06] my-1" />}
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 px-1 pt-2 pb-1">
                    {group.label}
                  </p>
                  <div className="grid grid-cols-3 gap-0">
                    {group.items.filter((item) => !item.ownerOnly || isOwner).map(({ href, label, icon }) => {
                      const active = pathname === href || pathname.startsWith(href + "/");
                      return (
                        <button
                          key={href}
                          onClick={() => router.push(href)}
                          className="flex flex-col items-center gap-1.5 py-3 px-2 rounded-2xl active:scale-95 transition-all duration-150 hover:bg-black/[0.04]"
                        >
                          <span
                            className="material-symbols-outlined text-[22px]"
                            style={{
                              color: active ? "var(--color-primary)" : "var(--muted-foreground)",
                              fontVariationSettings: active ? "'FILL' 1, 'wght' 500" : "'FILL' 0",
                            }}
                          >
                            {icon}
                          </span>
                          <span
                            className="text-[10px] leading-none font-semibold"
                            style={{ color: active ? "var(--color-primary)" : "var(--muted-foreground)" }}
                          >
                            {label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── BOTTOM NAVIGATION — floating pill, mobile only ── */}
      {!isMapPage && (
        <div className="fixed z-40 lg:hidden left-1/2 -translate-x-1/2" style={{ bottom: isStandalone ? 12 : 4, width: "calc(100% - 32px)", maxWidth: 420 }}>
          <div
            className="flex items-center justify-around px-2 py-3 rounded-[24px] bg-background/[0.90] backdrop-blur-[24px] backdrop-saturate-[1.6] border border-border"
            style={{
              WebkitBackdropFilter: "blur(24px) saturate(1.6)",
            }}
          >
            {visibleNav.map(({ href, label, icon, exact }) => {
              const active = isActive(href, exact);
              return (
                <Link
                  key={href}
                  href={href}
                  className="relative flex flex-col items-center justify-center flex-1 gap-1 py-0.5 transition-all duration-150 active:scale-90"
                >
                  <span
                    className="material-symbols-outlined text-[20px]"
                    style={{
                      color: active ? "var(--color-primary)" : "var(--muted-foreground)",
                      fontVariationSettings: active ? "'FILL' 1, 'wght' 500" : "'FILL' 0",
                    }}
                  >
                    {icon}
                  </span>
                  <span
                    className="text-[9px] leading-none font-semibold"
                    style={{ color: active ? "var(--color-primary)" : "var(--muted-foreground)" }}
                  >
                    {label}
                  </span>
                  {active && (
                    <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />
                  )}
                </Link>
              );
            })}

            <button
              onClick={() => setMoreOpen((v) => !v)}
              className="relative flex flex-col items-center justify-center flex-1 gap-1 py-0.5 transition-all duration-150 active:scale-90"
            >
              <span
                className="material-symbols-outlined text-[20px]"
                style={{
                  color: moreOpen ? "var(--color-primary)" : "var(--muted-foreground)",
                  fontVariationSettings: moreOpen ? "'FILL' 1, 'wght' 500" : "'FILL' 0",
                }}
              >
                grid_view
              </span>
              <span
                className="text-[9px] leading-none font-semibold"
                style={{ color: moreOpen ? "var(--color-primary)" : "var(--muted-foreground)" }}
              >
                More
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
