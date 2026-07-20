// Geo helpers for geo-aware dispatch (Sprint 2.4).
// Geocoding uses the Google Geocoding REST API and degrades gracefully:
// if GOOGLE_MAPS_API_KEY is not set (or the API fails), callers get null
// and every downstream feature simply shows no geo info — never an error.

export type LatLng = { lat: number; lng: number };

/**
 * Geocode a street address to lat/lng via Google Geocoding API.
 * Returns null when the key is missing, the address is empty, or the
 * API call fails for any reason. Never throws, never logs noise.
 */
export async function geocodeAddress(address: string): Promise<LatLng | null> {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  const trimmed = (address ?? "").trim();
  if (!key || !trimmed) return null;

  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(trimmed)}&key=${key}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = (await res.json()) as {
      results?: { geometry?: { location?: { lat?: number; lng?: number } } }[];
    };
    const loc = data?.results?.[0]?.geometry?.location;
    if (typeof loc?.lat === "number" && typeof loc?.lng === "number") {
      return { lat: loc.lat, lng: loc.lng };
    }
    return null;
  } catch {
    return null;
  }
}

/** Straight-line (great-circle) distance between two points, in miles. */
export function haversineMiles(a: LatLng, b: LatLng): number {
  const R = 3958.8; // Earth radius in miles
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/**
 * Straight-line → drive-time heuristic.
 * Short hops are mostly surface streets (~30 mph effective → 2 min/mile);
 * longer trips pick up highway speed (~46 mph effective → 1.3 min/mile
 * beyond the first 10 miles). Sprint 3 replaces this with real route
 * times from a directions/matrix API.
 */
export function driveMinutesEstimate(miles: number): number {
  if (miles < 10) return Math.round(miles * 2);
  return Math.round(20 + (miles - 10) * 1.3);
}
