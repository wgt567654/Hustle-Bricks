"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/currency";

type Category = "equipment" | "vehicle" | "part";
type Condition = "excellent" | "good" | "fair" | "poor";

export type InventoryItem = {
  id: string;
  business_id: string;
  name: string;
  category: Category;
  condition: Condition;
  quantity: number;
  min_quantity: number;
  location: string | null;
  serial_number: string | null;
  purchase_date: string | null;
  purchase_cost: number | null;
  current_value: number | null;
  vehicle_year: number | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  license_plate: string | null;
  insurance_expires_at: string | null;
  registration_expires_at: string | null;
  notes: string | null;
  is_active: boolean;
};

export type Assignment = {
  id: string;
  assigned_at: string;
  returned_at: string | null;
  notes: string | null;
  team_members: { id: string; name: string } | null;
  checkout_group_id: string | null;
};

export type UsageLog = {
  id: string;
  quantity_used: number;
  used_at: string;
  notes: string | null;
  jobs: { id: string; clients: { name: string } | null } | null;
  team_members: { id: string; name: string } | null;
};

export type TeamMember = { id: string; name: string };

export type PresetCrew = {
  id: string;
  name: string;
  member_ids: string[];
};

type InventoryDetailClientProps = {
  initialItem: InventoryItem;
  initialAssignments: Assignment[];
  initialUsageLogs: UsageLog[];
  initialTeamMembers: TeamMember[];
  initialPresetCrews: PresetCrew[];
  initialCurrency: string;
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

const INPUT = "flex h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring/30";

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`flex flex-col gap-1.5 ${className ?? ""}`}>
      <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">{label}</label>
      {children}
    </div>
  );
}

