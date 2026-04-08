"use client";

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useTheme } from 'next-themes';
import { UserGreeting } from './UserGreeting';
import { createClient } from '@/lib/supabase/client';

const NAV = [
  { href: "/",                label: "Home",     icon: "home",           exact: true  },
  { href: "/calendar",        label: "Schedule", icon: "calendar_month", exact: false },
  { href: "/clients",         label: "Clients",  icon: "group",          exact: false },
  { href: "/sales-dashboard", label: "Sales",    icon: "leaderboard",    exact: false },
];

const MORE_ITEMS = [
  { href: "/map",      label: "Job Map",  icon: "map",           color: "#007AFF", bg: "bg-[#007AFF]/10" },
  { href: "/reports",  label: "Reports",  icon: "bar_chart",     color: "#16a34a", bg: "bg-[#16a34a]/10" },
  { href: "/payments", label: "Payments", icon: "attach_money",  color: "#16a34a", bg: "bg-[#16a34a]/10" },
  { href: "/plans",    label: "Plans",    icon: "autorenew",     color: "#8b5cf6", bg: "bg-[#8b5cf6]/10" },
  { href: "/leads",    label: "Leads",    icon: "person_search", color: "#ea580c", bg: "bg-[#ea580c]/10" },
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

  const [{ data: completedJobs }, { data: todayJobs }, { data: inProgressJobs }, { data: pendingMembers }] = await Promise.all([
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
  ]);

  const notes: Notification[] = [];

  // Pending employee approvals
  const pending = (pendingMembers ?? []) as { id: string; name: string }[];
  if (pending.length > 0) {
    notes.push({
      id: "pending-employees",
      icon: "badge",
      iconColor: "#ea580c",
      iconBg: "bg-[#ea580c]/10",
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
      iconColor: "#ea580c",
      iconBg: "bg-[#ea580c]/10",
      title: `${unpaid.length} unpaid job${unpaid.length !== 1 ? "s" : ""}`,
      subtitle: `Collect $${(unpaid as { total: number }[]).reduce((s, j) => s + j.total, 0).toFixed(2)} outstanding`,
      href: "/payments",
    });
  }

  for (const job of (inProgressJobs ?? []) as unknown as { id: string; job_line_items: { description: string }[]; clients: { name: string } | null }[]) {
    notes.push({
      id: `inprogress-${job.id}`,
      icon: "play_circle",
      iconColor: "#ea580c",
      iconBg: "bg-[#ea580c]/10",
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
      iconColor: "#007AFF",
      iconBg: "bg-[#007AFF]/10",
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
  const [open,          setOpen]          = useState(false);
  const [settingsOpen,  setSettingsOpen]  = useState(false);
  const [moreOpen,      setMoreOpen]      = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading,       setLoading]       = useState(false);
  const [loaded,        setLoaded]        = useState(false);
  const drawerRef   = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);

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
    router.push("/login");
    router.refresh();
  }

  const unreadCount = notifications.length;
  const isOwner     = role === "owner";
  const visibleNav  = isOwner ? NAV : NAV.filter((n) => n.href !== "/sales-dashboard");

  return (
    <div className="relative flex h-full min-h-screen w-full flex-col overflow-x-hidden">

      {/* ── TOP APP BAR — frosted glass chrome ── */}
      <header className="sticky top-0 z-30 chrome">
        {/* Dark mode override via CSS class */}
        <style>{`
          .dark header.sticky { background: oklch(0.09 0 0 / 0.90) !important; }
        `}</style>
        <div className="flex items-center justify-between px-4 pt-3 pb-2.5 max-w-xl mx-auto">
          {/* Brand + Greeting */}
          <div className="flex items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-[#007AFF]"
              style={{ boxShadow: "0 2px 8px rgba(53,129,243,0.35)" }}
            >
              <span
                className="material-symbols-outlined text-[18px] text-white"
                style={{ fontVariationSettings: "'FILL' 1, 'wght' 700" }}
              >
                bolt
              </span>
            </div>
            <UserGreeting />
          </div>

          {/* Icon buttons */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => { setSettingsOpen((v) => !v); setOpen(false); }}
              className={`flex size-8 items-center justify-center rounded-full transition-all duration-200 active:scale-90 ${
                settingsOpen ? "bg-[#007AFF]/12 text-[#007AFF]" : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <span
                className="material-symbols-outlined text-[19px]"
                style={{ fontVariationSettings: settingsOpen ? "'FILL' 1" : "'FILL' 0" }}
              >
                settings
              </span>
            </button>

            <button
              onClick={() => { open ? setOpen(false) : openPanel(); setSettingsOpen(false); }}
              className={`relative flex size-8 items-center justify-center rounded-full transition-all duration-200 active:scale-90 ${
                open ? "bg-[#007AFF]/12 text-[#007AFF]" : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <span
                className="material-symbols-outlined text-[19px]"
                style={{ fontVariationSettings: open ? "'FILL' 1" : "'FILL' 0" }}
              >
                notifications
              </span>
              {/* Unread badge */}
              {(!open || !loaded) && (
                <span className="absolute top-1 right-1 size-[7px] rounded-full bg-[#ea580c]" style={{ boxShadow: "0 0 0 1.5px var(--color-background)" }} />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* ── SETTINGS PANEL ── */}
      {settingsOpen && (
        <div className="fixed inset-0 z-40" style={{ top: 56 }}>
          <div className="absolute inset-0" onClick={() => setSettingsOpen(false)} />
          <div className="absolute right-3 top-2 w-72 max-w-[calc(100vw-24px)]">
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
                          ? "bg-[#007AFF] text-white"
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
                  <div className="h-px bg-border/30 ml-14 mr-0" />
                  <button
                    onClick={() => { setSettingsOpen(false); router.push("/team"); }}
                    className="flex w-full items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors text-left"
                  >
                    <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted/80 text-foreground">
                      <span className="material-symbols-outlined text-[14px]">group</span>
                    </div>
                    <span className="font-medium text-sm text-foreground flex-1">Manage Team</span>
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
        <div className="fixed inset-0 z-40" style={{ top: 56 }}>
          <div className="absolute inset-0" onClick={() => setOpen(false)} />
          <div className="absolute right-3 top-2 w-80 max-w-[calc(100vw-24px)]">
            <div
              ref={drawerRef}
              className="rounded-2xl overflow-hidden glass-panel animate-in-down"
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-border/40">
                <span className="font-bold text-sm text-foreground">Notifications</span>
                {unreadCount > 0 && (
                  <span className="text-[10px] font-bold bg-[#ea580c] text-white px-2 py-0.5 rounded-full tabular-nums">
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
                    <div
                      className={`flex size-8 shrink-0 items-center justify-center rounded-xl ${note.iconBg}`}
                      style={{ color: note.iconColor }}
                    >
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
                    className="w-full text-center text-xs font-semibold text-[#007AFF] hover:underline py-0.5"
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
      <main className="flex-1 pb-24">{children}</main>

      {/* ── MORE BOTTOM SHEET ── */}
      {moreOpen && (
        <div
          className="fixed inset-0 z-50"
          style={{ background: "rgba(0,0,0,0.28)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)" }}
          onClick={() => setMoreOpen(false)}
        >
          <div
            className="absolute bottom-0 left-0 w-full glass-sheet rounded-t-[28px]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-center pt-3 pb-0.5">
              <div className="w-8 h-1 rounded-full bg-muted-foreground/25" />
            </div>
            <p className="text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-widest px-5 mt-3 mb-3">More</p>
            <div className="grid grid-cols-5 gap-3 px-5 pb-7">
              {MORE_ITEMS.map(({ href, label, icon, color, bg }) => (
                <button
                  key={href}
                  onClick={() => router.push(href)}
                  className="flex flex-col items-center gap-2 active:scale-95 transition-transform"
                >
                  <div
                    className={`flex size-14 items-center justify-center rounded-2xl ${bg}`}
                    style={{ color, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}
                  >
                    <span className="material-symbols-outlined text-[22px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                      {icon}
                    </span>
                  </div>
                  <span className="text-[11px] font-semibold text-foreground text-center">{label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── BOTTOM NAVIGATION ── */}
      <nav className="fixed bottom-0 left-0 w-full z-40 chrome">
        <style>{`
          .dark nav.fixed { background: oklch(0.09 0 0 / 0.90) !important; }
        `}</style>
        <div className="flex items-stretch max-w-xl mx-auto h-[52px] px-1">
          {visibleNav.map(({ href, label, icon, exact }) => {
            const active = isActive(href, exact);
            return (
              <Link
                key={href}
                href={href}
                className={`relative flex flex-col items-center justify-center flex-1 gap-0.5 py-1.5 transition-all duration-150 active:scale-90 ${
                  active ? "text-[#007AFF]" : "text-muted-foreground hover:text-foreground/80"
                }`}
              >
                <span
                  className="material-symbols-outlined text-[23px]"
                  style={active ? { fontVariationSettings: "'FILL' 1, 'wght' 500" } : undefined}
                >
                  {icon}
                </span>
                <span className={`text-[9px] leading-none ${active ? "font-bold" : "font-medium"}`}>{label}</span>
              </Link>
            );
          })}

          <button
            onClick={() => setMoreOpen((v) => !v)}
            className={`relative flex flex-col items-center justify-center flex-1 gap-0.5 py-1.5 transition-all duration-150 active:scale-90 ${
              moreOpen ? "text-[#007AFF]" : "text-muted-foreground hover:text-foreground/80"
            }`}
          >
            <span
              className="material-symbols-outlined text-[23px]"
              style={moreOpen ? { fontVariationSettings: "'FILL' 1, 'wght' 500" } : undefined}
            >
              grid_view
            </span>
            <span className={`text-[9px] leading-none ${moreOpen ? "font-bold" : "font-medium"}`}>More</span>
          </button>
        </div>
        {/* iOS home indicator space */}
        <div className="h-5" />
      </nav>
    </div>
  );
}
