import { NextResponse } from "next/server";

/**
 * Simple in-memory sliding-window rate limiter.
 *
 * LIMITATION: state lives in per-instance memory. On serverless hosting
 * (Vercel etc.) it resets on every cold start and is NOT shared across
 * concurrently running instances, so a determined attacker can exceed these
 * limits by spreading requests across instances. This is adequate as
 * launch-time abuse friction, not real enforcement — upgrade to a shared
 * store (Upstash / Redis, e.g. @upstash/ratelimit) for real rate limiting.
 */

const MAX_ENTRIES = 10_000;

// Map preserves insertion order; we re-insert keys on every touch so the
// first key is always the least-recently-used one (cheap LRU eviction).
const buckets = new Map<string, number[]>();

export function rateLimit(
  key: string,
  opts: { limit: number; windowMs: number }
): { ok: boolean; retryAfterSec?: number } {
  const now = Date.now();
  const windowStart = now - opts.windowMs;

  // Drop timestamps that have slid out of the window.
  const timestamps = (buckets.get(key) ?? []).filter((t) => t > windowStart);

  if (timestamps.length >= opts.limit) {
    const oldest = timestamps[0];
    const retryAfterSec = Math.max(
      1,
      Math.ceil((oldest + opts.windowMs - now) / 1000)
    );
    buckets.delete(key);
    buckets.set(key, timestamps);
    return { ok: false, retryAfterSec };
  }

  timestamps.push(now);
  buckets.delete(key);
  buckets.set(key, timestamps);

  // Cap total entries so the map can't grow unbounded; evict oldest-touched.
  while (buckets.size > MAX_ENTRIES) {
    const oldestKey = buckets.keys().next().value;
    if (oldestKey === undefined) break;
    buckets.delete(oldestKey);
  }

  return { ok: true };
}

/**
 * Best-effort client IP: first hop of x-forwarded-for, then x-real-ip,
 * then "unknown". Behind a trusted proxy (Vercel) the first XFF hop is the
 * real client.
 */
export function getClientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

/** Friendly 429 JSON response with a Retry-After header. */
export function tooManyRequests(retryAfterSec = 60): NextResponse {
  return NextResponse.json(
    {
      error:
        "Too many requests from your network. Please wait a few minutes and try again.",
    },
    { status: 429, headers: { "Retry-After": String(retryAfterSec) } }
  );
}
