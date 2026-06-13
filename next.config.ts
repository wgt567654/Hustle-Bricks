import type { NextConfig } from "next";

const corsHeaders = [
  { key: "Access-Control-Allow-Origin", value: "*" },
  { key: "Access-Control-Allow-Methods", value: "GET,POST,OPTIONS" },
  { key: "Access-Control-Allow-Headers", value: "Content-Type" },
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
      ...devHeaders,
      { source: "/api/leads/submit", headers: corsHeaders },
      { source: "/api/booking/capacity", headers: corsHeaders },
      { source: "/api/booking/public", headers: corsHeaders },
      { source: "/api/quotes/request", headers: corsHeaders },
    ];
  },
};

export default nextConfig;
