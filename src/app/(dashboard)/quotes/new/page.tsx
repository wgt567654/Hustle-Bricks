"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/currency";

type Service = {
  id: string;
  name: string;
  price: number;
  unit: string;
  category: string | null;
};

type Client = {
  id: string;
  name: string;
  tag: string;
};

type LineItem = {
  serviceId: string;
  name: string;
  unitPrice: number;
  qty: number;
};

function formatUnit(unit: string) {
  if (unit === "flat") return "";
  if (unit === "per_hour") return "/hr";
  if (unit === "per_sqft") return "/sq ft";
  if (unit === "per_item") return "/item";
  return "";
}

export default function QuoteBuilder() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [currency, setCurrency] = useState("USD");
  const [services, setServices] = useState<Service[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  const [selectedClientId, setSelectedClientId] = useState("");
  const [clientSearch, setClientSearch] = useState("");
  const [showClientPicker, setShowClientPicker] = useState(false);

  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [applyTax, setApplyTax] = useState(false);
  const [discount, setDiscount] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: business } = await supabase
        .from("businesses")
        .select("id, currency")
        .eq("owner_id", user.id)
        .single();

      if (!business) return;
      setBusinessId(business.id);
      setCurrency(business.currency ?? "USD");

      const [{ data: servicesData }, { data: clientsData }] = await Promise.all([
        supabase
          .from("services")
          .select("id, name, price, unit, category")
          .eq("business_id", business.id)
          .eq("is_active", true)
          .order("category")
          .order("name"),
        supabase
          .from("clients")
          .select("id, name, tag")
          .eq("business_id", business.id)
          .order("name"),
      ]);

      setServices(servicesData ?? []);
      setClients(clientsData ?? []);

      // Pre-select client from query param
      const preselect = searchParams.get("client");
      if (preselect && clientsData?.find((c) => c.id === preselect)) {
        setSelectedClientId(preselect);
      }

      setLoadingData(false);
    }
    load();
  }, []);

  const selectedClient = clients.find((c) => c.id === selectedClientId);
  const filteredClients = clients.filter((c) =>
    c.name.toLowerCase().includes(clientSearch.toLowerCase())
  );

  const categories = Array.from(new Set(services.map((s) => s.category ?? "Other")));

  function addItem(service: Service) {
    setLineItems((prev) => {
      const existing = prev.find((i) => i.serviceId === service.id);
      if (existing) {
        return prev.map((i) =>
          i.serviceId === service.id ? { ...i, qty: i.qty + 1 } : i
        );
      }
      return [...prev, { serviceId: service.id, name: service.name, unitPrice: service.price, qty: 1 }];
    });
  }

  function removeItem(serviceId: string) {
    setLineItems((prev) => {
      const existing = prev.find((i) => i.serviceId === serviceId);
      if (existing && existing.qty > 1) {
        return prev.map((i) => i.serviceId === serviceId ? { ...i, qty: i.qty - 1 } : i);
      }
      return prev.filter((i) => i.serviceId !== serviceId);
    });
  }

  const subtotal = lineItems.reduce((sum, i) => sum + i.unitPrice * i.qty, 0);
  const tax = applyTax ? subtotal * 0.08 : 0;
  const discountAmt = parseFloat(discount) || 0;
  const total = subtotal + tax - discountAmt;

  async function handleSave(status: "draft" | "sent") {
    if (!businessId || !selectedClientId) {
      setError("Please select a client before saving.");
      return;
    }
    if (lineItems.length === 0) {
      setError("Add at least one service to the quote.");
      return;
    }

    setSaving(true);
    setError(null);
    const supabase = createClient();

    const { data: quote, error: quoteError } = await supabase
      .from("quotes")
      .insert({
        business_id: businessId,
        client_id: selectedClientId,
        status,
        total,
        notes: notes.trim() || null,
      })
      .select("id")
      .single();

    if (quoteError || !quote) {
      setError(quoteError?.message ?? "Failed to save quote.");
      setSaving(false);
      return;
    }

    const lineItemRows = lineItems.map((i) => ({
      quote_id: quote.id,
      service_id: i.serviceId,
      description: i.name,
      quantity: i.qty,
      unit_price: i.unitPrice,
    }));

    const { error: itemsError } = await supabase
      .from("quote_line_items")
      .insert(lineItemRows);

    if (itemsError) {
      setError(itemsError.message);
      setSaving(false);
      return;
    }

    router.push("/sales");
  }

  if (loadingData) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (services.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 px-8 text-center">
        <span className="material-symbols-outlined text-[48px] text-muted-foreground/40">inventory_2</span>
        <p className="font-bold text-foreground">No services yet</p>
        <p className="text-sm text-muted-foreground">Add services to your catalog before creating a quote.</p>
        <button
          onClick={() => router.push("/services")}
          className="mt-2 rounded-xl font-bold py-3 px-6 text-sm bg-primary text-white shadow-md shadow-primary/30 hover:bg-primary/90 active:scale-95 transition-all"
        >
          Go to Services →
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 px-4 py-4 max-w-xl mx-auto pb-32">
      <div className="flex flex-col gap-0.5 mb-1">
        <h1 className="text-xl font-extrabold tracking-tight text-foreground">New Quote</h1>
        <p className="text-xs text-muted-foreground">Build an estimate for a client.</p>
      </div>

      {error && (
        <p className="text-sm text-red-500 bg-red-50 dark:bg-red-950/30 rounded-xl px-4 py-3">{error}</p>
      )}

      {/* Client Selector */}
      <section>
        <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-muted-foreground">Client</h3>
        {selectedClient ? (
          <div
            onClick={() => setShowClientPicker(true)}
            className="flex items-center justify-between p-4 rounded-2xl border border-primary/40 bg-primary/5 cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-full bg-primary/15 text-primary font-extrabold text-sm">
                {selectedClient.name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()}
              </div>
              <div>
                <p className="font-bold text-foreground">{selectedClient.name}</p>
                <p className="text-xs text-muted-foreground capitalize">{selectedClient.tag}</p>
              </div>
            </div>
            <span className="material-symbols-outlined text-[20px] text-muted-foreground">swap_horiz</span>
          </div>
        ) : (
          <button
            onClick={() => setShowClientPicker(true)}
            className="w-full flex items-center justify-between p-4 rounded-2xl border border-dashed border-border bg-muted/30 hover:bg-muted/50 transition-colors"
          >
            <span className="text-sm font-medium text-muted-foreground">Select a client…</span>
            <span className="material-symbols-outlined text-[20px] text-muted-foreground">person_search</span>
          </button>
        )}
      </section>

      {/* Services Grid */}
      <section>
        <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-muted-foreground">Add Services</h3>
        <div className="flex flex-col gap-4">
          {categories.map((cat) => (
            <div key={cat}>
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground/60 mb-2">{cat}</p>
              <div className="grid grid-cols-2 gap-3">
                {services.filter((s) => (s.category ?? "Other") === cat).map((service) => {
                  const inCart = lineItems.find((i) => i.serviceId === service.id);
                  return (
                    <div
                      key={service.id}
                      onClick={() => addItem(service)}
                      className={`flex flex-col p-4 rounded-2xl border shadow-sm active:scale-95 transition-all cursor-pointer ${
                        inCart
                          ? "border-primary bg-primary/5"
                          : "border-border bg-card hover:border-primary/50"
                      }`}
                    >
                      {inCart && (
                        <div className="w-5 h-5 rounded-full bg-primary text-white text-[10px] font-bold flex items-center justify-center mb-1.5 self-end">
                          {inCart.qty}
                        </div>
                      )}
                      <span className="font-bold text-sm leading-tight mb-1">{service.name}</span>
                      <span className="text-sm font-extrabold text-primary mt-auto">
                        {formatCurrency(service.price, currency)}{formatUnit(service.unit)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Line Items */}
      {lineItems.length > 0 && (
        <section>
          <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-muted-foreground">Line Items</h3>
          <div className="flex flex-col gap-3">
            {lineItems.map((item) => (
              <Card key={item.serviceId} className="p-3 pr-4 flex items-center justify-between rounded-2xl">
                <div className="flex flex-col gap-0.5 max-w-[55%]">
                  <span className="font-bold text-sm leading-tight text-foreground truncate">{item.name}</span>
                  <span className="text-xs font-semibold text-muted-foreground">{formatCurrency(item.unitPrice, currency)}</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 bg-muted rounded-full p-1 border border-border">
                    <button
                      onClick={() => removeItem(item.serviceId)}
                      className="size-6 flex items-center justify-center rounded-full bg-background shadow-sm text-foreground active:scale-90 transition-transform"
                    >
                      <span className="material-symbols-outlined text-[16px]">{item.qty === 1 ? "delete" : "remove"}</span>
                    </button>
                    <span className="text-sm font-bold w-4 text-center">{item.qty}</span>
                    <button
                      onClick={() => addItem(services.find((s) => s.id === item.serviceId)!)}
                      className="size-6 flex items-center justify-center rounded-full bg-background shadow-sm text-foreground active:scale-90 transition-transform"
                    >
                      <span className="material-symbols-outlined text-[16px]">add</span>
                    </button>
                  </div>
                  <span className="font-bold text-sm text-foreground w-14 text-right">
                    {formatCurrency(item.unitPrice * item.qty, currency)}
                  </span>
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Totals & Adjustments */}
      <section className="mt-2 bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">Subtotal</span>
            <span className="text-sm font-bold text-foreground">{formatCurrency(subtotal, currency)}</span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">Tax (8%)</span>
              <button
                onClick={() => setApplyTax(!applyTax)}
                className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full transition-colors ${
                  applyTax ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                }`}
              >
                {applyTax ? "ON" : "OFF"}
              </button>
            </div>
            <span className="text-sm font-bold text-foreground">{formatCurrency(tax, currency)}</span>
          </div>

          <div className="flex items-center justify-between gap-4">
            <span className="text-sm font-medium text-muted-foreground shrink-0">Discount ($)</span>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
                className="w-24 h-8 rounded-lg border border-border bg-transparent px-2 text-sm text-right font-bold focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
          </div>

          <Separator className="my-1" />

          <div className="flex items-end justify-between">
            <span className="text-lg font-bold text-foreground">Total</span>
            <span className="text-3xl font-extrabold tracking-tighter text-foreground">{formatCurrency(total, currency)}</span>
          </div>
        </div>

        {/* Notes */}
        <div className="px-5 pb-4">
          <textarea
            placeholder="Add a note for the client (optional)…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="flex w-full rounded-xl border border-border bg-muted/30 px-3 py-2.5 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
          />
        </div>

        {/* Actions */}
        <div className="bg-muted p-4 border-t border-border flex gap-3">
          <button
            onClick={() => handleSave("draft")}
            disabled={saving}
            className="flex-1 rounded-xl font-bold py-3 px-4 border border-border bg-card text-foreground shadow-sm hover:bg-muted/50 transition-colors disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save Draft"}
          </button>
          <button
            onClick={() => handleSave("sent")}
            disabled={saving}
            className="flex-1 rounded-xl font-bold py-3 px-4 bg-primary text-white shadow-primary/30 shadow-lg hover:opacity-90 transition-opacity active:scale-[0.98] disabled:opacity-50"
          >
            {saving ? "Saving…" : "Send Quote"}
          </button>
        </div>
      </section>

      {/* Client Picker Modal */}
      {showClientPicker && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowClientPicker(false)} />
          <div className="relative w-full max-w-lg bg-background rounded-t-3xl p-6 pb-10 shadow-2xl flex flex-col gap-4 max-h-[70vh]">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-extrabold tracking-tight text-foreground">Select Client</h2>
              <button
                onClick={() => setShowClientPicker(false)}
                className="flex size-8 items-center justify-center rounded-full bg-muted text-muted-foreground"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-muted-foreground">search</span>
              <input
                type="text"
                placeholder="Search clients…"
                value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)}
                autoFocus
                className="flex h-11 w-full rounded-xl border border-border bg-muted/30 pl-9 pr-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
            <div className="overflow-y-auto flex flex-col gap-2">
              {filteredClients.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">No clients found</p>
              )}
              {filteredClients.map((client) => (
                <button
                  key={client.id}
                  onClick={() => { setSelectedClientId(client.id); setShowClientPicker(false); setClientSearch(""); }}
                  className={`flex items-center gap-3 p-3 rounded-xl text-left transition-colors hover:bg-muted ${
                    selectedClientId === client.id ? "bg-primary/10" : ""
                  }`}
                >
                  <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary font-extrabold text-sm shrink-0">
                    {client.name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()}
                  </div>
                  <div>
                    <p className="font-bold text-foreground text-sm">{client.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">{client.tag}</p>
                  </div>
                  {selectedClientId === client.id && (
                    <span className="material-symbols-outlined text-[20px] text-primary ml-auto">check_circle</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
