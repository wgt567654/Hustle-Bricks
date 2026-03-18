"use client";

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useTheme } from 'next-themes';
import { UserGreeting } from './UserGreeting';
import { createClient } from '@/lib/supabase/client';

const NAV = [
  { href: "/", label: "Home", icon: "home", exact: true },
  { href: "/calendar", label: "Schedule", icon: "calendar_month", dot: true, exact: false },
  { href: "/clients", label: "Clients", icon: "groups", exact: false },
  { href: "/payments", label: "Earnings", icon: "attach_money", exact: false },
];

const MORE_ITEMS = [
  { href: "/map",     label: "Job Map",    icon: "map",           color: "#3581f3", bg: "bg-[#3581f3]/10" },
  { href: "/reports", label: "Reports",    icon: "bar_chart",     color: "#16a34a", bg: "bg-green-600/10" },
  { href: "/plans",   label: "Plans",      icon: "autorenew",     color: "#7c3aed", bg: "bg-violet-600/10" },
  { href: "/leads",   label: "Leads",      icon: "person_search", color: "#ea580c", bg: "bg-orange-500/10" },
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
  const endOfToday = new Date(now); endOfToday.setHours(23, 59, 59, 999);

  const [{ data: completedJobs }, { data: todayJobs }, { data: inProgressJobs }] = await Promise.all([
    supabase
      .from("jobs")
      .select("id, total, clients(name), payments(id)")
      .eq("business_id", business.id)
      .eq("status", "completed"),
    supabase
      .from("jobs")
      .select("id, scheduled_at, job_line_items(description), clients(name)")
      .eq("business_id", business.id)
      .eq("status", "scheduled")
      .gte("scheduled_at", startOfToday.toISOString())
      .lte("scheduled_at", endOfToday.toISOString())
      .order("scheduled_at"),
    supabase
      .from("jobs")
      .select("id, job_line_items(description), clients(name)")
      .eq("business_id", business.id)
      .eq("status", "in_progress"),
  ]);

  const notes: Notification[] = [];

  // Unpaid jobs
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

  // In-progress jobs
  for (const job of (inProgressJobs ?? []) as unknown as { id: string; job_line_items: { description: string }[]; clients: { name: string } | null }[]) {
    const title = job.job_line_items[0]?.description ?? "Job";
    notes.push({
      id: `inprogress-${job.id}`,
      icon: "play_circle",
      iconColor: "#ea580c",
      iconBg: "bg-[#ea580c]/10",
      title: `In progress: ${title}`,
      subtitle: job.clients?.name ?? "Unknown client",
      href: `/jobs/${job.id}`,
    });
  }

  // Today's scheduled jobs
  for (const job of (todayJobs ?? []) as unknown as { id: string; scheduled_at: string | null; job_line_items: { description: string }[]; clients: { name: string } | null }[]) {
    const title = job.job_line_items[0]?.description ?? "Job";
    const time = job.scheduled_at
      ? new Date(job.scheduled_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
      : "";
    notes.push({
      id: `today-${job.id}`,
      icon: "event",
      iconColor: "#3581f3",
      iconBg: "bg-[#3581f3]/10",
      title: `Today: ${title}`,
      subtitle: `${time}${job.clients?.name ? ` · ${job.clients.name}` : ""}`,
      href: `/jobs/${job.id}`,
    });
  }

  return notes;
}

export default function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
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

  // Close notifications on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Close settings on outside click
  useEffect(() => {
    if (!settingsOpen) return;
    function handleClick(e: MouseEvent) {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setSettingsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [settingsOpen]);

  // Close panels on route change
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

  return (
    <div className="relative flex h-full min-h-screen w-full flex-col overflow-x-hidden pb-safe">
      {/* Top App Bar */}
      <div className="sticky top-0 z-30 flex items-center bg-background/95 backdrop-blur-sm p-4 pb-2 justify-between border-b border-transparent dark:border-border">
        <div className="flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#3581f3]/10 border border-[#3581f3]/20 text-[#3581f3] overflow-hidden">
            <span className="material-symbols-outlined text-[22px]" style={{ fontVariationSettings: "'FILL' 1" }}>
              bolt
            </span>
          </div>
          <UserGreeting />
        </div>
        <div className="flex items-center gap-2">
          {/* Settings button */}
          <button
            onClick={() => { setSettingsOpen((v) => !v); setOpen(false); }}
            className={`relative flex size-10 items-center justify-center rounded-full bg-card shadow-sm border border-border text-foreground hover:bg-muted/50 transition-colors ${settingsOpen ? "bg-muted" : ""}`}
          >
            <span
              className="material-symbols-outlined text-[20px]"
              style={{ fontVariationSettings: settingsOpen ? "'FILL' 1" : "'FILL' 0" }}
            >
              settings
            </span>
          </button>

          {/* Notifications button */}
          <button
            onClick={() => { open ? setOpen(false) : openPanel(); setSettingsOpen(false); }}
            className="relative flex size-10 items-center justify-center rounded-full bg-card shadow-sm border border-border text-foreground hover:bg-muted/50 transition-colors"
          >
            <span
              className="material-symbols-outlined"
              style={{
                fontVariationSettings: open
                  ? "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24"
                  : "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24",
              }}
            >
              notifications
            </span>
            {!open && loaded && unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 size-2.5 rounded-full bg-[#ea580c] border-2 border-background" />
            )}
            {!loaded && (
              <span className="absolute top-1.5 right-1.5 size-2.5 rounded-full bg-[#ea580c] border-2 border-background" />
            )}
          </button>
        </div>
      </div>

      {/* Settings panel */}
      {settingsOpen && (
        <div className="fixed inset-0 z-20 bg-black/20 backdrop-blur-[2px]" style={{ top: "60px" }}>
          <div
            ref={settingsRef}
            className="absolute right-2 top-2 w-72 max-w-[calc(100vw-16px)] rounded-2xl bg-card border border-border shadow-2xl overflow-hidden"
          >
            {/* Appearance */}
            <div className="px-4 py-3 border-b border-border/50">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3">Appearance</p>
              <div className="grid grid-cols-3 gap-2">
                {(["light", "dark", "system"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTheme(t)}
                    className={`flex flex-col items-center gap-1.5 py-2.5 rounded-xl border text-xs font-bold transition-all ${
                      theme === t
                        ? "border-[#3581f3] bg-[#3581f3]/10 text-[#3581f3]"
                        : "border-border bg-muted/40 text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: theme === t ? "'FILL' 1" : "'FILL' 0" }}>
                      {t === "light" ? "light_mode" : t === "dark" ? "dark_mode" : "brightness_auto"}
                    </span>
                    <span className="capitalize">{t}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Quick links */}
            <div className="flex flex-col divide-y divide-border/50">
              <button
                onClick={() => { setSettingsOpen(false); router.push("/settings"); }}
                className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors text-left"
              >
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
                  <span className="material-symbols-outlined text-[16px]">tune</span>
                </div>
                <span className="font-bold text-sm text-foreground">App Settings</span>
                <span className="material-symbols-outlined text-muted-foreground text-[18px] ml-auto">chevron_right</span>
              </button>

              <button
                onClick={() => { setSettingsOpen(false); router.push("/team"); }}
                className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors text-left"
              >
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
                  <span className="material-symbols-outlined text-[16px]">group</span>
                </div>
                <span className="font-bold text-sm text-foreground">Manage Team</span>
                <span className="material-symbols-outlined text-muted-foreground text-[18px] ml-auto">chevron_right</span>
              </button>

              <button
                onClick={handleSignOut}
                className="flex items-center gap-3 px-4 py-3 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors text-left"
              >
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-red-500/10 text-red-500">
                  <span className="material-symbols-outlined text-[16px]">logout</span>
                </div>
                <span className="font-bold text-sm text-red-500">Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notification drawer */}
      {open && (
        <div className="fixed inset-0 z-20 bg-black/20 backdrop-blur-[2px]" style={{ top: "60px" }}>
          <div
            ref={drawerRef}
            className="absolute right-2 top-2 w-80 max-w-[calc(100vw-16px)] rounded-2xl bg-card border border-border shadow-2xl overflow-hidden"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
              <span className="font-extrabold text-sm text-foreground">Notifications</span>
              {unreadCount > 0 && (
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  {unreadCount} item{unreadCount !== 1 ? "s" : ""}
                </span>
              )}
            </div>

            <div className="flex flex-col divide-y divide-border/50 max-h-[60vh] overflow-y-auto">
              {loading && (
                <div className="px-4 py-6 flex items-center justify-center">
                  <p className="text-sm text-muted-foreground">Loading…</p>
                </div>
              )}

              {!loading && notifications.length === 0 && (
                <div className="px-4 py-8 flex flex-col items-center gap-2 text-center">
                  <span
                    className="material-symbols-outlined text-[40px] text-muted-foreground/30"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    notifications_active
                  </span>
                  <p className="text-sm font-bold text-foreground">All caught up!</p>
                  <p className="text-xs text-muted-foreground">No pending actions right now.</p>
                </div>
              )}

              {!loading && notifications.map((note) => (
                <button
                  key={note.id}
                  onClick={() => { setOpen(false); router.push(note.href); }}
                  className="flex items-start gap-3 px-4 py-3.5 hover:bg-muted/50 transition-colors text-left w-full"
                >
                  <div className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${note.iconBg}`} style={{ color: note.iconColor }}>
                    <span
                      className="material-symbols-outlined text-[18px]"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      {note.icon}
                    </span>
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="font-bold text-sm text-foreground leading-tight">{note.title}</span>
                    <span className="text-xs text-muted-foreground mt-0.5 truncate">{note.subtitle}</span>
                  </div>
                  <span className="material-symbols-outlined text-muted-foreground text-[18px] shrink-0 mt-0.5">chevron_right</span>
                </button>
              ))}
            </div>

            <div className="px-4 py-3 border-t border-border/50">
              <button
                onClick={() => { setOpen(false); router.push("/payments"); }}
                className="w-full text-center text-xs font-bold text-[#3581f3] hover:underline"
              >
                View all activity →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 pb-20">{children}</main>

      {/* More bottom sheet */}
      {moreOpen && (
        <div className="fixed inset-0 z-50 bg-black/40" onClick={() => setMoreOpen(false)}>
          <div
            className="absolute bottom-0 left-0 w-full bg-card rounded-t-3xl border-t border-border shadow-2xl pb-safe"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 rounded-full bg-border mx-auto mt-3 mb-4" />
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-5 mb-3">More</p>
            <div className="grid grid-cols-4 gap-2 px-4 pb-6">
              {MORE_ITEMS.map(({ href, label, icon, color, bg }) => (
                <button
                  key={href}
                  onClick={() => router.push(href)}
                  className="flex flex-col items-center gap-2 py-3 rounded-2xl border border-border bg-muted/30 active:scale-95 transition-transform"
                >
                  <div className={`flex size-10 items-center justify-center rounded-xl ${bg}`} style={{ color }}>
                    <span className="material-symbols-outlined text-[22px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                      {icon}
                    </span>
                  </div>
                  <span className="text-[10px] font-bold text-foreground">{label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Bottom Navigation Bar */}
      <div className="fixed bottom-0 left-0 w-full z-40 bg-card border-t border-border pb-safe">
        <div className="flex items-center justify-around h-16 max-w-md mx-auto px-2">
          {NAV.map(({ href, label, icon, dot, exact }) => {
            const active = isActive(href, exact);
            return (
              <Link
                key={href}
                href={href}
                className={`flex flex-col items-center justify-center w-full h-full gap-1 transition-colors relative ${
                  active ? "text-[#3581f3]" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <span
                  className="material-symbols-outlined text-[26px]"
                  style={active ? { fontVariationSettings: "'FILL' 1" } : undefined}
                >
                  {icon}
                </span>
                <span className={`text-[10px] font-medium ${active ? "font-bold" : ""}`}>{label}</span>
                {dot && !active && (
                  <div className="absolute top-[8px] right-[24px] rounded-full size-2 bg-[#ea580c] border border-card" />
                )}
              </Link>
            );
          })}
          {/* More button */}
          <button
            onClick={() => setMoreOpen((v) => !v)}
            className={`flex flex-col items-center justify-center w-full h-full gap-1 transition-colors ${
              moreOpen ? "text-[#3581f3]" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <span
              className="material-symbols-outlined text-[26px]"
              style={moreOpen ? { fontVariationSettings: "'FILL' 1" } : undefined}
            >
              grid_view
            </span>
            <span className={`text-[10px] font-medium ${moreOpen ? "font-bold" : ""}`}>More</span>
          </button>
        </div>
        {/* iOS Home Indicator Spacing fallback */}
        <div className="h-5 bg-card"></div>
      </div>
    </div>
  );
}
