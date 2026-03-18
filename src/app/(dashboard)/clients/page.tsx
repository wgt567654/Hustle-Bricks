"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";

type Tag = "residential" | "commercial" | "vip";

type Client = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  tag: Tag;
  notes: string | null;
};

const TAG_LABELS: Record<Tag, string> = {
  residential: "Residential",
  commercial: "Commercial",
  vip: "VIP",
};

const EMPTY_FORM = {
  name: "",
  email: "",
  phone: "",
  address: "",
  tag: "residential" as Tag,
  notes: "",
};

const FILTER_TABS: { label: string; value: Tag | "all" }[] = [
  { label: "All", value: "all" },
  { label: "Residential", value: "residential" },
  { label: "Commercial", value: "commercial" },
  { label: "VIPs", value: "vip" },
];

function getInitials(name: string) {
  return name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
}

export default function ClientsPage() {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<Tag | "all">("all");
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: business } = await supabase
        .from("businesses")
        .select("id")
        .eq("owner_id", user.id)
        .single();

      if (!business) return;
      setBusinessId(business.id);

      const { data } = await supabase
        .from("clients")
        .select("id, name, email, phone, address, tag, notes")
        .eq("business_id", business.id)
        .order("name");

      setClients(data ?? []);
      setLoading(false);
    }
    load();
  }, []);

  const filtered = clients.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.email ?? "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.phone ?? "").includes(searchQuery);
    const matchesFilter = activeFilter === "all" || c.tag === activeFilter;
    return matchesSearch && matchesFilter;
  });

  async function handleAdd(e: { preventDefault(): void }) {
    e.preventDefault();
    if (!businessId) return;
    setSaving(true);
    setError(null);

    const supabase = createClient();
    const { data, error } = await supabase
      .from("clients")
      .insert({
        business_id: businessId,
        name: form.name.trim(),
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        address: form.address.trim() || null,
        tag: form.tag,
        notes: form.notes.trim() || null,
      })
      .select("id, name, email, phone, address, tag, notes")
      .single();

    if (error) {
      setError(error.message);
      setSaving(false);
    } else {
      setClients((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
      setForm(EMPTY_FORM);
      setShowModal(false);
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    const supabase = createClient();
    await supabase.from("clients").delete().eq("id", id);
    setClients((prev) => prev.filter((c) => c.id !== id));
    setDeletingId(null);
  }

  return (
    <div className="flex flex-col gap-6 px-4 py-6 max-w-xl mx-auto pb-40">
      <div className="flex flex-col gap-1 mb-2">
        <h1 className="text-2xl font-extrabold tracking-tight text-foreground">Clients</h1>
        <p className="text-sm text-muted-foreground">Your customer base and CRM.</p>
      </div>

      {/* Search */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none text-muted-foreground">
          <span className="material-symbols-outlined text-[20px]">search</span>
        </div>
        <input
          type="text"
          className="block w-full rounded-2xl border-0 py-3.5 pl-11 pr-4 text-foreground bg-card shadow-sm ring-1 ring-inset ring-border placeholder:text-muted-foreground focus:ring-2 focus:ring-inset focus:ring-[#3581f3] text-sm transition-all focus:outline-none"
          placeholder="Search by name, email, or phone…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-none">
        {FILTER_TABS.map((tab) => (
          <button key={tab.value} onClick={() => setActiveFilter(tab.value)}>
            <Badge
              className={`px-4 py-1.5 text-xs rounded-full shrink-0 cursor-pointer transition-colors ${
                activeFilter === tab.value
                  ? "bg-[#3581f3] text-white hover:bg-[#3581f3]/90"
                  : "bg-card text-muted-foreground border border-border hover:bg-muted font-medium"
              }`}
              variant={activeFilter === tab.value ? "default" : "outline"}
            >
              {tab.label}
            </Badge>
          </button>
        ))}
      </div>

      {/* Client list */}
      <div className="flex flex-col gap-4">
        {loading && (
          <p className="text-sm text-muted-foreground text-center py-8">Loading clients…</p>
        )}

        {!loading && filtered.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-12 text-center">
            <span className="material-symbols-outlined text-[48px] text-muted-foreground/40">
              {searchQuery ? "search_off" : "group_add"}
            </span>
            <p className="text-sm font-medium text-muted-foreground">
              {searchQuery ? "No clients match your search" : "No clients yet"}
            </p>
            {!searchQuery && (
              <p className="text-xs text-muted-foreground/60">Tap + to add your first client</p>
            )}
          </div>
        )}

        {filtered.map((client) => (
          <Card key={client.id} onClick={() => router.push(`/clients/${client.id}`)} className="overflow-hidden rounded-2xl border-border shadow-sm group hover:border-[#3581f3]/30 transition-colors cursor-pointer p-4">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                {/* Avatar */}
                <div className={`flex size-11 shrink-0 items-center justify-center rounded-full font-extrabold text-sm ${
                  client.tag === "vip"
                    ? "bg-[#ea580c]/10 text-[#ea580c] border border-[#ea580c]/20"
                    : client.tag === "commercial"
                    ? "bg-foreground/10 text-foreground border border-foreground/10"
                    : "bg-[#3581f3]/10 text-[#3581f3] border border-[#3581f3]/10"
                }`}>
                  {getInitials(client.name)}
                </div>
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-lg text-foreground leading-tight">{client.name}</h3>
                    {client.tag === "vip" && (
                      <span className="material-symbols-outlined text-[#ea580c] text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                    )}
                  </div>
                  <span className="text-sm font-medium text-muted-foreground">{TAG_LABELS[client.tag]}</span>
                </div>
              </div>

              <button
                onClick={(e) => { e.stopPropagation(); handleDelete(client.id); }}
                disabled={deletingId === client.id}
                className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors opacity-0 group-hover:opacity-100"
              >
                <span className="material-symbols-outlined text-[18px]">delete</span>
              </button>
            </div>

            {client.phone && (
              <div className="flex items-center gap-2 mb-3">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <span className="material-symbols-outlined text-[16px]">call</span>
                </div>
                <span className="text-sm font-medium text-foreground">{client.phone}</span>
              </div>
            )}

            {client.email && (
              <div className="flex items-center gap-2 mb-3">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <span className="material-symbols-outlined text-[16px]">mail</span>
                </div>
                <span className="text-sm font-medium text-foreground">{client.email}</span>
              </div>
            )}

            {client.address && (
              <div className="bg-muted/40 rounded-xl p-3 flex items-center gap-2 border border-border/50">
                <span className="material-symbols-outlined text-[16px] text-muted-foreground shrink-0">location_on</span>
                <p className="text-sm font-medium text-foreground">{client.address}</p>
              </div>
            )}
          </Card>
        ))}
      </div>

      {/* Floating add button */}
      <button
        onClick={() => { setShowModal(true); setError(null); setForm(EMPTY_FORM); }}
        className="fixed bottom-24 right-4 z-50 flex size-14 items-center justify-center rounded-full bg-[#3581f3] text-white shadow-[#3581f3]/40 shadow-xl transition-transform hover:scale-105 active:scale-95"
      >
        <span className="material-symbols-outlined text-[28px]">person_add</span>
      </button>

      {/* Add Client Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative w-full max-w-lg bg-background rounded-t-3xl p-6 pb-10 shadow-2xl flex flex-col gap-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-extrabold tracking-tight text-foreground">New Client</h2>
              <button
                onClick={() => setShowModal(false)}
                className="flex size-8 items-center justify-center rounded-full bg-muted text-muted-foreground hover:bg-muted/80"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleAdd} className="flex flex-col gap-4">
              {error && (
                <p className="text-sm text-red-500 bg-red-50 dark:bg-red-950/30 rounded-xl px-3 py-2">{error}</p>
              )}

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Full Name</label>
                <input
                  type="text"
                  placeholder="e.g. John Smith"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  required
                  autoFocus
                  className="flex h-12 w-full rounded-xl border border-border bg-transparent px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>

              {/* Client Type */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Client Type</label>
                <div className="flex gap-2">
                  {(["residential", "commercial", "vip"] as Tag[]).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, tag: t }))}
                      className={`flex-1 rounded-xl border py-2.5 text-sm font-medium transition-all active:scale-95 ${
                        form.tag === t
                          ? "border-[#3581f3] bg-[#3581f3]/10 text-[#3581f3]"
                          : "border-border bg-muted/40 text-foreground hover:bg-muted"
                      }`}
                    >
                      {TAG_LABELS[t]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-3">
                <div className="flex flex-col gap-1.5 flex-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Phone</label>
                  <input
                    type="tel"
                    placeholder="(555) 000-0000"
                    value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                    className="flex h-12 w-full rounded-xl border border-border bg-transparent px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                </div>
                <div className="flex flex-col gap-1.5 flex-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Email</label>
                  <input
                    type="email"
                    placeholder="john@example.com"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    className="flex h-12 w-full rounded-xl border border-border bg-transparent px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Address <span className="normal-case font-normal text-muted-foreground/60">(optional)</span></label>
                <input
                  type="text"
                  placeholder="123 Main St, Springfield"
                  value={form.address}
                  onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                  className="flex h-12 w-full rounded-xl border border-border bg-transparent px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Notes <span className="normal-case font-normal text-muted-foreground/60">(optional)</span></label>
                <textarea
                  placeholder="Anything worth remembering about this client…"
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  rows={3}
                  className="flex w-full rounded-xl border border-border bg-transparent px-3 py-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={saving || !form.name.trim()}
                className="w-full mt-1 rounded-xl font-bold py-3.5 text-sm bg-[#3581f3] text-white shadow-md shadow-[#3581f3]/30 hover:bg-[#3581f3]/90 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? "Saving…" : "Add Client"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