function formatDate(str: string | null) {
  if (!str) return "—";
  return new Date(str).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// Collapses assignments with the same checkout_group_id into one entry for the history list
function groupHistory(assignments: Assignment[]) {
  const returned = assignments.filter((a) => a.returned_at);
  const seen = new Set<string>();
  const groups: { primary: Assignment; siblings: Assignment[] }[] = [];

  for (const a of returned) {
    if (a.checkout_group_id) {
      if (seen.has(a.checkout_group_id)) continue;
      seen.add(a.checkout_group_id);
      const siblings = returned.filter(
        (b) => b.checkout_group_id === a.checkout_group_id && b.id !== a.id
      );
      groups.push({ primary: a, siblings });
    } else {
      groups.push({ primary: a, siblings: [] });
    }
  }

  return groups;
}

export default function InventoryDetailClient({
  initialItem,
  initialAssignments,
  initialUsageLogs,
  initialTeamMembers,
  initialPresetCrews,
  initialCurrency,
}: InventoryDetailClientProps) {
  const router = useRouter();

  const [item, setItem] = useState<InventoryItem | null>(initialItem);
  const [assignments, setAssignments] = useState<Assignment[]>(initialAssignments);
  const [usageLogs, setUsageLogs] = useState<UsageLog[]>(initialUsageLogs);
  const [teamMembers] = useState<TeamMember[]>(initialTeamMembers);
  const [presetCrews, setPresetCrews] = useState<PresetCrew[]>(initialPresetCrews);
  const [currency] = useState(initialCurrency);

  // Edit state
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<InventoryItem>>(initialItem);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Check-out modal
  const [showCheckout, setShowCheckout] = useState(false);
  const [checkoutMemberIds, setCheckoutMemberIds] = useState<Set<string>>(new Set());
  const [checkoutNotes, setCheckoutNotes] = useState("");
  const [checkoutSaving, setCheckoutSaving] = useState(false);
  const [saveAsPreset, setSaveAsPreset] = useState(false);
  const [presetName, setPresetName] = useState("");
  const [deletingPresetId, setDeletingPresetId] = useState<string | null>(null);
  const [presetEditMode, setPresetEditMode] = useState(false);

  // Manual usage entry modal
  const [showLogUsage, setShowLogUsage] = useState(false);
  const [usageQty, setUsageQty] = useState("1");
  const [usageNotes, setUsageNotes] = useState("");
  const [usageSaving, setUsageSaving] = useState(false);

  // Assignment history collapse
  const [historyExpanded, setHistoryExpanded] = useState(false);

  // Delete confirm
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const openAssignments = assignments.filter((a) => !a.returned_at);
  const isGroupCheckout = openAssignments.length > 1;

  async function handleSave() {
    if (!item) return;
    setSaving(true);
    setSaveError(null);
    const supabase = createClient();

    const { error } = await supabase.from("inventory_items").update({
      name: editForm.name,
      category: editForm.category,
      condition: editForm.condition,
      quantity: editForm.quantity,
      min_quantity: editForm.min_quantity,
      location: editForm.location || null,
      serial_number: editForm.serial_number || null,
      purchase_date: editForm.purchase_date || null,
      purchase_cost: editForm.purchase_cost ?? null,
      current_value: editForm.current_value ?? null,
      vehicle_year: editForm.vehicle_year ?? null,
      vehicle_make: editForm.vehicle_make || null,
      vehicle_model: editForm.vehicle_model || null,
      license_plate: editForm.license_plate || null,
      insurance_expires_at: editForm.insurance_expires_at || null,
      registration_expires_at: editForm.registration_expires_at || null,
      notes: editForm.notes || null,
    }).eq("id", item.id);

    if (error) { setSaveError(error.message); setSaving(false); return; }

    setItem({ ...item, ...editForm } as InventoryItem);
    setEditing(false);
    setSaving(false);
  }

  function toggleMember(memberId: string) {
    setCheckoutMemberIds((prev) => {
      const next = new Set(prev);
      next.has(memberId) ? next.delete(memberId) : next.add(memberId);
      return next;
    });
    setSaveAsPreset(false);
    setPresetName("");
  }

  function applyPreset(crew: PresetCrew) {
    setCheckoutMemberIds(new Set(crew.member_ids));
    setSaveAsPreset(false);
    setPresetName("");
  }

  async function handleDeletePreset(presetId: string) {
    setDeletingPresetId(presetId);
    const supabase = createClient();
    await supabase.from("preset_crews").delete().eq("id", presetId);
    setPresetCrews((prev) => prev.filter((p) => p.id !== presetId));
    setDeletingPresetId(null);
  }

  async function handleCheckout() {
    if (!item || checkoutMemberIds.size === 0) return;
    setCheckoutSaving(true);
    const supabase = createClient();

    const isGroup = checkoutMemberIds.size > 1;
    const groupId = isGroup ? crypto.randomUUID() : null;

    const rows = Array.from(checkoutMemberIds).map((memberId) => ({
      item_id: item.id,
      team_member_id: memberId,
      notes: checkoutNotes || null,
      checkout_group_id: groupId,
    }));

    const { data: newAssigns } = await supabase
      .from("inventory_assignments")
      .insert(rows)
      .select("id, assigned_at, returned_at, notes, checkout_group_id, team_members(id, name)");

    if (newAssigns) {
      setAssignments([...(newAssigns as unknown as Assignment[]), ...assignments]);
    }

    if (saveAsPreset && presetName.trim() && checkoutMemberIds.size > 1) {
      const { data: crew } = await supabase
        .from("preset_crews")
        .insert({ business_id: item.business_id, name: presetName.trim() })
        .select("id")
        .single();
      if (crew) {
        await supabase.from("preset_crew_members").insert(
          Array.from(checkoutMemberIds).map((mid) => ({ preset_crew_id: crew.id, team_member_id: mid }))
        );
        setPresetCrews((prev) => [
          ...prev,
          { id: crew.id, name: presetName.trim(), member_ids: Array.from(checkoutMemberIds) },
        ]);
      }
    }

    setCheckoutMemberIds(new Set());
    setCheckoutNotes("");
    setShowCheckout(false);
    setSaveAsPreset(false);
    setPresetName("");
    setCheckoutSaving(false);
  }

  async function handleCheckin() {
    if (!item || openAssignments.length === 0) return;
    const supabase = createClient();
    const now = new Date().toISOString();

    await supabase
      .from("inventory_assignments")
      .update({ returned_at: now })
      .in("id", openAssignments.map((a) => a.id));

    setAssignments(assignments.map((a) =>
      openAssignments.some((oa) => oa.id === a.id) ? { ...a, returned_at: now } : a
    ));
  }

  async function handleLogUsage() {
    if (!item) return;
    setUsageSaving(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setUsageSaving(false); return; }

    if (item.category === "part") {
      const newQty = Math.max(0, item.quantity - (parseFloat(usageQty) || 1));
      await supabase.from("inventory_items").update({ quantity: newQty }).eq("id", item.id);
      setItem({ ...item, quantity: newQty });
      setEditForm((f) => ({ ...f, quantity: newQty }));
    }

    const { data: newUsage } = await supabase
      .from("inventory_usage")
      .insert({
        item_id: item.id,
        quantity_used: parseFloat(usageQty) || 1,
        notes: usageNotes || null,
      })
      .select("id, quantity_used, used_at, notes, jobs(id, clients(name)), team_members(id, name)")
      .single();

    if (newUsage) setUsageLogs([newUsage as unknown as UsageLog, ...usageLogs]);
    setUsageQty("1");
    setUsageNotes("");
    setShowLogUsage(false);
    setUsageSaving(false);
  }

  async function handleDelete() {
    if (!item) return;
    setDeleting(true);
    const supabase = createClient();
    await supabase.from("inventory_items").update({ is_active: false }).eq("id", item.id);
    router.push("/inventory");
  }

  if (!item) return null;

  const color = CATEGORY_COLOR[item.category];
  const isLowStock = item.category === "part" && item.min_quantity > 0 && item.quantity <= item.min_quantity;
  const depreciation =
    item.purchase_cost && item.current_value && item.purchase_cost > 0
      ? Math.round(((item.purchase_cost - item.current_value) / item.purchase_cost) * 100)
      : null;

  const historyGroups = groupHistory(assignments);

  // Which preset (if any) exactly matches the current member selection
  const matchingPreset = presetCrews.find(
    (p) =>
      p.member_ids.length === checkoutMemberIds.size &&
      p.member_ids.every((mid) => checkoutMemberIds.has(mid))
  );

  return (
    <div className="flex flex-col gap-4 px-4 lg:px-8 py-4 max-w-2xl mx-auto pb-10">
      {/* Back + header */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => router.push("/inventory")}
          className="flex size-8 items-center justify-center rounded-full bg-muted text-muted-foreground hover:bg-muted/80"
        >
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Inventory</p>
          <h1 className="text-lg font-extrabold tracking-tight text-foreground truncate">{item.name}</h1>
        </div>
        <button
          onClick={() => { setEditForm({ ...item }); setEditing(true); setSaveError(null); }}
          className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-border bg-card text-sm font-semibold text-foreground hover:bg-muted"
        >
          <span className="material-symbols-outlined text-[15px]">edit</span>
          Edit
        </button>
      </div>

      {/* Identity strip */}
      <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card p-3">
        <div
          className="flex size-12 shrink-0 items-center justify-center rounded-2xl text-white shadow-sm"
          style={{ backgroundColor: color }}
        >
          <span className="material-symbols-outlined text-[24px]" style={{ fontVariationSettings: "'FILL' 1" }}>
            {CATEGORY_ICON[item.category]}
          </span>
        </div>
        <div className="flex flex-col min-w-0 flex-1">
          <h2 className="font-extrabold text-foreground truncate">{item.name}</h2>
          <p className="text-sm text-muted-foreground">
            {CATEGORY_LABEL[item.category]}
            {item.category === "vehicle" && item.vehicle_make
              ? ` · ${[item.vehicle_year, item.vehicle_make, item.vehicle_model].filter(Boolean).join(" ")}`
              : ""}
            {item.location ? ` · ${item.location}` : ""}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <Badge className={`text-[10px] px-2 py-0.5 rounded-full border-0 ${CONDITION_CLASS[item.condition]}`}>
            {CONDITION_LABEL[item.condition]}
          </Badge>
          {item.category === "part" && (
            <span className={`text-xs font-bold ${isLowStock ? "text-orange-500" : "text-muted-foreground"}`}>
              Qty: {item.quantity}{isLowStock ? " ⚠ Low" : ""}
            </span>
          )}
        </div>
      </div>

      {/* Details */}
      {(item.serial_number || item.location || item.notes) && (
        <div className="rounded-2xl border border-border/60 bg-card p-4 flex flex-col gap-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Details</p>
          {item.serial_number && <DetailRow icon="tag" label="Serial #" value={item.serial_number} />}
          {item.location && <DetailRow icon="location_on" label="Location" value={item.location} />}
          {item.category === "vehicle" && item.license_plate && (
            <DetailRow icon="drive_eta" label="Plate" value={item.license_plate} />
          )}
          {item.category === "vehicle" && item.insurance_expires_at && (
            <DetailRow icon="shield" label="Insurance expires" value={formatDate(item.insurance_expires_at)} />
          )}
          {item.category === "vehicle" && item.registration_expires_at && (
            <DetailRow icon="assignment" label="Registration expires" value={formatDate(item.registration_expires_at)} />
          )}
          {item.notes && (
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Notes</span>
              <p className="text-sm text-foreground whitespace-pre-wrap">{item.notes}</p>
            </div>
          )}
        </div>
      )}

      {/* Cost & Value */}
      {(item.purchase_cost != null || item.current_value != null) && (
        <div className="rounded-2xl border border-border/60 bg-card p-4 flex flex-col gap-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Cost & Value</p>
          <div className="flex items-stretch gap-3">
            {item.purchase_cost != null && (
              <div className="flex-1 flex flex-col gap-0.5 rounded-xl bg-muted/40 p-3">
                <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Purchase Cost</span>
                <span className="text-lg font-extrabold text-foreground">{formatCurrency(item.purchase_cost, currency)}</span>
                {item.purchase_date && (
                  <span className="text-[10px] text-muted-foreground">{formatDate(item.purchase_date)}</span>
                )}
              </div>
            )}
            {item.current_value != null && (
              <div className="flex-1 flex flex-col gap-0.5 rounded-xl bg-muted/40 p-3">
                <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Current Value</span>
                <span className="text-lg font-extrabold text-foreground">{formatCurrency(item.current_value, currency)}</span>
                {depreciation !== null && (
                  <span className="text-[10px] text-orange-500 font-semibold">{depreciation}% depreciated</span>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Assignment */}
      <div className="rounded-2xl border border-border/60 bg-card p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Assignment</p>
          {openAssignments.length > 0 ? (
            <button
              onClick={handleCheckin}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-green-300 bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400 text-xs font-bold hover:bg-green-100 dark:hover:bg-green-950/30"
            >
              <span className="material-symbols-outlined text-[14px]">check_circle</span>
              {isGroupCheckout ? "Check In All" : "Check In"}
            </button>
          ) : (
            <button
              onClick={() => setShowCheckout(true)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-primary/30 bg-primary/8 text-primary text-xs font-bold hover:bg-primary/15"
            >
              <span className="material-symbols-outlined text-[14px]">person_add</span>
              Check Out
            </button>
          )}
        </div>

        {openAssignments.length > 0 ? (
          <div className="flex flex-col gap-2">
            {isGroupCheckout && (
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="material-symbols-outlined text-[14px] text-muted-foreground">group</span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Group Checkout</span>
              </div>
            )}
            {openAssignments.map((a) => (
              <div key={a.id} className="flex items-center gap-3 rounded-xl bg-primary/8 border border-primary/20 px-3 py-2.5">
                <span className="material-symbols-outlined text-[20px] text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>person</span>
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-bold text-foreground">{a.team_members?.name ?? "Unknown"}</span>
                  <span className="text-xs text-muted-foreground">Since {formatDate(a.assigned_at)}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Not currently assigned to anyone.</p>
        )}

        {historyGroups.length > 0 && (
          <>
            <Separator />
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">History</p>
              {historyGroups.length > 3 && (
                <button
                  onClick={() => setHistoryExpanded((v) => !v)}
                  className="flex items-center gap-0.5 text-[10px] font-semibold text-muted-foreground hover:text-foreground transition-colors"
                >
                  {historyExpanded ? "Show less" : `Show all ${historyGroups.length}`}
                  <span className={`material-symbols-outlined text-[14px] transition-transform ${historyExpanded ? "rotate-180" : ""}`}>
                    expand_more
                  </span>
                </button>
              )}
            </div>
            <div className="flex flex-col gap-2">
              {historyGroups
                .slice(0, historyExpanded ? undefined : 3)
                .map(({ primary, siblings }) => (
                  <div key={primary.id} className="flex items-start justify-between text-sm gap-2">
                    <div className="flex flex-col min-w-0">
                      <span className="font-medium text-foreground">
                        {primary.team_members?.name ?? "Unknown"}
                        {siblings.length > 0 && (
                          <span className="text-muted-foreground font-normal">
                            {" + "}{siblings.map((s) => s.team_members?.name ?? "Unknown").join(", ")}
                          </span>
                        )}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {formatDate(primary.assigned_at)} → {formatDate(primary.returned_at)}
                    </span>
                  </div>
                ))}
            </div>
          </>
        )}
      </div>

      {/* Usage Log */}
      <div className="rounded-2xl border border-border/60 bg-card p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Usage Log</p>
          <button
            onClick={() => { setUsageQty("1"); setUsageNotes(""); setShowLogUsage(true); }}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-border bg-muted/40 text-muted-foreground text-xs font-bold hover:bg-muted"
          >
            <span className="material-symbols-outlined text-[14px]">add</span>
            Log Usage
          </button>
        </div>

        {usageLogs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No usage recorded yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {usageLogs.map((u) => (
              <div key={u.id} className="flex items-start gap-3 rounded-xl bg-muted/30 px-3 py-2.5">
                <span className="material-symbols-outlined text-[16px] text-muted-foreground mt-0.5">build</span>
                <div className="flex flex-col min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">
                      {u.quantity_used !== 1 ? `×${u.quantity_used} ` : ""}
                      {u.jobs?.clients?.name ? `for ${u.jobs.clients.name}` : "Manual entry"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{formatDate(u.used_at)}</span>
                    {u.team_members && (
                      <span className="text-xs text-muted-foreground">· by {u.team_members.name}</span>
                    )}
                  </div>
                  {u.notes && <p className="text-xs text-muted-foreground mt-0.5">{u.notes}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Archive */}
      <div className="flex justify-end">
        {!showDeleteConfirm ? (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="text-xs text-muted-foreground hover:text-red-500 transition-colors"
          >
            Archive item
          </button>
        ) : (
          <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/20 px-3 py-2">
            <span className="text-sm text-red-600 dark:text-red-400">Archive this item?</span>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="px-3 py-1 rounded-lg bg-red-500 text-white text-xs font-bold disabled:opacity-50"
            >
              {deleting ? "…" : "Yes, archive"}
            </button>
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* Edit Sheet */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setEditing(false)} />
          <div className="relative w-full max-w-lg bg-background rounded-t-3xl p-6 pb-10 shadow-2xl max-h-[92vh] overflow-y-auto flex flex-col gap-4">
            <div className="absolute top-3 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-muted-foreground/20" />
            <div className="flex items-center justify-between pt-2">
              <h2 className="text-lg font-extrabold text-foreground">Edit Item</h2>
              <button onClick={() => setEditing(false)} className="flex size-8 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <Field label="Name *">
              <input
                type="text"
                required
                value={editForm.name ?? ""}
                onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                className={INPUT}
              />
            </Field>

            <Field label="Condition">
              <div className="flex gap-2">
                {(["excellent", "good", "fair", "poor"] as const).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setEditForm((f) => ({ ...f, condition: c }))}
                    className={`flex-1 py-2 rounded-xl border text-xs font-semibold transition-colors ${
                      editForm.condition === c
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-card text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {CONDITION_LABEL[c]}
                  </button>
                ))}
              </div>
            </Field>

            {editForm.category === "part" && (
              <div className="flex gap-3">
                <Field label="Quantity" className="flex-1">
                  <input
                    type="number"
                    min="0"
                    value={editForm.quantity ?? 1}
                    onChange={(e) => setEditForm((f) => ({ ...f, quantity: parseInt(e.target.value) || 0 }))}
                    className={INPUT}
                  />
                </Field>
                <Field label="Low Stock Alert" className="flex-1">
                  <input
                    type="number"
                    min="0"
                    value={editForm.min_quantity ?? 0}
                    onChange={(e) => setEditForm((f) => ({ ...f, min_quantity: parseInt(e.target.value) || 0 }))}
                    className={INPUT}
                  />
                </Field>
              </div>
            )}

            <Field label="Location">
              <input
                type="text"
                value={editForm.location ?? ""}
                onChange={(e) => setEditForm((f) => ({ ...f, location: e.target.value }))}
                className={INPUT}
              />
            </Field>

            <Field label="Serial Number">
              <input
                type="text"
                value={editForm.serial_number ?? ""}
                onChange={(e) => setEditForm((f) => ({ ...f, serial_number: e.target.value }))}
                className={INPUT}
              />
            </Field>

            {editForm.category === "vehicle" && (
              <>
                <div className="flex gap-3">
                  <Field label="Year" className="flex-1">
                    <input
                      type="number"
                      value={editForm.vehicle_year ?? ""}
                      onChange={(e) => setEditForm((f) => ({ ...f, vehicle_year: parseInt(e.target.value) || null }))}
                      className={INPUT}
                    />
                  </Field>
                  <Field label="Make" className="flex-1">
                    <input
                      type="text"
                      value={editForm.vehicle_make ?? ""}
                      onChange={(e) => setEditForm((f) => ({ ...f, vehicle_make: e.target.value }))}
                      className={INPUT}
                    />
                  </Field>
                  <Field label="Model" className="flex-1">
                    <input
                      type="text"
                      value={editForm.vehicle_model ?? ""}
                      onChange={(e) => setEditForm((f) => ({ ...f, vehicle_model: e.target.value }))}
                      className={INPUT}
                    />
                  </Field>
                </div>
                <Field label="License Plate">
                  <input
                    type="text"
                    value={editForm.license_plate ?? ""}
                    onChange={(e) => setEditForm((f) => ({ ...f, license_plate: e.target.value }))}
                    className={INPUT}
                  />
                </Field>
                <div className="flex gap-3">
                  <Field label="Insurance Expires" className="flex-1">
                    <input
                      type="date"
                      value={editForm.insurance_expires_at?.substring(0, 10) ?? ""}
                      onChange={(e) => setEditForm((f) => ({ ...f, insurance_expires_at: e.target.value || null }))}
                      className={INPUT}
                    />
                  </Field>
                  <Field label="Registration Expires" className="flex-1">
                    <input
                      type="date"
                      value={editForm.registration_expires_at?.substring(0, 10) ?? ""}
                      onChange={(e) => setEditForm((f) => ({ ...f, registration_expires_at: e.target.value || null }))}
                      className={INPUT}
                    />
                  </Field>
                </div>
              </>
            )}

            <div className="flex gap-3">
              <Field label="Purchase Date" className="flex-1">
                <input
                  type="date"
                  value={editForm.purchase_date?.substring(0, 10) ?? ""}
                  onChange={(e) => setEditForm((f) => ({ ...f, purchase_date: e.target.value || null }))}
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
                    value={editForm.purchase_cost ?? ""}
                    onChange={(e) => setEditForm((f) => ({ ...f, purchase_cost: e.target.value ? parseFloat(e.target.value) : null }))}
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
                    value={editForm.current_value ?? ""}
                    onChange={(e) => setEditForm((f) => ({ ...f, current_value: e.target.value ? parseFloat(e.target.value) : null }))}
                    className={INPUT + " pl-7"}
                  />
                </div>
              </Field>
            </div>

            <Field label="Notes">
              <textarea
                rows={3}
                value={editForm.notes ?? ""}
                onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))}
                className="w-full rounded-xl border border-border bg-background px-3 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring/30 resize-none"
              />
            </Field>

            {saveError && (
              <p className="text-sm text-red-500 bg-red-50 dark:bg-red-950/30 rounded-xl px-3 py-2">{saveError}</p>
            )}

            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full py-3.5 flex items-center justify-center rounded-xl bg-primary text-white font-bold text-sm disabled:opacity-50 active:scale-[0.98] transition-transform"
            >
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </div>
      )}

      {/* Check-out Modal */}
      {showCheckout && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => { setShowCheckout(false); setCheckoutMemberIds(new Set()); setSaveAsPreset(false); setPresetName(""); setPresetEditMode(false); }}
          />
          <div className="relative w-full max-w-lg bg-background rounded-t-3xl p-6 pb-10 shadow-2xl max-h-[88vh] overflow-y-auto flex flex-col gap-4">
            <div className="absolute top-3 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-muted-foreground/20" />
            <div className="flex items-center justify-between pt-2">
              <h2 className="text-lg font-extrabold text-foreground">Check Out Item</h2>
              <button
                onClick={() => { setShowCheckout(false); setCheckoutMemberIds(new Set()); setSaveAsPreset(false); setPresetName(""); setPresetEditMode(false); }}
                className="flex size-8 items-center justify-center rounded-full bg-muted text-muted-foreground"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            {/* Preset crew quick-select */}
            {presetCrews.length > 0 && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Preset Crews</p>
                  {presetEditMode ? (
                    <button
                      onClick={() => setPresetEditMode(false)}
                      className="text-xs font-bold text-primary"
                    >
                      Done
                    </button>
                  ) : (
                    <button
                      onClick={() => setPresetEditMode(true)}
                      className="flex items-center justify-center size-6 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                      title="Manage presets"
                    >
                      <span className="material-symbols-outlined text-[15px]">edit</span>
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {presetCrews.map((crew) => {
                    const isActive = !presetEditMode && matchingPreset?.id === crew.id;
                    return (
                      <div key={crew.id} className="flex items-center">
                        <button
                          onClick={() => {
                            if (presetEditMode) return;
                            isActive ? setCheckoutMemberIds(new Set()) : applyPreset(crew);
                          }}
                          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-colors ${
                            presetEditMode
                              ? "rounded-l-xl border border-r-0 border-border bg-muted/40 text-muted-foreground cursor-default"
                              : isActive
                                ? "rounded-xl border border-primary bg-primary/10 text-primary"
                                : "rounded-xl border border-border bg-muted/40 text-foreground hover:bg-muted"
                          }`}
                        >
                          <span className="material-symbols-outlined text-[13px]">group</span>
                          {crew.name}
                        </button>
                        {presetEditMode && (
                          <button
                            onClick={() => handleDeletePreset(crew.id)}
                            disabled={deletingPresetId === crew.id}
                            className="flex items-center justify-center px-2 py-1.5 rounded-r-xl border border-border bg-muted/40 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors disabled:opacity-40"
                          >
                            <span className="material-symbols-outlined text-[13px]">close</span>
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Member multi-select */}
            <Field label={`Assign to${checkoutMemberIds.size > 0 ? ` (${checkoutMemberIds.size} selected)` : " *"}`}>
              <div className="flex flex-col gap-1 rounded-xl border border-border bg-background overflow-hidden">
                {teamMembers.length === 0 ? (
                  <p className="text-sm text-muted-foreground px-3 py-3">No active team members found.</p>
                ) : (
                  teamMembers.map((m) => {
                    const checked = checkoutMemberIds.has(m.id);
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => toggleMember(m.id)}
                        className={`flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                          checked ? "bg-primary/8" : "hover:bg-muted/50"
                        }`}
                      >
                        <div className={`flex size-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors ${
                          checked ? "border-primary bg-primary" : "border-border"
                        }`}>
                          {checked && (
                            <span className="material-symbols-outlined text-[13px] text-white" style={{ fontVariationSettings: "'FILL' 1, 'wght' 700" }}>
                              check
                            </span>
                          )}
                        </div>
                        <span className={`text-sm font-medium ${checked ? "text-foreground" : "text-muted-foreground"}`}>
                          {m.name}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            </Field>

            <Field label="Notes (optional)">
              <input
                type="text"
                placeholder="e.g. Needed for Monday job"
                value={checkoutNotes}
                onChange={(e) => setCheckoutNotes(e.target.value)}
                className={INPUT}
              />
            </Field>

            {/* Save as preset — only when 2+ selected and no identical preset already exists */}
            {checkoutMemberIds.size >= 2 && !matchingPreset && (
              <div className="flex flex-col gap-2 rounded-xl border border-border bg-muted/30 p-3">
                <button
                  type="button"
                  onClick={() => setSaveAsPreset((v) => !v)}
                  className="flex items-center gap-2 text-sm font-semibold text-foreground"
                >
                  <div className={`flex size-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors ${
                    saveAsPreset ? "border-primary bg-primary" : "border-border"
                  }`}>
                    {saveAsPreset && (
                      <span className="material-symbols-outlined text-[13px] text-white" style={{ fontVariationSettings: "'FILL' 1, 'wght' 700" }}>
                        check
                      </span>
                    )}
                  </div>
                  Save this group as a preset crew
                </button>
                {saveAsPreset && (
                  <input
                    type="text"
                    placeholder="Preset crew name (e.g. Morning Crew)"
                    value={presetName}
                    onChange={(e) => setPresetName(e.target.value)}
                    className={INPUT}
                    autoFocus
                  />
                )}
              </div>
            )}

            {checkoutMemberIds.size >= 2 && matchingPreset && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <span className="material-symbols-outlined text-[13px]">group</span>
                Using preset: <strong className="text-foreground">{matchingPreset.name}</strong>
              </p>
            )}

            <button
              onClick={handleCheckout}
              disabled={checkoutSaving || checkoutMemberIds.size === 0 || (saveAsPreset && !presetName.trim())}
              className="w-full py-3.5 flex items-center justify-center rounded-xl bg-primary text-white font-bold text-sm disabled:opacity-50 active:scale-[0.98] transition-transform"
            >
              {checkoutSaving
                ? "Saving…"
                : checkoutMemberIds.size > 1
                  ? `Check Out to ${checkoutMemberIds.size} Members`
                  : "Check Out"}
            </button>
          </div>
        </div>
      )}

      {/* Log Usage Modal */}
      {showLogUsage && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowLogUsage(false)} />
          <div className="relative w-full max-w-lg bg-background rounded-t-3xl p-6 pb-10 shadow-2xl flex flex-col gap-4">
            <div className="absolute top-3 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-muted-foreground/20" />
            <div className="flex items-center justify-between pt-2">
              <h2 className="text-lg font-extrabold text-foreground">Log Usage</h2>
              <button onClick={() => setShowLogUsage(false)} className="flex size-8 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <Field label="Quantity Used">
              <input
                type="number"
                min="1"
                step="1"
                value={usageQty}
                onChange={(e) => setUsageQty(e.target.value)}
                className={INPUT}
              />
            </Field>

            <Field label="Notes (optional)">
              <input
                type="text"
                placeholder="e.g. Used on Smith job"
                value={usageNotes}
                onChange={(e) => setUsageNotes(e.target.value)}
                className={INPUT}
              />
            </Field>

            {item.category === "part" && (
              <p className="text-xs text-muted-foreground bg-muted/40 rounded-xl px-3 py-2">
                This will reduce the quantity from <strong>{item.quantity}</strong> to{" "}
                <strong>{Math.max(0, item.quantity - (parseFloat(usageQty) || 0))}</strong>.
              </p>
            )}

            <button
              onClick={handleLogUsage}
              disabled={usageSaving}
              className="w-full py-3.5 flex items-center justify-center rounded-xl bg-primary text-white font-bold text-sm disabled:opacity-50 active:scale-[0.98] transition-transform"
            >
              {usageSaving ? "Saving…" : "Log Usage"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function DetailRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="material-symbols-outlined text-[16px] text-muted-foreground shrink-0">{icon}</span>
      <span className="text-xs text-muted-foreground shrink-0 w-32">{label}</span>
      <span className="text-sm font-medium text-foreground truncate">{value}</span>
    </div>
  );
}
