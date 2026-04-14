"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";

const BUSINESS_TYPE_OPTIONS = [
  "Cleaning", "Landscaping", "Pressure Washing", "Painting", "Handyman",
  "Moving", "Plumbing", "Electrical", "HVAC", "Roofing", "Pest Control",
  "Pool Service", "Snow Removal", "Junk Removal", "Window Cleaning",
  "Carpentry", "Flooring", "Tree Service", "Catering", "Photography",
  "Event Planning", "Personal Training", "Tutoring", "Pet Grooming",
  "Auto Detailing", "Other",
];

const COUNTRIES = [
  { code: "US", name: "United States", currency: "USD", flag: "🇺🇸", symbol: "$" },
  { code: "CA", name: "Canada",        currency: "CAD", flag: "🇨🇦", symbol: "C$" },
  { code: "AU", name: "Australia",     currency: "AUD", flag: "🇦🇺", symbol: "A$" },
];

const PLANS = [
  {
    id: "solo",
    name: "Solo",
    tagline: "Start solo. Scale into the next plan.",
    monthlyPrice: 49,
    yearlyPrice: 34,
    highlight: false,
    features: ["1 user", "Unlimited jobs", "Client portal", "Quotes & invoices", "Payment tracking"],
  },
  {
    id: "team",
    name: "Team",
    tagline: "More reps. More doors. More revenue.",
    monthlyPrice: 119,
    yearlyPrice: 83,
    highlight: true,
    features: ["Up to 8 users", "Everything in Solo", "Team management", "Leaderboard", "Commission tracking"],
  },
  {
    id: "business",
    name: "Business",
    tagline: "For scaled operations.",
    monthlyPrice: 249,
    yearlyPrice: 174,
    highlight: false,
    features: ["Up to 30 users", "Everything in Team", "Route optimization", "Analytics", "Priority support"],
  },
] as const;

