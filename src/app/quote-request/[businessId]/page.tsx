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
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center bg-white">
        <div className="flex size-20 items-center justify-center rounded-full bg-green-100 mb-6">
          <svg className="w-10 h-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-2xl font-extrabold text-gray-900 mb-2">Request Received!</h1>
        <p className="text-gray-500 text-sm max-w-xs">
          Thanks! We'll review your request and reach out shortly to confirm your quote.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* Progress bar */}
      <div className="flex gap-1 px-4 pt-5">
        {progressSteps.map((s, i) => (
          <div
            key={s}
            className="flex-1 h-1 rounded-full transition-colors duration-300"
            style={{
              backgroundColor:
                i < stepIndex ? "#0d3b5e" :
                i === stepIndex ? "#0d3b5e" :
                "#e5e7eb",
              opacity: i <= stepIndex ? 1 : 0.4,
            }}
          />
        ))}
      </div>

      {/* Back button */}
      {stepIndex > 0 && (
        <button
          onClick={() => setStep(STEPS[stepIndex - 1])}
          className="self-start mt-3 ml-4 flex items-center gap-1 text-sm text-gray-500 font-medium"
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
            <h1 className="text-2xl font-extrabold text-[#0d3b5e] uppercase tracking-tight text-center mb-6">
              Let's Get to Know You!
            </h1>
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <input
                  className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-medium text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0d3b5e]/30"
                  placeholder="First Name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                />
                <input
                  className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-medium text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0d3b5e]/30"
                  placeholder="Last Name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
              </div>
              <input
                className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-medium text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0d3b5e]/30"
                placeholder="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <input
                className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-medium text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0d3b5e]/30"
                placeholder="Phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
              <select
                className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-medium text-gray-500 focus:outline-none focus:ring-2 focus:ring-[#0d3b5e]/30"
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
              className="mt-6 w-full py-3.5 rounded-full bg-[#0d3b5e] text-white font-bold text-sm disabled:opacity-40 active:scale-95 transition-transform flex items-center justify-center gap-2"
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
            <h1 className="text-2xl font-extrabold text-[#0d3b5e] uppercase tracking-tight text-center mb-8">
              What Type of Property?
            </h1>
            <div className="grid grid-cols-2 gap-4">
              {(["residential", "commercial"] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => { setPropertyType(type); next(); }}
                  className={`flex flex-col items-center gap-4 rounded-3xl border-2 py-8 px-4 transition-all active:scale-95 ${
                    propertyType === type
                      ? "border-[#0d3b5e] bg-[#0d3b5e]/5"
                      : "border-gray-200 bg-white"
                  }`}
                >
                  {type === "residential" ? (
                    <svg className="w-14 h-14 text-[#0d3b5e]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                    </svg>
                  ) : (
                    <svg className="w-14 h-14 text-[#0d3b5e]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  )}
                  <span className="font-extrabold text-sm uppercase tracking-wide text-[#0d3b5e]">
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
            <h1 className="text-2xl font-extrabold text-[#0d3b5e] uppercase tracking-tight text-center mb-6">
              What Services?
            </h1>
            <div className="grid grid-cols-2 gap-3">
              {SERVICES.map((s) => {
                const selected = selectedServices.includes(s);
                return (
                  <button
                    key={s}
                    onClick={() => toggleService(s)}
                    className={`flex flex-col items-center gap-3 rounded-3xl border-2 py-6 px-3 text-center transition-all active:scale-95 ${
                      selected
                        ? "border-[#0d3b5e] bg-[#0d3b5e]/5"
                        : "border-gray-200 bg-white"
                    }`}
                  >
                    <svg className="w-10 h-10 text-[#0d3b5e]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="font-bold text-xs uppercase tracking-wide text-[#0d3b5e] leading-tight">{s}</span>
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => next()}
              disabled={selectedServices.length === 0}
              className="mt-6 w-full py-3.5 rounded-full bg-[#0d3b5e] text-white font-bold text-sm disabled:opacity-40 active:scale-95 transition-transform flex items-center justify-center gap-2"
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
            <h1 className="text-2xl font-extrabold text-[#0d3b5e] uppercase tracking-tight text-center mb-6">
              Pick Your Frequency
            </h1>
            <div className="flex flex-col gap-3">
              {FREQUENCIES.map((f) => (
                <button
                  key={f.value}
                  onClick={() => { setFrequency(f.value); next(); }}
                  className={`flex items-center justify-between rounded-3xl border-2 px-5 py-4 transition-all active:scale-[0.98] ${
                    frequency === f.value
                      ? "border-[#0d3b5e] bg-[#0d3b5e]/5"
                      : "border-gray-200 bg-white"
                  }`}
                >
                  <div className="flex flex-col items-start">
                    <span className="font-extrabold text-sm uppercase tracking-wide text-[#0d3b5e]">{f.label}</span>
                    {f.savings && (
                      <span className="text-xs font-bold text-teal-500 mt-0.5">{f.savings}</span>
                    )}
                    <div className="flex flex-col gap-0.5 mt-1.5">
                      {["FREE RainBlock Tech", "7 Day Rain Guarantee", "FREE Hard Water Removal"].map((perk) => (
                        <span key={perk} className="text-[10px] text-gray-500">✓ {perk}</span>
                      ))}
                    </div>
                  </div>
                  {frequency === f.value && (
                    <div className="size-5 rounded-full bg-[#0d3b5e] flex items-center justify-center shrink-0">
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
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
            <h1 className="text-2xl font-extrabold text-[#0d3b5e] uppercase tracking-tight text-center mb-2">
              You're Almost There!
            </h1>
            <p className="text-center text-sm text-gray-400 mb-6">Where should we send the quote?</p>
            <div className="flex flex-col gap-3">
              <input
                className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-medium text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0d3b5e]/30"
                placeholder="Street Address"
                value={street}
                onChange={(e) => setStreet(e.target.value)}
              />
              <input
                className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-medium text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0d3b5e]/30"
                placeholder="City"
                value={city}
                onChange={(e) => setCity(e.target.value)}
              />
              <div className="grid grid-cols-2 gap-3">
                <select
                  className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#0d3b5e]/30"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                >
                  {["AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"].map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <input
                  className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-medium text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0d3b5e]/30"
                  placeholder="Zip Code"
                  value={zip}
                  onChange={(e) => setZip(e.target.value)}
                />
              </div>
            </div>

            {error && (
              <p className="mt-4 text-sm text-red-500 text-center">{error}</p>
            )}

            <button
              onClick={submit}
              disabled={submitting || !street.trim() || !city.trim()}
              className="mt-6 w-full py-3.5 rounded-full bg-[#0d3b5e] text-white font-bold text-sm disabled:opacity-40 active:scale-95 transition-transform flex items-center justify-center gap-2"
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
