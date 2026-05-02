"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const NAV = [
  { href: "/employee",              label: "Today",     icon: "home",          exact: true  },
  { href: "/employee/canvassing",   label: "Canvass",   icon: "door_front",    exact: false },
  { href: "/employee/schedule",     label: "Schedule",  icon: "calendar_month", exact: false },
  { href: "/employee/analytics",    label: "My Stats",  icon: "leaderboard",   exact: false },
  { href: "/employee/settings",     label: "Settings",  icon: "settings",      exact: false },
];

export default function EmployeeShell({
  children,
  employeeName,
}: {
  children: React.ReactNode;
  employeeName: string;
}) {
  const pathname = usePathname();
  const router   = useRouter();
  const isMapPage = pathname === "/employee/canvassing";

  function isActive(href: string, exact: boolean) {
    if (exact) return pathname === href;
    return pathname === href || pathname.startsWith(href + "/");
  }

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  const firstName = employeeName.split(" ")[0];

  return (
    <div className="relative flex h-full min-h-screen w-full flex-col overflow-x-hidden">

      {/* ── DESKTOP SIDEBAR — lg+ only, hidden on map ── */}
      {!isMapPage && <div
        className="hidden lg:flex flex-col fixed left-0 top-0 h-screen w-[60px] z-40 border-r border-border/40"
        style={{ background: "var(--card)" }}
      >
        {/* Logo mark */}
        <div className="flex items-center justify-center h-14 shrink-0">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary select-none">
            <svg viewBox="0 0 22 13" width="18" height="auto" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="0"  y="0"   width="9"  height="5.5" rx="0.75" fill="white" fillOpacity="0.95" />
              <rect x="11" y="0"   width="11" height="5.5" rx="0.75" fill="white" fillOpacity="0.95" />
              <rect x="0"  y="7.5" width="5"  height="5.5" rx="0.75" fill="white" fillOpacity="0.95" />
              <rect x="7"  y="7.5" width="9"  height="5.5" rx="0.75" fill="white" fillOpacity="0.95" />
              <rect x="18" y="7.5" width="4"  height="5.5" rx="0.75" fill="white" fillOpacity="0.95" />
            </svg>
          </div>
        </div>

        <div className="h-px bg-border/40 mx-2" />

        {/* Nav items */}
        <nav className="flex flex-col items-center gap-1 flex-1 py-3">
          {NAV.map(({ href, label, icon, exact }) => {
            const active = isActive(href, exact);
            return (
              <div key={href} className="group relative w-full flex justify-center">
                <Link
                  href={href}
                  className={`flex size-10 items-center justify-center rounded-xl transition-all active:scale-90 ${
                    active ? "bg-primary/10" : "hover:bg-muted/60"
                  }`}
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
                </Link>
                {/* Tooltip */}
                <div className="pointer-events-none absolute left-full ml-3 top-1/2 -translate-y-1/2 px-2.5 py-1.5 rounded-lg bg-card border border-border text-foreground text-xs font-semibold whitespace-nowrap shadow-lg opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-150 z-[60]">
                  {label}
                </div>
              </div>
            );
          })}
        </nav>

      </div>}

      {/* ── TOP BAR ── */}
      <header className={`sticky top-0 z-30 chrome lg:hidden${isMapPage ? " hidden" : ""}`}>
        <div className="flex items-center justify-between px-4 pt-3 pb-2.5 max-w-xl mx-auto">
          <div className="flex items-center gap-3">
            <div
              className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-primary"
              style={{ boxShadow: "0 2px 8px color-mix(in srgb, var(--color-primary) 35%, transparent)" }}
            >
              <span
                className="material-symbols-outlined text-[18px] text-white"
                style={{ fontVariationSettings: "'FILL' 1, 'wght' 700" }}
              >
                bolt
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-[11px] text-muted-foreground font-medium leading-none">Employee Portal</span>
              <span className="text-sm font-extrabold text-foreground leading-tight">{firstName}</span>
            </div>
          </div>

          <button
            onClick={handleSignOut}
            className="flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-all active:scale-90"
          >
            <span className="material-symbols-outlined text-[19px]">logout</span>
          </button>
        </div>
      </header>

      {/* ── MAIN CONTENT ── */}
      <main className={`flex-1 ${isMapPage ? "pb-0" : "lg:pb-8 lg:ml-[60px]"}`} style={isMapPage ? undefined : { paddingBottom: "calc(3.75rem + 1.25rem + env(safe-area-inset-bottom, 0px))" }}>{children}</main>

      {/* ── BOTTOM NAV ── */}
      <nav className={`fixed bottom-0 left-0 w-full z-40 chrome lg:hidden${isMapPage ? " hidden" : ""}`}>
        <div className="flex items-stretch max-w-xl mx-auto h-[52px] px-1">
          {NAV.map(({ href, label, icon, exact }) => {
            const active = isActive(href, exact);
            return (
              <Link
                key={href}
                href={href}
                className={`relative flex flex-col items-center justify-center flex-1 gap-0.5 py-1.5 transition-all duration-150 active:scale-90 ${
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground/80"
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
        </div>
        <div style={{ height: "env(safe-area-inset-bottom, 0px)" }} />
      </nav>
    </div>
  );
}