function ProgressBar({ step }: { step: number }) {
  return (
    <div className="flex gap-1.5 w-full">
      {[1, 2, 3, 4].map((s) => (
        <div
          key={s}
          className={`h-1 flex-1 rounded-full transition-colors ${
            s <= step ? "bg-primary" : "bg-border"
          }`}
        />
      ))}
    </div>
  );
}

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<2 | 3 | 4>(2);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 2 state
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");

  // Step 3 state
  const [businessName, setBusinessName] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [typeInput, setTypeInput] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [country, setCountry] = useState("US");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [businessId, setBusinessId] = useState<string | null>(null);

  // Step 4 state
  const [billingInterval, setBillingInterval] = useState<"monthly" | "yearly">("monthly");
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);

  const filteredOptions = BUSINESS_TYPE_OPTIONS.filter((opt) =>
    opt.toLowerCase().includes(typeInput.toLowerCase())
  );

  // Determine starting step based on existing profile/business data
  useEffect(() => {
    async function detectStep() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }

      const { data: profile } = await supabase
        .from("profiles")
        .select("first_name")
        .eq("id", user.id)
        .single();

      if (profile?.first_name) {
        // Contact info already saved — check for business
        const { data: biz } = await supabase
          .from("businesses")
          .select("id, subscription_status")
          .eq("owner_id", user.id)
          .maybeSingle();

        if (biz) {
          setBusinessId(biz.id);
          if (biz.subscription_status === "active" || biz.subscription_status === "trialing") {
            router.push("/");
            return;
          }
          setStep(4);
        } else {
          setStep(3);
        }
      } else {
        setStep(2);
      }
      setLoading(false);
    }
    detectStep();
  }, [router]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleStep2(e: React.FormEvent) {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) return;
    setSubmitting(true);
    setError(null);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); return; }

    const { error } = await supabase
      .from("profiles")
      .update({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        full_name: `${firstName.trim()} ${lastName.trim()}`,
        phone: phone.trim() || null,
      })
      .eq("id", user.id);

    if (error) {
      setError(error.message);
      setSubmitting(false);
    } else {
      setStep(3);
      setSubmitting(false);
    }
  }

  async function handleStep3(e: React.FormEvent) {
    e.preventDefault();
    if (!businessName.trim()) return;
    setSubmitting(true);
    setError(null);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); return; }

    const selectedCountry = COUNTRIES.find((c) => c.code === country)!;

    const { data, error } = await supabase
      .from("businesses")
      .insert({
        owner_id: user.id,
        name: businessName.trim(),
        business_type: businessType || null,
        country: selectedCountry.code,
        currency: selectedCountry.currency,
      })
      .select("id")
      .single();

    if (error || !data) {
      setError(error?.message ?? "Failed to create business.");
      setSubmitting(false);
    } else {
      setBusinessId(data.id);
      setStep(4);
      setSubmitting(false);
    }
  }

  async function handleSelectPlan(planId: string) {
    if (!businessId) return;
    setCheckoutLoading(planId);
    setError(null);

    const res = await fetch("/api/stripe/create-checkout-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan: planId, interval: billingInterval, businessId }),
    });

    const json = await res.json();
    if (!res.ok || !json.url) {
      setError(json.error ?? "Failed to start checkout.");
      setCheckoutLoading(null);
    } else {
      window.location.href = json.url;
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-background">
      <div className={`w-full flex flex-col gap-6 ${step === 4 ? "max-w-3xl" : "max-w-sm"}`}>

        <ProgressBar step={step} />

        {/* Step 2: Contact Information */}
        {step === 2 && (
          <>
            <div className="flex flex-col gap-1">
              <p className="text-xs font-bold uppercase tracking-wider text-primary">Step 2 of 4</p>
              <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Contact information</h1>
              <p className="text-sm text-muted-foreground">Tell us a bit about yourself.</p>
            </div>

            <Card className="p-6 rounded-2xl border-border shadow-sm">
              <form onSubmit={handleStep2} className="flex flex-col gap-5">
                {error && (
                  <p className="text-sm text-red-500 bg-red-50 dark:bg-red-950/30 rounded-xl px-3 py-2">{error}</p>
                )}
                <div className="flex gap-3">
                  <div className="flex flex-col gap-1.5 flex-1">
                    <label htmlFor="firstName" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      First name <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="firstName"
                      type="text"
                      placeholder="John"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      required
                      autoFocus
                      className="flex h-12 w-full rounded-xl border border-border bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5 flex-1">
                    <label htmlFor="lastName" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Last name <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="lastName"
                      type="text"
                      placeholder="Doe"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      required
                      className="flex h-12 w-full rounded-xl border border-border bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="phone" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Mobile phone number <span className="normal-case font-normal text-muted-foreground/60">(optional)</span>
                  </label>
                  <input
                    id="phone"
                    type="tel"
                    placeholder="(555) 123-4567"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="flex h-12 w-full rounded-xl border border-border bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                </div>
                <button
                  type="submit"
                  disabled={submitting || !firstName.trim() || !lastName.trim()}
                  className="w-full mt-1 rounded-xl font-bold py-3.5 text-sm bg-primary text-white shadow-md shadow-primary/30 hover:bg-primary/90 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? "Saving…" : "Continue →"}
                </button>
              </form>
            </Card>
          </>
        )}

        {/* Step 3: Business Details */}
        {step === 3 && (
          <>
            <div className="flex flex-col gap-1">
              <p className="text-xs font-bold uppercase tracking-wider text-primary">Step 3 of 4</p>
              <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Business details</h1>
              <p className="text-sm text-muted-foreground">What&apos;s the name of your company?</p>
            </div>

            <Card className="p-6 rounded-2xl border-border shadow-sm">
              <form onSubmit={handleStep3} className="flex flex-col gap-5">
                {error && (
                  <p className="text-sm text-red-500 bg-red-50 dark:bg-red-950/30 rounded-xl px-3 py-2">{error}</p>
                )}

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="businessName" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Company name <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="businessName"
                    type="text"
                    placeholder="e.g. Shine Pro Cleaning"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    required
                    autoFocus
                    className="flex h-12 w-full rounded-xl border border-border bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                </div>

                <div className="flex flex-col gap-1.5" ref={dropdownRef}>
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Business type <span className="normal-case font-normal text-muted-foreground/60">(optional)</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="e.g. Cleaning, Landscaping…"
                      value={typeInput}
                      onChange={(e) => { setTypeInput(e.target.value); setBusinessType(e.target.value); setShowDropdown(true); }}
                      onFocus={() => setShowDropdown(true)}
                      className="flex h-12 w-full rounded-xl border border-border bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    />
                    {showDropdown && filteredOptions.length > 0 && (
                      <ul className="absolute z-10 mt-1 w-full max-h-48 overflow-y-auto rounded-xl border border-border bg-background shadow-lg">
                        {filteredOptions.map((opt) => (
                          <li
                            key={opt}
                            onMouseDown={() => { setTypeInput(opt); setBusinessType(opt); setShowDropdown(false); }}
                            className="cursor-pointer px-3 py-2.5 text-sm hover:bg-muted transition-colors"
                          >
                            {opt}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Country <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-3">
                    {COUNTRIES.map((c) => (
                      <button
                        key={c.code}
                        type="button"
                        onClick={() => setCountry(c.code)}
                        className={`flex-1 flex flex-col items-start gap-1 rounded-xl border-2 p-3 transition-all ${
                          country === c.code
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-muted-foreground/40"
                        }`}
                      >
                        <span className="text-xl">{c.flag}</span>
                        <span className="text-xs font-bold text-foreground leading-tight">{c.name}</span>
                        <span className="text-xs text-muted-foreground">({c.symbol})</span>
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting || !businessName.trim()}
                  className="w-full mt-1 rounded-xl font-bold py-3.5 text-sm bg-primary text-white shadow-md shadow-primary/30 hover:bg-primary/90 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? "Saving…" : "Continue →"}
                </button>
              </form>
            </Card>
          </>
        )}

        {/* Step 4: Pricing */}
        {step === 4 && (
          <>
            <div className="flex flex-col gap-1">
              <p className="text-xs font-bold uppercase tracking-wider text-primary">Step 4 of 4</p>
              <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Choose your plan</h1>
              <p className="text-sm text-muted-foreground">Built and priced for growth. 7-day free trial on every plan.</p>
            </div>

            {error && (
              <p className="text-sm text-red-500 bg-red-50 dark:bg-red-950/30 rounded-xl px-3 py-2">{error}</p>
            )}

            {/* Billing toggle */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setBillingInterval("monthly")}
                className={`text-sm font-semibold px-4 py-2 rounded-lg transition-colors ${
                  billingInterval === "monthly"
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => setBillingInterval("yearly")}
                className={`flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-lg transition-colors ${
                  billingInterval === "yearly"
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Yearly
                <span className="text-xs font-bold bg-green-500 text-white px-1.5 py-0.5 rounded-md">30% OFF</span>
              </button>
            </div>

            {/* Plan cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {PLANS.map((plan) => {
                const price = billingInterval === "monthly" ? plan.monthlyPrice : plan.yearlyPrice;
                const isLoading = checkoutLoading === plan.id;
                return (
                  <Card
                    key={plan.id}
                    className={`p-6 rounded-2xl flex flex-col gap-4 relative ${
                      plan.highlight
                        ? "border-primary border-2 shadow-lg shadow-primary/10"
                        : "border-border shadow-sm"
                    }`}
                  >
                    {plan.highlight && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <span className="text-xs font-bold bg-primary text-white px-3 py-1 rounded-full">Most Popular</span>
                      </div>
                    )}
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{plan.name}</p>
                      <p className="text-sm text-muted-foreground mt-0.5">{plan.tagline}</p>
                    </div>
                    <div className="flex items-end gap-1">
                      <span className="text-4xl font-extrabold text-foreground">${price}</span>
                      <span className="text-sm text-muted-foreground mb-1.5">/ mo</span>
                    </div>
                    {billingInterval === "yearly" && (
                      <p className="text-xs text-muted-foreground -mt-3">Billed yearly · 30% off</p>
                    )}
                    <ul className="flex flex-col gap-1.5">
                      {plan.features.map((f) => (
                        <li key={f} className="flex items-center gap-2 text-sm text-foreground">
                          <span className="text-green-500 font-bold">+</span>
                          {f}
                        </li>
                      ))}
                    </ul>
                    <button
                      type="button"
                      onClick={() => handleSelectPlan(plan.id)}
                      disabled={checkoutLoading !== null}
                      className={`w-full mt-auto rounded-xl font-bold py-3 text-sm transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed ${
                        plan.highlight
                          ? "bg-primary text-white shadow-md shadow-primary/30 hover:bg-primary/90"
                          : "bg-muted text-foreground border border-border hover:bg-muted/80"
                      }`}
                    >
                      {isLoading ? "Redirecting…" : `Start ${plan.name}`}
                    </button>
                  </Card>
                );
              })}
            </div>
          </>
        )}

      </div>
    </div>
  );
}
