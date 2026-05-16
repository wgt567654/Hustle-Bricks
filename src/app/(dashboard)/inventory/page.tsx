"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/currency";

type Category = "equipment" | "vehicle" | "part";
type Condition = "excellent" | "good" | "fair" | "poor";

type InventoryItem = {
  id: string;
  name: string;
  category: Category;
  condition: Condition;
  quantity: number;
  min_quantity: number;
  location: string | null;
  serial_number: string | null;
  purchase_cost: number | null;
  current_value: number | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_year: number | null;
  is_active: boolean;
  inventory_assignments: { id: string; returned_at: string | null; team_member_id: string | null }[];
};

type TeamMember = { id: string; name: string };

type AddForm = {
  name: string;
  category: Category;
  condition: Condition;
  quantity: string;
  min_quantity: string;
  location: string;
  serial_number: string;
  purchase_date: string;
  purchase_cost: string;
  current_value: string;
  vehicle_year: string;
  vehicle_make: string;
  vehicle_model: string;
  license_plate: string;
  insurance_expires_at: string;
  registration_expires_at: string;
  notes: string;
};

const EMPTY_FORM: AddForm = {
  name: "",
  category: "equipment",
  condition: "good",
  quantity: "1",
  min_quantity: "0",
  location: "",
  serial_number: "",
  purchase_date: "",
  purchase_cost: "",
  current_value: "",
  vehicle_year: "",
  vehicle_make: "",
  vehicle_model: "",
  license_plate: "",
  insurance_expires_at: "",
  registration_expires_at: "",
  notes: "",
};

const LOCATION_PLACEHOLDER: Record<Category, string> = {
  equipment: 'e.g. "Truck 1", "Shop shelf B"',
  vehicle: 'e.g. "Main garage", "North parking lot"',
  part: 'e.g. "Supply cabinet", "Shop shelf A"',
};

const CATEGORY_LABEL: Record<Category, string> = {
  equipment: "Equipment",
  vehicle: "Vehicle",
  part: "Part / Supply",
};

const CATEGORY_ICON: Record<Category, string> = {
  equipment: "home_repair_service",
  vehicle: "directions_car",
  part: "category",
};

const CATEGORY_COLOR: Record<Category, string> = {
  equipment: "#3b82f6",
  vehicle: "#8b5cf6",
  part: "#22c55e",
};

const CONDITION_LABEL: Record<Condition, string> = {
  excellent: "Excellent",
  good: "Good",
  fair: "Fair",
  poor: "Poor",
};

