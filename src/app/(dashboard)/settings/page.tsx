"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserEmail(user.email ?? null);

      const { data: business } = await supabase
        .from("businesses")
        .select("id, name, venmo_username, cashapp_tag, check_payable_to, contact_email, contact_phone, tax_rate, commission_rate, sms_reminders_enabled, smart_scheduling_enabled, employee_access_code")
        .eq("owner_id", user.id)
        .single();

      if (!business) {
        router.replace("/");
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

        const { data: schedSettings } = await supabase
          .from("scheduling_settings")
          .select("unavailable_days, day_hours")
          .eq("business_id", business.id)
          .maybeSingle();
        if (schedSettings) {
          setUnavailableDays((schedSettings as { unavailable_days: number[] }).unavailable_days ?? [0, 6]);
          setDayHours((schedSettings as { day_hours: Record<number, { from: string; until: string }> }).day_hours ?? {});
        }
      }
      setLoading(false);
    }
    load();
  }, []);

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

  function toggleDay(day: number) {
    setUnavailableDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  }

  function setDayHour(day: number, field: "from" | "until", value: string) {
    setDayHours((prev) => ({ ...prev, [day]: { ...(prev[day] ?? { from: "08:00", until: "17:00" }), [field]: value } }));
  }

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const hasPaymentMethods = venmoUsername || cashappTag || checkPayableTo;
  const hasContactInfo = contactEmail || contactPhone;

  return (
    <div className="flex flex-col gap-6 px-4 lg:px-8 py-6 max-w-xl mx-auto lg:max-w-2xl pb-40 lg:pb-8">
      <div className="flex flex-col gap-1 mb-2">
        <h1 className="text-2xl font-extrabold tracking-tight text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground">Manage your business profile and account.</p>
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
            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-full bg-[#635bff]/10 flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-[#635bff]">
                    <path d="M4.5 3.75a3 3 0 00-3 3v.75h21v-.75a3 3 0 00-3-3h-15z" />
                    <path fillRule="evenodd" d="M22.5 9.75h-21v7.5a3 3 0 003 3h15a3 3 0 003-3v-7.5zm-18 3.75a.75.75 0 01.75-.75h6a.75.75 0 010 1.5h-6a.75.75 0 01-.75-.75zm.75 2.25a.75.75 0 000 1.5h3a.75.75 0 000-1.5h-3z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="flex flex-col">
                  <span className="font-bold text-sm text-foreground">Stripe Integration</span>
                  <span className="text-xs text-muted-foreground">Card payments enabled on invoices</span>
                </div>
              </div>
              <span className="text-xs font-bold text-[var(--color-status-completed)] bg-status-completed/10 px-2.5 py-1 rounded-full">Active</span>
            </div>
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
                </div>
              </Card>
            </section>
          );
        })()}

        {/* Account */}
        <section className="flex flex-col gap-3">
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
