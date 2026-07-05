"use client";

import { useState } from "react";
import { useParams } from "next/navigation";

type Step = "contact" | "property" | "services" | "frequency" | "address" | "done";

const SERVICES = [
  "Exterior Window Cleaning",
  "Interior Window Cleaning",
  "Screen Cleaning",
  "Pressure Wash / Soft Wash",
  "Solar Panel Cleaning",
  "Gutter Cleaning",
];

const FREQUENCIES = [
  { value: "monthly",   label: "Monthly",   savings: "$150 OFF" },
  { value: "quarterly", label: "Quarterly", savings: "$100 OFF" },
  { value: "biannual",  label: "Biannual",  savings: "$50 OFF"  },
  { value: "one-time",  label: "One-Time",  savings: null       },
];

const HOW_HEARD = ["Google", "Social Media", "Referral", "Door to Door", "Flyer", "Other"];

const STEPS: Step[] = ["contact", "property", "services", "frequency", "address", "done"];
const STEP_LABELS: Record<Step, string> = {
  contact: "Let's get to know you",
  property: "Property type",
  services: "Services needed",
  frequency: "Frequency",
  address: "Your address",
  done: "Done",
};

const INPUT_CLASS =
  "flex h-12 w-full rounded-xl border border-border bg-transparent px-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

const PRIMARY_BUTTON_CLASS =
  "mt-6 w-full py-3.5 rounded-full bg-primary text-white font-bold text-sm disabled:opacity-40 active:scale-95 transition-transform hover:shadow-lg hover:shadow-primary/20 flex items-center justify-center gap-2";

function StepHeader({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="text-center mb-6">
      <p className="text-xs font-bold uppercase tracking-wider text-primary mb-2">{eyebrow}</p>
      <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
      {subtitle && <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>}
    </div>
  );
}

