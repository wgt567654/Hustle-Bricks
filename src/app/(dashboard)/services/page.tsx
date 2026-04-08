"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";

type Service = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  price: number;
  unit: "flat" | "per_hour" | "per_sqft" | "per_item";
  duration_mins: number | null;
};

const UNIT_LABELS: Record<Service["unit"], string> = {
  flat: "flat",
  per_hour: "/hr",
  per_sqft: "/sq ft",
  per_item: "/item",
};

const UNIT_OPTIONS: { value: Service["unit"]; label: string }[] = [
  { value: "flat", label: "Flat rate" },
  { value: "per_hour", label: "Per hour" },
  { value: "per_sqft", label: "Per sq ft" },
  { value: "per_item", label: "Per item" },
];

function formatPrice(price: number, unit: Service["unit"]) {
  return `$${price.toFixed(2)}${UNIT_LABELS[unit] === "flat" ? "" : UNIT_LABELS[unit]}`;
}

function formatDuration(mins: number | null) {
  if (!mins) return null;
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

const EMPTY_FORM = {
  name: "",
  category: "",
  description: "",
  price: "",
  unit: "flat" as Service["unit"],
  duration_mins: "",
};

export default function ServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState("All");
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
        .from("services")
        .select("id, name, description, category, price, unit, duration_mins")
        .eq("business_id", business.id)
        .eq("is_active", true)
        .order("category")
        .order("name");

      setServices(data ?? []);
      setLoading(false);
    }
    load();
  }, []);

  const categories = ["All", ...Array.from(new Set(services.map((s) => s.category ?? "Uncategorized")))];
  const filtered = activeCategory === "All"
    ? services
    : services.filter((s) => (s.category ?? "Uncategorized") === activeCategory);

  async function handleAdd(e: { preventDefault(): void }) {
    e.preventDefault();
    if (!businessId) return;
    setSaving(true);
    setError(null);

    const supabase = createClient();
    const { data, error } = await supabase
      .from("services")
      .insert({
        business_id: businessId,
        name: form.name.trim(),
        category: form.category.trim() || null,
        description: form.description.trim() || null,
        price: parseFloat(form.price),
        unit: form.unit,
        duration_mins: form.duration_mins ? parseInt(form.duration_mins) : null,
      })
      .select("id, name, description, category, price, unit, duration_mins")
      .single();

    if (error) {
      setError(error.message);
      setSaving(false);
    } else {
      setServices((prev) => [...prev, data]);
      setForm(EMPTY_FORM);
      setShowModal(false);
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    const supabase = createClient();
    await supabase.from("services").update({ is_active: false }).eq("id", id);
    setServices((prev) => prev.filter((s) => s.id !== id));
    setDeletingId(null);
  }

  return (
    <div className="flex flex-col gap-6 px-4 py-6 max-w-xl mx-auto">
      <div className="flex flex-col gap-1 mb-2">
        <h1 className="text-2xl font-extrabold tracking-tight text-foreground">Service Catalog</h1>
        <p className="text-sm text-muted-foreground">Manage your offerings and standard pricing.</p>
      </div>

      {/* Category filter */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-none">
        {categories.map((cat) => (
          <button key={cat} onClick={() => setActiveCategory(cat)}>
            <Badge
              className={`px-4 py-1.5 text-xs rounded-full shrink-0 cursor-pointer transition-colors ${
                activeCategory === cat
                  ? "bg-primary text-white hover:bg-primary/90"
                  : "bg-card text-muted-foreground border border-border hover:bg-muted font-medium"
              }`}
              variant={activeCategory === cat ? "default" : "outline"}
            >
              {cat}
            </Badge>
          </button>
        ))}
      </div>

      {/* Service list */}
      <div className="flex flex-col gap-4">
        {loading && (
          <p className="text-sm text-muted-foreground text-center py-8">Loading services…</p>
        )}

        {!loading && filtered.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-12 text-center">
            <span className="material-symbols-outlined text-[48px] text-muted-foreground/40">inventory_2</span>
            <p className="text-sm font-medium text-muted-foreground">No services yet</p>
            <p className="text-xs text-muted-foreground/60">Tap + to add your first service</p>
          </div>
        )}

        {filtered.map((service) => (
          <Card key={service.id} className="overflow-hidden rounded-2xl border-border shadow-sm group hover:border-primary/30 transition-colors">
            <div className="p-4 flex gap-4">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary text-white shadow-sm">
                <span className="material-symbols-outlined text-[24px]">home_repair_service</span>
              </div>
              <div className="flex flex-1 flex-col min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-bold text-foreground leading-tight">{service.name}</h3>
                  <span className="font-extrabold text-foreground shrink-0">
                    {formatPrice(service.price, service.unit)}
                  </span>
                </div>
                <span className="text-xs font-medium text-muted-foreground mt-0.5 mb-2">
                  {[service.category, formatDuration(service.duration_mins)].filter(Boolean).join(" • ")}
                </span>
                {service.description && (
                  <p className="text-sm text-muted-foreground/80 leading-snug line-clamp-2">
                    {service.description}
                  </p>
                )}
              </div>
              <button
                onClick={() => handleDelete(service.id)}
                disabled={deletingId === service.id}
                className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors opacity-0 group-hover:opacity-100 self-start mt-0.5"
              >
                <span className="material-symbols-outlined text-[18px]">delete</span>
              </button>
            </div>
          </Card>
        ))}
      </div>

      {/* Floating add button */}
      <button
        onClick={() => { setShowModal(true); setError(null); setForm(EMPTY_FORM); }}
        className="fixed bottom-24 right-4 z-50 flex size-14 items-center justify-center rounded-full bg-primary text-white shadow-primary/40 shadow-xl transition-transform hover:scale-105 active:scale-95"
      >
        <span className="material-symbols-outlined text-[28px]">add</span>
      </button>

      {/* Add Service Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowModal(false)}
          />
          {/* Sheet */}
          <div className="relative w-full max-w-lg bg-background rounded-t-3xl p-6 pb-10 shadow-2xl flex flex-col gap-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-extrabold tracking-tight text-foreground">New Service</h2>
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
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Service Name</label>
                <input
                  type="text"
                  placeholder="e.g. Driveway Pressure Wash"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  required
                  autoFocus
                  className="flex h-12 w-full rounded-xl border border-border bg-transparent px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>

              <div className="flex gap-3">
                <div className="flex flex-col gap-1.5 flex-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Price ($)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={form.price}
                    onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                    required
                    className="flex h-12 w-full rounded-xl border border-border bg-transparent px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                </div>
                <div className="flex flex-col gap-1.5 flex-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Pricing Unit</label>
                  <select
                    value={form.unit}
                    onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value as Service["unit"] }))}
                    className="flex h-12 w-full rounded-xl border border-border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    {UNIT_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="flex flex-col gap-1.5 flex-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Category</label>
                  <input
                    type="text"
                    placeholder="e.g. Exterior Cleaning"
                    value={form.category}
                    onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                    className="flex h-12 w-full rounded-xl border border-border bg-transparent px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                </div>
                <div className="flex flex-col gap-1.5 w-28">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Duration (min)</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="60"
                    value={form.duration_mins}
                    onChange={(e) => setForm((f) => ({ ...f, duration_mins: e.target.value }))}
                    className="flex h-12 w-full rounded-xl border border-border bg-transparent px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Description <span className="normal-case font-normal text-muted-foreground/60">(optional)</span></label>
                <textarea
                  placeholder="Brief description of what's included…"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  rows={3}
                  className="flex w-full rounded-xl border border-border bg-transparent px-3 py-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={saving || !form.name.trim() || !form.price}
                className="w-full mt-1 rounded-xl font-bold py-3.5 text-sm bg-primary text-white shadow-md shadow-primary/30 hover:bg-primary/90 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? "Saving…" : "Add Service"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
