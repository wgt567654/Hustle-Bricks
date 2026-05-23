"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";

type Client = { id: string; name: string };
type LineItem = { description: string; qty: number; unitPrice: number };

export default function NewQuotePage() {
  const router = useRouter();
  const [businessId, setBusinessId]   = useState<string | null>(null);
  const [memberId, setMemberId]       = useState<string | null>(null);
  const [clients, setClients]         = useState<Client[]>([]);
  const [clientSearch, setClientSearch] = useState("");
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [showPicker, setShowPicker]   = useState(false);
  const [lineItems, setLineItems]     = useState<LineItem[]>([{ description: "", qty: 1, unitPrice: 0 }]);
  const [notes, setNotes]             = useState("");
  const [saving, setSaving]           = useState(false);
  const [savedId, setSavedId]         = useState<string | null>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

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

      const mid = (tm as unknown as { id: string }).id;
      const bid = (tm as unknown as { business_id: string }).business_id;
      setMemberId(mid);
      setBusinessId(bid);

      const { data: clientData } = await supabase
        .from("clients")
        .select("id, name")
        .eq("business_id", bid)
        .order("name");
      setClients((clientData ?? []) as Client[]);
    }
    load();
  }, []);

  useEffect(() => {
    if (!showPicker) return;
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setShowPicker(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showPicker]);

  const filteredClients = clients.filter((c) =>
    c.name.toLowerCase().includes(clientSearch.toLowerCase())
  );

  const total = lineItems.reduce((sum, li) => sum + li.qty * li.unitPrice, 0);

  function addLine() {
    setLineItems((prev) => [...prev, { description: "", qty: 1, unitPrice: 0 }]);
  }

  function removeLine(i: number) {
    setLineItems((prev) => prev.filter((_, idx) => idx !== i));
  }

  function updateLine(i: number, field: keyof LineItem, value: string | number) {
    setLineItems((prev) => prev.map((li, idx) => idx === i ? { ...li, [field]: value } : li));
  }

  async function saveQuote() {
    if (!businessId || !memberId) return;
    if (lineItems.every((li) => !li.description.trim())) return;
    setSaving(true);

    const supabase = createClient();

    let notesValue = notes.trim() || null;
    if (!selectedClient && clientSearch.trim()) {
      notesValue = `Client: ${clientSearch.trim()} (not in system)${notesValue ? `\n${notesValue}` : ""}`;
    }

    const { data: quote } = await supabase
      .from("quotes")
      .insert({
        business_id: businessId,
        client_id: selectedClient?.id ?? null,
        status: "draft",
        total,
        notes: notesValue,
        created_by_member_id: memberId,
      })
      .select("id")
      .single();

    if (quote) {
      const items = lineItems
        .filter((li) => li.description.trim())
        .map((li) => ({
          quote_id: (quote as unknown as { id: string }).id,
          description: li.description.trim(),
          quantity: li.qty,
          unit_price: li.unitPrice,
        }));
      if (items.length > 0) {
        await supabase.from("quote_line_items").insert(items);
      }
      setSavedId((quote as unknown as { id: string }).id);
    }
    setSaving(false);
  }

  function resetForm() {
    setSelectedClient(null);
    setClientSearch("");
    setLineItems([{ description: "", qty: 1, unitPrice: 0 }]);
    setNotes("");
    setSavedId(null);
  }

  if (savedId) {
    return (
      <div className="flex flex-col gap-4 px-4 py-4 max-w-xl mx-auto pb-32 lg:pb-8">
        <div className="flex items-center gap-3 mb-1">
          <button
            onClick={() => router.back()}
            className="flex size-8 items-center justify-center rounded-full hover:bg-muted/60 transition-colors text-muted-foreground"
          >
            <span className="material-symbols-outlined text-[20px]">arrow_back</span>
          </button>
          <h1 className="text-xl font-extrabold tracking-tight text-foreground">Quote Saved</h1>
        </div>

        <Card className="rounded-2xl border-border shadow-sm p-6 flex flex-col items-center gap-4 text-center">
          <div className="size-16 rounded-full bg-green-500/10 flex items-center justify-center">
            <span className="material-symbols-outlined text-[32px] text-green-500" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
          </div>
          <div>
            <p className="font-extrabold text-lg text-foreground">Draft submitted!</p>
            <p className="text-sm text-muted-foreground mt-1">Your manager will review and send this quote to the client.</p>
          </div>
          <div className="flex flex-col gap-2 w-full mt-2">
            <button
              onClick={resetForm}
              className="w-full py-3 rounded-2xl bg-primary text-primary-foreground font-bold text-sm hover:opacity-90 transition-all active:scale-[0.98]"
            >
              Create Another Quote
            </button>
            <Link
              href="/employee/quotes"
              className="w-full py-3 rounded-2xl border border-border text-muted-foreground font-bold text-sm hover:bg-muted/50 transition-all text-center"
            >
              View My Quotes
            </Link>
          </div>
        </Card>
      </div>
    );
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
          <h1 className="text-xl font-extrabold tracking-tight text-foreground">New Quote</h1>
          <p className="text-xs text-muted-foreground">Draft saved for manager review</p>
        </div>
      </div>

      {/* Client picker */}
      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Client</h3>
        <Card className="rounded-2xl border-border shadow-sm overflow-hidden">
          <div className="p-4 flex flex-col gap-3">
            {selectedClient ? (
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                  <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>person</span>
                </div>
                <span className="font-bold text-sm text-foreground flex-1">{selectedClient.name}</span>
                <button
                  onClick={() => { setSelectedClient(null); setClientSearch(""); }}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Change
                </button>
              </div>
            ) : (
              <div className="relative" ref={pickerRef}>
                <input
                  value={clientSearch}
                  onChange={(e) => { setClientSearch(e.target.value); setShowPicker(true); }}
                  onFocus={() => setShowPicker(true)}
                  placeholder="Search clients or enter name…"
                  className="w-full rounded-xl border border-border bg-muted/40 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
                {showPicker && filteredClients.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-background border border-border rounded-xl shadow-lg overflow-hidden z-10 max-h-48 overflow-y-auto">
                    {filteredClients.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => { setSelectedClient(c); setClientSearch(c.name); setShowPicker(false); }}
                        className="w-full text-left px-3 py-2.5 text-sm hover:bg-muted/60 transition-colors"
                      >
                        {c.name}
                      </button>
                    ))}
                  </div>
                )}
                {clientSearch.trim() && !selectedClient && (
                  <p className="text-[10px] text-muted-foreground mt-1.5">
                    Not in system? Name will be saved in notes.
                  </p>
                )}
              </div>
            )}
          </div>
        </Card>
      </section>

      {/* Line items */}
      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Services</h3>
        <Card className="rounded-2xl border-border shadow-sm overflow-hidden">
          <div className="divide-y divide-border/50">
            {lineItems.map((li, i) => (
              <div key={i} className="p-4 flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <input
                    value={li.description}
                    onChange={(e) => updateLine(i, "description", e.target.value)}
                    placeholder="Service description"
                    className="flex-1 rounded-xl border border-border bg-muted/40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  {lineItems.length > 1 && (
                    <button
                      onClick={() => removeLine(i)}
                      className="flex size-8 items-center justify-center rounded-full text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors shrink-0"
                    >
                      <span className="material-symbols-outlined text-[18px]">remove_circle</span>
                    </button>
                  )}
                </div>
                <div className="flex gap-2">
                  <div className="flex items-center gap-1 rounded-xl border border-border bg-muted/40 px-2">
                    <button onClick={() => updateLine(i, "qty", Math.max(1, li.qty - 1))} className="text-muted-foreground hover:text-foreground p-1">
                      <span className="material-symbols-outlined text-[16px]">remove</span>
                    </button>
                    <span className="text-sm font-bold text-foreground w-6 text-center">{li.qty}</span>
                    <button onClick={() => updateLine(i, "qty", li.qty + 1)} className="text-muted-foreground hover:text-foreground p-1">
                      <span className="material-symbols-outlined text-[16px]">add</span>
                    </button>
                  </div>
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={li.unitPrice || ""}
                      onChange={(e) => updateLine(i, "unitPrice", parseFloat(e.target.value) || 0)}
                      placeholder="0.00"
                      className="w-full rounded-xl border border-border bg-muted/40 pl-6 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div className="flex items-center justify-end w-20">
                    <span className="text-sm font-bold text-foreground">${(li.qty * li.unitPrice).toFixed(2)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="px-4 pb-4 flex flex-col gap-3">
            <button
              onClick={addLine}
              className="flex items-center gap-2 text-sm font-semibold text-primary hover:opacity-80 transition-opacity"
            >
              <span className="material-symbols-outlined text-[18px]">add_circle</span>
              Add service
            </button>
            <div className="flex items-center justify-between border-t border-border/50 pt-3">
              <span className="text-sm font-bold text-muted-foreground">Total</span>
              <span className="text-lg font-extrabold text-foreground">${total.toFixed(2)}</span>
            </div>
          </div>
        </Card>
      </section>

      {/* Notes */}
      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Notes</h3>
        <Card className="rounded-2xl border-border shadow-sm overflow-hidden">
          <div className="p-4">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional details for the manager…"
              rows={3}
              className="w-full rounded-xl border border-border bg-muted/40 px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </Card>
      </section>

      <button
        onClick={saveQuote}
        disabled={saving || !businessId || lineItems.every((li) => !li.description.trim())}
        className="w-full py-3 rounded-2xl bg-primary text-primary-foreground font-bold text-sm hover:opacity-90 disabled:opacity-50 transition-all active:scale-[0.98]"
      >
        {saving ? "Saving…" : "Submit Draft Quote"}
      </button>
    </div>
  );
}