export default function QuoteRequestPage() {
  const params = useParams();
  const businessId = params.businessId as string;

  const [step, setStep] = useState<Step>("contact");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName]   = useState("");
  const [email, setEmail]         = useState("");
  const [phone, setPhone]         = useState("");
  const [source, setSource]       = useState("");
  const [propertyType, setPropertyType] = useState<"residential" | "commercial" | "">("");
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [frequency, setFrequency] = useState("");
  const [street, setStreet]       = useState("");
  const [city, setCity]           = useState("");
  const [state, setState]         = useState("UT");
  const [zip, setZip]             = useState("");

  const stepIndex = STEPS.indexOf(step);
  const progressSteps = STEPS.filter((s) => s !== "done");

  function toggleService(s: string) {
    setSelectedServices((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );
  }

  function next(to?: Step) {
    const idx = stepIndex;
    setStep(to ?? STEPS[idx + 1]);
  }

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/leads/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          business_id: businessId,
          name: `${firstName.trim()} ${lastName.trim()}`.trim(),
          email: email || null,
          phone: phone || null,
          property_type: propertyType || null,
          services: selectedServices.length > 0 ? selectedServices : null,
          frequency: frequency || null,
          address: [street, city, state, zip].filter(Boolean).join(", ") || null,
          source: source || "Website",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Submission failed");
      setStep("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Done screen ──────────────────────────────────────────────────────────────
  if (step === "done") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center bg-background">
        <div className="flex size-20 items-center justify-center rounded-full icon-green mb-6">
          <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p className="text-xs font-bold uppercase tracking-wider text-primary mb-2">Quote Request</p>
        <h1 className="text-2xl font-bold tracking-tight text-foreground mb-2">Request Received!</h1>
        <p className="text-muted-foreground text-sm max-w-xs">
          Thanks! We&apos;ll review your request and reach out shortly to confirm your quote.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Progress bar */}
      <div className="flex gap-1 px-4 pt-5">
        {progressSteps.map((s, i) => (
          <div
            key={s}
            className={`flex-1 h-1 rounded-full transition-colors duration-300 ${
              i <= stepIndex ? "bg-primary" : "bg-border opacity-40"
            }`}
          />
        ))}
      </div>

      {/* Back button */}
      {stepIndex > 0 && (
        <button
          onClick={() => setStep(STEPS[stepIndex - 1])}
          className="self-start mt-3 ml-4 flex items-center gap-1 text-sm text-muted-foreground font-medium"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>
      )}

      <div className="flex-1 flex flex-col px-5 pt-6 pb-10 max-w-lg mx-auto w-full">

        {/* ── CONTACT ───────────────────────────────────────────────────── */}
        {step === "contact" && (
          <>
            <StepHeader
              eyebrow="Step 1 of 5"
              title="Let's Get to Know You!"
              subtitle="A few quick details so we can reach you."
            />
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <input
                  className={INPUT_CLASS}
                  placeholder="First Name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                />
                <input
                  className={INPUT_CLASS}
                  placeholder="Last Name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
              </div>
              <input
                className={INPUT_CLASS}
                placeholder="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <input
                className={INPUT_CLASS}
                placeholder="Phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
              <select
                className={`${INPUT_CLASS} ${source === "" ? "text-muted-foreground" : ""}`}
                value={source}
                onChange={(e) => setSource(e.target.value)}
              >
                <option value="">How you heard about us</option>
                {HOW_HEARD.map((h) => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
            <button
              onClick={() => next()}
              disabled={!firstName.trim()}
              className={PRIMARY_BUTTON_CLASS}
            >
              NEXT
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </>
        )}

        {/* ── PROPERTY TYPE ─────────────────────────────────────────────── */}
        {step === "property" && (
          <>
            <StepHeader
              eyebrow="Step 2 of 5"
              title="What Type of Property?"
              subtitle="Choose the option that best describes your property."
            />
            <div className="grid grid-cols-2 gap-4">
              {(["residential", "commercial"] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => { setPropertyType(type); next(); }}
                  className={`flex flex-col items-center gap-4 rounded-2xl border-2 py-8 px-4 transition-all active:scale-95 ${
                    propertyType === type
                      ? "border-primary bg-primary/5"
                      : "border-border bg-card"
                  }`}
                >
                  {type === "residential" ? (
                    <svg className="w-14 h-14 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                    </svg>
                  ) : (
                    <svg className="w-14 h-14 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  )}
                  <span className="font-bold text-sm uppercase tracking-wider text-foreground">
                    {type}
                  </span>
                </button>
              ))}
            </div>
          </>
        )}

        {/* ── SERVICES ──────────────────────────────────────────────────── */}
        {step === "services" && (
          <>
            <StepHeader
              eyebrow="Step 3 of 5"
              title="What Services?"
              subtitle="Select all the services you're interested in."
            />
            <div className="grid grid-cols-2 gap-3">
              {SERVICES.map((s) => {
                const selected = selectedServices.includes(s);
                return (
                  <button
                    key={s}
                    onClick={() => toggleService(s)}
                    className={`flex flex-col items-center gap-3 rounded-2xl border-2 py-6 px-3 text-center transition-all active:scale-95 ${
                      selected
                        ? "border-primary bg-primary/5"
                        : "border-border bg-card"
                    }`}
                  >
                    <svg className="w-10 h-10 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="font-bold text-xs uppercase tracking-wider text-foreground leading-tight">{s}</span>
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => next()}
              disabled={selectedServices.length === 0}
              className={PRIMARY_BUTTON_CLASS}
            >
              NEXT
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </>
        )}

        {/* ── FREQUENCY ─────────────────────────────────────────────────── */}
        {step === "frequency" && (
          <>
            <StepHeader
              eyebrow="Step 4 of 5"
              title="Pick Your Frequency"
              subtitle="More frequent visits unlock bigger savings."
            />
            <div className="flex flex-col gap-3">
              {FREQUENCIES.map((f) => (
                <button
                  key={f.value}
                  onClick={() => { setFrequency(f.value); next(); }}
                  className={`flex items-center justify-between rounded-2xl border-2 px-5 py-4 transition-all active:scale-[0.98] ${
                    frequency === f.value
                      ? "border-primary bg-primary/5"
                      : "border-border bg-card"
                  }`}
                >
                  <div className="flex flex-col items-start">
                    <span className="font-bold text-sm uppercase tracking-wider text-foreground">{f.label}</span>
                    {f.savings && (
                      <span className="text-xs font-bold text-highlight-teal mt-0.5">{f.savings}</span>
                    )}
                    <div className="flex flex-col gap-0.5 mt-1.5">
                      {["FREE RainBlock Tech", "7 Day Rain Guarantee", "FREE Hard Water Removal"].map((perk) => (
                        <span key={perk} className="text-[10px] text-muted-foreground">✓ {perk}</span>
                      ))}
                    </div>
                  </div>
                  {frequency === f.value && (
                    <div className="size-5 rounded-full bg-primary flex items-center justify-center shrink-0">
                      <svg className="w-3 h-3 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </>
        )}

        {/* ── ADDRESS ───────────────────────────────────────────────────── */}
        {step === "address" && (
          <>
            <StepHeader
              eyebrow="Step 5 of 5"
              title="You're Almost There!"
              subtitle="Where should we send the quote?"
            />
            <div className="flex flex-col gap-3">
              <input
                className={INPUT_CLASS}
                placeholder="Street Address"
                value={street}
                onChange={(e) => setStreet(e.target.value)}
              />
              <input
                className={INPUT_CLASS}
                placeholder="City"
                value={city}
                onChange={(e) => setCity(e.target.value)}
              />
              <div className="grid grid-cols-2 gap-3">
                <select
                  className={INPUT_CLASS}
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                >
                  {["AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"].map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <input
                  className={INPUT_CLASS}
                  placeholder="Zip Code"
                  value={zip}
                  onChange={(e) => setZip(e.target.value)}
                />
              </div>
            </div>

            {error && (
              <p className="mt-4 text-sm text-destructive text-center">{error}</p>
            )}

            <button
              onClick={submit}
              disabled={submitting || !street.trim() || !city.trim()}
              className={PRIMARY_BUTTON_CLASS}
            >
              {submitting ? "Submitting…" : (
                <>
                  SUBMIT
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </>
              )}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
