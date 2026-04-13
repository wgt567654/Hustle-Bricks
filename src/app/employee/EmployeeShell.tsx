"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const NAV = [
  { href: "/employee",            label: "Today",    icon: "home",          exact: true  },
  { href: "/employee/canvassing", label: "Canvass",  icon: "door_front",    exact: false },
  { href: "/employee/schedule",   label: "Schedule", icon: "calendar_month", exact: false },
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

      {/* ── TOP BAR ── */}
      <header className="sticky top-0 z-30 chrome">
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
      <main className="flex-1 pb-24">{children}</main>

      {/* ── BOTTOM NAV ── */}
      <nav className="fixed bottom-0 left-0 w-full z-40 chrome">
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
        <div className="h-5" />
      </nav>
    </div>
  );
}