const CONDITION_CLASS: Record<Condition, string> = {
  excellent: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  good: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  fair: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  poor: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

export default function InventoryPage() {
  const router = useRouter();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<"all" | Category>("all");
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [currency, setCurrency] = useState("USD");

  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<AddForm>({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: biz } = await supabase
        .from("businesses")
        .select("id, currency")
        .eq("owner_id", user.id)
        .maybeSingle();
      if (!biz) return;

      setBusinessId(biz.id);
      setCurrency((biz as unknown as { currency: string }).currency ?? "USD");

      const [{ data: invData }, { data: tmData }] = await Promise.all([
        supabase
          .from("inventory_items")
          .select("id, name, category, condition, quantity, min_quantity, location, serial_number, purchase_cost, current_value, vehicle_make, vehicle_model, vehicle_year, is_active, inventory_assignments(id, returned_at, team_member_id)")
          .eq("business_id", biz.id)
          .eq("is_active", true)
          .order("name"),
        supabase
          .from("team_members")
          .select("id, name")
          .eq("business_id", biz.id)
          .eq("is_active", true)
          .order("name"),
      ]);

      setItems((invData as unknown as InventoryItem[]) ?? []);
      setTeamMembers((tmData as TeamMember[]) ?? []);
      setLoading(false);
    }
    load();
  }, []);

  const filtered = items.filter((item) => {
    const matchesCat = categoryFilter === "all" || item.category === categoryFilter;
    const matchesSearch = !search.trim() || item.name.toLowerCase().includes(search.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const counts = {
    all: items.length,
    equipment: items.filter((i) => i.category === "equipment").length,
    vehicle: items.filter((i) => i.category === "vehicle").length,
    part: items.filter((i) => i.category === "part").length,
  };

  const lowStockCount = items.filter(
    (i) => i.category === "part" && i.min_quantity > 0 && i.quantity <= i.min_quantity
  ).length;

  function currentAssignee(item: InventoryItem): string | null {
    const open = item.inventory_assignments?.find((a) => !a.returned_at);
    if (!open) return null;
    const tm = teamMembers.find((m) => m.id === open.team_member_id);
    return tm?.name ?? "Someone";
  }

  function isLowStock(item: InventoryItem) {
    return item.category === "part" && item.min_quantity > 0 && item.quantity <= item.min_quantity;
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!businessId) return;
    setSaving(true);
    setSaveError(null);

    const supabase = createClient();
    const { error } = await supabase.from("inventory_items").insert({
      business_id: businessId,
      name: form.name.trim(),
      category: form.category,
      condition: form.condition,
      quantity: parseInt(form.quantity) || 1,
      min_quantity: parseInt(form.min_quantity) || 0,
      location: form.location.trim() || null,
      serial_number: form.serial_number.trim() || null,
      purchase_date: form.purchase_date || null,
      purchase_cost: form.purchase_cost ? parseFloat(form.purchase_cost) : null,
      current_value: form.current_value ? parseFloat(form.current_value) : null,
      vehicle_year: form.vehicle_year ? parseInt(form.vehicle_year) : null,
      vehicle_make: form.vehicle_make.trim() || null,
      vehicle_model: form.vehicle_model.trim() || null,
      license_plate: form.license_plate.trim() || null,
      insurance_expires_at: form.insurance_expires_at || null,
      registration_expires_at: form.registration_expires_at || null,
      notes: form.notes.trim() || null,
    });

    if (error) {
      setSaveError(error.message);
      setSaving(false);
      return;
    }

    // Reload
    const { data: invData } = await supabase
      .from("inventory_items")
      .select("id, name, category, condition, quantity, min_quantity, location, serial_number, purchase_cost, current_value, vehicle_make, vehicle_model, vehicle_year, is_active, inventory_assignments(id, returned_at, team_member_id)")
      .eq("business_id", businessId)
      .eq("is_active", true)
      .order("name");

    setItems((invData as unknown as InventoryItem[]) ?? []);
    setForm({ ...EMPTY_FORM });
    setShowAdd(false);
    setSaving(false);
  }

  return (
    <div className="flex flex-col gap-4 px-4 lg:px-8 py-4 max-w-xl mx-auto lg:max-w-none pb-8">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">HustleBricks</p>
          <h1 className="text-xl font-extrabold tracking-tight text-foreground">Inventory</h1>
        </div>
        <button
          onClick={() => { setForm({ ...EMPTY_FORM }); setSaveError(null); setShowAdd(true); }}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary text-white text-sm font-bold shadow-sm active:scale-95 transition-transform"
        >
          <span className="material-symbols-outlined text-[16px]">add</span>
          Add Item
        </button>
      </div>

      {/* Stats row */}
      {!loading && (
        <div className="flex items-stretch gap-2 overflow-x-auto scrollbar-none -mx-4 px-4 lg:mx-0 lg:px-0">
          {(["equipment", "vehicle", "part"] as const).map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat === categoryFilter ? "all" : cat)}
              className={`flex-1 min-w-[90px] flex flex-col gap-1 rounded-xl border p-2.5 text-left transition-colors ${
                categoryFilter === cat
                  ? "border-primary/40 bg-primary/5"
                  : "border-border/60 bg-card hover:bg-muted/40"
              }`}
            >
              <span
                className="material-symbols-outlined text-[18px]"
                style={{ color: CATEGORY_COLOR[cat], fontVariationSettings: "'FILL' 1" }}
              >
                {CATEGORY_ICON[cat]}
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{CATEGORY_LABEL[cat]}</span>
              <span className="text-lg font-extrabold text-foreground leading-none">{counts[cat]}</span>
            </button>
          ))}
          {lowStockCount > 0 && (
            <button
              onClick={() => setCategoryFilter("part")}
              className="flex-1 min-w-[90px] flex flex-col gap-1 rounded-xl border border-orange-200/60 bg-orange-50 dark:bg-orange-950/20 dark:border-orange-800/40 p-2.5 text-left"
            >
              <span className="material-symbols-outlined text-[18px] text-orange-500" style={{ fontVariationSettings: "'FILL' 1" }}>warning</span>
              <span className="text-[10px] font-bold uppercase tracking-wide text-orange-600 dark:text-orange-400">Low Stock</span>
              <span className="text-lg font-extrabold text-orange-600 dark:text-orange-400 leading-none">{lowStockCount}</span>
            </button>
          )}
        </div>
      )}

      {/* Search + filter tabs */}
      <div className="flex flex-col gap-2">
        <input
          type="text"
          placeholder="Search items…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring/30"
        />
        <div className="flex gap-2 overflow-x-auto scrollbar-none">
          {(["all", "equipment", "vehicle", "part"] as const).map((cat) => {
            const label = cat === "all" ? `All (${counts.all})` : `${CATEGORY_LABEL[cat]} (${counts[cat]})`;
            return (
              <button key={cat} onClick={() => setCategoryFilter(cat)} className="shrink-0">
                <Badge
                  className={`px-3 py-1 text-xs rounded-full cursor-pointer transition-colors whitespace-nowrap ${
                    categoryFilter === cat
                      ? "bg-primary text-white hover:bg-primary/90"
                      : "bg-card text-muted-foreground border border-border hover:bg-muted font-medium"
                  }`}
                  variant={categoryFilter === cat ? "default" : "outline"}
                >
                  {label}
                </Badge>
              </button>
            );
          })}
        </div>
      </div>

      {loading && <p className="text-sm text-muted-foreground text-center py-12">Loading…</p>}

      {!loading && filtered.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-16 text-center">
          <span className="material-symbols-outlined text-[48px] text-muted-foreground/40">inventory_2</span>
          <p className="text-sm font-medium text-muted-foreground">
            {items.length === 0 ? "No inventory yet" : "No items match your search"}
          </p>
          {items.length === 0 && (
            <p className="text-xs text-muted-foreground/60">Add equipment, vehicles, and supplies to get started</p>
          )}
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((item) => {
            const assignee = currentAssignee(item);
            const lowStock = isLowStock(item);
            const color = CATEGORY_COLOR[item.category];
            const vehicleLabel =
              item.category === "vehicle" && (item.vehicle_year || item.vehicle_make || item.vehicle_model)
                ? [item.vehicle_year, item.vehicle_make, item.vehicle_model].filter(Boolean).join(" ")
                : null;

            return (
              <Card
                key={item.id}
                onClick={() => router.push(`/inventory/${item.id}`)}
                className="overflow-hidden rounded-2xl cursor-pointer flex flex-col press"
              >
                <div className="h-1 w-full" style={{ backgroundColor: color }} />
                <div className="p-3 flex flex-col gap-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2.5">
                      <div
                        className="flex size-9 shrink-0 items-center justify-center rounded-xl text-white shadow-sm"
                        style={{ backgroundColor: color }}
                      >
                        <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                          {CATEGORY_ICON[item.category]}
                        </span>
                      </div>
                      <div className="flex flex-col min-w-0">
                        <h3 className="font-bold text-foreground leading-tight truncate">{item.name}</h3>
                        {vehicleLabel && (
                          <p className="text-xs text-muted-foreground truncate">{vehicleLabel}</p>
                        )}
                        {item.location && !vehicleLabel && (
                          <p className="text-xs text-muted-foreground truncate">{item.location}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <Badge className={`text-[10px] px-2 py-0.5 rounded-full border-0 ${CONDITION_CLASS[item.condition]}`}>
                        {CONDITION_LABEL[item.condition]}
                      </Badge>
                      {item.category === "part" && (
                        <span className={`text-[10px] font-bold ${lowStock ? "text-orange-500" : "text-muted-foreground"}`}>
                          Qty: {item.quantity}
                          {lowStock && " ⚠"}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {assignee && (
                      <div className="flex items-center gap-1 bg-primary/8 rounded-lg px-2 py-1">
                        <span className="material-symbols-outlined text-[12px] text-primary">person</span>
                        <span className="text-[10px] font-semibold text-primary truncate max-w-[100px]">{assignee}</span>
                      </div>
                    )}
                    {item.current_value != null && (
                      <div className="flex items-center gap-1 bg-muted/50 rounded-lg px-2 py-1">
                        <span className="material-symbols-outlined text-[12px] text-muted-foreground">attach_money</span>
                        <span className="text-[10px] font-semibold text-muted-foreground">
                          {formatCurrency(item.current_value, currency)}
                        </span>
                      </div>
                    )}
                    {item.serial_number && (
                      <div className="flex items-center gap-1 bg-muted/50 rounded-lg px-2 py-1">
                        <span className="material-symbols-outlined text-[12px] text-muted-foreground">tag</span>
                        <span className="text-[10px] font-semibold text-muted-foreground truncate max-w-[80px]">{item.serial_number}</span>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add Item Sheet */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowAdd(false)} />
          <form
            onSubmit={handleAdd}
            className="relative w-full max-w-lg bg-background rounded-t-3xl p-6 pb-10 shadow-2xl max-h-[92vh] overflow-y-auto flex flex-col gap-4"
          >
            <div className="absolute top-3 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-muted-foreground/20" />

            <div className="flex items-center justify-between pt-2">
              <h2 className="text-lg font-extrabold text-foreground">Add Inventory Item</h2>
              <button
                type="button"
                onClick={() => setShowAdd(false)}
                className="flex size-8 items-center justify-center rounded-full bg-muted text-muted-foreground"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <Field label="Name *">
              <input
                type="text"
                required
                placeholder="e.g. Pressure Washer"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className={INPUT}
              />
            </Field>

            <Field label="Category *">
              <div className="flex gap-2">
                {(["equipment", "vehicle", "part"] as const).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, category: cat }))}
                    className={`flex-1 flex flex-col items-center gap-1 py-2.5 rounded-xl border text-xs font-semibold transition-colors ${
                      form.category === cat
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-card text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    <span
                      className="material-symbols-outlined text-[18px]"
                      style={{ fontVariationSettings: "'FILL' 1", color: form.category === cat ? CATEGORY_COLOR[cat] : undefined }}
                    >
                      {CATEGORY_ICON[cat]}
                    </span>
                    {CATEGORY_LABEL[cat]}
                  </button>
                ))}
              </div>
            </Field>

            <Field label="Condition">
              <div className="flex gap-2">
                {(["excellent", "good", "fair", "poor"] as const).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, condition: c }))}
                    className={`flex-1 py-2 rounded-xl border text-xs font-semibold transition-colors ${
                      form.condition === c
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-card text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {CONDITION_LABEL[c]}
                  </button>
                ))}
              </div>
            </Field>

            {form.category === "part" && (
              <div className="flex gap-3">
                <Field label="Quantity" className="flex-1">
                  <input
                    type="number"
                    min="0"
                    value={form.quantity}
                    onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
                    className={INPUT}
                  />
                </Field>
                <Field label="Low Stock Alert" className="flex-1">
                  <input
                    type="number"
                    min="0"
                    placeholder="0 = off"
                    value={form.min_quantity}
                    onChange={(e) => setForm((f) => ({ ...f, min_quantity: e.target.value }))}
                    className={INPUT}
                  />
                </Field>
              </div>
            )}

            {/* Vehicle fields */}
            {form.category === "vehicle" && (
              <>
                <div className="flex gap-3">
                  <Field label="Year" className="flex-1">
                    <input
                      type="number"
                      min="1900"
                      max={new Date().getFullYear() + 1}
                      placeholder="2022"
                      value={form.vehicle_year}
                      onChange={(e) => setForm((f) => ({ ...f, vehicle_year: e.target.value }))}
                      className={INPUT}
                    />
                  </Field>
                  <Field label="Make" className="flex-1">
                    <input
                      type="text"
                      placeholder="Ford"
                      value={form.vehicle_make}
                      onChange={(e) => setForm((f) => ({ ...f, vehicle_make: e.target.value }))}
                      className={INPUT}
                    />
                  </Field>
                  <Field label="Model" className="flex-1">
                    <input
                      type="text"
                      placeholder="F-150"
                      value={form.vehicle_model}
                      onChange={(e) => setForm((f) => ({ ...f, vehicle_model: e.target.value }))}
                      className={INPUT}
                    />
                  </Field>
                </div>
                <Field label="License Plate">
                  <input
                    type="text"
                    placeholder="ABC-1234"
                    value={form.license_plate}
                    onChange={(e) => setForm((f) => ({ ...f, license_plate: e.target.value }))}
                    className={INPUT}
                  />
                </Field>
                <div className="flex gap-3">
                  <Field label="Insurance Expires" className="flex-1">
                    <input
                      type="date"
                      value={form.insurance_expires_at}
                      onChange={(e) => setForm((f) => ({ ...f, insurance_expires_at: e.target.value }))}
                      className={INPUT}
                    />
                  </Field>
                  <Field label="Registration Expires" className="flex-1">
                    <input
                      type="date"
                      value={form.registration_expires_at}
                      onChange={(e) => setForm((f) => ({ ...f, registration_expires_at: e.target.value }))}
                      className={INPUT}
                    />
                  </Field>
                </div>
              </>
            )}

            <Field label="Location">
              <input
                type="text"
                placeholder={LOCATION_PLACEHOLDER[form.category]}
                value={form.location}
                onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                className={INPUT}
              />
            </Field>

            <Field label="Serial Number">
              <input
                type="text"
                placeholder="Optional"
                value={form.serial_number}
                onChange={(e) => setForm((f) => ({ ...f, serial_number: e.target.value }))}
                className={INPUT}
              />
            </Field>

            <div className="flex gap-3">
              <Field label="Purchase Date" className="flex-1">
                <input
                  type="date"
                  value={form.purchase_date}
                  onChange={(e) => setForm((f) => ({ ...f, purchase_date: e.target.value }))}
                  className={INPUT}
                />
              </Field>
              <Field label="Purchase Cost" className="flex-1">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm pointer-events-none">$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={form.purchase_cost}
                    onChange={(e) => setForm((f) => ({ ...f, purchase_cost: e.target.value }))}
                    className={INPUT + " pl-7"}
                  />
                </div>
              </Field>
              <Field label="Current Value" className="flex-1">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm pointer-events-none">$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={form.current_value}
                    onChange={(e) => setForm((f) => ({ ...f, current_value: e.target.value }))}
                    className={INPUT + " pl-7"}
                  />
                </div>
              </Field>
            </div>

            <Field label="Notes">
              <textarea
                rows={2}
                placeholder="Optional notes…"
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                className="w-full rounded-xl border border-border bg-background px-3 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring/30 resize-none"
              />
            </Field>

            {saveError && (
              <p className="text-sm text-red-500 bg-red-50 dark:bg-red-950/30 rounded-xl px-3 py-2">{saveError}</p>
            )}

            <button
              type="submit"
              disabled={saving}
              className="w-full py-3.5 flex items-center justify-center rounded-xl bg-primary text-white font-bold text-sm disabled:opacity-50 active:scale-[0.98] transition-transform"
            >
              {saving ? "Saving…" : "Add Item"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

const INPUT = "flex h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring/30";

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`flex flex-col gap-1.5 ${className ?? ""}`}>
      <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">{label}</label>
      {children}
    </div>
  );
}
