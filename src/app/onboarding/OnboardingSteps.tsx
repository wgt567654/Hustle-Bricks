"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import type { ComponentType } from "react";
import { BUSINESS_TYPE_OPTIONS } from "@/lib/businessTypes";
import { INDUSTRY_TEMPLATES } from "@/lib/industry-templates";
import { ACCENT_PRESETS, DEFAULT_THEME, applyThemeToDocument } from "@/lib/customization";
import {
  AI_TONES,
  AUTOMATION_OPTIONS,
  BIGGEST_CHALLENGES,
  BUSINESS_STAGES,
  COUNTRIES,
  GOAL_MAX,
  GOAL_MIN,
  GOAL_PRESETS,
  GOAL_STEP,
  GROWTH_PRIORITIES,
  JOB_VALUE_RANGES,
  PAYMENT_METHOD_OPTIONS,
  TAX_RATE_CHIPS,
  TEAM_SIZES,
  WEEKDAYS,
  serviceSuggestionsFor,
  type ChoiceOption,
  type StepId,
} from "@/lib/onboarding/config";
import { createClient } from "@/lib/supabase/client";
import { saveProgress, type OnboardingAnswers } from "./save";

export type ConnectStatus = "not_connected" | "pending" | "active";

export type StepProps = {
  a: OnboardingAnswers;
  set: (patch: Partial<OnboardingAnswers>) => void;
  businessId: string | null;
  connectStatus: ConnectStatus;
};

/* ── Shared primitives ────────────────────────────────────────────────────── */

const inputCls =
  "flex h-12 w-full rounded-xl border border-border bg-card px-3 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

function StepHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
        {title}
      </h1>
      {subtitle && (
        <p className="text-sm text-muted-foreground leading-relaxed">{subtitle}</p>
      )}
    </div>
  );
}

function Label({
  children,
  optional,
  htmlFor,
}: {
  children: React.ReactNode;
  optional?: boolean;
  htmlFor?: string;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="text-xs font-bold uppercase tracking-wider text-muted-foreground"
    >
      {children}
      {optional && (
        <span className="normal-case font-normal text-muted-foreground/60"> (optional)</span>
      )}
    </label>
  );
}

