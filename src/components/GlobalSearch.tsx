"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getBusinessId } from "@/lib/supabase/get-business";

type Item = {
  id: string;
  kind: "nav" | "client" | "lead" | "job" | "quote" | "team";
  group: string;
  name: string;
  subtitle: string;
  href: string;
  icon: string;
};

const NAV_ITEMS: Item[] = [
  { id: "nav-jobs",          kind: "nav", group: "Pages", name: "All Jobs",         subtitle: "Jobs",    href: "/jobs",                  icon: "list_alt"          },
  { id: "nav-calendar",      kind: "nav", group: "Pages", name: "Calendar",         subtitle: "Jobs",    href: "/calendar",              icon: "calendar_month"    },
  { id: "nav-bookings",      kind: "nav", group: "Pages", name: "Bookings",         subtitle: "Jobs",    href: "/bookings",              icon: "book_online"       },
  { id: "nav-clients",       kind: "nav", group: "Pages", name: "Clients",          subtitle: "Clients", href: "/clients",               icon: "contacts"          },
  { id: "nav-leads",         kind: "nav", group: "Pages", name: "Leads",            subtitle: "Clients", href: "/leads",                 icon: "person_search"     },
  { id: "nav-inbox",         kind: "nav", group: "Pages", name: "Inbox",            subtitle: "Clients", href: "/inbox",                 icon: "chat"              },
  { id: "nav-plans",         kind: "nav", group: "Pages", name: "Plans",            subtitle: "Clients", href: "/plans",                 icon: "autorenew"         },
  { id: "nav-pipeline",      kind: "nav", group: "Pages", name: "Pipeline",         subtitle: "Sales",   href: "/sales",                 icon: "trending_up"       },
  { id: "nav-quotes",        kind: "nav", group: "Pages", name: "Quotes",           subtitle: "Sales",   href: "/quotes",                icon: "request_quote"     },
  { id: "nav-payments",      kind: "nav", group: "Pages", name: "Payments",         subtitle: "Sales",   href: "/payments",              icon: "attach_money"      },
  { id: "nav-team",          kind: "nav", group: "Pages", name: "Team Members",     subtitle: "Team",    href: "/team",                  icon: "badge"             },
  { id: "nav-messages",      kind: "nav", group: "Pages", name: "Messages",         subtitle: "Team",    href: "/messages",              icon: "forum"             },
  { id: "nav-territories",   kind: "nav", group: "Pages", name: "Territories",      subtitle: "Team",    href: "/territories",           icon: "pin_drop"          },
  { id: "nav-analytics",     kind: "nav", group: "Pages", name: "Analytics",        subtitle: "Reports", href: "/analytics",             icon: "leaderboard"       },
  { id: "nav-mileage",       kind: "nav", group: "Pages", name: "Mileage",          subtitle: "Reports", href: "/reports/mileage",       icon: "local_gas_station" },
  { id: "nav-profitability", kind: "nav", group: "Pages", name: "Profitability",    subtitle: "Reports", href: "/reports/profitability", icon: "trending_up"       },
  { id: "nav-commission",    kind: "nav", group: "Pages", name: "Commission",       subtitle: "Reports", href: "/reports/commission",    icon: "emoji_events"      },
  { id: "nav-canvassing",    kind: "nav", group: "Pages", name: "Map / Canvassing", subtitle: "Field",   href: "/canvassing",            icon: "map"               },
  { id: "nav-heatmap",       kind: "nav", group: "Pages", name: "Heat Map",         subtitle: "Field",   href: "/heatmap",               icon: "whatshot"          },
  { id: "nav-intel",         kind: "nav", group: "Pages", name: "Competitor Intel", subtitle: "Field",   href: "/intel",                 icon: "visibility"        },
  { id: "nav-inventory",     kind: "nav", group: "Pages", name: "Inventory",        subtitle: "Field",   href: "/inventory",             icon: "inventory_2"       },
  { id: "nav-assistant",     kind: "nav", group: "Pages", name: "AI Assistant",     subtitle: "Tools",   href: "/assistant",             icon: "auto_awesome"      },
  { id: "nav-settings",      kind: "nav", group: "Pages", name: "Settings",         subtitle: "Tools",   href: "/settings",              icon: "settings"          },
];

const DATA_GROUPS: { kind: Item["kind"]; label: string }[] = [
  { kind: "client", label: "Clients" },
  { kind: "lead",   label: "Leads"   },
  { kind: "job",    label: "Jobs"    },
  { kind: "quote",  label: "Quotes"  },
  { kind: "team",   label: "Team"    },
];

