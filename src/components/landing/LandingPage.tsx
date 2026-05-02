"use client";

import { useState } from "react";
import Link from "next/link";

// Force light-mode color tokens regardless of system theme
const light = {
  "--background": "oklch(0.985 0.002 248)",
  "--foreground": "oklch(0.220 0.031 260)",
  "--card": "oklch(1 0 0)",
  "--muted-foreground": "oklch(0.551 0.023 264)",
  "--border": "oklch(0.928 0.006 265)",
  "--primary": "oklch(0.470 0.082 229)",
  "--secondary": "oklch(0.970 0.004 248)",
  colorScheme: "light",
} as React.CSSProperties;

// ─── Section wrapper ──────────────────────────────────────────────────────────

function SectionCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`mx-4 md:mx-8 rounded-3xl ${className}`} style={{ background: "#faf9f7" }}>
      {children}
    </div>
  );
}

// ─── Nav ─────────────────────────────────────────────────────────────────────

function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <header
      className="fixed top-0 inset-x-0 z-50 border-b"
      style={{
        background: "oklch(1 0 0 / 0.90)",
        backdropFilter: "blur(20px) saturate(1.6)",
        WebkitBackdropFilter: "blur(20px) saturate(1.6)",
        borderColor: "oklch(0.928 0.006 265 / 0.6)",
      }}
    >
      <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center overflow-hidden" style={{ background: "oklch(0.470 0.082 229)" }}>
            <svg viewBox="0 0 200 200" width="32" height="32" xmlns="http://www.w3.org/2000/svg">
              <rect x="28" y="74" width="66" height="40" rx="5" fill="white" fillOpacity="0.95" />
              <rect x="106" y="74" width="66" height="40" rx="5" fill="white" fillOpacity="0.95" />
              <rect x="28" y="122" width="37" height="40" rx="5" fill="white" fillOpacity="0.95" />
              <rect x="73" y="122" width="54" height="40" rx="5" fill="white" fillOpacity="0.95" />
              <rect x="135" y="122" width="37" height="40" rx="5" fill="white" fillOpacity="0.95" />
            </svg>
          </div>
          <span className="font-display font-bold text-lg tracking-tight" style={{ color: "oklch(0.220 0.031 260)" }}>
            HustleBricks
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-6">
          {["#features", "#pricing", "#faq"].map((href) => (
            <a key={href} href={href} className="text-sm transition-colors" style={{ color: "oklch(0.551 0.023 264)" }}>
              {href.replace("#", "").charAt(0).toUpperCase() + href.replace("#", "").slice(1)}
            </a>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-3">
          <Link href="/login" className="text-sm px-3 py-1.5 transition-colors" style={{ color: "oklch(0.551 0.023 264)" }}>
            Log in
          </Link>
          <Link
            href="/signup"
            className="text-sm font-medium text-white px-4 py-2 rounded-xl transition-colors press"
            style={{ background: "oklch(0.470 0.082 229)" }}
          >
            Get Started
          </Link>
        </div>

        <button
          className="md:hidden p-2"
          style={{ color: "oklch(0.551 0.023 264)" }}
          onClick={() => setOpen(!open)}
          aria-label="Toggle menu"
        >
          <span className="material-symbols-outlined text-xl">{open ? "close" : "menu"}</span>
        </button>
      </div>

      {open && (
        <div
          className="md:hidden border-t px-5 py-4 flex flex-col gap-3"
          style={{ background: "oklch(1 0 0 / 0.97)", borderColor: "oklch(0.928 0.006 265 / 0.6)" }}
        >
          <a href="#features" className="text-sm" style={{ color: "oklch(0.551 0.023 264)" }} onClick={() => setOpen(false)}>Features</a>
          <a href="#pricing" className="text-sm" style={{ color: "oklch(0.551 0.023 264)" }} onClick={() => setOpen(false)}>Pricing</a>
          <a href="#faq" className="text-sm" style={{ color: "oklch(0.551 0.023 264)" }} onClick={() => setOpen(false)}>FAQ</a>
          <div className="flex gap-3 pt-2 border-t" style={{ borderColor: "oklch(0.928 0.006 265 / 0.6)" }}>
            <Link href="/login" className="flex-1 text-center text-sm border rounded-xl py-2" style={{ borderColor: "oklch(0.928 0.006 265)", color: "oklch(0.220 0.031 260)" }}>Log in</Link>
            <Link href="/signup" className="flex-1 text-center text-sm text-white rounded-xl py-2 font-medium" style={{ background: "oklch(0.470 0.082 229)" }}>Get Started</Link>
          </div>
        </div>
      )}
    </header>
  );
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

function Hero() {
  return (
    <section
      className="relative pt-32 pb-24 overflow-hidden"
      style={{ background: "linear-gradient(160deg, #f7f8f9 0%, #e5f2f8 60%, #d6e3ec 100%)" }}
    >
      <div
        className="absolute top-10 left-1/2 -translate-x-1/2 w-[700px] h-[400px] -z-10 opacity-20"
        style={{ background: "radial-gradient(ellipse, oklch(0.470 0.082 229) 0%, transparent 70%)", filter: "blur(80px)" }}
      />

      <div className="max-w-4xl mx-auto px-5 text-center">
        <div
          className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 mb-6 border"
          style={{ background: "oklch(0.470 0.082 229 / 0.08)", borderColor: "oklch(0.470 0.082 229 / 0.20)" }}
        >
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          <span className="text-sm font-medium" style={{ color: "oklch(0.470 0.082 229)" }}>Built for home service businesses</span>
        </div>

        <h1 className="text-5xl md:text-7xl font-display font-bold leading-[1.05] mb-6" style={{ color: "oklch(0.220 0.031 260)" }}>
          Run your business.
          <br />
          <span
            className="text-transparent bg-clip-text"
            style={{ backgroundImage: "linear-gradient(90deg, oklch(0.470 0.082 229), oklch(0.685 0.148 237))" }}
          >
            Not the other way around.
          </span>
        </h1>

        <p className="text-lg md:text-xl max-w-2xl mx-auto mb-10 leading-relaxed" style={{ color: "oklch(0.551 0.023 264)" }}>
          HustleBricks puts your jobs, clients, payments, and team in one place — so you spend less time juggling and more time growing.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-5">
          <Link
            href="/signup"
            className="press w-full sm:w-auto inline-flex items-center justify-center gap-2 text-white font-semibold px-7 py-3.5 rounded-xl transition-colors text-base shadow-lg"
            style={{ background: "oklch(0.470 0.082 229)", boxShadow: "0 8px 24px oklch(0.470 0.082 229 / 0.25)" }}
          >
            Start Free Trial
            <span className="material-symbols-outlined text-lg">arrow_forward</span>
          </Link>
          <Link
            href="/login"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 font-medium px-7 py-3.5 rounded-xl transition-colors text-base border"
            style={{ borderColor: "oklch(0.470 0.082 229 / 0.30)", color: "oklch(0.470 0.082 229)" }}
          >
            Log in
          </Link>
        </div>

        <p className="text-sm" style={{ color: "oklch(0.551 0.023 264 / 0.70)" }}>7-day free trial · No credit card required</p>
      </div>
    </section>
  );
}

// ─── Feature Cards ────────────────────────────────────────────────────────────

const featureCards = [
  { icon: "work",     color: "oklch(0.470 0.082 229)", bg: "oklch(0.470 0.082 229 / 0.08)", title: "Jobs & Scheduling",       desc: "Track every job from quote to completion. Google Calendar sync keeps your whole team in the loop." },
  { icon: "group",    color: "oklch(0.606 0.219 293)", bg: "oklch(0.606 0.219 293 / 0.08)", title: "Clients & Quotes",        desc: "Manage your client list, send professional quotes, and convert them into invoices in one click." },
  { icon: "payments", color: "oklch(0.627 0.170 149)", bg: "oklch(0.627 0.170 149 / 0.08)", title: "Online Payments",         desc: "Get paid faster with Stripe-powered invoices your clients can pay from any device." },
  { icon: "badge",    color: "oklch(0.769 0.165 70)",  bg: "oklch(0.769 0.165 70  / 0.08)", title: "Team & Employee Portal",  desc: "Add crew members, assign jobs, and let your team clock in straight from their phones." },
];

function FeatureCards() {
  return (
    <section id="features" className="py-6" style={{ background: "white" }}>
      <SectionCard className="py-16 px-8">
        <div className="text-center mb-12">
          <p className="text-xs font-semibold tracking-widest uppercase mb-3" style={{ color: "oklch(0.470 0.082 229)" }}>Features</p>
          <h2 className="text-3xl md:text-4xl font-display font-bold mb-4" style={{ color: "oklch(0.220 0.031 260)" }}>
            Everything you need to run the job.
          </h2>
          <p className="max-w-xl mx-auto" style={{ color: "oklch(0.551 0.023 264)" }}>
            No more juggling spreadsheets, texts, and sticky notes. HustleBricks handles the operational side so you can focus on the work.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {featureCards.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl p-6 flex flex-col gap-4 border"
              style={{ background: "white", borderColor: "oklch(0.928 0.006 265 / 0.6)", boxShadow: "0 2px 12px oklch(0 0 0 / 0.05)" }}
            >
              <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: f.bg }}>
                <span className="material-symbols-outlined text-xl" style={{ color: f.color }}>{f.icon}</span>
              </div>
              <div>
                <h3 className="font-display font-semibold text-base mb-1" style={{ color: "oklch(0.220 0.031 260)" }}>{f.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: "oklch(0.551 0.023 264)" }}>{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    </section>
  );
}

// ─── Mock Screenshots ─────────────────────────────────────────────────────────

function JobBoardMockup() {
  const jobs = [
    { title: "Roof Inspection — Johnson",      status: "In Progress", statusColor: "#f97316", date: "Today, 9:00 AM",      tech: "Mike R." },
    { title: "Gutter Cleaning — Martinez",     status: "Scheduled",   statusColor: "#6366f1", date: "Today, 11:30 AM",    tech: "Dave S." },
    { title: "Window Wash — Patel",            status: "Completed",   statusColor: "#22c55e", date: "Yesterday",           tech: "Mike R." },
    { title: "Pressure Wash — Thompson",       status: "Scheduled",   statusColor: "#6366f1", date: "Tomorrow, 8:00 AM",  tech: "Dave S." },
    { title: "HVAC Service — Williams",        status: "Completed",   statusColor: "#22c55e", date: "Jun 9",               tech: "Chris T." },
    { title: "Landscaping — Garcia",           status: "In Progress", statusColor: "#f97316", date: "Today, 2:00 PM",     tech: "Mike R." },
  ];
  return (
    <div className="rounded-2xl overflow-hidden border" style={{ background: "white", borderColor: "oklch(0.928 0.006 265 / 0.6)", boxShadow: "0 8px 40px oklch(0 0 0 / 0.10)" }}>
      <div className="px-6 py-5 border-b flex items-center justify-between" style={{ borderColor: "oklch(0.928 0.006 265 / 0.5)" }}>
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined" style={{ fontSize: 22, color: "oklch(0.470 0.082 229)" }}>work</span>
          <span className="font-display font-semibold text-base" style={{ color: "oklch(0.220 0.031 260)" }}>Jobs</span>
          <span className="text-xs px-2 py-0.5 rounded-full font-semibold ml-1" style={{ background: "oklch(0.470 0.082 229 / 0.10)", color: "oklch(0.470 0.082 229)" }}>6 active</span>
        </div>
        <div className="flex items-center gap-2 rounded-xl px-4 py-2" style={{ background: "oklch(0.970 0.004 248)" }}>
          <span className="material-symbols-outlined" style={{ fontSize: 15, color: "oklch(0.551 0.023 264)" }}>search</span>
          <span className="text-sm" style={{ color: "oklch(0.551 0.023 264)" }}>Search jobs…</span>
        </div>
      </div>
      <div className="divide-y" style={{ borderColor: "oklch(0.928 0.006 265 / 0.4)" }}>
        {jobs.map((j, i) => (
          <div key={i} className="px-6 py-4 flex items-center gap-4">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: j.statusColor + "15" }}>
              <span className="material-symbols-outlined" style={{ fontSize: 18, color: j.statusColor }}>work</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate" style={{ color: "oklch(0.220 0.031 260)" }}>{j.title}</p>
              <p className="text-xs mt-0.5" style={{ color: "oklch(0.551 0.023 264)" }}>{j.date} · {j.tech}</p>
            </div>
            <span
              className="text-xs font-semibold px-3 py-1.5 rounded-full flex-shrink-0"
              style={{ background: j.statusColor + "15", color: j.statusColor }}
            >
              {j.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CanvasMapMockup() {
  const pins = [
    // left cluster
    { x: "6%",  y: "28%", color: "#f97316" }, { x: "9%",  y: "48%", color: "#22c55e" },
    { x: "7%",  y: "68%", color: "#f97316" }, { x: "12%", y: "38%", color: "#94a3b8" },
    { x: "13%", y: "58%", color: "#22c55e" }, { x: "15%", y: "78%", color: "#f97316" },
    { x: "17%", y: "22%", color: "#ef4444" }, { x: "20%", y: "44%", color: "#f97316" },
    { x: "19%", y: "64%", color: "#94a3b8" }, { x: "22%", y: "84%", color: "#22c55e" },
    // mid-left
    { x: "26%", y: "18%", color: "#f97316" }, { x: "28%", y: "35%", color: "#22c55e" },
    { x: "27%", y: "55%", color: "#f97316" }, { x: "30%", y: "72%", color: "#ef4444" },
    { x: "32%", y: "88%", color: "#f97316" }, { x: "34%", y: "28%", color: "#94a3b8" },
    { x: "35%", y: "48%", color: "#22c55e" }, { x: "36%", y: "66%", color: "#f97316" },
    // center
    { x: "41%", y: "14%", color: "#22c55e" }, { x: "40%", y: "32%", color: "#f97316" },
    { x: "42%", y: "52%", color: "#94a3b8" }, { x: "43%", y: "72%", color: "#22c55e" },
    { x: "45%", y: "86%", color: "#f97316" }, { x: "47%", y: "24%", color: "#ef4444" },
    { x: "48%", y: "44%", color: "#f97316" }, { x: "49%", y: "62%", color: "#22c55e" },
    // mid-right
    { x: "54%", y: "18%", color: "#f97316" }, { x: "55%", y: "38%", color: "#22c55e" },
    { x: "56%", y: "58%", color: "#f97316" }, { x: "57%", y: "76%", color: "#94a3b8" },
    { x: "60%", y: "28%", color: "#ef4444" }, { x: "61%", y: "48%", color: "#f97316" },
    { x: "62%", y: "68%", color: "#22c55e" }, { x: "63%", y: "86%", color: "#f97316" },
    // right cluster
    { x: "68%", y: "22%", color: "#22c55e" }, { x: "69%", y: "42%", color: "#f97316" },
    { x: "70%", y: "62%", color: "#94a3b8" }, { x: "72%", y: "78%", color: "#f97316" },
    { x: "75%", y: "16%", color: "#f97316" }, { x: "76%", y: "36%", color: "#22c55e" },
    { x: "77%", y: "54%", color: "#ef4444" }, { x: "78%", y: "72%", color: "#f97316" },
    { x: "82%", y: "26%", color: "#22c55e" }, { x: "83%", y: "46%", color: "#f97316" },
    { x: "84%", y: "64%", color: "#94a3b8" }, { x: "86%", y: "82%", color: "#f97316" },
    { x: "90%", y: "34%", color: "#f97316" }, { x: "91%", y: "54%", color: "#22c55e" },
    { x: "93%", y: "70%", color: "#ef4444" },
  ];

  return (
    <div className="rounded-2xl overflow-hidden border" style={{ borderColor: "oklch(0.928 0.006 265 / 0.6)", boxShadow: "0 8px 40px oklch(0 0 0 / 0.10)" }}>
      {/* Header */}
      <div className="px-6 py-5 flex items-center justify-between border-b" style={{ background: "white", borderColor: "oklch(0.928 0.006 265 / 0.5)" }}>
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined" style={{ fontSize: 22, color: "oklch(0.470 0.082 229)" }}>map</span>
          <span className="font-display font-semibold text-base" style={{ color: "oklch(0.220 0.031 260)" }}>Canvassing Map</span>
          <span className="text-xs px-2 py-0.5 rounded-full font-semibold ml-1" style={{ background: "oklch(0.470 0.082 229 / 0.10)", color: "oklch(0.470 0.082 229)" }}>Live</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full" style={{ background: "oklch(0.470 0.082 229 / 0.10)", color: "oklch(0.470 0.082 229)" }}>
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>location_on</span>
          Oak Park, IL
        </div>
      </div>

      {/* Map body */}
      <div className="relative" style={{ height: 340 }}>
        {/* SVG street map */}
        <svg viewBox="0 0 800 340" className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">
          {/* Land background */}
          <rect width="800" height="340" fill="#e8e0d4"/>

          {/* Park areas */}
          <polygon points="30,195 140,170 165,215 175,275 55,288 18,248" fill="#c4dba0" stroke="#b0cc8c" strokeWidth="1"/>
          <polygon points="480,5 575,18 595,82 505,100 458,58" fill="#c4dba0" stroke="#b0cc8c" strokeWidth="1"/>
          <polygon points="680,240 760,230 790,290 730,320 670,305" fill="#c4dba0" stroke="#b0cc8c" strokeWidth="1"/>

          {/* Park labels */}
          <text x="80" y="238" fontSize="8" fill="#7a9a60" fontFamily="sans-serif" fontStyle="italic">Riverside Park</text>
          <text x="502" y="55" fontSize="8" fill="#7a9a60" fontFamily="sans-serif" fontStyle="italic">Green Space</text>

          {/* ── Major roads (outline then fill) ── */}
          {/* Diagonal boulevard */}
          <path d="M 0,310 Q 150,270 300,220 Q 480,165 650,110 Q 740,82 800,62" stroke="#cfc8b8" strokeWidth="20" fill="none" strokeLinecap="round"/>
          <path d="M 0,310 Q 150,270 300,220 Q 480,165 650,110 Q 740,82 800,62" stroke="#ffffff" strokeWidth="14" fill="none" strokeLinecap="round"/>

          {/* Horizontal main */}
          <line x1="0" y1="148" x2="800" y2="148" stroke="#cfc8b8" strokeWidth="16"/>
          <line x1="0" y1="148" x2="800" y2="148" stroke="#ffffff" strokeWidth="11"/>

          {/* ── Secondary roads ── */}
          <line x1="0" y1="68" x2="800" y2="68" stroke="#d4ccbc" strokeWidth="11"/>
          <line x1="0" y1="68" x2="800" y2="68" stroke="#f8f4ef" strokeWidth="7"/>

          <line x1="0" y1="248" x2="800" y2="248" stroke="#d4ccbc" strokeWidth="11"/>
          <line x1="0" y1="248" x2="800" y2="248" stroke="#f8f4ef" strokeWidth="7"/>

          <line x1="180" y1="0" x2="180" y2="340" stroke="#d4ccbc" strokeWidth="11"/>
          <line x1="180" y1="0" x2="180" y2="340" stroke="#f8f4ef" strokeWidth="7"/>

          <line x1="420" y1="0" x2="420" y2="340" stroke="#d4ccbc" strokeWidth="11"/>
          <line x1="420" y1="0" x2="420" y2="340" stroke="#f8f4ef" strokeWidth="7"/>

          <line x1="640" y1="0" x2="640" y2="340" stroke="#d4ccbc" strokeWidth="11"/>
          <line x1="640" y1="0" x2="640" y2="340" stroke="#f8f4ef" strokeWidth="7"/>

          {/* ── Residential streets ── */}
          <path d="M 180,68 Q 220,108 210,148" stroke="#d8d0c0" strokeWidth="8" fill="none"/>
          <path d="M 180,68 Q 220,108 210,148" stroke="#f8f4ef" strokeWidth="5" fill="none"/>

          <path d="M 420,148 Q 460,188 475,248" stroke="#d8d0c0" strokeWidth="8" fill="none"/>
          <path d="M 420,148 Q 460,188 475,248" stroke="#f8f4ef" strokeWidth="5" fill="none"/>

          <path d="M 640,148 Q 680,190 700,248" stroke="#d8d0c0" strokeWidth="8" fill="none"/>
          <path d="M 640,148 Q 680,190 700,248" stroke="#f8f4ef" strokeWidth="5" fill="none"/>

          <path d="M 300,248 Q 320,290 310,340" stroke="#d8d0c0" strokeWidth="8" fill="none"/>
          <path d="M 300,248 Q 320,290 310,340" stroke="#f8f4ef" strokeWidth="5" fill="none"/>

          <path d="M 80,68 Q 100,108 90,148" stroke="#d8d0c0" strokeWidth="7" fill="none"/>
          <path d="M 80,68 Q 100,108 90,148" stroke="#f8f4ef" strokeWidth="4" fill="none"/>

          <path d="M 550,68 Q 570,108 560,148" stroke="#d8d0c0" strokeWidth="7" fill="none"/>
          <path d="M 550,68 Q 570,108 560,148" stroke="#f8f4ef" strokeWidth="4" fill="none"/>

          {/* ── Street labels ── */}
          <text x="20" y="144" fontSize="8.5" fill="#9a9080" fontFamily="sans-serif">Oak Boulevard</text>
          <text x="20" y="63" fontSize="7.5" fill="#9a9080" fontFamily="sans-serif">Maple Ave</text>
          <text x="20" y="243" fontSize="7.5" fill="#9a9080" fontFamily="sans-serif">Elm Street</text>
          <text x="176" y="30" fontSize="7" fill="#9a9080" fontFamily="sans-serif" transform="rotate(90,176,30)">Cedar Rd</text>
          <text x="416" y="30" fontSize="7" fill="#9a9080" fontFamily="sans-serif" transform="rotate(90,416,30)">Pine Ave</text>
          <text x="636" y="30" fontSize="7" fill="#9a9080" fontFamily="sans-serif" transform="rotate(90,636,30)">Birch Dr</text>
          <text x="110" y="308" fontSize="7.5" fill="#9a9080" fontFamily="sans-serif" transform="rotate(-22,110,308)">Riverside Blvd</text>
        </svg>

        {/* Pins on top of map */}
        {pins.map((pin, i) => (
          <div
            key={i}
            className="absolute"
            style={{ left: pin.x, top: pin.y, transform: "translate(-50%,-50%)", zIndex: 2 }}
          >
            <div
              className="flex items-center justify-center rounded-full border-2 border-white shadow-md"
              style={{ width: 22, height: 22, background: pin.color }}
            >
              <span className="material-symbols-outlined text-white" style={{ fontSize: 11 }}>home</span>
            </div>
          </div>
        ))}

        {/* Legend */}
        <div className="absolute bottom-3 left-3 rounded-xl px-3 py-2.5 flex flex-col gap-1.5 z-10" style={{ background: "rgba(255,252,248,0.92)", backdropFilter: "blur(8px)", border: "1px solid rgba(0,0,0,0.08)", boxShadow: "0 2px 12px rgba(0,0,0,0.12)" }}>
          {[{ color: "#f97316", label: "Visited" }, { color: "#22c55e", label: "Interested" }, { color: "#ef4444", label: "No Answer" }, { color: "#94a3b8", label: "Not Visited" }].map((l) => (
            <div key={l.label} className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full" style={{ background: l.color }} />
              <span style={{ fontSize: 10, color: "#4a4a4a" }}>{l.label}</span>
            </div>
          ))}
        </div>

        {/* Stats chip */}
        <div className="absolute top-3 right-3 rounded-xl px-3.5 py-2.5 z-10" style={{ background: "rgba(255,252,248,0.92)", backdropFilter: "blur(8px)", border: "1px solid rgba(0,0,0,0.08)", boxShadow: "0 2px 12px rgba(0,0,0,0.12)" }}>
          <p style={{ fontSize: 10, color: "#888" }}>Doors knocked</p>
          <p className="font-bold text-sm" style={{ color: "#1a1a2e" }}>47 today</p>
        </div>
      </div>
    </div>
  );
}

function RevenueChartMockup() {
  const bars = [
    { month: "Jan", height: 38, value: "$9.2k"  },
    { month: "Feb", height: 50, value: "$12.4k" },
    { month: "Mar", height: 63, value: "$15.8k" },
    { month: "Apr", height: 55, value: "$13.7k" },
    { month: "May", height: 78, value: "$19.5k" },
    { month: "Jun", height: 100, value: "$24.8k" },
  ];
  return (
    <div className="rounded-2xl overflow-hidden border" style={{ background: "white", borderColor: "oklch(0.928 0.006 265 / 0.6)", boxShadow: "0 8px 40px oklch(0 0 0 / 0.10)" }}>
      <div className="px-6 py-5 border-b flex items-center justify-between" style={{ borderColor: "oklch(0.928 0.006 265 / 0.5)" }}>
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="material-symbols-outlined" style={{ fontSize: 22, color: "oklch(0.470 0.082 229)" }}>bar_chart</span>
            <span className="font-display font-semibold text-base" style={{ color: "oklch(0.220 0.031 260)" }}>Revenue</span>
          </div>
          <p className="text-3xl font-display font-bold" style={{ color: "oklch(0.220 0.031 260)" }}>$24,830</p>
          <p className="text-xs mt-0.5" style={{ color: "oklch(0.551 0.023 264)" }}>June 2025</p>
        </div>
        <div>
          <div className="flex items-center gap-1.5 text-sm font-bold px-4 py-2 rounded-xl mb-2" style={{ background: "#f0fdf4", color: "#16a34a" }}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>trending_up</span>
            +18% vs last month
          </div>
          <div className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl" style={{ background: "oklch(0.470 0.082 229 / 0.08)", color: "oklch(0.470 0.082 229)" }}>
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>payments</span>
            12 invoices paid
          </div>
        </div>
      </div>
      <div className="px-6 py-6">
        <div className="flex items-end gap-3" style={{ height: 180 }}>
          <div className="flex flex-col justify-between h-full pr-2 flex-shrink-0">
            {["$25k", "$20k", "$15k", "$10k", "$5k", "$0"].map((l) => (
              <span key={l} style={{ fontSize: 10, color: "oklch(0.551 0.023 264)" }}>{l}</span>
            ))}
          </div>
          {bars.map((b, i) => (
            <div key={i} className="flex-1 flex flex-col items-center justify-end gap-1.5" style={{ height: "100%" }}>
              <span style={{ fontSize: 9, color: "oklch(0.551 0.023 264)" }}>{b.value}</span>
              <div
                className="w-full rounded-t-xl transition-all"
                style={{
                  height: `${b.height}%`,
                  background: i === bars.length - 1
                    ? "linear-gradient(180deg, oklch(0.470 0.082 229), oklch(0.685 0.148 237))"
                    : "oklch(0.470 0.082 229 / 0.18)",
                }}
              />
              <span className="font-medium" style={{ fontSize: 10, color: i === bars.length - 1 ? "oklch(0.470 0.082 229)" : "oklch(0.551 0.023 264)" }}>{b.month}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ClientListMockup() {
  const clients = [
    { initials: "MJ", name: "Mike Johnson",      lastJob: "Roof Inspection",      date: "Jun 10", balance: "$0",   jobs: 8,  color: "oklch(0.470 0.082 229)" },
    { initials: "SR", name: "Sarah Rodriguez",   lastJob: "Window Cleaning",      date: "Jun 8",  balance: "$180", jobs: 5,  color: "oklch(0.606 0.219 293)" },
    { initials: "TP", name: "Tom Patel",          lastJob: "Gutter Cleaning",      date: "Jun 5",  balance: "$0",   jobs: 12, color: "oklch(0.627 0.170 149)" },
    { initials: "AL", name: "Amanda Lee",         lastJob: "Pressure Washing",     date: "Jun 3",  balance: "$95",  jobs: 3,  color: "oklch(0.769 0.165 70)"  },
    { initials: "RK", name: "Robert Kim",         lastJob: "Landscaping",          date: "Jun 1",  balance: "$0",   jobs: 6,  color: "#8b5cf6"                 },
  ];
  return (
    <div className="rounded-2xl overflow-hidden border" style={{ background: "white", borderColor: "oklch(0.928 0.006 265 / 0.6)", boxShadow: "0 8px 40px oklch(0 0 0 / 0.10)" }}>
      <div className="px-6 py-5 border-b flex items-center justify-between" style={{ borderColor: "oklch(0.928 0.006 265 / 0.5)" }}>
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined" style={{ fontSize: 22, color: "oklch(0.470 0.082 229)" }}>group</span>
          <span className="font-display font-semibold text-base" style={{ color: "oklch(0.220 0.031 260)" }}>Clients</span>
          <span className="text-xs px-2 py-0.5 rounded-full font-semibold ml-1" style={{ background: "oklch(0.470 0.082 229 / 0.10)", color: "oklch(0.470 0.082 229)" }}>48 total</span>
        </div>
        <div className="flex items-center gap-2 rounded-xl px-4 py-2" style={{ background: "oklch(0.970 0.004 248)" }}>
          <span className="material-symbols-outlined" style={{ fontSize: 15, color: "oklch(0.551 0.023 264)" }}>search</span>
          <span className="text-sm" style={{ color: "oklch(0.551 0.023 264)" }}>Search…</span>
        </div>
      </div>
      <div className="divide-y" style={{ borderColor: "oklch(0.928 0.006 265 / 0.4)" }}>
        {clients.map((c, i) => (
          <div key={i} className="px-6 py-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-white font-bold" style={{ fontSize: 13, background: c.color }}>
              {c.initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium" style={{ color: "oklch(0.220 0.031 260)" }}>{c.name}</p>
              <p className="text-xs mt-0.5" style={{ color: "oklch(0.551 0.023 264)" }}>{c.lastJob} · {c.date} · {c.jobs} jobs</p>
            </div>
            <p className="text-sm font-semibold flex-shrink-0" style={{ color: c.balance === "$0" ? "oklch(0.627 0.170 149)" : "#f97316" }}>
              {c.balance === "$0" ? "Paid ✓" : c.balance + " due"}
            </p>
            <div className="px-3 h-8 rounded-xl border flex items-center justify-center flex-shrink-0 text-xs font-medium" style={{ borderColor: "oklch(0.928 0.006 265)", color: "oklch(0.470 0.082 229)" }}>
              View
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Detail Sections ──────────────────────────────────────────────────────────

function DetailSection({
  eyebrow, title, description, bullets, iconColor, iconBg, reverse, mockup,
}: {
  eyebrow: string; title: string; description: string; bullets: string[];
  iconColor: string; iconBg: string; reverse?: boolean; mockup: React.ReactNode;
}) {
  return (
    <div className={`flex flex-col ${reverse ? "lg:flex-row-reverse" : "lg:flex-row"} items-center gap-12 lg:gap-16 py-14`}>
      <div className="flex-1">
        <p className="text-xs font-semibold tracking-widest uppercase mb-3" style={{ color: iconColor }}>{eyebrow}</p>
        <h2 className="text-3xl md:text-4xl font-display font-bold mb-4" style={{ color: "oklch(0.220 0.031 260)" }}>{title}</h2>
        <p className="mb-6 leading-relaxed" style={{ color: "oklch(0.551 0.023 264)" }}>{description}</p>
        <ul className="space-y-3">
          {bullets.map((b) => (
            <li key={b} className="flex items-center gap-3 text-sm" style={{ color: "oklch(0.220 0.031 260)" }}>
              <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: iconBg }}>
                <span className="material-symbols-outlined" style={{ color: iconColor, fontSize: "14px" }}>check</span>
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
      <div className="flex-1 w-full">{mockup}</div>
    </div>
  );
}

function DetailSections() {
  return (
    <section className="py-6" style={{ background: "white" }}>
      <SectionCard className="px-8">
        <DetailSection
          eyebrow="Jobs & Scheduling"
          title="From first call to final sign-off."
          description="Create jobs, assign them to your crew, and track every status update in real time. HustleBricks syncs with Google Calendar so nothing falls through the cracks."
          bullets={["Create and assign jobs in seconds", "Track job status: scheduled, in progress, completed", "Google Calendar sync for every team member", "Before & after photos captured on-site", "Client portal for booking requests"]}
          iconColor="oklch(0.470 0.082 229)"
          iconBg="oklch(0.470 0.082 229 / 0.10)"
          mockup={<JobBoardMockup />}
        />
        <div className="border-t" style={{ borderColor: "oklch(0.928 0.006 265 / 0.5)" }} />
        <DetailSection
          eyebrow="Canvassing"
          title="Take your team door to door."
          description="Map your territory, track every door your team knocks, and follow up with interested homeowners — all from one live map view."
          bullets={["Interactive map with real-time door statuses", "Color-coded pins: interested, no answer, follow-up", "Track daily knock counts per rep", "Convert leads into jobs instantly", "Team leaderboard for canvassing performance"]}
          iconColor="oklch(0.606 0.219 293)"
          iconBg="oklch(0.606 0.219 293 / 0.10)"
          reverse
          mockup={<CanvasMapMockup />}
        />
        <div className="border-t" style={{ borderColor: "oklch(0.928 0.006 265 / 0.5)" }} />
        <DetailSection
          eyebrow="Payments & Invoicing"
          title="Get paid. Every time. On time."
          description="Send professional invoices clients can pay online via Stripe. Track what's been paid, what's outstanding, and follow up automatically — all from one dashboard."
          bullets={["Stripe-powered online payments", "Send invoice links via email or SMS", "Track paid vs. outstanding balances", "Cash and check logging for offline payments", "Tip collection at job completion"]}
          iconColor="oklch(0.627 0.170 149)"
          iconBg="oklch(0.627 0.170 149 / 0.10)"
          mockup={<RevenueChartMockup />}
        />
        <div className="border-t" style={{ borderColor: "oklch(0.928 0.006 265 / 0.5)" }} />
        <DetailSection
          eyebrow="Clients"
          title="Every client. Every detail. One place."
          description="Build your client list, track job history, and see outstanding balances at a glance. Send quotes and convert them to invoices without ever leaving the app."
          bullets={["Full client profiles with job history", "Track open balances and payment status", "Send quotes directly from the client record", "Shareable client booking portal", "Notes and contact info always at hand"]}
          iconColor="oklch(0.769 0.165 70)"
          iconBg="oklch(0.769 0.165 70 / 0.10)"
          reverse
          mockup={<ClientListMockup />}
        />
      </SectionCard>
    </section>
  );
}

// ─── Pricing ──────────────────────────────────────────────────────────────────

const plans = [
  {
    name: "Solo", tagline: "Start solo. Scale into the next plan.", monthly: 49, yearly: 34, highlight: false,
    features: ["1 user", "Unlimited jobs & clients", "Quotes & invoicing", "Stripe online payments", "Google Calendar sync", "Client booking portal", "Mobile-friendly"],
  },
  {
    name: "Team", tagline: "More crew. More jobs. More revenue.", monthly: 119, yearly: 83, highlight: true,
    features: ["Up to 8 users", "Everything in Solo", "Employee portal & time tracking", "Job assignment & notifications", "Team scheduling", "Sales dashboard", "Analytics & reports"],
  },
  {
    name: "Business", tagline: "Built for scaled operations.", monthly: 249, yearly: 174, highlight: false,
    features: ["Up to 30 users", "Everything in Team", "Canvassing & lead map", "Payroll reports", "Custom roles & permissions", "Priority support", "Dedicated onboarding"],
  },
];

function Pricing() {
  const [yearly, setYearly] = useState(false);

  return (
    <section id="pricing" className="py-6" style={{ background: "white" }}>
      <SectionCard className="py-16 px-8">
        <div className="text-center mb-12">
          <p className="text-xs font-semibold tracking-widest uppercase mb-3" style={{ color: "oklch(0.470 0.082 229)" }}>Pricing</p>
          <h2 className="text-3xl md:text-4xl font-display font-bold mb-4" style={{ color: "oklch(0.220 0.031 260)" }}>
            Built and priced for growth.
          </h2>
          <p className="mb-8" style={{ color: "oklch(0.551 0.023 264)" }}>7-day free trial on every plan. No credit card required.</p>

          <div className="inline-flex items-center gap-3 rounded-full p-1 border" style={{ background: "white", borderColor: "oklch(0.928 0.006 265 / 0.8)" }}>
            <button
              onClick={() => setYearly(false)}
              className="px-4 py-1.5 rounded-full text-sm font-medium transition-colors"
              style={!yearly ? { background: "oklch(0.470 0.082 229)", color: "white" } : { color: "oklch(0.551 0.023 264)" }}
            >
              Monthly
            </button>
            <button
              onClick={() => setYearly(true)}
              className="px-4 py-1.5 rounded-full text-sm font-medium transition-colors flex items-center gap-2"
              style={yearly ? { background: "oklch(0.470 0.082 229)", color: "white" } : { color: "oklch(0.551 0.023 264)" }}
            >
              Yearly
              <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full" style={{ background: "#f0fdf4", color: "#16a34a" }}>30% OFF</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className="relative rounded-2xl p-7 flex flex-col gap-6"
              style={plan.highlight
                ? { background: "oklch(0.470 0.082 229)", boxShadow: "0 8px 40px oklch(0.470 0.082 229 / 0.35)" }
                : { background: "white", border: "1px solid oklch(0.928 0.006 265 / 0.8)", boxShadow: "0 2px 12px oklch(0 0 0 / 0.05)" }}
            >
              {plan.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-white text-xs font-bold px-4 py-1 rounded-full shadow-sm" style={{ color: "oklch(0.470 0.082 229)" }}>
                  Most Popular
                </div>
              )}

              <div>
                <p className="text-xs font-bold tracking-widest uppercase mb-1" style={{ color: plan.highlight ? "rgba(255,255,255,0.65)" : "oklch(0.551 0.023 264)" }}>
                  {plan.name}
                </p>
                <p className="text-sm" style={{ color: plan.highlight ? "rgba(255,255,255,0.70)" : "oklch(0.551 0.023 264)" }}>
                  {plan.tagline}
                </p>
              </div>

              <div>
                {yearly && (
                  <p className="text-sm line-through mb-0.5" style={{ color: plan.highlight ? "rgba(255,255,255,0.40)" : "oklch(0.551 0.023 264 / 0.60)" }}>
                    ${plan.monthly}/mo
                  </p>
                )}
                <div className="flex items-end gap-1">
                  <span className="text-4xl font-display font-bold" style={{ color: plan.highlight ? "white" : "oklch(0.220 0.031 260)" }}>
                    ${yearly ? plan.yearly : plan.monthly}
                  </span>
                  <span className="text-sm mb-1.5" style={{ color: plan.highlight ? "rgba(255,255,255,0.60)" : "oklch(0.551 0.023 264)" }}>USD/mo</span>
                </div>
                {yearly && (
                  <p className="text-xs" style={{ color: plan.highlight ? "rgba(255,255,255,0.50)" : "oklch(0.551 0.023 264)" }}>Billed yearly · 30% OFF</p>
                )}
              </div>

              <Link
                href="/signup"
                className="press w-full text-center py-2.5 rounded-xl text-sm font-semibold transition-colors"
                style={plan.highlight
                  ? { background: "white", color: "oklch(0.470 0.082 229)" }
                  : { background: "oklch(0.470 0.082 229)", color: "white" }}
              >
                Start Free Trial
              </Link>

              <ul className="space-y-3">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2.5 text-sm">
                    <span
                      className="material-symbols-outlined flex-shrink-0"
                      style={{ fontSize: "16px", color: plan.highlight ? "rgba(255,255,255,0.80)" : "oklch(0.470 0.082 229)" }}
                    >
                      check
                    </span>
                    <span style={{ color: plan.highlight ? "rgba(255,255,255,0.85)" : "oklch(0.220 0.031 260)" }}>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </SectionCard>
    </section>
  );
}

// ─── FAQ ──────────────────────────────────────────────────────────────────────

const faqs = [
  { q: "What kinds of businesses use HustleBricks?", a: "HustleBricks is built for home service businesses — cleaning, landscaping, pressure washing, painting, handyman, moving, and more. If you book jobs and have a crew, it works for you." },
  { q: "How does the free trial work?", a: "Sign up and get 7 days free on any plan. No credit card required. At the end of the trial you can subscribe or your account pauses — your data stays safe either way." },
  { q: "Can my employees use HustleBricks from their phone?", a: "Yes. Your crew gets access to the Employee Portal, where they can view assigned jobs, clock in and out, take before/after photos, and collect payment — all from a mobile browser." },
  { q: "How do online payments work?", a: "HustleBricks uses Stripe to process payments. You send clients an invoice link, they pay by card, and the money lands in your Stripe account. You can also log cash and check payments manually." },
  { q: "Can I bring my existing clients over?", a: "Absolutely. You can add clients manually or import them. Your existing jobs and history can be entered as well during onboarding." },
];

function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section id="faq" className="py-6" style={{ background: "white" }}>
      <SectionCard className="py-16 px-8">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-xs font-semibold tracking-widest uppercase mb-3" style={{ color: "oklch(0.470 0.082 229)" }}>FAQ</p>
            <h2 className="text-3xl md:text-4xl font-display font-bold mb-4" style={{ color: "oklch(0.220 0.031 260)" }}>
              Everything you need before switching.
            </h2>
          </div>

          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <div
                key={i}
                className="rounded-2xl border overflow-hidden"
                style={{ background: "white", borderColor: "oklch(0.928 0.006 265 / 0.8)", boxShadow: "0 1px 6px oklch(0 0 0 / 0.04)" }}
              >
                <button
                  className="w-full flex items-center justify-between px-6 py-4 text-left"
                  onClick={() => setOpenIndex(openIndex === i ? null : i)}
                >
                  <span className="text-sm font-medium" style={{ color: "oklch(0.220 0.031 260)" }}>{faq.q}</span>
                  <span
                    className="material-symbols-outlined flex-shrink-0 ml-4 transition-transform"
                    style={{ fontSize: "20px", color: "oklch(0.551 0.023 264)", transform: openIndex === i ? "rotate(180deg)" : "rotate(0deg)" }}
                  >
                    keyboard_arrow_down
                  </span>
                </button>
                {openIndex === i && (
                  <div className="px-6 pb-5">
                    <p className="text-sm leading-relaxed" style={{ color: "oklch(0.551 0.023 264)" }}>{faq.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </SectionCard>
    </section>
  );
}

// ─── Final CTA ────────────────────────────────────────────────────────────────

function FinalCTA() {
  return (
    <section className="py-6" style={{ background: "white" }}>
      <div
        className="mx-4 md:mx-8 rounded-3xl py-20 text-center relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, oklch(0.300 0.082 229) 0%, oklch(0.420 0.082 229) 100%)" }}
      >
        <div
          className="absolute inset-0 opacity-40"
          style={{ background: "radial-gradient(ellipse at 50% 0%, oklch(0.570 0.100 229), transparent 70%)" }}
        />
        <h2 className="text-3xl md:text-5xl font-display font-bold text-white mb-4 relative">
          Your business deserves better software.
        </h2>
        <p className="mb-10 max-w-md mx-auto relative" style={{ color: "rgba(255,255,255,0.70)" }}>
          Your competitors are already running lean. Get started in minutes.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 relative">
          <Link
            href="/signup"
            className="press inline-flex items-center gap-2 bg-white font-semibold px-8 py-3.5 rounded-xl hover:bg-white/90 transition-colors shadow-lg"
            style={{ color: "oklch(0.470 0.082 229)" }}
          >
            Start Free Trial
            <span className="material-symbols-outlined text-lg">arrow_forward</span>
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 border font-medium px-8 py-3.5 rounded-xl transition-colors text-white"
            style={{ borderColor: "rgba(255,255,255,0.35)" }}
          >
            Log in
          </Link>
        </div>
        <p className="text-xs mt-5 relative" style={{ color: "rgba(255,255,255,0.40)" }}>7-day free trial · No credit card required</p>
      </div>
    </section>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer className="py-10 border-t" style={{ background: "#faf9f7", borderColor: "oklch(0.928 0.006 265 / 0.6)" }}>
      <div className="max-w-6xl mx-auto px-5 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center overflow-hidden" style={{ background: "oklch(0.470 0.082 229)" }}>
            <svg viewBox="0 0 200 200" width="28" height="28" xmlns="http://www.w3.org/2000/svg">
              <rect x="28" y="74" width="66" height="40" rx="5" fill="white" fillOpacity="0.95" />
              <rect x="106" y="74" width="66" height="40" rx="5" fill="white" fillOpacity="0.95" />
              <rect x="28" y="122" width="37" height="40" rx="5" fill="white" fillOpacity="0.95" />
              <rect x="73" y="122" width="54" height="40" rx="5" fill="white" fillOpacity="0.95" />
              <rect x="135" y="122" width="37" height="40" rx="5" fill="white" fillOpacity="0.95" />
            </svg>
          </div>
          <span className="font-display font-bold" style={{ color: "oklch(0.220 0.031 260)" }}>HustleBricks</span>
        </div>
        <p className="text-xs" style={{ color: "oklch(0.551 0.023 264)" }}>© {new Date().getFullYear()} HustleBricks. All rights reserved.</p>
        <nav className="flex items-center gap-5">
          <Link href="/login" className="text-xs transition-colors" style={{ color: "oklch(0.551 0.023 264)" }}>Log in</Link>
          <a href="#" className="text-xs transition-colors" style={{ color: "oklch(0.551 0.023 264)" }}>Privacy</a>
          <a href="#" className="text-xs transition-colors" style={{ color: "oklch(0.551 0.023 264)" }}>Terms</a>
        </nav>
      </div>
    </footer>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <div style={{ ...light, minHeight: "100vh", background: "white" }}>
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
