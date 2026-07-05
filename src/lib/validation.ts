/**
 * Light input-sanity helpers for public intake routes (defense in depth).
 * Not a full schema validator — just enough to reject garbage and oversized
 * payloads before they hit the database.
 */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Max length for names, emails, phones, addresses, and similar short fields. */
export const SHORT_MAX = 200;
/** Max length for notes / free-text messages. */
export const LONG_MAX = 2000;

export function isUuid(v: unknown): v is string {
  return typeof v === "string" && UUID_RE.test(v);
}

/** Required non-empty string up to `max` chars. */
export function isRequiredString(v: unknown, max = SHORT_MAX): v is string {
  return typeof v === "string" && v.trim().length > 0 && v.length <= max;
}

/** Optional field: absent/null/empty is fine; if present must be a string up to `max`. */
export function isOptionalString(
  v: unknown,
  max = SHORT_MAX
): v is string | null | undefined {
  if (v === undefined || v === null || v === "") return true;
  return typeof v === "string" && v.length <= max;
}

/** Optional array of short strings (e.g. selected services). */
export function isOptionalStringArray(
  v: unknown,
  maxItems = 50
): v is string[] | null | undefined {
  if (v === undefined || v === null) return true;
  return (
    Array.isArray(v) &&
    v.length <= maxItems &&
    v.every((item) => typeof item === "string" && item.length <= SHORT_MAX)
  );
}
