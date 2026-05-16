import { NextRequest, NextResponse } from "next/server";

// WMO weather codes >= 51 indicate precipitation (drizzle, rain, snow, thunderstorm)
function hasWeatherRisk(code: number, precip: number): boolean {
  return code >= 51 || precip > 1;
}

type DayRisk = { date: string; weathercode: number; precipitation_sum: number; hasRisk: boolean };

async function fetchCityRisk(city: string): Promise<DayRisk[]> {
  try {
    // Strip state/country suffix (e.g. "Denver, Colorado, US" → "Denver")
    const cityName = city.split(",")[0].trim();
    const geoRes = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityName)}&count=1&language=en&format=json`,
      { next: { revalidate: 3600 } }
    );
    const geoData = await geoRes.json();
    const location = geoData.results?.[0];
    if (!location) return [];

    const forecastRes = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${location.latitude}&longitude=${location.longitude}&daily=weather_code,precipitation_sum&timezone=auto&forecast_days=7`,
      { next: { revalidate: 3600 } }
    );
    const forecastData = await forecastRes.json();

    const dates: string[] = forecastData.daily?.time ?? [];
    const codes: number[] = forecastData.daily?.weather_code ?? [];
    const precips: number[] = forecastData.daily?.precipitation_sum ?? [];

    return dates.map((date, i) => ({
      date,
      weathercode: codes[i] ?? 0,
      precipitation_sum: precips[i] ?? 0,
      hasRisk: hasWeatherRisk(codes[i] ?? 0, precips[i] ?? 0),
    }));
  } catch {
    return [];
  }
}

export async function GET(req: NextRequest) {
  const cities = req.nextUrl.searchParams.getAll("city").filter(Boolean);
  if (!cities.length) return NextResponse.json({ risk: [] });

  // Fetch all cities in parallel; union risk — a date is risky if any area is risky
  const allResults = await Promise.all(cities.map(fetchCityRisk));

  const byDate = new Map<string, DayRisk>();
  for (const days of allResults) {
    for (const day of days) {
      const existing = byDate.get(day.date);
      if (!existing || (day.hasRisk && !existing.hasRisk)) {
        byDate.set(day.date, day);
      }
    }
  }

  const risk = Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
  return NextResponse.json({ risk });
}
