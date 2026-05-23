"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";

type InventoryItem = {
  id: string;
  name: string;
  category: "equipment" | "vehicle" | "part";
  condition: string | null;
  quantity: number | null;
  min_quantity: number | null;
  location: string | null;
};

const CONDITION_STYLES: Record<string, string> = {
  excellent: "bg-green-500/10 text-green-600",
  good:      "bg-primary/10 text-primary",
  fair:      "bg-amber-500/10 text-amber-600",
  poor:      "bg-red-500/10 text-red-500",
};

const CATEGORY_ICONS: Record<string, string> = {
  equipment: "construction",
  vehicle:   "directions_car",
  part:      "inventory_2",
};

const CATEGORY_LABELS: Record<string, string> = {
  equipment: "Equipment",
  vehicle:   "Vehicles",
  part:      "Parts & Supplies",
};

export default function EmployeeInventoryPage() {
  const [items, setItems]               = useState<InventoryItem[]>([]);
  const [assignedIds, setAssignedIds]   = useState<Set<string>>(new Set());
  const [loading, setLoading]           = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>("equipment");

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: tm } = await supabase
        .from("team_members")
        .select("id, business_id")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .single();
      if (!tm) return;

      const memberId   = (tm as unknown as { id: string }).id;
      const businessId = (tm as unknown as { business_id: string }).business_id;

      const [{ data: itemData }, { data: assignData }] = await Promise.all([
        supabase
          .from("inventory_items")
          .select("id, name, category, condition, quantity, min_quantity, location, is_active")
          .eq("business_id", businessId)
          .eq("is_active", true)
          .order("category")
          .order("name"),
        supabase
          .from("inventory_assignments")
          .select("item_id, returned_at")
          .eq("team_member_id", memberId)
          .is("returned_at", null),
      ]);

      setItems((itemData ?? []) as unknown as InventoryItem[]);
      setAssignedIds(new Set(((assignData ?? []) as unknown as { item_id: string }[]).map((a) => a.item_id)));
      setLoading(false);
    }
    load();
  }, []);

  const categories = ["equipment", "vehicle", "part"] as const;
  const filtered = items.filter((i) => i.category === activeCategory);

  return (
    <div className="flex flex-col gap-4 px-4 py-4 max-w-xl mx-auto pb-32 lg:pb-8">
      <div className="flex flex-col gap-0.5 mb-1">
        <h1 className="text-xl font-extrabold tracking-tight text-foreground">Inventory</h1>
        <p className="text-xs text-muted-foreground">Browse available equipment and supplies</p>
      </div>

      {/* Category tabs */}
      <div className="flex gap-1.5">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 ${
              activeCategory === cat
                ? "bg-primary text-primary-foreground"
                : "bg-muted/60 text-muted-foreground hover:bg-muted"
            }`}
          >
            {CATEGORY_LABELS[cat]}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex flex-col gap-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-muted animate-pulse rounded-2xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="rounded-2xl border-border shadow-sm">
          <div className="p-8 flex flex-col items-center gap-2 text-center">
            <span className="material-symbols-outlined text-[40px] text-muted-foreground/30" style={{ fontVariationSettings: "'FILL' 1" }}>
              {CATEGORY_ICONS[activeCategory]}
            </span>
            <p className="text-sm font-semibold text-muted-foreground">No {CATEGORY_LABELS[activeCategory].toLowerCase()} in inventory</p>
          </div>
        </Card>
      ) : (
        <Card className="rounded-2xl border-border shadow-sm overflow-hidden divide-y divide-border/50">
          {filtered.map((item) => {
            const isAssigned  = assignedIds.has(item.id);
            const isLowStock  = item.category === "part" && item.quantity != null && item.min_quantity != null && item.quantity <= item.min_quantity;
            const condStyle   = CONDITION_STYLES[item.condition ?? "good"] ?? CONDITION_STYLES.good;

            return (
              <div key={item.id} className="p-4 flex items-center gap-3">
                <div className={`size-10 rounded-full flex items-center justify-center shrink-0 ${isAssigned ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                  <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                    {CATEGORY_ICONS[item.category]}
                  </span>
                </div>
                <div className="flex flex-col flex-1 min-w-0">
                  <span className="font-bold text-sm text-foreground truncate">{item.name}</span>
                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    {item.location && (
                      <span className="text-[10px] text-muted-foreground">{item.location}</span>
                    )}
                    {item.condition && (
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full capitalize ${condStyle}`}>
                        {item.condition}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  {item.category === "part" && item.quantity != null && (
                    <span className={`text-xs font-bold ${isLowStock ? "text-amber-500" : "text-muted-foreground"}`}>
                      {item.quantity} in stock
                    </span>
                  )}
                  {isLowStock && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600">
                      Low stock
                    </span>
                  )}
                  {isAssigned && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
                      Assigned to you
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}
