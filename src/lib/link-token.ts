import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * HMAC-signed tokens for public links (e.g. /q/{quoteId}?t=...).
 * Server-only — never import from a client component.
 *
 * Secret: LINK_SIGNING_SECRET if set, otherwise falls back to CRON_SECRET
 * so no new env var is strictly required.
 */
function signingSecret(): string {
  const secret = process.env.LINK_SIGNING_SECRET ?? process.env.CRON_SECRET;
  if (!secret) {
    throw new Error("link-token: set LINK_SIGNING_SECRET or CRON_SECRET");
  }
  return secret;
}

/** Returns a 32-hex-char HMAC-SHA256 token over `${purpose}:${id}`. */
export function signLinkToken(purpose: string, id: string): string {
  return createHmac("sha256", signingSecret())
    .update(`${purpose}:${id}`)
    .digest("hex")
    .slice(0, 32);
}

/** Constant-time verification of a token produced by signLinkToken. */
export function verifyLinkToken(
  purpose: string,
  id: string,
  token: string | null | undefined
): boolean {
  if (!token || typeof token !== "string") return false;
  const expected = Buffer.from(signLinkToken(purpose, id), "utf8");
  const provided = Buffer.from(token, "utf8");
  if (expected.length !== provided.length) return false;
  return timingSafeEqual(expected, provided);
}