/** Single-select card grid — the workhorse for one-tap answers. */
function OptionGrid({
  options,
  value,
  onChange,
  columns = 2,
}: {
  options: ChoiceOption[];
  value: string | null;
  onChange: (key: string) => void;
  columns?: 1 | 2 | 3;
}) {
  const cols =
    columns === 3 ? "grid-cols-2 sm:grid-cols-3" : columns === 1 ? "grid-cols-1" : "grid-cols-2";
  return (
    <div className={`grid ${cols} gap-3`}>
      {options.map((o) => {
        const selected = value === o.key;
        return (
          <button
            key={o.key}
            type="button"
            onClick={() => onChange(o.key)}
            className={`press flex flex-col items-start gap-2.5 rounded-2xl border-2 p-4 text-left transition-all ${
              selected
                ? "border-primary bg-primary/5 shadow-sm"
                : "border-border bg-card hover:border-muted-foreground/40"
            }`}
          >
            <span
              className={`material-symbols-outlined flex size-9 items-center justify-center rounded-xl text-[20px] ${
                selected ? "bg-primary text-primary-foreground" : "icon-primary"
              }`}
            >
              {o.icon}
            </span>
            <span className="flex flex-col gap-0.5">
              <span className="text-sm font-bold text-foreground leading-tight">{o.label}</span>
              {o.hint && <span className="text-xs text-muted-foreground">{o.hint}</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** Multi-select chip row. */
function ChipRow({
  options,
  values,
  onToggle,
  max,
}: {
  options: ChoiceOption[];
  values: string[];
  onToggle: (key: string) => void;
  max?: number;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const selected = values.includes(o.key);
        const capped = !!max && !selected && values.length >= max;
        return (
          <button
            key={o.key}
            type="button"
            disabled={capped}
            onClick={() => onToggle(o.key)}
            className={`press inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-semibold transition-all disabled:opacity-40 ${
              selected
                ? "border-primary bg-primary text-primary-foreground shadow-sm"
                : "border-border bg-card text-foreground hover:border-muted-foreground/40"
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">
              {selected ? "check" : o.icon}
            </span>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function Switch({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
        on ? "bg-primary" : "bg-border"
      }`}
    >
      <span
        className={`absolute top-1 size-5 rounded-full bg-white shadow-sm transition-transform ${
          on ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}

/* ── You ──────────────────────────────────────────────────────────────────── */

function WelcomeStep({ a }: StepProps) {
  const rows = [
    { icon: "request_quote", text: "Quotes, jobs, and payments in one place" },
    { icon: "calendar_month", text: "Scheduling built around your crew" },
    { icon: "smart_toy", text: "An AI assistant that knows your business" },
  ];
  return (
    <div className="flex flex-col gap-7">
      <span
        className="material-symbols-outlined flex size-14 items-center justify-center rounded-2xl text-[30px]"
        style={{
          color: "var(--brand-brick)",
          background: "color-mix(in oklch, var(--brand-brick) 14%, transparent)",
        }}
      >
        foundation
      </span>
      <StepHeader
        title={a.firstName ? `Welcome, ${a.firstName}.` : "Welcome to HustleBricks."}
        subtitle="A few quick questions and your workspace will be tuned to how you actually run your business — not a blank slate."
      />
      <div className="flex flex-col gap-4">
        {rows.map((r) => (
          <div key={r.icon} className="flex items-center gap-3.5">
            <span className="material-symbols-outlined icon-primary flex size-9 shrink-0 items-center justify-center rounded-xl text-[18px]">
              {r.icon}
            </span>
            <p className="text-sm font-medium text-foreground">{r.text}</p>
          </div>
        ))}
      </div>
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="material-symbols-outlined text-[16px]">timer</span>
        About 3 minutes. Everything saves as you go — skip anything.
      </p>
    </div>
  );
}

function NameStep({ a, set }: StepProps) {
  return (
    <div className="flex flex-col gap-6">
      <StepHeader
        title="First, introduce yourself"
        subtitle="This is how you'll appear to clients and your crew."
      />
      <div className="flex gap-3">
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor="ob-first">First name</Label>
          <input
            id="ob-first"
            type="text"
            placeholder="Jesse"
            autoFocus
            value={a.firstName}
            onChange={(e) => set({ firstName: e.target.value })}
            className={inputCls}
          />
        </div>
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor="ob-last">Last name</Label>
          <input
            id="ob-last"
            type="text"
            placeholder="Rivera"
            value={a.lastName}
            onChange={(e) => set({ lastName: e.target.value })}
            className={inputCls}
          />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ob-phone" optional>
          Mobile number
        </Label>
        <input
          id="ob-phone"
          type="tel"
          placeholder="(555) 123-4567"
          value={a.phone}
          onChange={(e) => set({ phone: e.target.value })}
          className={inputCls}
        />
        <p className="text-xs text-muted-foreground">Used for booking and job alerts.</p>
      </div>
    </div>
  );
}

/* ── Business ─────────────────────────────────────────────────────────────── */

function BusinessStep({ a, set }: StepProps) {
  return (
    <div className="flex flex-col gap-6">
      <StepHeader
        title="Name your business"
        subtitle="This appears on quotes, invoices, and your booking page."
      />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ob-bizname">Business name</Label>
        <input
          id="ob-bizname"
          type="text"
          placeholder="e.g. Ridgeline Pressure Washing"
          autoFocus
          value={a.businessName}
          onChange={(e) => set({ businessName: e.target.value })}
          className={inputCls}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label>Country</Label>
        <div className="flex gap-3">
          {COUNTRIES.map((c) => (
            <button
              key={c.code}
              type="button"
              onClick={() => set({ country: c.code })}
              className={`press flex flex-1 flex-col items-start gap-1 rounded-2xl border-2 p-3 transition-all ${
                a.country === c.code
                  ? "border-primary bg-primary/5"
                  : "border-border bg-card hover:border-muted-foreground/40"
              }`}
            >
              <span className="text-xl">{c.flag}</span>
              <span className="text-xs font-bold leading-tight text-foreground">{c.name}</span>
              <span className="text-xs text-muted-foreground">{c.currency}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function IndustryStep({ a, set }: StepProps) {
  const [customInput, setCustomInput] = useState(a.industry === "custom" ? a.industryLabel : "");
  const [showList, setShowList] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setShowList(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const filtered = BUSINESS_TYPE_OPTIONS.filter((o) =>
    o.toLowerCase().includes(customInput.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-6">
      <StepHeader
        title="What's your trade?"
        subtitle="One tap sets up your accent color, shortcuts, pipeline stages, and the job fields your crew actually needs. Everything stays editable."
      />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {INDUSTRY_TEMPLATES.map((t) => {
          const selected = a.industry === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => set({ industry: t.id, industryLabel: t.name })}
              className={`press flex flex-col items-start gap-2.5 rounded-2xl border-2 p-3.5 text-left transition-all ${
                selected
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "border-border bg-card hover:border-muted-foreground/40"
              }`}
            >
              <span
                className="material-symbols-outlined flex size-9 items-center justify-center rounded-xl text-[20px]"
                style={{
                  color: `oklch(0.52 ${t.accentC} ${t.accentH})`,
                  background: `oklch(0.52 ${t.accentC} ${t.accentH} / 0.12)`,
                }}
              >
                {t.icon}
              </span>
              <span className="text-[13px] font-bold leading-tight text-foreground">{t.name}</span>
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => set({ industry: "custom", industryLabel: customInput })}
          className={`press flex flex-col items-start gap-2.5 rounded-2xl border-2 border-dashed p-3.5 text-left transition-all ${
            a.industry === "custom"
              ? "border-primary bg-primary/5"
              : "border-border bg-card hover:border-muted-foreground/40"
          }`}
        >
          <span className="material-symbols-outlined icon-primary flex size-9 items-center justify-center rounded-xl text-[20px]">
            more_horiz
          </span>
          <span className="text-[13px] font-bold leading-tight text-foreground">Something else</span>
        </button>
      </div>

      {a.industry === "custom" && (
        <div ref={boxRef} className="relative flex flex-col gap-1.5 animate-in-down">
          <Label htmlFor="ob-industry-custom">Your trade</Label>
          <input
            id="ob-industry-custom"
            type="text"
            placeholder="e.g. Pool Service, Junk Removal…"
            autoFocus
            value={customInput}
            onChange={(e) => {
              setCustomInput(e.target.value);
              set({ industryLabel: e.target.value });
              setShowList(true);
            }}
            onFocus={() => setShowList(true)}
            className={inputCls}
          />
          {showList && customInput && filtered.length > 0 && (
            <ul className="glass-panel absolute top-full z-10 mt-1 max-h-44 w-full overflow-y-auto rounded-xl">
              {filtered.map((opt) => (
                <li
                  key={opt}
                  onMouseDown={() => {
                    setCustomInput(opt);
                    set({ industryLabel: opt });
                    setShowList(false);
                  }}
                  className="cursor-pointer px-3 py-2.5 text-sm transition-colors hover:bg-muted"
                >
                  {opt}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function ServicesStep({ a, set }: StepProps) {
  const suggestions = serviceSuggestionsFor(
    a.industry === "custom" ? null : a.industry
  );
  const [customName, setCustomName] = useState("");
  const [customPrice, setCustomPrice] = useState("");
  const seeded = useRef(false);

  // smart default: preselect the suggested catalog once, on first visit
  useEffect(() => {
    if (!seeded.current && a.services.length === 0) {
      seeded.current = true;
      set({ services: suggestions.map((s) => ({ ...s })) });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedNames = new Set(a.services.map((s) => s.name));

  function toggle(s: { name: string; price: number }) {
    if (selectedNames.has(s.name)) {
      set({ services: a.services.filter((x) => x.name !== s.name) });
    } else {
      set({ services: [...a.services, { ...s }] });
    }
  }

  function addCustom() {
    const name = customName.trim();
    if (!name || selectedNames.has(name)) return;
    set({
      services: [...a.services, { name, price: Number(customPrice) || 0 }],
    });
    setCustomName("");
    setCustomPrice("");
  }

  const extras = a.services.filter(
    (s) => !suggestions.some((x) => x.name === s.name)
  );

  return (
    <div className="flex flex-col gap-6">
      <StepHeader
        title="What do you offer?"
        subtitle="These become your service catalog — ready for quotes, jobs, and online booking. Prices are starting points you can edit anytime."
      />
      <div className="flex flex-wrap gap-2">
        {suggestions.map((s) => {
          const selected = selectedNames.has(s.name);
          return (
            <button
              key={s.name}
              type="button"
              onClick={() => toggle(s)}
              className={`press inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-semibold transition-all ${
                selected
                  ? "border-primary bg-primary text-primary-foreground shadow-sm"
                  : "border-border bg-card text-foreground hover:border-muted-foreground/40"
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">
                {selected ? "check" : "add"}
              </span>
              {s.name}
              <span className={`tnum text-xs ${selected ? "text-primary-foreground/75" : "text-muted-foreground"}`}>
                ${s.price}
              </span>
            </button>
          );
        })}
        {extras.map((s) => (
          <button
            key={s.name}
            type="button"
            onClick={() => toggle(s)}
            className="press inline-flex items-center gap-2 rounded-full border border-primary bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground shadow-sm"
          >
            <span className="material-symbols-outlined text-[16px]">check</span>
            {s.name}
            <span className="tnum text-xs text-primary-foreground/75">${s.price}</span>
          </button>
        ))}
      </div>
      <div className="flex items-end gap-2">
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor="ob-svc-name" optional>
            Add your own
          </Label>
          <input
            id="ob-svc-name"
            type="text"
            placeholder="Service name"
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addCustom();
              }
            }}
            className={inputCls}
          />
        </div>
        <div className="flex w-24 flex-col gap-1.5">
          <Label htmlFor="ob-svc-price">Price</Label>
          <input
            id="ob-svc-price"
            type="number"
            min="0"
            placeholder="0"
            value={customPrice}
            onChange={(e) => setCustomPrice(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addCustom();
              }
            }}
            className={`${inputCls} tnum`}
          />
        </div>
        <button
          type="button"
          onClick={addCustom}
          disabled={!customName.trim()}
          className="press flex size-12 shrink-0 items-center justify-center rounded-xl bg-secondary text-secondary-foreground disabled:opacity-40"
          aria-label="Add service"
        >
          <span className="material-symbols-outlined text-[20px]">add</span>
        </button>
      </div>
    </div>
  );
}

function TeamStep({ a, set }: StepProps) {
  return (
    <div className="flex flex-col gap-6">
      <StepHeader
        title="How big is your crew?"
        subtitle="Sets your booking capacity and how team features show up."
      />
      <OptionGrid
        options={TEAM_SIZES}
        value={a.teamSize}
        onChange={(teamSize) => set({ teamSize })}
      />
    </div>
  );
}

function StageStep({ a, set }: StepProps) {
  return (
    <div className="flex flex-col gap-6">
      <StepHeader
        title="Where's the business at?"
        subtitle="Your AI assistant calibrates its advice to your stage."
      />
      <OptionGrid
        options={BUSINESS_STAGES}
        value={a.stage}
        onChange={(stage) => set({ stage })}
      />
    </div>
  );
}

/* ── Money ────────────────────────────────────────────────────────────────── */

function JobValueStep({ a, set }: StepProps) {
  return (
    <div className="flex flex-col gap-6">
      <StepHeader
        title="What's a typical job worth?"
        subtitle="Anchors your analytics and helps the AI sanity-check pricing."
      />
      <OptionGrid
        options={JOB_VALUE_RANGES}
        value={a.jobValue}
        onChange={(jobValue) => set({ jobValue })}
      />
    </div>
  );
}

function GoalStep({ a, set }: StepProps) {
  const goal = a.goal ?? 0;
  const symbol = COUNTRIES.find((c) => c.code === a.country)?.symbol ?? "$";
  return (
    <div className="flex flex-col gap-7">
      <StepHeader
        title="Set a monthly revenue goal"
        subtitle="It anchors your analytics and gives the AI a target to coach you toward. Aim high — you can adjust it anytime."
      />
      <div className="flex flex-col items-center gap-1 py-2">
        <p className="tnum text-5xl font-extrabold tracking-tight text-foreground">
          {symbol}
          {goal.toLocaleString()}
        </p>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          per month
        </p>
      </div>
      <input
        type="range"
        min={GOAL_MIN}
        max={GOAL_MAX}
        step={GOAL_STEP}
        value={goal || GOAL_MIN}
        onChange={(e) => set({ goal: Number(e.target.value) })}
        className="h-2 w-full cursor-pointer appearance-none rounded-full bg-border"
        style={{ accentColor: "var(--primary)" }}
        aria-label="Monthly revenue goal"
      />
      <div className="flex flex-wrap gap-2">
        {GOAL_PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => set({ goal: p })}
            className={`press tnum rounded-full border px-4 py-2 text-sm font-semibold transition-all ${
              goal === p
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-foreground hover:border-muted-foreground/40"
            }`}
          >
            {symbol}
            {p >= 1000 ? `${p / 1000}k` : p}
          </button>
        ))}
      </div>
    </div>
  );
}

