"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { createClient } from "@/lib/supabase/client";
import { SERVICE_TYPES, MessageType, DEFAULT_TEMPLATES, interpolateTemplate as _interpolate } from "@/lib/messageTemplates";
import { BUSINESS_TYPE_OPTIONS } from "@/lib/businessTypes";
import CityAutocomplete from "@/components/CityAutocomplete";

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

  // Service areas (weather alerts)
  const [serviceAreas, setServiceAreas] = useState<string[]>([]);

  // Logo
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  // Contact info fields
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [editingContact, setEditingContact] = useState(false);
  const [savingContact, setSavingContact] = useState(false);

  // Address & website
  const [businessAddress, setBusinessAddress] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [editingAddressWeb, setEditingAddressWeb] = useState(false);
  const [savingAddressWeb, setSavingAddressWeb] = useState(false);

  // Invoice message
  const [invoiceMessage, setInvoiceMessage] = useState("");
  const [editingInvoiceMessage, setEditingInvoiceMessage] = useState(false);
  const [savingInvoiceMessage, setSavingInvoiceMessage] = useState(false);

  // Terms & conditions
  const [termsAndConditions, setTermsAndConditions] = useState("");
  const [editingTerms, setEditingTerms] = useState(false);
  const [savingTerms, setSavingTerms] = useState(false);

  // Business type
  const [businessType, setBusinessType] = useState("");
  const [editingBusinessType, setEditingBusinessType] = useState(false);
  const [savingBusinessType, setSavingBusinessType] = useState(false);
  const [businessTypeOpen, setBusinessTypeOpen] = useState(false);

  // Employee access code
  const [accessCode, setAccessCode] = useState<string | null>(null);
  const [generatingCode, setGeneratingCode] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);

  // Website booking link / slug
  const [slug, setSlug] = useState<string | null>(null);
  const [slugInput, setSlugInput] = useState("");
  const [editingSlug, setEditingSlug] = useState(false);
  const [savingSlug, setSavingSlug] = useState(false);
  const [slugError, setSlugError] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  // Tax & commission
  const [taxRate, setTaxRate] = useState("8.00");
  const [commissionRate, setCommissionRate] = useState("5.00");
  const [mileageRate, setMileageRate] = useState("0.70");
  const [editingTax, setEditingTax] = useState(false);
  const [editingCommission, setEditingCommission] = useState(false);
  const [editingMileage, setEditingMileage] = useState(false);
  const [savingTax, setSavingTax] = useState(false);
  const [savingCommission, setSavingCommission] = useState(false);
  const [savingMileage, setSavingMileage] = useState(false);

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
  const [reviewRequests, setReviewRequests] = useState(false);
  const [leadNotify, setLeadNotify] = useState(false);
  const [followUpEnabled, setFollowUpEnabled] = useState(false);
  const [rebookingEnabled, setRebookingEnabled] = useState(false);
  const [autoInvoiceEnabled, setAutoInvoiceEnabled] = useState(true);
  const [paymentRemindersEnabled, setPaymentRemindersEnabled] = useState(true);
  const [morningBriefingEnabled, setMorningBriefingEnabled] = useState(false);
  const [aiSmsEnabled, setAiSmsEnabled] = useState(false);
  const [savingAutomation, setSavingAutomation] = useState<string | null>(null);

  // Rebooking threshold
  const [rebookingAfterDays, setRebookingAfterDays] = useState("60");
  const [editingRebookingDays, setEditingRebookingDays] = useState(false);
  const [savingRebookingDays, setSavingRebookingDays] = useState(false);

  // Google Review URL
  const [googleReviewUrl, setGoogleReviewUrl] = useState("");
  const [editingReviewUrl, setEditingReviewUrl] = useState(false);
  const [savingReviewUrl, setSavingReviewUrl] = useState(false);

  // Pipeline velocity
  const [staleQuoteDays, setStaleQuoteDays] = useState("7");
  const [editingStaleQuoteDays, setEditingStaleQuoteDays] = useState(false);
  const [savingStaleQuoteDays, setSavingStaleQuoteDays] = useState(false);

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

  // Customer financing (BNPL)
  const [financingEnabled, setFinancingEnabled] = useState(false);
  const [financingPartner, setFinancingPartner] = useState("");
  const [financingUrl, setFinancingUrl] = useState("");
  const [financingMinAmount, setFinancingMinAmount] = useState("500");
  const [editingFinancing, setEditingFinancing] = useState(false);
  const [savingFinancing, setSavingFinancing] = useState(false);

  // Message templates
  const [tmplService, setTmplService] = useState<string>(
    () => (typeof window !== "undefined" && localStorage.getItem("tmplService")) || "Air Duct Cleaning"
  );
  const [tmplPostQuote, setTmplPostQuote] = useState("");
  const [tmplConfirmation, setTmplConfirmation] = useState("");
  const [tmplReminder, setTmplReminder] = useState("");
  const [tmplSaving, setTmplSaving] = useState(false);
  const [tmplSaved, setTmplSaved] = useState(false);
  const [tmplLoading, setTmplLoading] = useState(false);
  const [tmplSearch, setTmplSearch] = useState("");
  const [tmplDropdownOpen, setTmplDropdownOpen] = useState(false);
  const [ownerName, setOwnerName] = useState("");

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
      setOwnerName((user.user_metadata?.full_name as string | undefined) ?? user.email?.split("@")[0] ?? "");

      const { data: business, error: businessError } = await supabase
        .from("businesses")
        .select("*")
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
        const bizSlug = (business as unknown as { slug: string | null }).slug ?? null;
        setSlug(bizSlug);
        setSlugInput(bizSlug ?? "");
        setVenmoUsername(business.venmo_username ?? "");
        setCashappTag(business.cashapp_tag ?? "");
        setCheckPayableTo(business.check_payable_to ?? business.name ?? "");
        setContactEmail(business.contact_email ?? "");
        setContactPhone(business.contact_phone ?? "");
        setLogoUrl((business as unknown as { logo_url: string | null }).logo_url ?? null);
        const biz5 = business as unknown as { address: string | null; website_url: string | null; invoice_message: string | null; terms_and_conditions: string | null; business_type: string | null };
        setBusinessAddress(biz5.address ?? "");
        setWebsiteUrl(biz5.website_url ?? "");
        setInvoiceMessage(biz5.invoice_message ?? "");
        setTermsAndConditions(biz5.terms_and_conditions ?? "");
        setBusinessType(biz5.business_type ?? "");
        const areas = (business as unknown as { service_areas: string[] | null }).service_areas ?? [];
        setServiceAreas(areas.length ? areas : (business as unknown as { city: string | null }).city ? [(business as unknown as { city: string }).city] : []);
        setTaxRate(business.tax_rate != null ? String(business.tax_rate) : "8.00");
        setCommissionRate(business.commission_rate != null ? String(business.commission_rate) : "5.00");
        setMileageRate((business as unknown as { mileage_rate_per_mile: number | null }).mileage_rate_per_mile != null ? String((business as unknown as { mileage_rate_per_mile: number }).mileage_rate_per_mile) : "0.70");
        setSmsReminders(business.sms_reminders_enabled ?? false);
        setSmartScheduling(business.smart_scheduling_enabled ?? false);
        const biz2 = business as unknown as {
          review_requests_enabled: boolean | null;
          lead_notify_enabled: boolean | null;
          google_review_url: string | null;
        };
        setReviewRequests(biz2.review_requests_enabled ?? false);
        setLeadNotify(biz2.lead_notify_enabled ?? false);
        setGoogleReviewUrl(biz2.google_review_url ?? "");
        const biz3 = business as unknown as { follow_up_enabled: boolean | null; stale_quote_days: number | null; rebooking_enabled: boolean | null; rebooking_after_days: number | null; auto_invoice_enabled: boolean | null; payment_reminders_enabled: boolean | null; morning_briefing_enabled: boolean | null; ai_sms_enabled: boolean | null };
        setFollowUpEnabled(biz3.follow_up_enabled ?? false);
        setStaleQuoteDays(biz3.stale_quote_days != null ? String(biz3.stale_quote_days) : "7");
        setRebookingEnabled(biz3.rebooking_enabled ?? false);
        setRebookingAfterDays(biz3.rebooking_after_days != null ? String(biz3.rebooking_after_days) : "60");
        setAutoInvoiceEnabled(biz3.auto_invoice_enabled ?? true);
        setPaymentRemindersEnabled(biz3.payment_reminders_enabled ?? true);
        setMorningBriefingEnabled(biz3.morning_briefing_enabled ?? false);
        setAiSmsEnabled(biz3.ai_sms_enabled ?? false);

        // Financing
        const biz4 = business as unknown as { financing_enabled: boolean | null; financing_partner: string | null; financing_url: string | null; financing_min_amount: number | null };
        setFinancingEnabled(biz4.financing_enabled ?? false);
        setFinancingPartner(biz4.financing_partner ?? "");
        setFinancingUrl(biz4.financing_url ?? "");
        setFinancingMinAmount(biz4.financing_min_amount != null ? String(biz4.financing_min_amount) : "500");

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

  // Load templates whenever service or businessId changes
  useEffect(() => {
    if (businessId) loadTemplatesForService(tmplService);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId, tmplService]);

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

  async function handleLogoUpload(file: File) {
    if (!businessId) return;
    setUploadingLogo(true);
    const supabase = createClient();
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${businessId}/logo.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from("business-logos")
      .upload(path, file, { upsert: true });
    if (!uploadError) {
      const { data: { publicUrl } } = supabase.storage.from("business-logos").getPublicUrl(path);
      await supabase.from("businesses").update({ logo_url: publicUrl }).eq("id", businessId);
      setLogoUrl(publicUrl);
    }
    setUploadingLogo(false);
  }

  async function saveFinancing() {
    if (!businessId) return;
    setSavingFinancing(true);
    const supabase = createClient();
    await supabase.from("businesses").update({
      financing_enabled: financingEnabled,
      financing_partner: financingPartner.trim() || null,
      financing_url: financingUrl.trim() || null,
      financing_min_amount: parseInt(financingMinAmount) || 500,
    }).eq("id", businessId);
    setSavingFinancing(false);
    setEditingFinancing(false);
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

  async function saveSlug() {
    if (!businessId) return;
    setSlugError(null);
    const cleaned = slugInput.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
    if (!cleaned) { setSlugError("Enter a valid link name."); return; }
    setSavingSlug(true);
    const supabase = createClient();
    const { error } = await supabase.from("businesses").update({ slug: cleaned } as Record<string, unknown>).eq("id", businessId);
    if (error) {
      setSlugError(error.code === "23505" ? "That link name is already taken. Try another." : error.message);
    } else {
      setSlug(cleaned);
      setSlugInput(cleaned);
      setEditingSlug(false);
    }
    setSavingSlug(false);
  }

  async function copyBookingLink() {
    const link = `${window.location.origin}/book/${slug ?? businessId}`;
    await navigator.clipboard.writeText(link);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
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

  async function addServiceArea(area: string) {
    if (!businessId || !area.trim() || serviceAreas.includes(area.trim())) return;
    const updated = [...serviceAreas, area.trim()];
    const supabase = createClient();
    await supabase.from("businesses").update({ service_areas: updated }).eq("id", businessId);
    setServiceAreas(updated);
  }

  async function removeServiceArea(area: string) {
    if (!businessId) return;
    const updated = serviceAreas.filter((a) => a !== area);
    const supabase = createClient();
    await supabase.from("businesses").update({ service_areas: updated }).eq("id", businessId);
    setServiceAreas(updated);
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

  async function saveAddressWeb() {
    if (!businessId) return;
    setSavingAddressWeb(true);
    const supabase = createClient();
    await supabase.from("businesses").update({
      address: businessAddress.trim() || null,
      website_url: websiteUrl.trim() || null,
    }).eq("id", businessId);
    setSavingAddressWeb(false);
    setEditingAddressWeb(false);
  }

  async function saveInvoiceMessage() {
    if (!businessId) return;
    setSavingInvoiceMessage(true);
    const supabase = createClient();
    await supabase.from("businesses").update({ invoice_message: invoiceMessage.trim() || null }).eq("id", businessId);
    setSavingInvoiceMessage(false);
    setEditingInvoiceMessage(false);
  }

  async function saveTerms() {
    if (!businessId) return;
    setSavingTerms(true);
    const supabase = createClient();
    await supabase.from("businesses").update({ terms_and_conditions: termsAndConditions.trim() || null }).eq("id", businessId);
    setSavingTerms(false);
    setEditingTerms(false);
  }

  async function saveBusinessType() {
    if (!businessId) return;
    setSavingBusinessType(true);
    const supabase = createClient();
    await supabase.from("businesses").update({ business_type: businessType || null }).eq("id", businessId);
    setSavingBusinessType(false);
    setEditingBusinessType(false);
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

  async function saveMileageRate() {
    if (!businessId) return;
    setSavingMileage(true);
    const supabase = createClient();
    await supabase.from("businesses").update({ mileage_rate_per_mile: parseFloat(mileageRate) || 0.70 }).eq("id", businessId);
    setSavingMileage(false);
    setEditingMileage(false);
  }

  async function toggleAutomation(
    key: "sms_reminders_enabled" | "smart_scheduling_enabled" | "review_requests_enabled" | "lead_notify_enabled" | "follow_up_enabled" | "rebooking_enabled" | "auto_invoice_enabled" | "payment_reminders_enabled" | "morning_briefing_enabled" | "ai_sms_enabled",
    current: boolean
  ) {
    const setters: Record<string, (v: boolean) => void> = {
      sms_reminders_enabled: setSmsReminders,
      smart_scheduling_enabled: setSmartScheduling,
      review_requests_enabled: setReviewRequests,
      lead_notify_enabled: setLeadNotify,
      follow_up_enabled: setFollowUpEnabled,
      rebooking_enabled: setRebookingEnabled,
      auto_invoice_enabled: setAutoInvoiceEnabled,
      payment_reminders_enabled: setPaymentRemindersEnabled,
      morning_briefing_enabled: setMorningBriefingEnabled,
      ai_sms_enabled: setAiSmsEnabled,
    };
    setters[key]?.(!current);
    if (!businessId) return;
    setSavingAutomation(key);
    const supabase = createClient();
    const { error } = await supabase.from("businesses").update({ [key]: !current }).eq("id", businessId);
    if (error) setters[key]?.(current);
    setSavingAutomation(null);
  }

  async function saveGoogleReviewUrl() {
    if (!businessId) return;
    setSavingReviewUrl(true);
    const supabase = createClient();
    await supabase.from("businesses").update({ google_review_url: googleReviewUrl || null }).eq("id", businessId);
    setSavingReviewUrl(false);
    setEditingReviewUrl(false);
  }

  async function saveStaleQuoteDays() {
    if (!businessId) return;
    setSavingStaleQuoteDays(true);
    const supabase = createClient();
    const days = parseInt(staleQuoteDays) || 7;
    await supabase.from("businesses").update({ stale_quote_days: days }).eq("id", businessId);
    setStaleQuoteDays(String(days));
    setSavingStaleQuoteDays(false);
    setEditingStaleQuoteDays(false);
  }

  async function saveRebookingAfterDays() {
    if (!businessId) return;
    setSavingRebookingDays(true);
    const supabase = createClient();
    const days = parseInt(rebookingAfterDays) || 60;
    await supabase.from("businesses").update({ rebooking_after_days: days }).eq("id", businessId);
    setRebookingAfterDays(String(days));
    setSavingRebookingDays(false);
    setEditingRebookingDays(false);
  }

  function fillKnownVars(body: string) {
    return body
      .replace(/\{ownerName\}/g, ownerName || "{ownerName}")
      .replace(/\{bizName\}/g, businessName || "{bizName}");
  }

  async function loadTemplatesForService(serviceType: string) {
    if (!businessId) return;
    setTmplLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("message_templates")
      .select("message_type, body")
      .eq("business_id", businessId)
      .eq("service_type", serviceType);
    const saved = Object.fromEntries((data ?? []).map((r: { message_type: string; body: string }) => [r.message_type, r.body]));
    const defaults = DEFAULT_TEMPLATES[serviceType as keyof typeof DEFAULT_TEMPLATES] ?? DEFAULT_TEMPLATES["Other"];
    setTmplPostQuote(fillKnownVars(saved["post_quote"] ?? defaults.post_quote));
    setTmplConfirmation(fillKnownVars(saved["confirmation"] ?? defaults.confirmation));
    setTmplReminder(fillKnownVars(saved["reminder"] ?? defaults.reminder));
    setTmplLoading(false);
  }

  async function saveTemplates() {
    if (!businessId) return;
    setTmplSaving(true);
    const supabase = createClient();
    const rows: { business_id: string; service_type: string; message_type: MessageType; body: string }[] = [
      { business_id: businessId, service_type: tmplService, message_type: "post_quote", body: tmplPostQuote },
      { business_id: businessId, service_type: tmplService, message_type: "confirmation", body: tmplConfirmation },
      { business_id: businessId, service_type: tmplService, message_type: "reminder", body: tmplReminder },
    ];
    await supabase.from("message_templates").upsert(rows, { onConflict: "business_id,service_type,message_type" });
    setTmplSaving(false);
    setTmplSaved(true);
    setTimeout(() => setTmplSaved(false), 2000);
  }

  async function resetTemplates() {
    if (!businessId) return;
    const supabase = createClient();
    await supabase.from("message_templates").delete()
      .eq("business_id", businessId)
      .eq("service_type", tmplService);
    const defaults = DEFAULT_TEMPLATES[tmplService as keyof typeof DEFAULT_TEMPLATES] ?? DEFAULT_TEMPLATES["Other"];
    setTmplPostQuote(fillKnownVars(defaults.post_quote));
    setTmplConfirmation(fillKnownVars(defaults.confirmation));
    setTmplReminder(fillKnownVars(defaults.reminder));
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

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  async function deleteAccount() {
    setDeletingAccount(true);
    const res = await fetch("/api/account/delete", { method: "DELETE" });
    if (res.ok) {
      window.location.href = "/";
    } else {
      const { error } = await res.json();
      alert(error ?? "Could not delete account. Please try again.");
      setDeletingAccount(false);
    }
  }

  const hasPaymentMethods = venmoUsername || cashappTag || checkPayableTo;
  const hasContactInfo = contactEmail || contactPhone;

  type Section = "company" | "billing" | "team" | "account" | "scheduling" | "automations" | "payments" | "messages" | "pipeline" | "canvassing" | "share";
  const NAV_GLOBAL: { id: Section; label: string; icon: string }[] = [
    { id: "company", label: "Company", icon: "store" },
    { id: "billing", label: "Billing", icon: "credit_card" },
    { id: "team", label: "Team & Access", icon: "group" },
    { id: "account", label: "Account", icon: "manage_accounts" },
  ];
  const NAV_CONFIG: { id: Section; label: string; icon: string }[] = [
    { id: "scheduling", label: "Scheduling", icon: "calendar_month" },
    { id: "automations", label: "Automations", icon: "auto_awesome" },
    { id: "payments", label: "Payments", icon: "payments" },
    { id: "messages", label: "Messages", icon: "sms" },
    { id: "pipeline", label: "Pipeline", icon: "trending_up" },
    { id: "canvassing", label: "Canvassing", icon: "map" },
    { id: "share", label: "Share Form", icon: "share" },
  ];
  const ALL_NAV = [...NAV_GLOBAL, ...NAV_CONFIG];
  const SECTION_META: Record<Section, { label: string; desc: string }> = {
    company: { label: "Company", desc: "Business name, service areas, and contact info." },
    billing: { label: "Billing", desc: "Stripe Connect, subscription plan, tax and pay rates." },
    team: { label: "Team & Access", desc: "Employee access code." },
    account: { label: "Account", desc: "Sign out or delete your account." },
    scheduling: { label: "Scheduling", desc: "Available days, hours, and crew size." },
    automations: { label: "Automations", desc: "Toggle automated SMS workflows." },
    payments: { label: "Payments", desc: "Payment methods on invoices and customer financing." },
    messages: { label: "Messages", desc: "Customize SMS templates for each service type." },
    pipeline: { label: "Pipeline", desc: "Configure stalled quote thresholds." },
    canvassing: { label: "Canvassing", desc: "Custom fields for canvassing bookings." },
    share: { label: "Share Form", desc: "Links and embed code for your quote request form." },
  };
  const [activeSection, setActiveSection] = useState<Section>(
    () => (searchParams.get("sec") as Section | null) ?? "company"
  );

  return (
    <div className="flex min-h-screen bg-background">

      {/* Left Sidebar — desktop only */}
      <aside className="hidden lg:flex flex-col w-56 shrink-0 border-r border-border/60 sticky top-0 h-screen overflow-y-auto">
        <div className="px-4 pt-5 pb-2">
          <h2 className="text-base font-extrabold tracking-tight text-foreground">Settings</h2>
        </div>
        <nav className="flex flex-col px-2 pb-6">
          <p className="px-2 pt-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">Global Settings</p>
          {NAV_GLOBAL.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveSection(item.id)}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left ${
                activeSection === item.id
                  ? "bg-primary/10 text-primary font-semibold"
                  : "text-foreground/70 hover:bg-muted/60 hover:text-foreground"
              }`}
            >
              <span className="material-symbols-outlined text-[17px]">{item.icon}</span>
              {item.label}
            </button>
          ))}
          <p className="px-2 pt-5 pb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">Feature Configurations</p>
          {NAV_CONFIG.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveSection(item.id)}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left ${
                activeSection === item.id
                  ? "bg-primary/10 text-primary font-semibold"
                  : "text-foreground/70 hover:bg-muted/60 hover:text-foreground"
              }`}
            >
              <span className="material-symbols-outlined text-[17px]">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Mobile tab bar */}
        <div className="lg:hidden sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border/60 px-4 pt-3 pb-2">
          <h1 className="text-lg font-extrabold tracking-tight text-foreground mb-2">Settings</h1>
          <div className="flex gap-1.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {ALL_NAV.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                className={`shrink-0 px-3 py-1 rounded-full text-[11px] font-semibold transition-colors ${
                  activeSection === item.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* Desktop section header */}
        <div className="hidden lg:flex flex-col gap-0.5 px-8 py-5 border-b border-border/40">
          <h1 className="text-lg font-extrabold tracking-tight text-foreground">{SECTION_META[activeSection].label}</h1>
          <p className="text-xs text-muted-foreground">{SECTION_META[activeSection].desc}</p>
        </div>

        <div className="flex flex-col gap-5 px-4 lg:px-8 py-5 max-w-2xl pb-32 lg:pb-8">

        {activeSection === "company" && (
        <section className="flex flex-col gap-3">
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Business Profile</h3>
          <Card className="rounded-2xl border-border shadow-sm overflow-visible">
            <div className="p-4 flex flex-col gap-4">
              {editingName ? (
                <div className="flex items-center gap-3">
                  <label className="relative size-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary border-2 border-primary/20 shrink-0 cursor-pointer group overflow-hidden">
                    <input type="file" accept="image/*" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleLogoUpload(f); }} />
                    {logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={logoUrl} alt="Logo" className="size-full object-contain rounded-2xl" />
                    ) : (
                      <span className="material-symbols-outlined text-[32px]">store</span>
                    )}
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl">
                      {uploadingLogo
                        ? <span className="material-symbols-outlined text-white text-[20px] animate-spin">progress_activity</span>
                        : <span className="material-symbols-outlined text-white text-[20px]">photo_camera</span>}
                    </div>
                  </label>
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
                  <label className="relative size-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary border-2 border-primary/20 shrink-0 cursor-pointer group overflow-hidden">
                    <input type="file" accept="image/*" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleLogoUpload(f); }} />
                    {logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={logoUrl} alt="Logo" className="size-full object-contain rounded-2xl" />
                    ) : (
                      <span className="material-symbols-outlined text-[32px]">store</span>
                    )}
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl">
                      {uploadingLogo
                        ? <span className="material-symbols-outlined text-white text-[20px] animate-spin">progress_activity</span>
                        : <span className="material-symbols-outlined text-white text-[20px]">photo_camera</span>}
                    </div>
                  </label>
                  <div className="flex flex-col flex-1">
                    <h4 className="font-bold text-foreground">{loading ? "Loading…" : businessName}</h4>
                    <span className="text-sm text-muted-foreground">{userEmail}</span>
                  </div>
                  <button onClick={() => setEditingName(true)} className="text-primary text-sm font-bold shrink-0">Edit</button>
                </div>
              )}

              <div className="border-t border-border/50 pt-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="material-symbols-outlined text-[18px] text-muted-foreground">category</span>
                  <div>
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Business Type</p>
                    <p className="text-sm text-foreground font-medium mt-0.5">{businessType || <span className="text-muted-foreground/60 italic">Not set</span>}</p>
                  </div>
                </div>
                {editingBusinessType ? (
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="relative">
                      <input
                        autoFocus
                        type="text"
                        value={businessType}
                        onChange={(e) => { setBusinessType(e.target.value); setBusinessTypeOpen(true); }}
                        onFocus={() => setBusinessTypeOpen(true)}
                        onBlur={() => setTimeout(() => setBusinessTypeOpen(false), 150)}
                        placeholder="Type or select…"
                        className="rounded-lg border border-border bg-card px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 w-40"
                      />
                      {businessTypeOpen && (
                        <div className="absolute right-0 top-full mt-1 z-50 w-52 max-h-52 overflow-y-auto rounded-xl border border-border bg-popover shadow-lg">
                          {(() => {
                            const q = businessType.toLowerCase();
                            const matches = BUSINESS_TYPE_OPTIONS.filter((o) => o.toLowerCase().includes(q));
                            const isExact = BUSINESS_TYPE_OPTIONS.some((o) => o.toLowerCase() === q);
                            return (
                              <>
                                {matches.map((opt) => (
                                  <button
                                    key={opt}
                                    onMouseDown={() => { setBusinessType(opt); setBusinessTypeOpen(false); }}
                                    className="w-full text-left px-3 py-2 text-sm hover:bg-muted/60 transition-colors"
                                  >
                                    {opt}
                                  </button>
                                ))}
                                {businessType && !isExact && (
                                  <>
                                    {matches.length > 0 && <div className="border-t border-border/50" />}
                                    <button
                                      onMouseDown={() => setBusinessTypeOpen(false)}
                                      className="w-full text-left px-3 py-2 text-sm font-semibold text-foreground hover:bg-muted/60 transition-colors"
                                    >
                                      Use &ldquo;{businessType}&rdquo;
                                    </button>
                                    <button
                                      onMouseDown={() => { setBusinessType("Other"); setBusinessTypeOpen(false); }}
                                      className="w-full text-left px-3 py-2 text-sm hover:bg-muted/60 transition-colors"
                                    >
                                      Other
                                    </button>
                                  </>
                                )}
                              </>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                    <button onClick={saveBusinessType} disabled={savingBusinessType} className="text-sm font-bold text-[var(--color-status-completed)] disabled:opacity-50">
                      {savingBusinessType ? "…" : "Save"}
                    </button>
                    <button onClick={() => setEditingBusinessType(false)} className="text-sm font-bold text-muted-foreground">Cancel</button>
                  </div>
                ) : (
                  <button onClick={() => setEditingBusinessType(true)} className="text-primary text-sm font-bold shrink-0">
                    {businessType ? "Edit" : "Set"}
                  </button>
                )}
              </div>
            </div>
          </Card>

          {/* Service Areas (weather alerts) */}
          <Card className="rounded-2xl border-border shadow-sm overflow-hidden">
            <div className="p-4 flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[20px] text-primary">partly_cloudy_day</span>
                </div>
                <div>
                  <p className="font-bold text-sm text-foreground">Service Areas</p>
                  <p className="text-xs text-muted-foreground">Cities where you work — used for weather alerts on scheduled jobs.</p>
                </div>
              </div>

              {serviceAreas.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {serviceAreas.map((area) => (
                    <span key={area} className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold">
                      <span className="material-symbols-outlined text-[11px]" style={{ fontVariationSettings: "'FILL' 1" }}>location_city</span>
                      {area}
                      <button
                        onClick={() => removeServiceArea(area)}
                        className="flex size-4 items-center justify-center rounded-full hover:bg-primary/20 transition-colors ml-0.5"
                        aria-label={`Remove ${area}`}
                      >
                        <span className="material-symbols-outlined text-[11px]">close</span>
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {serviceAreas.length === 0 && (
                <p className="text-xs text-muted-foreground/70 italic">No areas added yet — search below to add your first.</p>
              )}

              <CityAutocomplete
                onSelect={addServiceArea}
                placeholder="Search for a city to add…"
                inputClassName="flex h-10 w-full rounded-xl border border-border bg-muted/30 px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring/40"
              />
            </div>
          </Card>
        </section>
        )}

        {activeSection === "team" && (
        <section className="flex flex-col gap-3">

        {/* Website Booking Link */}
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Website Booking Link</h3>
          <Card className="rounded-2xl border-border shadow-sm overflow-hidden">
            <div className="p-4 flex flex-col gap-4">
              <div className="flex items-start gap-3">
                <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="material-symbols-outlined text-[20px] text-primary">link</span>
                </div>
                <div className="flex flex-col flex-1 gap-0.5">
                  <span className="font-bold text-sm text-foreground">Your Public Booking Page</span>
                  <span className="text-xs text-muted-foreground">
                    Share this link on Google, Instagram, or anywhere — customers can request quotes, book, or contact you without logging in.
                  </span>
                </div>
              </div>

              {/* Current link display */}
              <div className="flex items-center gap-2 bg-muted/50 rounded-xl px-3 py-2 min-w-0">
                <span className="text-xs text-muted-foreground shrink-0">/book/</span>
                <span className="font-mono font-bold text-sm text-foreground truncate flex-1">
                  {slug ?? businessId}
                </span>
                <button
                  onClick={copyBookingLink}
                  className={`text-xs font-bold shrink-0 transition-colors ${linkCopied ? "text-green-600" : "text-primary"}`}
                >
                  {linkCopied ? "Copied!" : "Copy"}
                </button>
              </div>

              {/* Set custom slug */}
              {!editingSlug ? (
                <button
                  onClick={() => { setEditingSlug(true); setSlugInput(slug ?? ""); setSlugError(null); }}
                  className="text-xs font-bold text-primary hover:underline text-left"
                >
                  {slug ? "Change link name" : "Set a custom link name"}
                </button>
              ) : (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground shrink-0">/book/</span>
                    <input
                      type="text"
                      value={slugInput}
                      onChange={(e) => setSlugInput(e.target.value)}
                      placeholder="your-business-name"
                      className="flex-1 rounded-lg border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30"
                    />
                  </div>
                  {slugError && <p className="text-xs text-red-500">{slugError}</p>}
                  <div className="flex gap-2">
                    <button
                      onClick={saveSlug}
                      disabled={savingSlug}
                      className="flex-1 py-2 rounded-xl bg-primary text-white font-bold text-xs hover:bg-primary/90 disabled:opacity-50"
                    >
                      {savingSlug ? "Saving…" : "Save"}
                    </button>
                    <button
                      onClick={() => { setEditingSlug(false); setSlugError(null); }}
                      className="px-4 py-2 rounded-xl border border-border text-xs font-bold text-muted-foreground hover:bg-muted/50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Preview link */}
              <a
                href={`/book/${slug ?? businessId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors"
              >
                <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                Preview your booking page
              </a>
            </div>
          </Card>

        {/* Employee Access Code */}
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
        )}

        {activeSection === "company" && (
        <section className="flex flex-col gap-3">
        {/* Contact Info */}
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
        )}

        {activeSection === "company" && (
        <section className="flex flex-col gap-3">
          {/* Address & Website */}
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Address &amp; Website</h3>
            {!editingAddressWeb && (
              <button onClick={() => setEditingAddressWeb(true)} className="text-xs font-bold text-primary">
                {businessAddress || websiteUrl ? "Edit" : "Set up"}
              </button>
            )}
          </div>

          {editingAddressWeb ? (
            <Card className="rounded-2xl border-border shadow-sm overflow-hidden">
              <div className="p-4 flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[14px]">location_on</span>
                    Business Address
                  </label>
                  <input
                    type="text"
                    placeholder="123 Main St, City, State 00000"
                    value={businessAddress}
                    onChange={(e) => setBusinessAddress(e.target.value)}
                    className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring/30"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[14px]">language</span>
                    Website
                  </label>
                  <input
                    type="url"
                    placeholder="https://yourbusiness.com"
                    value={websiteUrl}
                    onChange={(e) => setWebsiteUrl(e.target.value)}
                    className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring/30"
                  />
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => setEditingAddressWeb(false)}
                    className="flex-1 py-2.5 rounded-xl border border-border text-sm font-bold text-muted-foreground hover:bg-muted/50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveAddressWeb}
                    disabled={savingAddressWeb}
                    className="flex-[2] py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 disabled:opacity-50 transition-colors"
                  >
                    {savingAddressWeb ? "Saving…" : "Save"}
                  </button>
                </div>
              </div>
            </Card>
          ) : (
            <Card className="rounded-2xl border-border shadow-sm overflow-hidden">
              {!businessAddress && !websiteUrl ? (
                <button
                  onClick={() => setEditingAddressWeb(true)}
                  className="w-full p-4 flex items-center gap-3 hover:bg-muted/30 transition-colors"
                >
                  <div className="size-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground shrink-0">
                    <span className="material-symbols-outlined text-[20px]">location_on</span>
                  </div>
                  <div className="flex flex-col items-start flex-1">
                    <span className="font-bold text-sm text-foreground">Add address &amp; website</span>
                    <span className="text-xs text-muted-foreground">Shown on invoices</span>
                  </div>
                  <span className="material-symbols-outlined text-muted-foreground">chevron_right</span>
                </button>
              ) : (
                <div className="flex flex-col divide-y divide-border/50">
                  {businessAddress && (
                    <div className="p-4 flex items-center gap-3">
                      <div className="size-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-[20px] text-muted-foreground">location_on</span>
                      </div>
                      <div className="flex flex-col flex-1">
                        <span className="font-bold text-sm text-foreground">Address</span>
                        <span className="text-xs text-muted-foreground">{businessAddress}</span>
                      </div>
                    </div>
                  )}
                  {websiteUrl && (
                    <div className="p-4 flex items-center gap-3">
                      <div className="size-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-[20px] text-muted-foreground">language</span>
                      </div>
                      <div className="flex flex-col flex-1">
                        <span className="font-bold text-sm text-foreground">Website</span>
                        <span className="text-xs text-muted-foreground">{websiteUrl.replace(/^https?:\/\//, "")}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </Card>
          )}
        </section>
        )}

        {activeSection === "company" && (
        <section className="flex flex-col gap-3">
          {/* Invoice / Estimate Message */}
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Invoice Message</h3>
            {!editingInvoiceMessage && (
              <button onClick={() => setEditingInvoiceMessage(true)} className="text-xs font-bold text-primary">
                {invoiceMessage ? "Edit" : "Set up"}
              </button>
            )}
          </div>

          {editingInvoiceMessage ? (
            <Card className="rounded-2xl border-border shadow-sm overflow-hidden">
              <div className="p-4 flex flex-col gap-4">
                <p className="text-xs text-muted-foreground">A personal note shown at the bottom of every invoice and quote.</p>
                <textarea
                  rows={4}
                  placeholder="Thank you for your business! Payment due within 30 days."
                  value={invoiceMessage}
                  onChange={(e) => setInvoiceMessage(e.target.value)}
                  className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring/30 resize-none"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => setEditingInvoiceMessage(false)}
                    className="flex-1 py-2.5 rounded-xl border border-border text-sm font-bold text-muted-foreground hover:bg-muted/50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveInvoiceMessage}
                    disabled={savingInvoiceMessage}
                    className="flex-[2] py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 disabled:opacity-50 transition-colors"
                  >
                    {savingInvoiceMessage ? "Saving…" : "Save"}
                  </button>
                </div>
              </div>
            </Card>
          ) : (
            <Card className="rounded-2xl border-border shadow-sm overflow-hidden">
              {!invoiceMessage ? (
                <button
                  onClick={() => setEditingInvoiceMessage(true)}
                  className="w-full p-4 flex items-center gap-3 hover:bg-muted/30 transition-colors"
                >
                  <div className="size-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground shrink-0">
                    <span className="material-symbols-outlined text-[20px]">chat_bubble</span>
                  </div>
                  <div className="flex flex-col items-start flex-1">
                    <span className="font-bold text-sm text-foreground">Add invoice message</span>
                    <span className="text-xs text-muted-foreground">A note shown on every invoice &amp; quote</span>
                  </div>
                  <span className="material-symbols-outlined text-muted-foreground">chevron_right</span>
                </button>
              ) : (
                <div className="p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Message</p>
                  <p className="text-sm text-foreground leading-relaxed">{invoiceMessage}</p>
                </div>
              )}
            </Card>
          )}
        </section>
        )}

        {activeSection === "company" && (
        <section className="flex flex-col gap-3">
          {/* Terms & Conditions */}
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Terms &amp; Conditions</h3>
            {!editingTerms && (
              <button onClick={() => setEditingTerms(true)} className="text-xs font-bold text-primary">
                {termsAndConditions ? "Edit" : "Set up"}
              </button>
            )}
          </div>

          {editingTerms ? (
            <Card className="rounded-2xl border-border shadow-sm overflow-hidden">
              <div className="p-4 flex flex-col gap-4">
                <p className="text-xs text-muted-foreground">Shown at the bottom of invoices and quotes. Clients can expand to read the full text.</p>
                <textarea
                  rows={6}
                  placeholder="Payment is due within 30 days of invoice date. Late payments subject to 1.5% monthly interest…"
                  value={termsAndConditions}
                  onChange={(e) => setTermsAndConditions(e.target.value)}
                  className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring/30 resize-none"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => setEditingTerms(false)}
                    className="flex-1 py-2.5 rounded-xl border border-border text-sm font-bold text-muted-foreground hover:bg-muted/50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveTerms}
                    disabled={savingTerms}
                    className="flex-[2] py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 disabled:opacity-50 transition-colors"
                  >
                    {savingTerms ? "Saving…" : "Save"}
                  </button>
                </div>
              </div>
            </Card>
          ) : (
            <Card className="rounded-2xl border-border shadow-sm overflow-hidden">
              {!termsAndConditions ? (
                <button
                  onClick={() => setEditingTerms(true)}
                  className="w-full p-4 flex items-center gap-3 hover:bg-muted/30 transition-colors"
                >
                  <div className="size-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground shrink-0">
                    <span className="material-symbols-outlined text-[20px]">gavel</span>
                  </div>
                  <div className="flex flex-col items-start flex-1">
                    <span className="font-bold text-sm text-foreground">Add terms &amp; conditions</span>
                    <span className="text-xs text-muted-foreground">Collapsible section on invoices &amp; quotes</span>
                  </div>
                  <span className="material-symbols-outlined text-muted-foreground">chevron_right</span>
                </button>
              ) : (
                <div className="p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Terms</p>
                  <p className="text-sm text-foreground leading-relaxed line-clamp-3">{termsAndConditions}</p>
                  {termsAndConditions.length > 180 && (
                    <button onClick={() => setEditingTerms(true)} className="mt-1 text-xs font-bold text-primary">Show full</button>
                  )}
                </div>
              )}
            </Card>
          )}
        </section>
        )}

        {activeSection === "payments" && (
        <section className="flex flex-col gap-3">
        {/* Payment Methods */}
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
        )}

        {activeSection === "billing" && (
        <section className="flex flex-col gap-3">
        {/* Financial & Billing */}
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

            {/* Mileage Reimbursement Rate */}
            <div className="flex flex-col border-t border-border/50">
              <div className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-full bg-muted flex items-center justify-center text-foreground">
                    <span className="material-symbols-outlined text-[20px]">local_gas_station</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="font-bold text-sm text-foreground">Mileage Reimbursement</span>
                    <span className="text-xs text-muted-foreground">${mileageRate}/mile</span>
                  </div>
                </div>
                <button onClick={() => setEditingMileage((v) => !v)} className="text-xs font-bold text-primary">
                  {editingMileage ? "Cancel" : "Edit"}
                </button>
              </div>
              {editingMileage && (
                <div className="px-4 pb-4 flex gap-2 items-center">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-bold">$</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={mileageRate}
                      onChange={(e) => setMileageRate(e.target.value)}
                      className="w-full rounded-xl border border-border bg-card pl-7 pr-16 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-bold">/mi</span>
                  </div>
                  <button
                    onClick={saveMileageRate}
                    disabled={savingMileage}
                    className="px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 disabled:opacity-50"
                  >
                    {savingMileage ? "Saving…" : "Save"}
                  </button>
                </div>
              )}
            </div>
          </Card>
        </section>
        )}

        {activeSection === "automations" && (
        <section className="flex flex-col gap-3">
        {/* Automations */}
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Automations</h3>
          <Card className="rounded-2xl border-border shadow-sm flex flex-col overflow-hidden">
            {([
              { label: "Automated Reminders", sub: "Send SMS 24hrs before job", key: "sms_reminders_enabled" as const, value: smsReminders },
              { label: "Smart Scheduling", sub: "Optimize routes using Maps API", key: "smart_scheduling_enabled" as const, value: smartScheduling },
              { label: "Review Request Automation", sub: "Auto-send a Google Review link 24hrs after job completion", key: "review_requests_enabled" as const, value: reviewRequests },
              { label: "Lead Speed-to-Contact", sub: "Auto-text new leads within minutes of submission", key: "lead_notify_enabled" as const, value: leadNotify },
              { label: "Quote Follow-Up Sequence", sub: "Auto-text clients at 24hrs, 72hrs, and 7 days after a quote is sent", key: "follow_up_enabled" as const, value: followUpEnabled },
              { label: "Rebooking Campaign", sub: `Auto-text past clients who haven't booked in ${rebookingAfterDays} days to bring them back`, key: "rebooking_enabled" as const, value: rebookingEnabled },
              { label: "Auto Invoice on Completion", sub: "Automatically text and email the client their invoice link the moment a job is marked complete", key: "auto_invoice_enabled" as const, value: autoInvoiceEnabled },
              { label: "Payment Reminder Sequence", sub: "Auto-text unpaid invoices at 3, 7, and 14 days after job completion until paid", key: "payment_reminders_enabled" as const, value: paymentRemindersEnabled },
              { label: "Morning Briefing", sub: "Receive a daily SMS at 7am with today's jobs, pending quotes, and unpaid invoices", key: "morning_briefing_enabled" as const, value: morningBriefingEnabled },
              { label: "AI SMS Auto-Reply", sub: "Claude AI reads client texts and replies with job context (time, status, reschedule requests) — you stay in control via inbox", key: "ai_sms_enabled" as const, value: aiSmsEnabled },
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

          {/* Google Review URL — only shown when Review Request Automation is on */}
          {reviewRequests && (
            <Card className="rounded-2xl border-border shadow-sm">
              <div className="p-4 flex flex-col gap-3">
                <div className="flex flex-col gap-0.5">
                  <span className="font-bold text-sm text-foreground">Google Review Link</span>
                  <span className="text-xs text-muted-foreground">Paste your Google Business review URL. Customers will receive this link automatically after each completed job.</span>
                </div>
                {editingReviewUrl ? (
                  <div className="flex flex-col gap-2">
                    <input
                      type="url"
                      value={googleReviewUrl}
                      onChange={(e) => setGoogleReviewUrl(e.target.value)}
                      placeholder="https://g.page/r/your-business/review"
                      className="w-full rounded-xl border border-border bg-muted/30 px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring/40"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={saveGoogleReviewUrl}
                        disabled={savingReviewUrl}
                        className="px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 disabled:opacity-50"
                      >
                        {savingReviewUrl ? "Saving…" : "Save"}
                      </button>
                      <button
                        onClick={() => { setEditingReviewUrl(false); }}
                        className="px-4 py-2.5 rounded-xl bg-muted text-foreground text-sm font-bold hover:bg-muted/80"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-foreground truncate">
                      {googleReviewUrl || <span className="text-muted-foreground italic">No URL set — add one to activate</span>}
                    </span>
                    <button
                      onClick={() => setEditingReviewUrl(true)}
                      className="shrink-0 text-xs font-bold text-primary hover:underline"
                    >
                      {googleReviewUrl ? "Edit" : "Add URL"}
                    </button>
                  </div>
                )}
              </div>
            </Card>
          )}

          {rebookingEnabled && (
            <Card className="rounded-2xl border-border shadow-sm overflow-hidden">
              <div className="p-4 flex flex-col gap-3">
                <div className="flex flex-col gap-0.5">
                  <span className="font-bold text-sm text-foreground">Rebooking Window</span>
                  <span className="text-xs text-muted-foreground">
                    Send the rebooking SMS after a client has gone {rebookingAfterDays} days without a new job.
                    We won&apos;t contact the same client again until another {rebookingAfterDays} days pass.
                  </span>
                </div>
                {editingRebookingDays ? (
                  <div className="flex flex-col gap-2">
                    <div className="flex gap-2 items-center">
                      <input
                        type="number"
                        min="7"
                        max="365"
                        step="1"
                        value={rebookingAfterDays}
                        onChange={(e) => setRebookingAfterDays(e.target.value)}
                        className="flex-1 rounded-xl border border-border bg-muted/30 px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring/40"
                      />
                      <span className="text-sm font-bold text-muted-foreground shrink-0">days</span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={saveRebookingAfterDays}
                        disabled={savingRebookingDays}
                        className="px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 disabled:opacity-50"
                      >
                        {savingRebookingDays ? "Saving…" : "Save"}
                      </button>
                      <button
                        onClick={() => setEditingRebookingDays(false)}
                        className="px-4 py-2.5 rounded-xl bg-muted text-foreground text-sm font-bold hover:bg-muted/80"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-bold text-foreground">{rebookingAfterDays} days</span>
                    <button
                      onClick={() => setEditingRebookingDays(true)}
                      className="shrink-0 text-xs font-bold text-primary hover:underline"
                    >
                      Edit
                    </button>
                  </div>
                )}
              </div>
            </Card>
          )}
        </section>
        )}

        {activeSection === "pipeline" && (
        <section className="flex flex-col gap-3">
        {/* Sales Pipeline */}
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Sales Pipeline</h3>
          <Card className="rounded-2xl border-border shadow-sm overflow-hidden">
            <div className="flex flex-col border-border/50">
              <div className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-full bg-muted flex items-center justify-center text-foreground">
                    <span className="material-symbols-outlined text-[20px]">timer</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="font-bold text-sm text-foreground">Stalled Quote Threshold</span>
                    <span className="text-xs text-muted-foreground">Flag quotes as stalled after {staleQuoteDays} days with no response</span>
                  </div>
                </div>
                <button onClick={() => setEditingStaleQuoteDays((v) => !v)} className="text-xs font-bold text-primary">
                  {editingStaleQuoteDays ? "Cancel" : "Edit"}
                </button>
              </div>
              {editingStaleQuoteDays && (
                <div className="px-4 pb-4 flex gap-2 items-center">
                  <div className="relative flex-1">
                    <input
                      type="number"
                      min="1"
                      max="365"
                      step="1"
                      value={staleQuoteDays}
                      onChange={(e) => setStaleQuoteDays(e.target.value)}
                      className="w-full rounded-xl border border-border bg-card px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-bold">days</span>
                  </div>
                  <button
                    onClick={saveStaleQuoteDays}
                    disabled={savingStaleQuoteDays}
                    className="px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 disabled:opacity-50"
                  >
                    {savingStaleQuoteDays ? "Saving…" : "Save"}
                  </button>
                </div>
              )}
            </div>
          </Card>
        </section>
        )}

        {activeSection === "messages" && (
        <section className="flex flex-col gap-3">
        {/* Message Templates */}
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Message Templates</h3>
          <Card className="rounded-2xl border-border shadow-sm overflow-hidden">
            <div className="p-4 flex flex-col gap-4">
              <p className="text-xs text-muted-foreground">
                Customize the SMS messages sent to clients for each service type. These pre-fill automatically when you tap the SMS button on a job.
              </p>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-muted-foreground">Service Type</label>
                <div className="relative">
                  <input
                    type="text"
                    value={tmplDropdownOpen ? tmplSearch : tmplService}
                    placeholder="Search service type…"
                    onFocus={() => { setTmplDropdownOpen(true); setTmplSearch(""); }}
                    onBlur={() => setTimeout(() => setTmplDropdownOpen(false), 150)}
                    onChange={(e) => setTmplSearch(e.target.value)}
                    className="w-full rounded-xl border border-border bg-muted/30 px-3 py-2.5 text-sm font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-ring/40"
                  />
                  <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-[16px] text-muted-foreground pointer-events-none">
                    {tmplDropdownOpen ? "search" : "expand_more"}
                  </span>
                  {tmplDropdownOpen && (() => {
                    const query = tmplSearch.toLowerCase();
                    const filtered = [...SERVICE_TYPES].sort().filter((s) => s.toLowerCase().includes(query));
                    return filtered.length > 0 ? (
                      <div className="absolute z-50 top-full left-0 right-0 mt-1 rounded-xl border border-border bg-card shadow-lg overflow-hidden max-h-52 overflow-y-auto">
                        {filtered.map((s) => (
                          <button
                            key={s}
                            type="button"
                            onMouseDown={() => {
                              setTmplService(s);
                              localStorage.setItem("tmplService", s);
                              setTmplDropdownOpen(false);
                              setTmplSearch("");
                            }}
                            className={`w-full text-left px-3 py-2.5 text-sm font-medium transition-colors hover:bg-muted/60 ${s === tmplService ? "text-primary bg-primary/5" : "text-foreground"}`}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    ) : null;
                  })()}
                </div>
              </div>
              {tmplLoading ? (
                <p className="text-xs text-muted-foreground text-center py-4">Loading…</p>
              ) : (
                <div className="flex flex-col gap-4">
                  {(
                    [
                      { key: "post_quote" as const, label: "Post-Quote (Scheduling)", value: tmplPostQuote, set: setTmplPostQuote },
                      { key: "confirmation" as const, label: "Confirmation (Scheduled)", value: tmplConfirmation, set: setTmplConfirmation },
                      { key: "reminder" as const, label: "24-Hour Reminder", value: tmplReminder, set: setTmplReminder },
                    ] satisfies { key: MessageType; label: string; value: string; set: (v: string) => void }[]
                  ).map((item) => (
                    <div key={item.key} className="flex flex-col gap-1">
                      <label className="text-xs font-semibold text-muted-foreground">{item.label}</label>
                      <p className="text-[10px] text-muted-foreground/60 leading-tight">
                        Tokens: {"{clientName}"}
                        {item.key !== "post_quote" ? `, {"{date}"}, {"{time}"}` : ""}
                      </p>
                      <textarea
                        value={item.value}
                        onChange={(e) => item.set(e.target.value)}
                        rows={5}
                        className="w-full rounded-xl border border-border bg-muted/30 px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring/40 resize-none leading-relaxed"
                      />
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <button
                      onClick={resetTemplates}
                      className="flex-1 py-2.5 rounded-xl border border-border text-muted-foreground text-sm font-bold hover:bg-muted/50 transition-colors"
                    >
                      Reset to Default
                    </button>
                    <button
                      onClick={saveTemplates}
                      disabled={tmplSaving}
                      className="flex-[2] py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 disabled:opacity-50 transition-colors"
                    >
                      {tmplSaved ? "Saved ✓" : tmplSaving ? "Saving…" : "Save Templates"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </section>
        )}

        {activeSection === "scheduling" && (() => {
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
                        <p className="text-sm font-semibold text-foreground">Default Crew Size</p>
                        <p className="text-xs text-muted-foreground">Fallback used for booking availability — individual jobs can have a different crew</p>
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

        {activeSection === "share" && businessId && (() => {
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

        {activeSection === "payments" && (
        <section className="flex flex-col gap-3">
        {/* Customer Financing */}
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Customer Financing</h3>
          <Card className="rounded-2xl border-border shadow-sm overflow-hidden">
            <div className="p-4 flex flex-col gap-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <p className="font-semibold text-sm text-foreground">Offer financing to clients</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Show a &quot;Finance this job&quot; button on quotes and invoices above the minimum amount</p>
                </div>
                <button
                  onClick={async () => {
                    const next = !financingEnabled;
                    setFinancingEnabled(next);
                    if (businessId) {
                      const supabase = createClient();
                      await supabase.from("businesses").update({ financing_enabled: next }).eq("id", businessId);
                    }
                  }}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none ${financingEnabled ? "bg-primary" : "bg-muted"}`}
                  aria-checked={financingEnabled}
                >
                  <span className={`inline-block size-5 transform rounded-full bg-white shadow-sm transition-transform ${financingEnabled ? "translate-x-5" : "translate-x-0"}`} />
                </button>
              </div>

              {financingEnabled && (
                <>
                  <Separator />
                  {!editingFinancing ? (
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <div className="flex flex-col gap-1">
                          <p className="text-xs text-muted-foreground">Partner</p>
                          <p className="text-sm font-medium text-foreground">{financingPartner || "Not set"}</p>
                        </div>
                        <div className="flex flex-col gap-1 text-right">
                          <p className="text-xs text-muted-foreground">Min. job amount</p>
                          <p className="text-sm font-medium text-foreground">${financingMinAmount}</p>
                        </div>
                      </div>
                      {financingUrl && (
                        <p className="text-xs text-muted-foreground truncate">
                          Link: <span className="text-primary">{financingUrl}</span>
                        </p>
                      )}
                      <button
                        onClick={() => setEditingFinancing(true)}
                        className="flex items-center gap-1.5 self-start px-3 py-1.5 rounded-xl bg-muted text-muted-foreground text-xs font-semibold hover:bg-muted/80 transition-colors"
                      >
                        <span className="material-symbols-outlined text-[14px]">edit</span>
                        Configure
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3">
                      <div>
                        <label className="text-xs font-medium text-muted-foreground">Financing partner</label>
                        <input
                          value={financingPartner}
                          onChange={(e) => setFinancingPartner(e.target.value)}
                          placeholder="e.g. Wisetack, Hearth, Sunbit"
                          className="mt-1 w-full rounded-xl border border-border bg-muted/40 px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring/40"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground">Application / referral link</label>
                        <input
                          value={financingUrl}
                          onChange={(e) => setFinancingUrl(e.target.value)}
                          placeholder="https://…"
                          type="url"
                          className="mt-1 w-full rounded-xl border border-border bg-muted/40 px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring/40"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground">Minimum job amount ($)</label>
                        <input
                          value={financingMinAmount}
                          onChange={(e) => setFinancingMinAmount(e.target.value)}
                          type="number"
                          min="0"
                          placeholder="500"
                          className="mt-1 w-full rounded-xl border border-border bg-muted/40 px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring/40"
                        />
                        <p className="text-xs text-muted-foreground mt-1">Financing button only appears on quotes and invoices at or above this amount</p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={saveFinancing}
                          disabled={savingFinancing}
                          className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 active:scale-95 transition-all disabled:opacity-50"
                        >
                          {savingFinancing ? "Saving…" : "Save"}
                        </button>
                        <button
                          onClick={() => setEditingFinancing(false)}
                          className="px-4 py-2.5 rounded-xl border border-border text-sm font-semibold text-muted-foreground hover:bg-muted transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </Card>
        </section>
        )}

        {activeSection === "canvassing" && (
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
        </section>
        )}

        {activeSection === "account" && (
        <section className="flex flex-col gap-3">
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Account</h3>
          <Card className="rounded-2xl border-border shadow-sm overflow-hidden divide-y divide-border/50">
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
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="w-full p-4 flex items-center gap-3 hover:bg-muted/50 transition-colors"
            >
              <div className="size-10 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 shrink-0">
                <span className="material-symbols-outlined text-[20px]">delete_forever</span>
              </div>
              <div className="flex flex-col items-start">
                <span className="font-bold text-sm text-red-500">Delete Account</span>
                <span className="text-xs text-muted-foreground">Permanently remove your account and data</span>
              </div>
              <span className="material-symbols-outlined text-muted-foreground ml-auto">chevron_right</span>
            </button>
          </Card>

          {showDeleteConfirm && (
            <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center bg-black/40 backdrop-blur-sm px-4" onClick={() => setShowDeleteConfirm(false)}>
              <div className="w-full max-w-sm bg-background rounded-2xl shadow-2xl p-5 flex flex-col gap-4" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center gap-3">
                  <div className="size-12 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 shrink-0">
                    <span className="material-symbols-outlined text-[24px]">delete_forever</span>
                  </div>
                  <div>
                    <p className="font-bold text-base text-foreground">Delete Account?</p>
                    <p className="text-xs text-muted-foreground mt-0.5">This cannot be undone</p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  Your account, business profile, clients, jobs, and all associated data will be permanently deleted.
                </p>
                <div className="flex gap-2 mt-1">
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="flex-1 py-3 rounded-2xl border border-border text-muted-foreground font-bold text-sm hover:bg-muted/50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={deleteAccount}
                    disabled={deletingAccount}
                    className="flex-[2] py-3 rounded-2xl bg-red-500 text-white font-bold text-sm hover:bg-red-600 disabled:opacity-50 transition-colors"
                  >
                    {deletingAccount ? "Deleting…" : "Yes, Delete Everything"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>
        )}

        </div>
      </div>
    </div>
  );
}
