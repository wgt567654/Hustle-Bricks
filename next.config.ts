import type { NextConfig } from "next";

// Lock CORS on public intake routes to the app's own origin.
// NOTE: if the booking widget is ever embedded on customers' own websites,
// this must become a per-business origin allowlist instead of a single origin.
function appOrigin(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL ?? "https://hustlebricks.com";
  try {
    return new URL(raw).origin;
  } catch {
    return "https://hustlebricks.com";
  }
}

const corsHeaders = [
  { key: "Access-Control-Allow-Origin", value: appOrigin() },
  { key: "Access-Control-Allow-Methods", value: "GET,POST,OPTIONS" },
  { key: "Access-Control-Allow-Headers", value: "Content-Type" },
];

// Global security headers. No CSP yet — adding one blind risks breaking the
// app (inline styles, Supabase/Stripe/Twilio origins); treat as a follow-up.
// Permissions-Policy: the app uses the microphone (voice notes in chat) and
// geolocation (canvassing map); camera capture goes through <input capture>
// (native picker), which Permissions-Policy does not gate, so camera=() is safe.
const securityHeaders = [
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(self), geolocation=(self)",
  },
];

// /book/* is embedded in <iframe>s on customers' own websites, so it must not
// send X-Frame-Options. frame-ancestors * is the Calendly/Acuity model for a
// public booking widget; tighten to a per-business allowlist if ever needed.
// The widget's API calls originate from our own origin inside the frame, so
// the CORS allowlist above is unaffected.
const embedHeaders = [
  { key: "Content-Security-Policy", value: "frame-ancestors *" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
];

const nextConfig: NextConfig = {
  async headers() {
    const devHeaders =
      process.env.NODE_ENV === "development"
        ? [
            {
              source: "/_next/static/:path*",
              headers: [{ key: "Cache-Control", value: "no-store" }],
            },
          ]
        : [];

    return [
      // Everything except /book/* gets the frame-blocking security headers;
      // /book/* gets the embeddable variant instead.
      { source: "/((?!book/|book$).*)", headers: securityHeaders },
      { source: "/book/:path*", headers: embedHeaders },
      ...devHeaders,
      { source: "/api/leads/submit", headers: corsHeaders },
      { source: "/api/booking/capacity", headers: corsHeaders },
      { source: "/api/booking/public", headers: corsHeaders },
      { source: "/api/quotes/request", headers: corsHeaders },
    ];
  },
};

export default nextConfig;
