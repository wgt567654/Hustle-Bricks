import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Helpers for attaching intake-uploaded photos (see /api/leads/photos) to a
 * lead. URLs are only accepted if they point into OUR lead-photos bucket for
 * the SAME business — callers can't attach arbitrary URLs or another
 * business's uploads to a lead.
 */

export function leadPhotoUrlPrefix(businessId: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/lead-photos/${businessId}/`;
}

/** Optional array of ≤8 URLs, each produced by our upload endpoint for this business. */
export function isValidPhotoUrls(
  v: unknown,
  businessId: string
): v is string[] | null | undefined {
  if (v === undefined || v === null) return true;
  const prefix = leadPhotoUrlPrefix(businessId);
  return (
    Array.isArray(v) &&
    v.length <= 8 &&
    v.every(
      (u) => typeof u === "string" && u.length <= 500 && u.startsWith(prefix)
    )
  );
}

/**
 * Insert lead_photos rows for already-uploaded intake photos. Best-effort:
 * the lead itself is the record of truth, so a failure here (e.g. the owner
 * hasn't run canvassing_booking_rpc.sql yet) must not fail the submission.
 */
export async function attachLeadPhotos(
  supabase: SupabaseClient,
  leadId: string,
  businessId: string,
  urls: string[] | null | undefined
): Promise<void> {
  if (!urls || urls.length === 0) return;
  await supabase.from("lead_photos").insert(
    urls.map((url) => ({ lead_id: leadId, business_id: businessId, url }))
  );
}