export default function GlobalSearch() {
  const [query, setQuery]     = useState("");
  const [dataItems, setData]  = useState<Item[]>([]);
  const [open, setOpen]       = useState(false);
  const [loading, setLoading] = useState(false);
  const containerRef          = useRef<HTMLDivElement>(null);
  const businessIdRef         = useRef<string | null>(null);
  const router                = useRouter();

  // Nav items filtered client-side — instant, no debounce
  const q = query.trim();
  const navMatches = q.length >= 2
    ? NAV_ITEMS.filter((n) => n.name.toLowerCase().includes(q.toLowerCase()))
    : [];

  const hasResults = navMatches.length > 0 || dataItems.length > 0;

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Open dropdown as soon as nav matches appear
  useEffect(() => {
    if (navMatches.length > 0) setOpen(true);
  }, [navMatches.length]);

  useEffect(() => {
    if (q.length < 2) { setData([]); return; }

    const timer = setTimeout(async () => {
      setLoading(true);
      const supabase = createClient();
      if (!businessIdRef.current) {
        businessIdRef.current = await getBusinessId(supabase);
      }
      const businessId = businessIdRef.current;
      if (!businessId) { setLoading(false); return; }

      const safe = q.replace(/%/g, "\\%").replace(/_/g, "\\_");

      const [clientsRes, leadsRes, teamRes] = await Promise.all([
        supabase.from("clients").select("id, name, email, phone").eq("business_id", businessId).or(`name.ilike.%${safe}%,email.ilike.%${safe}%,phone.ilike.%${safe}%`).limit(4),
        supabase.from("leads").select("id, name, phone, stage").eq("business_id", businessId).or(`name.ilike.%${safe}%,phone.ilike.%${safe}%`).limit(4),
        supabase.from("team_members").select("id, name, role").eq("business_id", businessId).ilike("name", `%${safe}%`).limit(3),
      ]);

      const all: Item[] = [];

      for (const c of clientsRes.data ?? []) {
        all.push({ id: c.id, kind: "client", group: "Clients", name: c.name, subtitle: c.email ?? c.phone ?? "Client", href: `/clients/${c.id}`, icon: "person" });
      }
      for (const l of leadsRes.data ?? []) {
        all.push({ id: l.id, kind: "lead", group: "Leads", name: l.name, subtitle: (l.stage as string ?? "lead").replace(/_/g, " "), href: `/leads/${l.id}`, icon: "person_search" });
      }
      for (const t of teamRes.data ?? []) {
        all.push({ id: t.id, kind: "team", group: "Team", name: t.name, subtitle: t.role as string, href: `/team`, icon: "badge" });
      }

      const clientIds = (clientsRes.data ?? []).map((c) => c.id);
      if (clientIds.length > 0) {
        const [jobsRes, quotesRes] = await Promise.all([
          supabase.from("jobs").select("id, status, scheduled_at, clients(name)").eq("business_id", businessId).in("client_id", clientIds).order("scheduled_at", { ascending: false }).limit(4),
          supabase.from("quotes").select("id, status, total, clients(name)").eq("business_id", businessId).in("client_id", clientIds).limit(3),
        ]);

        for (const j of jobsRes.data ?? []) {
          const clientName = (j.clients as unknown as { name: string } | null)?.name ?? "Job";
          const date = j.scheduled_at ? new Date(j.scheduled_at).toLocaleDateString([], { month: "short", day: "numeric" }) : null;
          all.push({ id: j.id, kind: "job", group: "Jobs", name: clientName, subtitle: [j.status.replace(/_/g, " "), date].filter(Boolean).join(" · "), href: `/jobs/${j.id}`, icon: "work" });
        }
        for (const qr of quotesRes.data ?? []) {
          const clientName = (qr.clients as unknown as { name: string } | null)?.name ?? "Quote";
          all.push({ id: qr.id, kind: "quote", group: "Quotes", name: clientName, subtitle: `${qr.status} · $${(qr.total ?? 0).toFixed(0)}`, href: `/quotes/${qr.id}`, icon: "request_quote" });
        }
      }

      setData(all);
      if (all.length > 0) setOpen(true);
      setLoading(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [q]);

  function handleSelect(href: string) {
    router.push(href);
    setQuery("");
    setData([]);
    setOpen(false);
  }

  const allGroups: { label: string; items: Item[] }[] = [
    ...(navMatches.length > 0 ? [{ label: "Pages", items: navMatches }] : []),
    ...DATA_GROUPS.map(({ kind, label }) => ({ label, items: dataItems.filter((i) => i.kind === kind) })).filter((g) => g.items.length > 0),
  ];

  return (
    <div ref={containerRef} className="relative hidden sm:block">
      <div className="flex items-center gap-2 h-8 px-3 mr-1 rounded-full bg-muted/60 border border-border/40 text-muted-foreground focus-within:border-border focus-within:bg-muted/80 transition-all">
        <span className="material-symbols-outlined text-[16px] shrink-0">
          {loading ? "progress_activity" : "search"}
        </span>
        <input
          type="text"
          placeholder="Search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => { if (hasResults) setOpen(true); }}
          onKeyDown={(e) => { if (e.key === "Escape") { setOpen(false); setQuery(""); setData([]); } }}
          className="bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none w-32 focus:w-44 transition-all duration-200"
        />
      </div>

      {open && hasResults && (
        <div className="absolute top-full right-0 mt-2 w-72 rounded-xl border border-border/40 bg-background/95 backdrop-blur-[16px] shadow-lg z-[500] overflow-hidden">
          {allGroups.map(({ label, items }) => (
            <div key={label}>
              <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground bg-muted/30">
                {label}
              </div>
              {items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleSelect(item.href)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted/60 transition-colors text-left"
                >
                  <span className="material-symbols-outlined text-[18px] text-muted-foreground shrink-0">{item.icon}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{item.name}</p>
                    <p className="text-xs text-muted-foreground truncate capitalize">{item.subtitle}</p>
                  </div>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