function MoneyStep({ a, set }: StepProps) {
  const [customTax, setCustomTax] = useState<string>(
    a.taxRate !== null && !TAX_RATE_CHIPS.includes(a.taxRate) ? String(a.taxRate) : ""
  );

  function togglePayment(key: string) {
    set({
      paymentMethods: a.paymentMethods.includes(key)
        ? a.paymentMethods.filter((k) => k !== key)
        : [...a.paymentMethods, key],
    });
  }

  return (
    <div className="flex flex-col gap-7">
      <StepHeader
        title="Money basics"
        subtitle="Tax rate goes on every quote; payment methods show up when you collect."
      />
      <div className="flex flex-col gap-2.5">
        <Label>Sales tax rate</Label>
        <div className="flex flex-wrap items-center gap-2">
          {TAX_RATE_CHIPS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => {
                setCustomTax("");
                set({ taxRate: r });
              }}
              className={`press tnum rounded-full border px-4 py-2 text-sm font-semibold transition-all ${
                a.taxRate === r && customTax === ""
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-foreground hover:border-muted-foreground/40"
              }`}
            >
              {r}%
            </button>
          ))}
          <div className="relative">
            <input
              type="number"
              min="0"
              max="30"
              step="0.1"
              placeholder="Custom"
              value={customTax}
              onChange={(e) => {
                setCustomTax(e.target.value);
                const n = Number(e.target.value);
                if (!isNaN(n) && e.target.value !== "") set({ taxRate: n });
              }}
              className={`tnum h-[38px] w-24 rounded-full border bg-card px-3.5 pr-7 text-sm font-semibold shadow-none transition-colors placeholder:font-normal placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${
                customTax !== "" ? "border-primary" : "border-border"
              }`}
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">
              %
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2.5">
        <Label>How do you take payment?</Label>
        <ChipRow
          options={PAYMENT_METHOD_OPTIONS}
          values={a.paymentMethods}
          onToggle={togglePayment}
        />
      </div>

      {a.paymentMethods.includes("venmo") && (
        <div className="flex flex-col gap-1.5 animate-in-down">
          <Label htmlFor="ob-venmo">Venmo username</Label>
          <input
            id="ob-venmo"
            type="text"
            placeholder="@your-business"
            value={a.venmoUsername}
            onChange={(e) => set({ venmoUsername: e.target.value })}
            className={inputCls}
          />
        </div>
      )}
      {a.paymentMethods.includes("cashapp") && (
        <div className="flex flex-col gap-1.5 animate-in-down">
          <Label htmlFor="ob-cashapp">Cash App tag</Label>
          <input
            id="ob-cashapp"
            type="text"
            placeholder="$YourBusiness"
            value={a.cashappTag}
            onChange={(e) => set({ cashappTag: e.target.value })}
            className={inputCls}
          />
        </div>
      )}
      {a.paymentMethods.includes("check") && (
        <div className="flex flex-col gap-1.5 animate-in-down">
          <Label htmlFor="ob-check">Checks payable to</Label>
          <input
            id="ob-check"
            type="text"
            placeholder="Business or personal name"
            value={a.checkPayableTo}
            onChange={(e) => set({ checkPayableTo: e.target.value })}
            className={inputCls}
          />
        </div>
      )}
    </div>
  );
}

