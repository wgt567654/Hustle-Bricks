type LatLng = { lat: number; lng: number };

function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/**
 * Nearest-neighbor TSP heuristic. Starts from index 0 (earliest job by
 * scheduled_at) and greedily picks the closest unvisited stop.
 * Runs in O(n²) — fast enough for n ≤ 25.
 */
export function nearestNeighborTSP<T extends LatLng>(stops: T[]): T[] {
  if (stops.length <= 1) return [...stops];
  const remaining = [...stops];
  const result: T[] = [remaining.splice(0, 1)[0]];
  while (remaining.length > 0) {
    const last = result[result.length - 1];
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const d = haversineKm(last, remaining[i]);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }
    result.push(remaining.splice(bestIdx, 1)[0]);
  }
  return result;
}

/**
 * Build a Google Maps multi-stop directions URL.
 * Opens in the Google Maps app on mobile or the browser on desktop.
 *
 * For >10 addresses, returns two URLs (Google Maps caps waypoints at 8 + origin
 * + destination = 10 stops per URL). The second URL starts at the 10th stop of
 * the first so the routes chain together.
 */
export function buildGoogleMapsRouteUrls(addresses: string[]): string[] {
  if (addresses.length === 0) return [];

  if (addresses.length === 1) {
    return [
      `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(addresses[0])}&travelmode=driving`,
    ];
  }

  const chunks: string[][] = [];
  // Each chunk: up to 10 stops (origin + up to 8 waypoints + destination).
  // Overlap by 1 so the last stop of chunk N is the first of chunk N+1.
  let i = 0;
  while (i < addresses.length) {
    const chunk = addresses.slice(i, i + 10);
    chunks.push(chunk);
    if (chunk.length < 10) break;
    i += 9; // overlap last stop
  }

  return chunks.map((chunk) => {
    const origin = encodeURIComponent(chunk[0]);
    const destination = encodeURIComponent(chunk[chunk.length - 1]);
    const waypoints = chunk
      .slice(1, -1)
      .map(encodeURIComponent)
      .join("|");
    return (
      `https://www.google.com/maps/dir/?api=1` +
      `&origin=${origin}` +
      `&destination=${destination}` +
      (waypoints ? `&waypoints=${waypoints}` : "") +
      `&travelmode=driving`
    );
  });
}
