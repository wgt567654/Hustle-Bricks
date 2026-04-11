"use client";

import { useState } from "react";
import Link from "next/link";

// ─── Nav ─────────────────────────────────────────────────────────────────────

function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="chrome fixed top-0 inset-x-0 z-50 border-b border-border/60">
      <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center">
            <span className="text-white font-bold text-sm">H</span>
          </div>
          <span className="font-display font-bold text-lg tracking-tight text-foreground">
            HustleBricks
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-6">
          <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            Features
          </a>
          <a href="#pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            Pricing
          </a>
          <a href="#faq" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            FAQ
          </a>
        </nav>

        {/* Desktop CTA */}
        <div className="hidden md:flex items-center gap-3">
          <Link
            href="/login"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="text-sm font-medium bg-primary text-white px-4 py-2 rounded-xl hover:bg-primary/90 transition-colors press"
          >
            Get Started
          </Link>
        </div>

        {/* Mobile menu button */}
        <button
          className="md:hidden text-muted-foreground hover:text-foreground p-2"
          onClick={() => setOpen(!open)}
          aria-label="Toggle menu"
        >
          <span className="material-symbols-outlined text-xl">{open ? "close" : "menu"}</span>
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden border-t border-border/60 bg-card/95 backdrop-blur-lg px-5 py-4 flex flex-col gap-3">
          <a href="#features" className="text-sm text-muted-foreground" onClick={() => setOpen(false)}>Features</a>
          <a href="#pricing" className="text-sm text-muted-foreground" onClick={() => setOpen(false)}>Pricing</a>
          <a href="#faq" className="text-sm text-muted-foreground" onClick={() => setOpen(false)}>FAQ</a>
          <div className="flex gap-3 pt-2 border-t border-border/60">
            <Link href="/login" className="flex-1 text-center text-sm border border-border rounded-xl py-2 text-foreground">Log in</Link>
            <Link href="/signup" className="flex-1 text-center text-sm bg-primary text-white rounded-xl py-2 font-medium">Get Started</Link>
          </div>
        </div>
      )}
    </header>
  );
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

function Hero() {
  return (
    <section className="relative pt-32 pb-24 overflow-hidden">
      {/* Background gradient */}
      <div
        className="absolute inset-0 -z-10"
        style={{
          background:
            "linear-gradient(160deg, oklch(0.098 0.005 260) 0%, oklch(0.180 0.060 277) 40%, oklch(0.300 0.080 277) 70%, oklch(0.985 0.002 248) 100%)",
        }}
      />
      {/* Soft glow */}
      <div
        className="absolute top-20 left-1/2 -translate-x-1/2 w-[600px] h-[400px] -z-10 opacity-30"
        style={{
          background: "radial-gradient(ellipse, oklch(0.511 0.230 277) 0%, transparent 70%)",
          filter: "blur(60px)",
        }}
      />

      <div className="max-w-4xl mx-auto px-5 text-center">
        {/* Eyebrow */}
        <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-1.5 mb-6 backdrop-blur-sm">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span className="text-sm text-white/80 font-medium">Built for home service businesses</span>
        </div>

        {/* Headline */}
        <h1 className="text-5xl md:text-7xl font-display font-bold text-white leading-[1.05] mb-6">
          Run your business.
          <br />
          <span
            className="text-transparent bg-clip-text"
            style={{
              backgroundImage: "linear-gradient(90deg, oklch(0.750 0.148 237), oklch(0.660 0.219 293))",
            }}
          >
            Not the other way around.
          </span>
        </h1>

        {/* Subheadline */}
        <p className="text-lg md:text-xl text-white/70 max-w-2xl mx-auto mb-10 leading-relaxed">
          HustleBricks puts your jobs, clients, payments, and team in one place — so you spend less time juggling and more time growing.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-5">
          <Link
            href="/signup"
            className="press w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-white text-primary font-semibold px-7 py-3.5 rounded-xl hover:bg-white/90 transition-colors shadow-lg text-base"
          >
            Start Free Trial
            <span className="material-symbols-outlined text-lg">arrow_forward</span>
          </Link>
          <Link
            href="/login"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 border border-white/30 text-white font-medium px-7 py-3.5 rounded-xl hover:bg-white/10 transition-colors text-base"
          >
            Log in
          </Link>
        </div>

        <p className="text-sm text-white/40">7-day free trial · No credit card required</p>
      </div>
    </section>
  );
}

