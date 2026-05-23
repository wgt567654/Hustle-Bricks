"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";

type Quote = {
  id: string;
  status: string;
  total: number | null;
  notes: string | null;
  created_at: string;
  clients: { name: string } | null;
};

const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  draft:    { label: "Draft",    className: "bg-muted text-muted-foreground" },
  sent:     { label: "Sent",     className: "bg-primary/10 text-primary" },
  accepted: { label: "Accepted", className: "bg-green-500/10 text-green-600" },
  declined: { label: "Declined", className: "bg-red-500/10 text-red-500" },
};

function fmtDate(str: string) {
  return new Date(str).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

export default function EmployeeQuotesPage() {
  const [quotes, setQuotes]   = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: tm } = await supabase
        .from("team_members")
        .select("id")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .single();
      if (!tm) return;

      const memberId = (tm as unknown as { id: string }).id;

      const { data } = await supabase
        .from("quotes")
        .select("id, status, total, notes, created_at, clients(name)")
        .eq("created_by_member_id", memberId)
        .order("created_at", { ascending: false });

      setQuotes((data ?? []) as unknown as Quote[]);
      setLoading(false);
    }
    load();
  }, []);

  return (
    <div className="flex flex-col gap-4 px-4 py-4 max-w-xl mx-auto pb-32 lg:pb-8">
      <div className="flex items-center justify-between mb-1">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-foreground">My Quotes</h1>
          <p className="text-xs text-muted-foreground">Drafts submitted for manager review</p>
        </div>
        <Link
          href="/employee/quotes/new"
          className="flex size-9 items-center justify-center rounded-full bg-primary text-white shadow-sm hover:opacity-90 active:scale-90 transition-all"
        >
          <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>add</span>
        </Link>
      </div>

      {loading ? (
        <div className="flex flex-col gap-2">
          {[1, 2, 3].map((i) => <div key={i} className="h-20 bg-muted animate-pulse rounded-2xl" />)}
        </div>
      ) : quotes.length === 0 ? (
        <Card className="rounded-2xl border-border shadow-sm">
          <div className="p-10 flex flex-col items-center gap-3 text-center">
            <span className="material-symbols-outlined text-[48px] text-muted-foreground/30" style={{ fontVariationSettings: "'FILL' 1" }}>request_quote</span>
            <p className="text-sm font-semibold text-muted-foreground">No quotes yet</p>
            <p className="text-xs text-muted-foreground/60">Create a draft quote in the field and your manager will review it.</p>
            <Link
              href="/employee/quotes/new"
              className="mt-2 px-4 py-2.5 rounded-2xl bg-primary text-primary-foreground font-bold text-sm hover:opacity-90 active:scale-95 transition-all"
            >
              Create First Quote
            </Link>
          </div>
        </Card>
      ) : (
        <Card className="rounded-2xl border-border shadow-sm overflow-hidden divide-y divide-border/50">
          {quotes.map((q) => {
            const st = STATUS_STYLES[q.status] ?? STATUS_STYLES.draft;
            const clientName = q.clients?.name ?? null;
            return (
              <div key={q.id} className="p-4 flex items-center gap-3">
                <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                  <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>request_quote</span>
                </div>
                <div className="flex flex-col flex-1 min-w-0">
                  <span className="font-bold text-sm text-foreground truncate">
                    {clientName ?? "No client"}
                  </span>
                  <span className="text-xs text-muted-foreground">{fmtDate(q.created_at)}</span>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  {q.total != null && (
                    <span className="text-sm font-bold text-foreground">${q.total.toFixed(0)}</span>
                  )}
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${st.className}`}>
                    {st.label}
                  </span>
                </div>
              </div>
            );
          })}
        </Card>
      )}

      {/* FAB */}
      <Link
        href="/employee/quotes/new"
        className="fixed bottom-24 right-4 z-50 lg:hidden flex size-14 items-center justify-center rounded-full bg-primary text-white shadow-lg shadow-primary/30 active:scale-90 transition-all"
      >
        <span className="material-symbols-outlined text-[24px]" style={{ fontVariationSettings: "'FILL' 1" }}>add</span>
      </Link>
    </div>
  );
}