/** Real Stripe Connect — reuses /api/stripe/connect/express, returns to the wizard. */
function PaymentsStep({ businessId, connectStatus }: StepProps) {
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function connect() {
    if (!businessId || connecting) return;
    setConnecting(true);
    setError(null);
    // pin the resume pointer so the Stripe round-trip lands back on this step
    await saveProgress(createClient(), businessId, "payments");
    try {
      const res = await fetch("/api/stripe/connect/express", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId, returnTo: "onboarding" }),
      });
      const { url, error: apiError } = await res.json();
      if (apiError || !url) {
        setError(apiError || "Couldn't reach Stripe — try again in a moment.");
        setConnecting(false);
        return;
      }
      window.location.href = url;
    } catch {
      setError("Couldn't reach Stripe — try again in a moment.");
      setConnecting(false);
    }
  }

  const perks = [
    { icon: "credit_card", text: "Cards, Apple Pay, and Google Pay in the field" },
    { icon: "receipt_long", text: "Invoices clients can pay online" },
    { icon: "autorenew", text: "Recurring billing for service plans" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <StepHeader
        title="Get paid by card"
        subtitle="Connect Stripe to take card payments on the spot. Free to set up — you only pay standard card fees per transaction."
      />

      {connectStatus === "active" ? (
        <div className="flex items-center gap-3.5 rounded-2xl border border-border bg-card p-4">
          <span className="material-symbols-outlined icon-green flex size-10 shrink-0 items-center justify-center rounded-xl text-[20px]">
            check_circle
          </span>
          <div>
            <p className="text-sm font-bold text-foreground">Stripe connected</p>
            <p className="text-xs text-muted-foreground">
              You&apos;re ready to take card payments.
            </p>
          </div>
        </div>
      ) : connectStatus === "pending" ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center gap-3.5">
            <span className="material-symbols-outlined icon-caution flex size-10 shrink-0 items-center justify-center rounded-xl text-[20px]">
              hourglass_top
            </span>
            <div>
              <p className="text-sm font-bold text-foreground">Almost there</p>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Stripe is finishing its review. Keep going — we&apos;ll switch card
                payments on automatically.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={connect}
            disabled={connecting}
            className="press self-start rounded-xl bg-secondary px-4 py-2 text-sm font-semibold text-secondary-foreground disabled:opacity-50"
          >
            {connecting ? "Opening Stripe…" : "Review details in Stripe"}
          </button>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-4">
            {perks.map((p) => (
              <div key={p.icon} className="flex items-center gap-3.5">
                <span className="material-symbols-outlined icon-primary flex size-9 shrink-0 items-center justify-center rounded-xl text-[18px]">
                  {p.icon}
                </span>
                <p className="text-sm font-medium text-foreground">{p.text}</p>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={connect}
            disabled={connecting || !businessId}
            className="press flex w-full items-center justify-center gap-2 rounded-xl bg-[#635BFF] py-3.5 text-sm font-bold text-white shadow-md shadow-[#635BFF]/30 transition-all hover:bg-[#635BFF]/90 disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[18px]">bolt</span>
            {connecting ? "Opening Stripe…" : "Connect with Stripe"}
          </button>
          <p className="-mt-3 text-center text-xs text-muted-foreground">
            Takes about 2 minutes. You&apos;ll come right back here.
          </p>
        </>
      )}

      {error && (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-500 dark:bg-red-950/30">
          {error}
        </p>
      )}
    </div>
  );
}

/* ── Operations ───────────────────────────────────────────────────────────── */

function HoursStep({ a, set }: StepProps) {
  function toggleDay(day: number) {
    set({
      workDays: a.workDays.includes(day)
        ? a.workDays.filter((d) => d !== day)
        : [...a.workDays, day],
    });
  }
  return (
    <div className="flex flex-col gap-7">
      <StepHeader
        title="When do you work?"
        subtitle="Your booking page only offers times inside these hours. Fine-tune per-day later in Settings."
      />
      <div className="flex flex-col gap-2.5">
        <Label>Working days</Label>
        <div className="flex gap-2">
          {WEEKDAYS.map((d) => {
            const on = a.workDays.includes(d.day);
            return (
              <button
                key={d.day}
                type="button"
                onClick={() => toggleDay(d.day)}
                aria-label={d.label}
                aria-pressed={on}
                className={`press flex size-11 items-center justify-center rounded-full border text-sm font-bold transition-all ${
                  on
                    ? "border-primary bg-primary text-primary-foreground shadow-sm"
                    : "border-border bg-card text-muted-foreground hover:border-muted-foreground/40"
                }`}
              >
                {d.short}
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex items-end gap-3">
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor="ob-from">Start</Label>
          <input
            id="ob-from"
            type="time"
            value={a.dayFrom}
            onChange={(e) => set({ dayFrom: e.target.value })}
            className={`${inputCls} tnum`}
          />
        </div>
        <span className="pb-3.5 text-sm text-muted-foreground">to</span>
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor="ob-until">End</Label>
          <input
            id="ob-until"
            type="time"
            value={a.dayUntil}
            onChange={(e) => set({ dayUntil: e.target.value })}
            className={`${inputCls} tnum`}
          />
        </div>
      </div>
    </div>
  );
}

function AreaStep({ a, set }: StepProps) {
  const [areaInput, setAreaInput] = useState("");

  function addArea() {
    const v = areaInput.trim();
    if (!v || a.serviceAreas.includes(v)) return;
    set({ serviceAreas: [...a.serviceAreas, v] });
    setAreaInput("");
  }

  return (
    <div className="flex flex-col gap-6">
      <StepHeader
        title="Where do you work?"
        subtitle="Powers weather alerts for your crew and keeps jobs inside your territory."
      />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ob-city">Home base city</Label>
        <input
          id="ob-city"
          type="text"
          placeholder="e.g. Boise, ID"
          autoFocus
          value={a.city}
          onChange={(e) => set({ city: e.target.value })}
          className={inputCls}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ob-area" optional>
          Service areas
        </Label>
        <div className="flex gap-2">
          <input
            id="ob-area"
            type="text"
            placeholder="Neighborhood, city, or ZIP — press Enter"
            value={areaInput}
            onChange={(e) => setAreaInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addArea();
              }
            }}
            className={inputCls}
          />
          <button
            type="button"
            onClick={addArea}
            disabled={!areaInput.trim()}
            className="press flex size-12 shrink-0 items-center justify-center rounded-xl bg-secondary text-secondary-foreground disabled:opacity-40"
            aria-label="Add area"
          >
            <span className="material-symbols-outlined text-[20px]">add</span>
          </button>
        </div>
        {a.serviceAreas.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-2">
            {a.serviceAreas.map((area) => (
              <span
                key={area}
                className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-sm font-semibold text-secondary-foreground"
              >
                {area}
                <button
                  type="button"
                  onClick={() =>
                    set({ serviceAreas: a.serviceAreas.filter((x) => x !== area) })
                  }
                  aria-label={`Remove ${area}`}
                  className="material-symbols-outlined text-[16px] opacity-70 hover:opacity-100"
                >
                  close
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AutomationsStep({ a, set }: StepProps) {
  return (
    <div className="flex flex-col gap-6">
      <StepHeader
        title="Put the busywork on autopilot"
        subtitle="HustleBricks handles these in the background. Flip anything off — or change your mind later in Settings."
      />
      <div className="flex flex-col gap-3">
        {AUTOMATION_OPTIONS.map((o) => {
          const on = a.automations[o.key] ?? o.defaultOn;
          return (
            <div
              key={o.key}
              className="flex items-center gap-3.5 rounded-2xl border border-border bg-card p-4"
            >
              <span className="material-symbols-outlined icon-primary flex size-10 shrink-0 items-center justify-center rounded-xl text-[20px]">
                {o.icon}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-foreground">{o.label}</p>
                <p className="text-xs leading-relaxed text-muted-foreground">{o.description}</p>
              </div>
              <Switch
                on={on}
                onChange={(v) => set({ automations: { ...a.automations, [o.key]: v } })}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Personalize ──────────────────────────────────────────────────────────── */

function WorkspaceStep({ a, set }: StepProps) {
  const { theme: mode, setTheme: setMode } = useTheme();

  function pick(h: number, c: number) {
    set({ accentH: h, accentC: c });
    applyThemeToDocument({ ...DEFAULT_THEME, accentH: h, accentC: c });
  }

  return (
    <div className="flex flex-col gap-7">
      <StepHeader
        title="Make it yours"
        subtitle="Pick your workspace accent — the whole app re-skins live. There's a full Customize Studio inside for everything else."
      />
      <div className="grid grid-cols-5 gap-3">
        {ACCENT_PRESETS.map((p) => {
          const selected = a.accentH === p.h && a.accentC === p.c;
          return (
            <button
              key={p.name}
              type="button"
              onClick={() => pick(p.h, p.c)}
              className="press flex flex-col items-center gap-1.5"
              aria-pressed={selected}
            >
              <span
                className={`flex size-11 items-center justify-center rounded-full transition-all ${
                  selected ? "ring-2 ring-ring ring-offset-2 ring-offset-background" : ""
                }`}
                style={{ background: `oklch(0.52 ${p.c} ${p.h})` }}
              >
                {selected && (
                  <span className="material-symbols-outlined text-[18px] text-white">check</span>
                )}
              </span>
              <span className="text-[11px] font-semibold text-muted-foreground">{p.name}</span>
            </button>
          );
        })}
      </div>
      <div className="flex flex-col gap-2.5">
        <Label>Appearance</Label>
        <div className="flex gap-2 rounded-2xl bg-muted p-1">
          {[
            { key: "light", label: "Light", icon: "light_mode" },
            { key: "dark", label: "Dark", icon: "dark_mode" },
            { key: "system", label: "Auto", icon: "contrast" },
          ].map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => setMode(m.key)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-semibold transition-all ${
                mode === m.key
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">{m.icon}</span>
              {m.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function AiStep({ a, set }: StepProps) {
  return (
    <div className="flex flex-col gap-7">
      <StepHeader
        title="Tune your AI assistant"
        subtitle="It answers questions, texts clients, and keeps an eye on your money. Tell it how to show up."
      />
      <div className="flex flex-col gap-2.5">
        <Label>Voice</Label>
        <ChipRow
          options={AI_TONES}
          values={a.tone ? [a.tone] : []}
          onToggle={(tone) => set({ tone })}
        />
      </div>
      <div className="flex flex-col gap-2.5">
        <Label>What matters most right now? (pick up to 3)</Label>
        <ChipRow
          options={GROWTH_PRIORITIES}
          values={a.priorities}
          max={3}
          onToggle={(key) =>
            set({
              priorities: a.priorities.includes(key)
                ? a.priorities.filter((k) => k !== key)
                : [...a.priorities, key],
            })
          }
        />
      </div>
      <div className="flex flex-col gap-2.5">
        <Label>Biggest headache?</Label>
        <ChipRow
          options={BIGGEST_CHALLENGES}
          values={a.challenge ? [a.challenge] : []}
          onToggle={(challenge) =>
            set({ challenge: a.challenge === challenge ? null : challenge })
          }
        />
      </div>
    </div>
  );
}

/* ── Plan (ported from the previous onboarding page, behavior unchanged) ──── */

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

/** Suggest the plan that matches the crew size they told us about. */
function suggestedPlan(teamSize: string | null): string {
  if (teamSize === "16_plus") return "business";
  if (teamSize === "2_5" || teamSize === "6_15") return "team";
  return "solo";
}

function PlanStep({ a, businessId }: StepProps) {
  const router = useRouter();
  const [billingInterval, setBillingInterval] = useState<"monthly" | "yearly">("monthly");
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const suggested = suggestedPlan(a.teamSize);

  async function handleSelectPlan(planId: string) {
    if (!businessId) return;
    setCheckoutLoading(planId);
    setError(null);

    // Solo is free — no card, no Stripe. Activate the business and drop the
    // owner straight into the app. Team/Business still go through checkout.
    if (planId === "solo") {
      const { error: activateError } = await createClient()
        .from("businesses")
        .update({ subscription_status: "active", plan: "solo" })
        .eq("id", businessId);
      if (activateError) {
        setError(activateError.message);
        setCheckoutLoading(null);
        return;
      }
      router.push("/");
      return;
    }

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

  return (
    <div className="flex flex-col gap-6">
      <StepHeader
        title="Your setup is saved. Pick a plan."
        subtitle="Built and priced for growth. 7-day free trial on every plan."
      />
      {error && (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-500 dark:bg-red-950/30">
          {error}
        </p>
      )}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setBillingInterval("monthly")}
          className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
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
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
            billingInterval === "yearly"
              ? "bg-foreground text-background"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Yearly
          <span className="rounded-md bg-green-500 px-1.5 py-0.5 text-xs font-bold text-white">
            30% OFF
          </span>
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {PLANS.map((plan) => {
          const price = billingInterval === "monthly" ? plan.monthlyPrice : plan.yearlyPrice;
          const isLoading = checkoutLoading === plan.id;
          const isSuggested = plan.id === suggested;
          return (
            <div
              key={plan.id}
              className={`relative flex flex-col gap-4 rounded-2xl border bg-card p-6 ${
                plan.highlight
                  ? "border-2 border-primary shadow-lg shadow-primary/10"
                  : "border-border shadow-card"
              }`}
            >
              {plan.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="rounded-full bg-primary px-3 py-1 text-xs font-bold text-white">
                    Most Popular
                  </span>
                </div>
              )}
              <div>
                <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {plan.name}
                  {isSuggested && (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold normal-case tracking-normal text-primary">
                      For your crew size
                    </span>
                  )}
                </p>
                <p className="mt-0.5 text-sm text-muted-foreground">{plan.tagline}</p>
              </div>
              {plan.id === "solo" ? (
                <div>
                  <div className="flex items-end gap-1">
                    <span className="tnum text-4xl font-extrabold text-foreground">$0</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Free forever</p>
                </div>
              ) : (
                <>
                  <div className="flex items-end gap-1">
                    <span className="tnum text-4xl font-extrabold text-foreground">${price}</span>
                    <span className="mb-1.5 text-sm text-muted-foreground">/ mo</span>
                  </div>
                  {billingInterval === "yearly" && (
                    <p className="-mt-3 text-xs text-muted-foreground">Billed yearly · 30% off</p>
                  )}
                </>
              )}
              <ul className="flex flex-col gap-1.5">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-foreground">
                    <span className="font-bold text-green-500">+</span>
                    {f}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => handleSelectPlan(plan.id)}
                disabled={checkoutLoading !== null}
                className={`press mt-auto w-full rounded-xl py-3 text-sm font-bold transition-all disabled:cursor-not-allowed disabled:opacity-60 ${
                  plan.highlight
                    ? "bg-primary text-white shadow-md shadow-primary/30 hover:bg-primary/90"
                    : "border border-border bg-muted text-foreground hover:bg-muted/80"
                }`}
              >
                {isLoading
                  ? plan.id === "solo"
                    ? "Setting up…"
                    : "Redirecting…"
                  : plan.id === "solo"
                    ? "Start Free"
                    : `Start ${plan.name}`}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Registry consumed by the wizard ──────────────────────────────────────── */

export const STEP_COMPONENTS: Record<StepId, ComponentType<StepProps>> = {
  welcome: WelcomeStep,
  name: NameStep,
  business: BusinessStep,
  industry: IndustryStep,
  services: ServicesStep,
  team: TeamStep,
  stage: StageStep,
  jobValue: JobValueStep,
  goal: GoalStep,
  money: MoneyStep,
  payments: PaymentsStep,
  hours: HoursStep,
  area: AreaStep,
  automations: AutomationsStep,
  workspace: WorkspaceStep,
  ai: AiStep,
  plan: PlanStep,
};

/** Continue is enabled only when the step's answer is usable. */
export function stepIsValid(stepId: StepId, a: OnboardingAnswers): boolean {
  switch (stepId) {
    case "name":
      return !!a.firstName.trim() && !!a.lastName.trim();
    case "business":
      return !!a.businessName.trim();
    case "industry":
      return a.industry === "custom" ? !!a.industryLabel.trim() : !!a.industry;
    case "services":
      return a.services.length > 0;
    case "team":
      return !!a.teamSize;
    case "stage":
      return !!a.stage;
    case "jobValue":
      return !!a.jobValue;
    case "goal":
      return (a.goal ?? 0) > 0;
    case "money":
      return a.taxRate !== null || a.paymentMethods.length > 0;
    case "hours":
      return a.workDays.length > 0;
    case "area":
      return !!a.city.trim() || a.serviceAreas.length > 0;
    case "ai":
      return !!a.tone;
    default:
      return true;
  }
}

export function stepCta(stepId: StepId): string {
  switch (stepId) {
    case "welcome":
      return "Set up my business";
    case "ai":
      return "Finish setup";
    default:
      return "Continue";
  }
}