// ─── Feature Cards ────────────────────────────────────────────────────────────

const featureCards = [
  {
    icon: "work",
    color: "oklch(0.511 0.230 277)",
    bg: "oklch(0.511 0.230 277 / 0.08)",
    title: "Jobs & Scheduling",
    desc: "Track every job from quote to completion. Google Calendar sync keeps your whole team in the loop.",
  },
  {
    icon: "group",
    color: "oklch(0.606 0.219 293)",
    bg: "oklch(0.606 0.219 293 / 0.08)",
    title: "Clients & Quotes",
    desc: "Manage your client list, send professional quotes, and convert them into invoices in one click.",
  },
  {
    icon: "payments",
    color: "oklch(0.627 0.170 149)",
    bg: "oklch(0.627 0.170 149 / 0.08)",
    title: "Online Payments",
    desc: "Get paid faster with Stripe-powered invoices your clients can pay from any device.",
  },
  {
    icon: "badge",
    color: "oklch(0.769 0.165 70)",
    bg: "oklch(0.769 0.165 70 / 0.08)",
    title: "Team & Employee Portal",
    desc: "Add crew members, assign jobs, and let your team clock in straight from their phones.",
  },
];

function FeatureCards() {
  return (
    <section id="features" className="py-20 max-w-6xl mx-auto px-5">
      <div className="text-center mb-12">
        <p className="text-xs font-semibold tracking-widest uppercase text-primary mb-3">Features</p>
        <h2 className="text-3xl md:text-4xl font-display font-bold text-foreground mb-4">
          Everything you need to run the job.
        </h2>
        <p className="text-muted-foreground max-w-xl mx-auto">
          No more juggling spreadsheets, texts, and sticky notes. HustleBricks handles the operational side so you can focus on the work.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {featureCards.map((f) => (
          <div key={f.title} className="bg-card rounded-2xl shadow-card p-6 flex flex-col gap-4">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center"
              style={{ background: f.bg }}
            >
              <span className="material-symbols-outlined text-xl" style={{ color: f.color }}>
                {f.icon}
              </span>
            </div>
            <div>
              <h3 className="font-display font-semibold text-base text-foreground mb-1">{f.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── Detail Sections ──────────────────────────────────────────────────────────

function DetailSection({
  eyebrow,
  title,
  description,
  bullets,
  icon,
  iconColor,
  iconBg,
  reverse,
}: {
  eyebrow: string;
  title: string;
  description: string;
  bullets: string[];
  icon: string;
  iconColor: string;
  iconBg: string;
  reverse?: boolean;
}) {
  return (
    <div
      className={`flex flex-col ${reverse ? "lg:flex-row-reverse" : "lg:flex-row"} items-center gap-12 lg:gap-16 py-16`}
    >
      {/* Text */}
      <div className="flex-1">
        <p className="text-xs font-semibold tracking-widest uppercase mb-3" style={{ color: iconColor }}>
          {eyebrow}
        </p>
        <h2 className="text-3xl md:text-4xl font-display font-bold text-foreground mb-4">{title}</h2>
        <p className="text-muted-foreground mb-6 leading-relaxed">{description}</p>
        <ul className="space-y-3">
          {bullets.map((b) => (
            <li key={b} className="flex items-center gap-3 text-sm text-foreground">
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: iconBg }}
              >
                <span className="material-symbols-outlined text-xs" style={{ color: iconColor, fontSize: "14px" }}>
                  check
                </span>
              </div>
              {b}
            </li>
          ))}
        </ul>
        <Link
          href="/signup"
          className="press mt-8 inline-flex items-center gap-2 text-sm font-semibold text-white px-5 py-2.5 rounded-xl transition-colors"
          style={{ background: iconColor }}
        >
          Start Free Trial
          <span className="material-symbols-outlined text-base">arrow_forward</span>
        </Link>
      </div>

      {/* Visual panel */}
      <div className="flex-1 w-full">
        <div
          className="rounded-2xl shadow-card overflow-hidden border border-border/50 p-8 flex items-center justify-center min-h-[300px]"
          style={{ background: iconBg }}
        >
          <div className="text-center flex flex-col items-center gap-4">
            <div
              className="w-20 h-20 rounded-2xl flex items-center justify-center shadow-card bg-card"
            >
              <span className="material-symbols-outlined text-4xl" style={{ color: iconColor }}>
                {icon}
              </span>
            </div>
            <div className="space-y-2">
              {bullets.slice(0, 3).map((b) => (
                <div key={b} className="bg-card/80 backdrop-blur-sm rounded-xl px-4 py-2.5 shadow-card flex items-center gap-2.5">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: iconColor }} />
                  <span className="text-xs text-foreground font-medium">{b}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailSections() {
  return (
    <section className="max-w-6xl mx-auto px-5">
      <DetailSection
        eyebrow="Jobs & Scheduling"
        title="From first call to final sign-off."
        description="Create jobs, assign them to your crew, and track every status update in real time. HustleBricks syncs with Google Calendar so nothing falls through the cracks."
        bullets={[
          "Create and assign jobs in seconds",
          "Track job status: scheduled, in progress, completed",
          "Google Calendar sync for every team member",
          "Before & after photos captured on-site",
          "Client portal for booking requests",
        ]}
        icon="calendar_month"
        iconColor="oklch(0.511 0.230 277)"
        iconBg="oklch(0.511 0.230 277 / 0.07)"
      />

      <div className="border-t border-border/50" />

      <DetailSection
        eyebrow="Payments & Invoicing"
        title="Get paid. Every time. On time."
        description="Send professional invoices clients can pay online via Stripe. Track what's been paid, what's outstanding, and follow up automatically — all from one dashboard."
        bullets={[
          "Stripe-powered online payments",
          "Send invoice links via email or SMS",
          "Track paid vs. outstanding balances",
          "Cash and check logging for offline payments",
          "Tip collection at job completion",
        ]}
        icon="payments"
        iconColor="oklch(0.627 0.170 149)"
        iconBg="oklch(0.627 0.170 149 / 0.07)"
        reverse
      />
    </section>
  );
}

// ─── Pricing ──────────────────────────────────────────────────────────────────

const plans = [
  {
    name: "Solo",
    tagline: "Start solo. Scale into the next plan.",
    monthly: 49,
    yearly: 34,
    cta: "Start Free Trial",
    highlight: false,
    features: [
      "1 user",
      "Unlimited jobs & clients",
      "Quotes & invoicing",
      "Stripe online payments",
      "Google Calendar sync",
      "Client booking portal",
      "Mobile-friendly",
    ],
  },
  {
    name: "Team",
    tagline: "More crew. More jobs. More revenue.",
    monthly: 119,
    yearly: 83,
    cta: "Start Free Trial",
    highlight: true,
    features: [
      "Up to 8 users",
      "Everything in Solo",
      "Employee portal & time tracking",
      "Job assignment & notifications",
      "Team scheduling",
      "Sales dashboard",
      "Analytics & reports",
    ],
  },
  {
    name: "Business",
    tagline: "Built for scaled operations.",
    monthly: 249,
    yearly: 174,
    cta: "Start Free Trial",
    highlight: false,
    features: [
      "Up to 30 users",
      "Everything in Team",
      "Canvassing & lead map",
      "Payroll reports",
      "Custom roles & permissions",
      "Priority support",
      "Dedicated onboarding",
    ],
  },
];

function Pricing() {
  const [yearly, setYearly] = useState(false);

  return (
    <section id="pricing" className="py-20 max-w-6xl mx-auto px-5">
      <div className="text-center mb-12">
        <p className="text-xs font-semibold tracking-widest uppercase text-primary mb-3">Pricing</p>
        <h2 className="text-3xl md:text-4xl font-display font-bold text-foreground mb-4">
          Built and priced for growth.
        </h2>
        <p className="text-muted-foreground mb-8">7-day free trial on every plan. No credit card required.</p>

        {/* Toggle */}
        <div className="inline-flex items-center gap-3 bg-secondary rounded-full p-1">
          <button
            onClick={() => setYearly(false)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              !yearly ? "bg-card shadow-card text-foreground" : "text-muted-foreground"
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setYearly(true)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors flex items-center gap-2 ${
              yearly ? "bg-card shadow-card text-foreground" : "text-muted-foreground"
            }`}
          >
            Yearly
            <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 dark:text-emerald-400 px-1.5 py-0.5 rounded-full">
              30% OFF
            </span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map((plan) => (
          <div
            key={plan.name}
            className={`relative rounded-2xl p-7 flex flex-col gap-6 ${
              plan.highlight
                ? "bg-primary text-white shadow-[0_8px_40px_oklch(0.511_0.230_277_/_0.35)]"
                : "bg-card shadow-card border border-border/50"
            }`}
          >
            {plan.highlight && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-white text-primary text-xs font-bold px-4 py-1 rounded-full shadow-sm">
                Most Popular
              </div>
            )}

            <div>
              <p className={`text-xs font-bold tracking-widest uppercase mb-1 ${plan.highlight ? "text-white/60" : "text-muted-foreground"}`}>
                {plan.name}
              </p>
              <p className={`text-sm ${plan.highlight ? "text-white/70" : "text-muted-foreground"}`}>
                {plan.tagline}
              </p>
            </div>

            <div>
              {yearly && (
                <p className={`text-sm line-through mb-0.5 ${plan.highlight ? "text-white/40" : "text-muted-foreground/60"}`}>
                  ${plan.monthly}/mo
                </p>
              )}
              <div className="flex items-end gap-1">
                <span className={`text-4xl font-display font-bold ${plan.highlight ? "text-white" : "text-foreground"}`}>
                  ${yearly ? plan.yearly : plan.monthly}
                </span>
                <span className={`text-sm mb-1.5 ${plan.highlight ? "text-white/60" : "text-muted-foreground"}`}>
                  USD/mo
                </span>
              </div>
              {yearly && (
                <p className={`text-xs ${plan.highlight ? "text-white/50" : "text-muted-foreground"}`}>
                  Billed yearly · 30% OFF
                </p>
              )}
            </div>

            <Link
              href="/signup"
              className={`press w-full text-center py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                plan.highlight
                  ? "bg-white text-primary hover:bg-white/90"
                  : "bg-primary text-white hover:bg-primary/90"
              }`}
            >
              {plan.cta}
            </Link>

            <ul className="space-y-3">
              {plan.features.map((f) => (
                <li key={f} className="flex items-center gap-2.5 text-sm">
                  <span
                    className={`material-symbols-outlined text-base flex-shrink-0 ${
                      plan.highlight ? "text-white/80" : "text-primary"
                    }`}
                    style={{ fontSize: "16px" }}
                  >
                    add
                  </span>
                  <span className={plan.highlight ? "text-white/80" : "text-foreground"}>
                    {f}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── FAQ ──────────────────────────────────────────────────────────────────────

const faqs = [
  {
    q: "What kinds of businesses use HustleBricks?",
    a: "HustleBricks is built for home service businesses — cleaning, landscaping, pressure washing, painting, handyman, moving, and more. If you book jobs and have a crew, it works for you.",
  },
  {
    q: "How does the free trial work?",
    a: "Sign up and get 7 days free on any plan. No credit card required. At the end of the trial you can subscribe or your account pauses — your data stays safe either way.",
  },
  {
    q: "Can my employees use HustleBricks from their phone?",
    a: "Yes. Your crew gets access to the Employee Portal, where they can view assigned jobs, clock in and out, take before/after photos, and collect payment — all from a mobile browser.",
  },
  {
    q: "How do online payments work?",
    a: "HustleBricks uses Stripe to process payments. You send clients an invoice link, they pay by card, and the money lands in your Stripe account. You can also log cash and check payments manually.",
  },
  {
    q: "Can I bring my existing clients over?",
    a: "Absolutely. You can add clients manually or import them. Your existing jobs and history can be entered as well during onboarding.",
  },
];

function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section id="faq" className="py-20" style={{ background: "oklch(0.098 0.005 260)" }}>
      <div className="max-w-3xl mx-auto px-5">
        <div className="text-center mb-12">
          <p className="text-xs font-semibold tracking-widest uppercase text-primary mb-3">FAQ</p>
          <h2 className="text-3xl md:text-4xl font-display font-bold text-white mb-4">
            Everything you need before switching.
          </h2>
        </div>

        <div className="space-y-3">
          {faqs.map((faq, i) => (
            <div
              key={i}
              className="rounded-2xl border border-white/10 overflow-hidden"
              style={{ background: "oklch(0.143 0.006 260)" }}
            >
              <button
                className="w-full flex items-center justify-between px-6 py-4 text-left"
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
              >
                <span className="text-sm font-medium text-white">{faq.q}</span>
                <span
                  className="material-symbols-outlined text-white/50 flex-shrink-0 ml-4 transition-transform"
                  style={{
                    fontSize: "20px",
                    transform: openIndex === i ? "rotate(180deg)" : "rotate(0deg)",
                  }}
                >
                  keyboard_arrow_down
                </span>
              </button>
              {openIndex === i && (
                <div className="px-6 pb-5">
                  <p className="text-sm text-white/60 leading-relaxed">{faq.a}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Final CTA ────────────────────────────────────────────────────────────────

function FinalCTA() {
  return (
    <section className="py-24" style={{ background: "oklch(0.098 0.005 260)" }}>
      <div
        className="max-w-4xl mx-auto px-5 rounded-3xl py-16 text-center relative overflow-hidden"
        style={{
          background: "linear-gradient(135deg, oklch(0.180 0.060 277) 0%, oklch(0.250 0.100 277) 100%)",
        }}
      >
        {/* Glow */}
        <div
          className="absolute inset-0 -z-10 opacity-40"
          style={{
            background: "radial-gradient(ellipse at 50% 0%, oklch(0.511 0.230 277), transparent 70%)",
          }}
        />

        <h2 className="text-3xl md:text-5xl font-display font-bold text-white mb-4">
          Your business deserves better software.
        </h2>
        <p className="text-white/60 mb-10 max-w-md mx-auto">
          Your competitors are already running lean. Get started in minutes.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/signup"
            className="press inline-flex items-center gap-2 bg-white text-primary font-semibold px-8 py-3.5 rounded-xl hover:bg-white/90 transition-colors shadow-lg"
          >
            Start Free Trial
            <span className="material-symbols-outlined text-lg">arrow_forward</span>
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 border border-white/30 text-white font-medium px-8 py-3.5 rounded-xl hover:bg-white/10 transition-colors"
          >
            Log in
          </Link>
        </div>
        <p className="text-xs text-white/30 mt-5">7-day free trial · No credit card required</p>
      </div>
    </section>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer
      className="border-t border-white/10 py-10"
      style={{ background: "oklch(0.098 0.005 260)" }}
    >
      <div className="max-w-6xl mx-auto px-5 flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-white font-bold text-xs">H</span>
          </div>
          <span className="font-display font-bold text-white/80">HustleBricks</span>
        </div>

        <p className="text-xs text-white/30">© {new Date().getFullYear()} HustleBricks. All rights reserved.</p>

        <nav className="flex items-center gap-5">
          <Link href="/login" className="text-xs text-white/40 hover:text-white/70 transition-colors">Log in</Link>
          <a href="#" className="text-xs text-white/40 hover:text-white/70 transition-colors">Privacy</a>
          <a href="#" className="text-xs text-white/40 hover:text-white/70 transition-colors">Terms</a>
        </nav>
      </div>
    </footer>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <Hero />
      <FeatureCards />
      <DetailSections />
      <Pricing />
      <FAQ />
      <FinalCTA />
      <Footer />
    </div>
  );
}
