"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { createClient } from "@/lib/supabase/client";

export default function SettingsPage() {
  const router = useRouter();
  const [businessName, setBusinessName] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // Payment method fields
  const [venmoUsername, setVenmoUsername] = useState("");
  const [cashappTag, setCashappTag] = useState("");
  const [checkPayableTo, setCheckPayableTo] = useState("");
  const [editingPayments, setEditingPayments] = useState(false);
  const [savingPayments, setSavingPayments] = useState(false);

  // Contact info fields
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [editingContact, setEditingContact] = useState(false);
  const [savingContact, setSavingContact] = useState(false);

  // Employee access code
  const [accessCode, setAccessCode] = useState<string | null>(null);
  const [generatingCode, setGeneratingCode] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);

  // Tax & commission
  const [taxRate, setTaxRate] = useState("8.00");
  const [commissionRate, setCommissionRate] = useState("5.00");
  const [editingTax, setEditingTax] = useState(false);
  const [editingCommission, setEditingCommission] = useState(false);
  const [savingTax, setSavingTax] = useState(false);
  const [savingCommission, setSavingCommission] = useState(false);

  // Stripe Connect
  const searchParams = useSearchParams();
  const [connectStatus, setConnectStatus] = useState<"not_connected" | "pending" | "active">("not_connected");
  const [connectType, setConnectType] = useState<string | null>(null);
  const [connectingExpress, setConnectingExpress] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [connectBanner, setConnectBanner] = useState<"success" | "error" | "refresh" | "return" | null>(null);

  // HustleBricks subscription
  const [stripeSubscriptionId, setStripeSubscriptionId] = useState<string | null>(null);
  const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>(null);
  const [plan, setPlan] = useState<string | null>(null);
  const [openingPortal, setOpeningPortal] = useState(false);

  // Automations
  const [smsReminders, setSmsReminders] = useState(false);
  const [smartScheduling, setSmartScheduling] = useState(false);
  const [savingAutomation, setSavingAutomation] = useState<string | null>(null);

  // Scheduling settings
  const [unavailableDays, setUnavailableDays] = useState<number[]>([0, 6]);
  const [dayHours, setDayHours] = useState<Record<number, { from: string; until: string }>>({
    1: { from: "08:00", until: "17:00" },
    2: { from: "08:00", until: "17:00" },
    3: { from: "08:00", until: "17:00" },
    4: { from: "08:00", until: "17:00" },
    5: { from: "08:00", until: "17:00" },
  });
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [scheduleSaved, setScheduleSaved] = useState(false);
  const [crewSize, setCrewSize] = useState(1);
  const [savingCrew, setSavingCrew] = useState(false);
  const [crewSaved, setCrewSaved] = useState(false);

  // Canvassing custom fields
  type CustomField = { id: string; label: string; field_type: "text" | "number" | "boolean" | "select"; options: string[]; required: boolean; position: number };
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [cfModalOpen, setCfModalOpen] = useState(false);
  const [cfEditing, setCfEditing] = useState<CustomField | null>(null);
  const [cfForm, setCfForm] = useState<Omit<CustomField, "id" | "position">>({ label: "", field_type: "text", options: [], required: false });
  const [cfOptionsInput, setCfOptionsInput] = useState("");
  const [cfSaving, setCfSaving] = useState(false);
  const [cfDeleting, setCfDeleting] = useState<string | null>(null);

  // Share form
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedIframe, setCopiedIframe] = useState(false);
  const [copiedButton, setCopiedButton] = useState(false);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserEmail(user.email ?? null);

      const { data: business, error: businessError } = await supabase
        .from("businesses")
        .select("id, name, venmo_username, cashapp_tag, check_payable_to, contact_email, contact_phone, tax_rate, commission_rate, sms_reminders_enabled, smart_scheduling_enabled, employee_access_code, stripe_connect_account_id, stripe_connect_status, stripe_connect_type, stripe_subscription_id, subscription_status, plan")
        .eq("owner_id", user.id)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      // Only redirect if there is truly no business for this user (not on query errors)
      if (!business && !businessError) {
        router.replace("/");
        return;
      }
      if (!business) {
        setLoading(false);
        return;
      }
      if (business) {
        setBusinessId(business.id);
        setBusinessName(business.name);
        setNameInput(business.name);
        setAccessCode((business as unknown as { employee_access_code: string | null }).employee_access_code ?? null);
        setVenmoUsername(business.venmo_username ?? "");
        setCashappTag(business.cashapp_tag ?? "");
        setCheckPayableTo(business.check_payable_to ?? business.name ?? "");
        setContactEmail(business.contact_email ?? "");
        setContactPhone(business.contact_phone ?? "");
        setTaxRate(business.tax_rate != null ? String(business.tax_rate) : "8.00");
        setCommissionRate(business.commission_rate != null ? String(business.commission_rate) : "5.00");
        setSmsReminders(business.sms_reminders_enabled ?? false);
        setSmartScheduling(business.smart_scheduling_enabled ?? false);

        // Stripe Connect state
        const biz = business as unknown as {
          stripe_connect_status: string | null;
          stripe_connect_type: string | null;
          stripe_subscription_id: string | null;
          subscription_status: string | null;
          plan: string | null;
        };
        setConnectStatus((biz.stripe_connect_status as "not_connected" | "pending" | "active") ?? "not_connected");
        setConnectType(biz.stripe_connect_type ?? null);
        setStripeSubscriptionId(biz.stripe_subscription_id ?? null);
        setSubscriptionStatus(biz.subscription_status ?? null);
        setPlan(biz.plan ?? null);

        const { data: schedSettings } = await supabase
          .from("scheduling_settings")
          .select("unavailable_days, day_hours")
          .eq("business_id", business.id)
          .maybeSingle();
        if (schedSettings) {
          setUnavailableDays((schedSettings as { unavailable_days: number[] }).unavailable_days ?? [0, 6]);
          setDayHours((schedSettings as { day_hours: Record<number, { from: string; until: string }> }).day_hours ?? {});
        }

        const { data: crewSettings } = await supabase
          .from("business_crew_settings")
          .select("crew_size")
          .eq("business_id", business.id)
          .maybeSingle();
        if (crewSettings) {
          setCrewSize((crewSettings as { crew_size: number }).crew_size ?? 1);
        }

        const { data: cfData } = await supabase
          .from("canvassing_custom_fields")
          .select("*")
          .eq("business_id", business.id)
          .order("position");
        setCustomFields((cfData as unknown as CustomField[]) ?? []);
      }
      setLoading(false);
    }
    load();
  }, []);

  // Read connect return state from URL on mount
  useEffect(() => {
    const param = searchParams.get("connect");
    if (param === "success" || param === "return" || param === "refresh" || param === "error") {
      setConnectBanner(param as "success" | "return" | "refresh" | "error");
    }
  }, [searchParams]);

  async function connectExpress() {
    if (!businessId) return;
    setConnectingExpress(true);
    try {
      const res = await fetch("/api/stripe/connect/express", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId }),
      });
      const { url, error } = await res.json();
      if (error || !url) { setConnectingExpress(false); return; }
      window.location.href = url;
    } catch {
      setConnectingExpress(false);
    }
  }

  async function connectStandard() {
    window.location.href = "/api/stripe/connect/standard";
  }

  async function disconnectStripe() {
    if (!businessId) return;
    setDisconnecting(true);
    const res = await fetch("/api/stripe/connect/disconnect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ businessId }),
    });
    const { ok, error } = await res.json();
    if (ok) {
      setConnectStatus("not_connected");
      setConnectType(null);
    } else {
      alert(error ?? "Could not disconnect");
    }
    setDisconnecting(false);
  }

  async function openSubscriptionPortal() {
    setOpeningPortal(true);
    try {
      const res = await fetch("/api/stripe/customer-portal", { method: "POST" });
      const { url } = await res.json();
      if (url) window.open(url, "_blank");
    } finally {
      setOpeningPortal(false);
    }
  }

  function generateCode() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  }

  async function regenerateAccessCode() {
    if (!businessId) return;
    setGeneratingCode(true);
    const newCode = generateCode();
    const supabase = createClient();
    await supabase.from("businesses").update({ employee_access_code: newCode } as Record<string, unknown>).eq("id", businessId);
    setAccessCode(newCode);
    setGeneratingCode(false);
  }

  async function copyAccessCode() {
    if (!accessCode) return;
    await navigator.clipboard.writeText(accessCode);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  }

  async function saveName() {
    if (!businessId || !nameInput.trim()) return;
    setSaving(true);
    const supabase = createClient();
    await supabase.from("businesses").update({ name: nameInput.trim() }).eq("id", businessId);
    setBusinessName(nameInput.trim());
    setEditingName(false);
    setSaving(false);
  }

  async function savePaymentMethods() {
    if (!businessId) return;
    setSavingPayments(true);
    const supabase = createClient();
    await supabase.from("businesses").update({
      venmo_username: venmoUsername.trim().replace(/^@/, "") || null,
      cashapp_tag: cashappTag.trim().replace(/^\$/, "") || null,
      check_payable_to: checkPayableTo.trim() || null,
    }).eq("id", businessId);
    setSavingPayments(false);
    setEditingPayments(false);
  }

  async function saveContactInfo() {
    if (!businessId) return;
    setSavingContact(true);
    const supabase = createClient();
    await supabase.from("businesses").update({
      contact_email: contactEmail.trim() || null,
      contact_phone: contactPhone.trim() || null,
    }).eq("id", businessId);
    setSavingContact(false);
    setEditingContact(false);
  }

  async function saveTax() {
    if (!businessId) return;
    setSavingTax(true);
    const supabase = createClient();
    await supabase.from("businesses").update({ tax_rate: parseFloat(taxRate) || 0 }).eq("id", businessId);
    setSavingTax(false);
    setEditingTax(false);
  }

  async function saveCommission() {
    if (!businessId) return;
    setSavingCommission(true);
    const supabase = createClient();
    await supabase.from("businesses").update({ commission_rate: parseFloat(commissionRate) || 0 }).eq("id", businessId);
    setSavingCommission(false);
    setEditingCommission(false);
  }

  async function toggleAutomation(key: "sms_reminders_enabled" | "smart_scheduling_enabled", current: boolean) {
    if (!businessId) return;
    setSavingAutomation(key);
    const supabase = createClient();
    await supabase.from("businesses").update({ [key]: !current }).eq("id", businessId);
    if (key === "sms_reminders_enabled") setSmsReminders(!current);
    else setSmartScheduling(!current);
    setSavingAutomation(null);
  }

  async function saveScheduling() {
    if (!businessId) return;
    setSavingSchedule(true);
    const supabase = createClient();
    await supabase.from("scheduling_settings").upsert({
      business_id: businessId,
      unavailable_days: unavailableDays,
      day_hours: dayHours,
    }, { onConflict: "business_id" });
    setSavingSchedule(false);
    setScheduleSaved(true);
    setTimeout(() => setScheduleSaved(false), 2000);
  }

  async function saveCrewSize() {
    if (!businessId) return;
    setSavingCrew(true);
    const supabase = createClient();
    await supabase.from("business_crew_settings").upsert({
      business_id: businessId,
      crew_size: crewSize,
    }, { onConflict: "business_id" });
    setSavingCrew(false);
    setCrewSaved(true);
    setTimeout(() => setCrewSaved(false), 2000);
  }

  function toggleDay(day: number) {
    setUnavailableDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  }

  function setDayHour(day: number, field: "from" | "until", value: string) {
    setDayHours((prev) => ({ ...prev, [day]: { ...(prev[day] ?? { from: "08:00", until: "17:00" }), [field]: value } }));
  }

  function openCfModal(field?: CustomField) {
    if (field) {
      setCfEditing(field);
      setCfForm({ label: field.label, field_type: field.field_type, options: field.options ?? [], required: field.required });
      setCfOptionsInput((field.options ?? []).join(", "));
    } else {
      setCfEditing(null);
      setCfForm({ label: "", field_type: "text", options: [], required: false });
      setCfOptionsInput("");
    }
    setCfModalOpen(true);
  }

  async function saveCf() {
    if (!businessId || !cfForm.label.trim()) return;
    setCfSaving(true);
    const supabase = createClient();
    const options = cfForm.field_type === "select"
      ? cfOptionsInput.split(",").map((s) => s.trim()).filter(Boolean)
      : [];
    if (cfEditing) {
      const { data } = await supabase.from("canvassing_custom_fields")
        .update({ label: cfForm.label.trim(), field_type: cfForm.field_type, options, required: cfForm.required })
        .eq("id", cfEditing.id).select("*").single();
      if (data) setCustomFields((prev) => prev.map((f) => f.id === cfEditing.id ? data as unknown as CustomField : f));
    } else {
      const position = customFields.length;
      const { data } = await supabase.from("canvassing_custom_fields")
        .insert({ business_id: businessId, label: cfForm.label.trim(), field_type: cfForm.field_type, options, required: cfForm.required, position })
        .select("*").single();
      if (data) setCustomFields((prev) => [...prev, data as unknown as CustomField]);
    }
    setCfSaving(false);
    setCfModalOpen(false);
  }

  async function deleteCf(id: string) {
    setCfDeleting(id);
    const supabase = createClient();
    await supabase.from("canvassing_custom_fields").delete().eq("id", id);
    setCustomFields((prev) => prev.filter((f) => f.id !== id));
    setCfDeleting(null);
  }

  async function moveCf(id: string, dir: -1 | 1) {
    const idx = customFields.findIndex((f) => f.id === id);
    if (idx < 0) return;
    const next = idx + dir;
    if (next < 0 || next >= customFields.length) return;
    const updated = [...customFields];
    [updated[idx], updated[next]] = [updated[next], updated[idx]];
    setCustomFields(updated);
    const supabase = createClient();
    await Promise.all([
      supabase.from("canvassing_custom_fields").update({ position: next }).eq("id", updated[idx].id),
      supabase.from("canvassing_custom_fields").update({ position: idx }).eq("id", updated[next].id),
    ]);
  }

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  const hasPaymentMethods = venmoUsername || cashappTag || checkPayableTo;
  const hasContactInfo = contactEmail || contactPhone;

  return (
    <div className="flex flex-col gap-4 px-4 lg:px-8 py-4 max-w-xl mx-auto lg:max-w-2xl pb-32 lg:pb-8">
      <div className="flex flex-col gap-0.5 mb-1">
        <h1 className="text-xl font-extrabold tracking-tight text-foreground">Settings</h1>
        <p className="text-xs text-muted-foreground">Manage your business profile and account.</p>
      </div>

      <div className="flex flex-col gap-5">

        {/* Business Profile */}
        <section className="flex flex-col gap-3">
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Business Profile</h3>
          <Card className="rounded-2xl border-border shadow-sm overflow-hidden">
            <div className="p-4 flex flex-col gap-4">
              {editingName ? (
                <div className="flex items-center gap-3">
                  <div className="size-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary border-2 border-primary/20 shrink-0">
                    <span className="material-symbols-outlined text-[32px]">store</span>
                  </div>
                  <input
                    autoFocus
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && saveName()}
                    className="flex-1 h-11 rounded-xl border border-border bg-transparent px-3 text-sm font-bold focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                  <button onClick={saveName} disabled={saving} className="text-sm font-bold text-[var(--color-status-completed)] shrink-0 disabled:opacity-50">
                    {saving ? "…" : "Save"}
                  </button>
                  <button onClick={() => { setEditingName(false); setNameInput(businessName); }} className="text-sm font-bold text-muted-foreground shrink-0">
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-4">
                  <div className="size-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary border-2 border-primary/20 shrink-0">
                    <span className="material-symbols-outlined text-[32px]">store</span>
                  </div>
                  <div className="flex flex-col flex-1">
                    <h4 className="font-bold text-foreground">{loading ? "Loading…" : businessName}</h4>
                    <span className="text-sm text-muted-foreground">{userEmail}</span>
                  </div>
                  <button onClick={() => setEditingName(true)} className="text-primary text-sm font-bold shrink-0">Edit</button>
                </div>
              )}
            </div>
          </Card>
        </section>

        {/* Employee Access Code */}
        <section className="flex flex-col gap-3">
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Employee Access</h3>
          <Card className="rounded-2xl border-border shadow-sm overflow-hidden">
            <div className="p-4 flex flex-col gap-4">
              <div className="flex items-start gap-3">
                <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="material-symbols-outlined text-[20px] text-primary">badge</span>
                </div>
                <div className="flex flex-col flex-1 gap-0.5">
                  <span className="font-bold text-sm text-foreground">Team Access Code</span>
                  <span className="text-xs text-muted-foreground">
                    Share this code with employees so they can join your team from the login screen.
                  </span>
                </div>
              </div>

              {accessCode ? (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between bg-muted/50 rounded-xl px-4 py-3">
                    <span className="font-mono font-extrabold text-2xl tracking-[0.3em] text-foreground">
                      {accessCode}
                    </span>
                    <button
                      onClick={copyAccessCode}
                      className={`text-xs font-bold transition-colors ${codeCopied ? "text-[var(--color-status-completed)]" : "text-primary"}`}
                    >
                      {codeCopied ? "Copied!" : "Copy"}
                    </button>
                  </div>
                  <button
                    onClick={regenerateAccessCode}
                    disabled={generatingCode}
                    className="text-xs font-bold text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                  >
                    {generatingCode ? "Generating…" : "↻ Generate new code"}
                  </button>
                </div>
              ) : (
                <button
                  onClick={regenerateAccessCode}
                  disabled={generatingCode}
                  className="w-full py-3 rounded-xl bg-primary text-white font-bold text-sm hover:bg-primary/90 active:scale-95 transition-all disabled:opacity-50"
                >
                  {generatingCode ? "Generating…" : "Generate Access Code"}
                </button>
              )}
            </div>
          </Card>
        </section>

        {/* Contact Info */}
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Contact Info</h3>
            {!editingContact && (
              <button onClick={() => setEditingContact(true)} className="text-xs font-bold text-primary">
                {hasContactInfo ? "Edit" : "Set up"}
              </button>
            )}
          </div>

          {editingContact ? (
            <Card className="rounded-2xl border-border shadow-sm overflow-hidden">
              <div className="p-4 flex flex-col gap-4">
                <p className="text-xs text-muted-foreground">
                  Shown on invoices so clients can reach you with questions.
                </p>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[14px]">mail</span>
                    Business Email
                  </label>
                  <input
                    type="email"
                    placeholder="you@yourbusiness.com"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring/30"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[14px]">call</span>
                    Business Phone
                  </label>
                  <input
                    type="tel"
                    placeholder="(555) 000-0000"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring/30"
                  />
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => setEditingContact(false)}
                    className="flex-1 py-2.5 rounded-xl border border-border text-sm font-bold text-muted-foreground hover:bg-muted/50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveContactInfo}
                    disabled={savingContact}
                    className="flex-[2] py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 disabled:opacity-50 transition-colors"
                  >
                    {savingContact ? "Saving…" : "Save Contact Info"}
                  </button>
                </div>
              </div>
            </Card>
          ) : (
            <Card className="rounded-2xl border-border shadow-sm overflow-hidden">
              {!hasContactInfo ? (
                <button
                  onClick={() => setEditingContact(true)}
                  className="w-full p-4 flex items-center gap-3 hover:bg-muted/30 transition-colors"
                >
                  <div className="size-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground shrink-0">
                    <span className="material-symbols-outlined text-[20px]">contact_support</span>
                  </div>
                  <div className="flex flex-col items-start flex-1">
                    <span className="font-bold text-sm text-foreground">Add contact info</span>
                    <span className="text-xs text-muted-foreground">Email & phone shown on invoices</span>
                  </div>
                  <span className="material-symbols-outlined text-muted-foreground">chevron_right</span>
                </button>
              ) : (
                <div className="flex flex-col divide-y divide-border/50">
                  {contactEmail && (
                    <div className="p-4 flex items-center gap-3">
                      <div className="size-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-[20px] text-muted-foreground">mail</span>
                      </div>
                      <div className="flex flex-col flex-1">
                        <span className="font-bold text-sm text-foreground">Email</span>
                        <span className="text-xs text-muted-foreground">{contactEmail}</span>
                      </div>
                    </div>
                  )}
                  {contactPhone && (
                    <div className="p-4 flex items-center gap-3">
                      <div className="size-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-[20px] text-muted-foreground">call</span>
                      </div>
                      <div className="flex flex-col flex-1">
                        <span className="font-bold text-sm text-foreground">Phone</span>
                        <span className="text-xs text-muted-foreground">{contactPhone}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </Card>
          )}
        </section>

        {/* Payment Methods */}
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Payment Methods</h3>
            {!editingPayments && (
              <button onClick={() => setEditingPayments(true)} className="text-xs font-bold text-primary">
                {hasPaymentMethods ? "Edit" : "Set up"}
              </button>
            )}
          </div>

          {editingPayments ? (
            <Card className="rounded-2xl border-border shadow-sm overflow-hidden">
              <div className="p-4 flex flex-col gap-4">
                <p className="text-xs text-muted-foreground">
                  These will appear on invoices so clients know how to pay you.
                </p>

                {/* Venmo */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[14px]">phone_iphone</span>
                    Venmo Username
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground font-bold text-sm">@</span>
                    <input
                      type="text"
                      placeholder="yourvenmo"
                      value={venmoUsername}
                      onChange={(e) => setVenmoUsername(e.target.value.replace(/^@/, ""))}
                      className="w-full rounded-xl border border-border bg-card pl-8 pr-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring/30"
                    />
                  </div>
                </div>

                {/* CashApp */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[14px]">phone_iphone</span>
                    Cash App Tag
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground font-bold text-sm">$</span>
                    <input
                      type="text"
                      placeholder="yourcashtag"
                      value={cashappTag}
                      onChange={(e) => setCashappTag(e.target.value.replace(/^\$/, ""))}
                      className="w-full rounded-xl border border-border bg-card pl-8 pr-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring/30"
                    />
                  </div>
                </div>

                {/* Check */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[14px]">receipt</span>
                    Check Payable To
                  </label>
                  <input
                    type="text"
                    placeholder={businessName || "Your Business Name"}
                    value={checkPayableTo}
                    onChange={(e) => setCheckPayableTo(e.target.value)}
                    className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring/30"
                  />
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => setEditingPayments(false)}
                    className="flex-1 py-2.5 rounded-xl border border-border text-sm font-bold text-muted-foreground hover:bg-muted/50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={savePaymentMethods}
                    disabled={savingPayments}
                    className="flex-[2] py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 disabled:opacity-50 transition-colors"
                  >
                    {savingPayments ? "Saving…" : "Save Payment Methods"}
                  </button>
                </div>
              </div>
            </Card>
          ) : (
            <Card className="rounded-2xl border-border shadow-sm overflow-hidden">
              {!hasPaymentMethods ? (
                <button
                  onClick={() => setEditingPayments(true)}
                  className="w-full p-4 flex items-center gap-3 hover:bg-muted/30 transition-colors"
                >
                  <div className="size-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground shrink-0">
                    <span className="material-symbols-outlined text-[20px]">payments</span>
                  </div>
                  <div className="flex flex-col items-start flex-1">
                    <span className="font-bold text-sm text-foreground">Set up payment methods</span>
                    <span className="text-xs text-muted-foreground">Add Venmo, CashApp, or check info for invoices</span>
                  </div>
                  <span className="material-symbols-outlined text-muted-foreground">chevron_right</span>
                </button>
              ) : (
                <div className="flex flex-col divide-y divide-border/50">
                  {venmoUsername && (
                    <div className="p-4 flex items-center gap-3">
                      <div className="size-10 rounded-full bg-[#008CFF]/10 flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-[20px] text-[#008CFF]">phone_iphone</span>
                      </div>
                      <div className="flex flex-col flex-1">
                        <span className="font-bold text-sm text-foreground">Venmo</span>
                        <span className="text-xs text-muted-foreground">@{venmoUsername}</span>
                      </div>
                    </div>
                  )}
                  {cashappTag && (
                    <div className="p-4 flex items-center gap-3">
                      <div className="size-10 rounded-full bg-[#00C244]/10 flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-[20px] text-[#00C244]">phone_iphone</span>
                      </div>
                      <div className="flex flex-col flex-1">
                        <span className="font-bold text-sm text-foreground">Cash App</span>
                        <span className="text-xs text-muted-foreground">${cashappTag}</span>
                      </div>
                    </div>
                  )}
                  {checkPayableTo && (
                    <div className="p-4 flex items-center gap-3">
                      <div className="size-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-[20px] text-muted-foreground">receipt</span>
                      </div>
                      <div className="flex flex-col flex-1">
                        <span className="font-bold text-sm text-foreground">Check</span>
                        <span className="text-xs text-muted-foreground">Payable to: {checkPayableTo}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </Card>
          )}
        </section>

        {/* Financial & Billing */}
        <section className="flex flex-col gap-3">
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Financial & Billing</h3>
          <Card className="rounded-2xl border-border shadow-sm flex flex-col divide-y divide-border/50">
            {/* Stripe Connect — real status */}
            {connectBanner === "success" && (
              <div className="px-4 py-2.5 bg-green-50 border-b border-green-100 text-xs text-green-700 font-medium">
                Stripe account connected successfully.
              </div>
            )}
            {connectBanner === "error" && (
              <div className="px-4 py-2.5 bg-red-50 border-b border-red-100 text-xs text-red-700 font-medium">
                Something went wrong connecting Stripe. Please try again.
              </div>
            )}
            {connectBanner === "refresh" && (
              <div className="px-4 py-2.5 bg-amber-50 border-b border-amber-100 text-xs text-amber-700 font-medium">
                Your Stripe setup link expired. Click &quot;Resume Setup&quot; to continue.
              </div>
            )}
            <div className="p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="size-10 shrink-0 rounded-full bg-[#635bff]/10 flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-[#635bff]">
                    <path d="M4.5 3.75a3 3 0 00-3 3v.75h21v-.75a3 3 0 00-3-3h-15z" />
                    <path fillRule="evenodd" d="M22.5 9.75h-21v7.5a3 3 0 003 3h15a3 3 0 003-3v-7.5zm-18 3.75a.75.75 0 01.75-.75h6a.75.75 0 010 1.5h-6a.75.75 0 01-.75-.75zm.75 2.25a.75.75 0 000 1.5h3a.75.75 0 000-1.5h-3z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="font-bold text-sm text-foreground">Stripe Connect</span>
                  <span className="text-xs text-muted-foreground truncate">
                    {connectStatus === "active"
                      ? `Connected · ${connectType === "express" ? "Express account" : "Standard account"}`
                      : connectStatus === "pending"
                      ? "Finish setup to accept card payments"
                      : "Connect Stripe to accept card payments"}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {connectStatus === "active" && (
                  <>
                    <span className="text-xs font-bold text-green-700 bg-green-100 px-2.5 py-1 rounded-full">Connected</span>
                    <button
                      onClick={disconnectStripe}
                      disabled={disconnecting}
                      className="text-xs font-bold text-destructive hover:opacity-80 disabled:opacity-50"
                    >
                      {disconnecting ? "…" : "Disconnect"}
                    </button>
                  </>
                )}
                {connectStatus === "pending" && (
                  <>
                    <span className="text-xs font-bold text-amber-700 bg-amber-100 px-2.5 py-1 rounded-full">Pending</span>
                    <button
                      onClick={connectExpress}
                      disabled={connectingExpress}
                      className="text-xs font-bold text-primary hover:opacity-80 disabled:opacity-50"
                    >
                      {connectingExpress ? "…" : "Resume Setup"}
                    </button>
                  </>
                )}
                {connectStatus === "not_connected" && (
                  <div className="flex flex-col items-end gap-1">
                    <button
                      onClick={connectExpress}
                      disabled={connectingExpress}
                      className="text-xs font-bold text-primary hover:opacity-80 disabled:opacity-50"
                    >
                      {connectingExpress ? "Redirecting…" : "New Stripe account"}
                    </button>
                    <button
                      onClick={connectStandard}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      Use existing account
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* HustleBricks Subscription */}
            {stripeSubscriptionId && (
              <div className="p-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="size-10 shrink-0 rounded-full bg-muted flex items-center justify-center text-foreground">
                    <span className="material-symbols-outlined text-[20px]">subscriptions</span>
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="font-bold text-sm text-foreground capitalize">
                      {plan ? `${plan.charAt(0).toUpperCase() + plan.slice(1)} Plan` : "HustleBricks Subscription"}
                    </span>
                    <span className="text-xs text-muted-foreground capitalize">{subscriptionStatus ?? "active"}</span>
                  </div>
                </div>
                <button
                  onClick={openSubscriptionPortal}
                  disabled={openingPortal}
                  className="text-xs font-bold text-primary hover:opacity-80 disabled:opacity-50 shrink-0"
                >
                  {openingPortal ? "Opening…" : "Manage →"}
                </button>
              </div>
            )}
            {/* Tax Settings */}
            <div className="flex flex-col">
              <div className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-full bg-muted flex items-center justify-center text-foreground">
                    <span className="material-symbols-outlined text-[20px]">request_quote</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="font-bold text-sm text-foreground">Tax Settings</span>
                    <span className="text-xs text-muted-foreground">Default Rate: {taxRate}%</span>
                  </div>
                </div>
                <button onClick={() => setEditingTax((v) => !v)} className="text-xs font-bold text-primary">
                  {editingTax ? "Cancel" : "Edit"}
                </button>
              </div>
              {editingTax && (
                <div className="px-4 pb-4 flex gap-2 items-center">
                  <div className="relative flex-1">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={taxRate}
                      onChange={(e) => setTaxRate(e.target.value)}
                      className="w-full rounded-xl border border-border bg-card px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-bold">%</span>
                  </div>
                  <button
                    onClick={saveTax}
                    disabled={savingTax}
                    className="px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 disabled:opacity-50"
                  >
                    {savingTax ? "Saving…" : "Save"}
                  </button>
                </div>
              )}
            </div>

            {/* Sales Commissions */}
            <div className="flex flex-col border-t border-border/50">
              <div className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-full bg-muted flex items-center justify-center text-foreground">
                    <span className="material-symbols-outlined text-[20px]">percent</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="font-bold text-sm text-foreground">Sales Commissions</span>
                    <span className="text-xs text-muted-foreground">Default Rate: {commissionRate}%</span>
                  </div>
                </div>
                <button onClick={() => setEditingCommission((v) => !v)} className="text-xs font-bold text-primary">
                  {editingCommission ? "Cancel" : "Edit"}
                </button>
              </div>
              {editingCommission && (
                <div className="px-4 pb-4 flex gap-2 items-center">
                  <div className="relative flex-1">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={commissionRate}
                      onChange={(e) => setCommissionRate(e.target.value)}
                      className="w-full rounded-xl border border-border bg-card px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-bold">%</span>
                  </div>
                  <button
                    onClick={saveCommission}
                    disabled={savingCommission}
                    className="px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 disabled:opacity-50"
                  >
                    {savingCommission ? "Saving…" : "Save"}
                  </button>
                </div>
              )}
            </div>
          </Card>
        </section>

        {/* Automations */}
        <section className="flex flex-col gap-3">
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Automations</h3>
          <Card className="rounded-2xl border-border shadow-sm flex flex-col overflow-hidden">
            {([
              { label: "Automated Reminders", sub: "Send SMS 24hrs before job", key: "sms_reminders_enabled" as const, value: smsReminders },
              { label: "Smart Scheduling", sub: "Optimize routes using Maps API", key: "smart_scheduling_enabled" as const, value: smartScheduling },
            ]).map((item, i) => (
              <div key={item.key}>
                {i > 0 && <Separator className="bg-border/50" />}
                <div className="p-4 flex items-center justify-between">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-bold text-sm text-foreground">{item.label}</span>
                    <span className="text-xs text-muted-foreground">{item.sub}</span>
                  </div>
                  <button
                    onClick={() => toggleAutomation(item.key, item.value)}
                    disabled={savingAutomation === item.key}
                    className={`w-12 h-6 rounded-full relative shadow-inner transition-colors duration-200 disabled:opacity-60 ${item.value ? "bg-primary" : "bg-muted"}`}
                  >
                    <div className={`size-5 bg-white rounded-full absolute top-0.5 shadow-sm transition-transform duration-200 ${item.value ? "translate-x-6" : "translate-x-0.5"}`} />
                  </button>
                </div>
              </div>
            ))}
          </Card>
        </section>

        {/* Scheduling Availability */}
        {(() => {
          const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
          const HOURS = Array.from({ length: 14 }, (_, i) => `${String(i + 6).padStart(2, "0")}:00`); // 06:00–19:00
          return (
            <section className="flex flex-col gap-3">
              <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Scheduling</h3>
              <Card className="rounded-2xl border-border shadow-sm overflow-hidden">
                <div className="p-4 flex flex-col gap-1">
                  <p className="text-xs text-muted-foreground mb-3">
                    Set which days and hours clients can request appointments from your booking link.
                  </p>
                  {DAY_LABELS.map((label, day) => {
                    const isAvailable = !unavailableDays.includes(day);
                    const hours = dayHours[day] ?? { from: "08:00", until: "17:00" };
                    return (
                      <div key={day} className="flex flex-col gap-2 py-2 border-b border-border/40 last:border-0">
                        <div className="flex items-center justify-between">
                          <span className={`text-sm font-bold ${isAvailable ? "text-foreground" : "text-muted-foreground"}`}>{label}</span>
                          <button
                            onClick={() => toggleDay(day)}
                            className={`w-10 h-5 rounded-full relative shadow-inner transition-colors duration-200 ${isAvailable ? "bg-primary" : "bg-muted"}`}
                          >
                            <div className={`size-4 bg-white rounded-full absolute top-0.5 shadow-sm transition-transform duration-200 ${isAvailable ? "translate-x-5" : "translate-x-0.5"}`} />
                          </button>
                        </div>
                        {isAvailable && (
                          <div className="flex items-center gap-2">
                            <select
                              value={hours.from}
                              onChange={(e) => setDayHour(day, "from", e.target.value)}
                              className="flex-1 rounded-lg border border-border bg-muted/30 px-2 py-1.5 text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-ring/40"
                            >
                              {HOURS.map((h) => <option key={h} value={h}>{h}</option>)}
                            </select>
                            <span className="text-xs text-muted-foreground">to</span>
                            <select
                              value={hours.until}
                              onChange={(e) => setDayHour(day, "until", e.target.value)}
                              className="flex-1 rounded-lg border border-border bg-muted/30 px-2 py-1.5 text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-ring/40"
                            >
                              {HOURS.map((h) => <option key={h} value={h}>{h}</option>)}
                            </select>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <button
                    onClick={saveScheduling}
                    disabled={savingSchedule}
                    className="mt-3 w-full py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 disabled:opacity-50 transition-colors"
                  >
                    {scheduleSaved ? "Saved!" : savingSchedule ? "Saving…" : "Save Schedule"}
                  </button>

                  {/* Crew size */}
                  <div className="mt-2 pt-4 border-t border-border/50 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-foreground">Crew Size</p>
                        <p className="text-xs text-muted-foreground">How many employees are needed per job</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setCrewSize((n) => Math.max(1, n - 1))}
                          className="flex size-8 items-center justify-center rounded-full border border-border bg-muted/40 text-foreground hover:bg-muted transition-colors"
                        >
                          <span className="material-symbols-outlined text-[18px]">remove</span>
                        </button>
                        <span className="w-8 text-center text-lg font-bold tabular-nums">{crewSize}</span>
                        <button
                          onClick={() => setCrewSize((n) => n + 1)}
                          className="flex size-8 items-center justify-center rounded-full border border-border bg-muted/40 text-foreground hover:bg-muted transition-colors"
                        >
                          <span className="material-symbols-outlined text-[18px]">add</span>
                        </button>
                      </div>
                    </div>
                    <button
                      onClick={saveCrewSize}
                      disabled={savingCrew}
                      className="w-full py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 disabled:opacity-50 transition-colors"
                    >
                      {crewSaved ? "Saved!" : savingCrew ? "Saving…" : "Save Crew Size"}
                    </button>
                  </div>
                </div>
              </Card>
            </section>
          );
        })()}

        {/* Share Your Form */}
        {businessId && (() => {
          const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin;
          const formUrl = `${appUrl}/quote-request/${businessId}`;
          const iframeCode = `<iframe\n  src="${formUrl}"\n  width="100%"\n  height="750"\n  style="border:none;border-radius:16px;display:block;"\n  loading="lazy"\n></iframe>`;
          const buttonCode = `<a href="${formUrl}" style="display:inline-block;background:#111418;color:white;padding:16px 32px;border-radius:12px;font-weight:700;font-size:16px;text-decoration:none;">Get a Free Quote</a>`;

          function copy(text: string, set: (v: boolean) => void) {
            navigator.clipboard.writeText(text);
            set(true);
            setTimeout(() => set(false), 2000);
          }

          return (
            <section className="flex flex-col gap-3">
              <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Share Your Form</h3>
              <Card className="rounded-2xl border-border shadow-sm overflow-hidden divide-y divide-border">

                {/* Direct link */}
                <div className="p-4 flex flex-col gap-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Direct Link</p>
                  <p className="text-xs text-muted-foreground">Send clients directly to your quote request form.</p>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex-1 rounded-xl border border-border bg-muted/40 px-3 py-2.5 text-xs text-foreground font-mono truncate select-all">
                      {formUrl}
                    </div>
                    <button
                      onClick={() => copy(formUrl, setCopiedLink)}
                      className={`shrink-0 px-4 py-2.5 rounded-xl text-xs font-bold transition-colors ${copiedLink ? "bg-green-500 text-white" : "bg-primary text-white hover:bg-primary/90"}`}
                    >
                      {copiedLink ? "Copied!" : "Copy"}
                    </button>
                  </div>
                </div>

                {/* Embed iframe */}
                <div className="p-4 flex flex-col gap-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Embed on Your Website</p>
                  <p className="text-xs text-muted-foreground">Paste this code into your website to show the form inline.</p>
                  <div className="flex items-start gap-2 mt-1">
                    <pre className="flex-1 rounded-xl border border-border bg-muted/40 px-3 py-2.5 text-xs text-foreground font-mono whitespace-pre-wrap break-all overflow-x-auto">
                      {iframeCode}
                    </pre>
                    <button
                      onClick={() => copy(iframeCode, setCopiedIframe)}
                      className={`shrink-0 px-4 py-2.5 rounded-xl text-xs font-bold transition-colors ${copiedIframe ? "bg-green-500 text-white" : "bg-primary text-white hover:bg-primary/90"}`}
                    >
                      {copiedIframe ? "Copied!" : "Copy"}
                    </button>
                  </div>
                </div>

                {/* Button snippet */}
                <div className="p-4 flex flex-col gap-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Button Snippet</p>
                  <p className="text-xs text-muted-foreground">Add a &quot;Get a Free Quote&quot; button to any page.</p>
                  <div className="flex items-start gap-2 mt-1">
                    <pre className="flex-1 rounded-xl border border-border bg-muted/40 px-3 py-2.5 text-xs text-foreground font-mono whitespace-pre-wrap break-all overflow-x-auto">
                      {buttonCode}
                    </pre>
                    <button
                      onClick={() => copy(buttonCode, setCopiedButton)}
                      className={`shrink-0 px-4 py-2.5 rounded-xl text-xs font-bold transition-colors ${copiedButton ? "bg-green-500 text-white" : "bg-primary text-white hover:bg-primary/90"}`}
                    >
                      {copiedButton ? "Copied!" : "Copy"}
                    </button>
                  </div>
                </div>

              </Card>
            </section>
          );
        })()}

        {/* Account */}
        <section className="flex flex-col gap-3">
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Canvassing Fields</h3>
          <Card className="rounded-2xl border-border shadow-sm overflow-hidden">
            <div className="p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-foreground">Custom Booking Fields</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Fields your reps fill in when booking a homeowner</p>
                </div>
                <button onClick={() => openCfModal()} className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold active:scale-95 transition-all">
                  <span className="material-symbols-outlined text-[14px]">add</span> Add
                </button>
              </div>
              {customFields.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">No custom fields yet. Add fields like &quot;Number of Windows&quot; or &quot;Service Type&quot;.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {customFields.map((f, i) => (
                    <div key={f.id} className="flex items-center gap-2 p-2.5 rounded-xl bg-muted/40 border border-border/50">
                      <div className="flex flex-col gap-0.5 mr-1">
                        <button onClick={() => moveCf(f.id, -1)} disabled={i === 0} className="text-muted-foreground hover:text-foreground disabled:opacity-20 transition-colors leading-none">
                          <span className="material-symbols-outlined text-[14px]">arrow_drop_up</span>
                        </button>
                        <button onClick={() => moveCf(f.id, 1)} disabled={i === customFields.length - 1} className="text-muted-foreground hover:text-foreground disabled:opacity-20 transition-colors leading-none">
                          <span className="material-symbols-outlined text-[14px]">arrow_drop_down</span>
                        </button>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{f.label}{f.required && <span className="text-red-500 ml-0.5">*</span>}</p>
                        <p className="text-[11px] text-muted-foreground capitalize">
                          {f.field_type === "boolean" ? "Yes / No" : f.field_type === "select" ? `Dropdown: ${(f.options ?? []).join(", ")}` : f.field_type}
                        </p>
                      </div>
                      <button onClick={() => openCfModal(f)} className="size-7 flex items-center justify-center rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                        <span className="material-symbols-outlined text-[16px]">edit</span>
                      </button>
                      <button onClick={() => deleteCf(f.id)} disabled={cfDeleting === f.id} className="size-7 flex items-center justify-center rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors text-muted-foreground hover:text-red-500 disabled:opacity-50">
                        <span className="material-symbols-outlined text-[16px]">{cfDeleting === f.id ? "hourglass_empty" : "delete"}</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>

          {/* Custom field modal */}
          {cfModalOpen && (
            <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center bg-black/40 backdrop-blur-sm px-4" onClick={() => setCfModalOpen(false)}>
              <div className="w-full max-w-sm bg-background rounded-2xl shadow-2xl p-5 flex flex-col gap-4" onClick={(e) => e.stopPropagation()}>
                <p className="font-bold text-base text-foreground">{cfEditing ? "Edit Field" : "Add Custom Field"}</p>
                <div className="flex flex-col gap-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Field Label *</label>
                    <input value={cfForm.label} onChange={(e) => setCfForm((f) => ({ ...f, label: e.target.value }))} placeholder="e.g. Number of Windows" className="mt-1 w-full rounded-xl border border-border bg-muted/40 px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/40" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Field Type</label>
                    <select value={cfForm.field_type} onChange={(e) => setCfForm((f) => ({ ...f, field_type: e.target.value as CustomField["field_type"] }))} className="mt-1 w-full rounded-xl border border-border bg-muted/40 px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/40">
                      <option value="text">Text</option>
                      <option value="number">Number</option>
                      <option value="boolean">Yes / No</option>
                      <option value="select">Dropdown</option>
                    </select>
                  </div>
                  {cfForm.field_type === "select" && (
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Options (comma-separated)</label>
                      <input value={cfOptionsInput} onChange={(e) => setCfOptionsInput(e.target.value)} placeholder="e.g. Exterior, Interior, Both, Screens" className="mt-1 w-full rounded-xl border border-border bg-muted/40 px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/40" />
                    </div>
                  )}
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={cfForm.required} onChange={(e) => setCfForm((f) => ({ ...f, required: e.target.checked }))} className="rounded" />
                    <span className="text-sm text-foreground">Required field</span>
                  </label>
                </div>
                <div className="flex gap-2 mt-1">
                  <button onClick={() => setCfModalOpen(false)} className="flex-1 py-3 rounded-2xl border border-border text-muted-foreground font-bold text-sm">Cancel</button>
                  <button onClick={saveCf} disabled={cfSaving || !cfForm.label.trim()} className="flex-[2] py-3 rounded-2xl bg-primary text-primary-foreground font-bold text-sm disabled:opacity-50">{cfSaving ? "Saving…" : cfEditing ? "Save Changes" : "Add Field"}</button>
                </div>
              </div>
            </div>
          )}

          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Account</h3>
          <Card className="rounded-2xl border-border shadow-sm overflow-hidden">
            <button
              onClick={signOut}
              className="w-full p-4 flex items-center gap-3 hover:bg-muted/50 transition-colors"
            >
              <div className="size-10 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 shrink-0">
                <span className="material-symbols-outlined text-[20px]">logout</span>
              </div>
              <div className="flex flex-col items-start">
                <span className="font-bold text-sm text-red-500">Sign Out</span>
                <span className="text-xs text-muted-foreground">You&apos;ll need to log back in</span>
              </div>
              <span className="material-symbols-outlined text-muted-foreground ml-auto">chevron_right</span>
            </button>
          </Card>
        </section>

      </div>
    </div>
  );
}
