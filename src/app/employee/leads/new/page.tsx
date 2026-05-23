"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import AddressAutocomplete from "@/components/AddressAutocomplete";

type Heat = "hot" | "warm" | "cool";

const HEAT_OPTIONS: { value: Heat; label: string; color: string; bg: string }[] = [
  { value: "hot",  label: "Hot",  color: "text-red-500",    bg: "bg-red-500/10 border-red-500/30"    },
  { value: "warm", label: "Warm", color: "text-amber-500",  bg: "bg-amber-500/10 border-amber-500/30" },
  { value: "cool", label: "Cool", color: "text-blue-500",   bg: "bg-blue-500/10 border-blue-500/30"  },
];

function heatToSource(heat: Heat): string {
  if (heat === "hot")  return "Hot Lead – Canvass";
  if (heat === "warm") return "Warm Lead – Canvass";
  return "Canvass";
}

export default function NewLeadPage() {
  const router = useRouter();
  const [businessId, setBusinessId] = useState<string | null>(null);

  const [name, setName]       = useState("");
  const [phone, setPhone]     = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes]     = useState("");
  const [heat, setHeat]       = useState<Heat>("warm");

  const [saving, setSaving]   = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("team_members")
        .select("business_id")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .single();
      if (data) setBusinessId((data as unknown as { business_id: string }).business_id);
    }
    load();
  }, []);

  async function saveLead() {
    if (!businessId || !name.trim()) return;
    setSaving(true);
    const supabase = createClient();
    await supabase.from("leads").insert({
      business_id: businessId,
      name: name.trim(),
      phone: phone.trim() || null,
      address: address.trim() || null,
      stage: "new",
      source: heatToSource(heat),
      notes: notes.trim() || null,
    });
    setSuccess(true);
    setSaving(false);
    setName("");
    setPhone("");
    setAddress("");
    setNotes("");
    setHeat("warm");
    setTimeout(() => setSuccess(false), 3000);
  }

  return (
    <div className="flex flex-col gap-4 px-4 py-4 max-w-xl mx-auto pb-32 lg:pb-8">
      <div className="flex items-center gap-3 mb-1">
        <button
          onClick={() => router.back()}
          className="flex size-8 items-center justify-center rounded-full hover:bg-muted/60 transition-colors text-muted-foreground"
        >
          <span className="material-symbols-outlined text-[20px]">arrow_back</span>
        </button>
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-foreground">New Lead</h1>
          <p className="text-xs text-muted-foreground">Log a potential customer from the field</p>
        </div>
      </div>

      {success && (
        <div className="flex items-center gap-3 rounded-2xl bg-green-500/10 border border-green-500/20 px-4 py-3">
          <span className="material-symbols-outlined text-[20px] text-green-500" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
          <p className="text-sm font-semibold text-green-700 dark:text-green-400">Lead saved! Form cleared for next entry.</p>
        </div>
      )}

      <Card className="rounded-2xl border-border shadow-sm overflow-hidden">
        <div className="p-4 flex flex-col gap-4">
          {/* Name */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Name <span className="text-red-500">*</span></label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
              className="w-full rounded-xl border border-border bg-muted/40 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Phone */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Phone</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(555) 000-0000"
              className="w-full rounded-xl border border-border bg-muted/40 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Address */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Address</label>
            <AddressAutocomplete
              value={address}
              onChange={setAddress}
              placeholder="123 Main St, City, State"
              className="w-full rounded-xl border border-border bg-muted/40 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Heat level */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Interest Level</label>
            <div className="flex gap-2">
              {HEAT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setHeat(opt.value)}
                  className={`flex-1 py-2 rounded-xl border text-sm font-bold transition-all active:scale-95 ${
                    heat === opt.value
                      ? `${opt.bg} ${opt.color} border-current`
                      : "bg-muted/40 border-border text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="What are they interested in? Any details…"
              rows={3}
              className="w-full rounded-xl border border-border bg-muted/40 px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <button
            onClick={saveLead}
            disabled={saving || !name.trim() || !businessId}
            className="w-full py-3 rounded-2xl bg-primary text-primary-foreground font-bold text-sm hover:opacity-90 disabled:opacity-50 transition-all active:scale-[0.98]"
          >
            {saving ? "Saving…" : "Save Lead"}
          </button>
        </div>
      </Card>
    </div>
  );
}
