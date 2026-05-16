"use client";

import { useRef, useState } from "react";

type GeoResult = {
  id: number;
  name: string;
  admin1?: string;
  country_code?: string;
};

interface Props {
  onSelect: (city: string) => void;
  placeholder?: string;
  inputClassName?: string;
}

function formatCity(r: GeoResult): string {
  return [r.name, r.admin1, r.country_code].filter(Boolean).join(", ");
}

export default function CityAutocomplete({ onSelect, placeholder = "Search for a city…", inputClassName }: Props) {
  const [input, setInput] = useState("");
  const [results, setResults] = useState<GeoResult[]>([]);
  const [notFound, setNotFound] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleInput(val: string) {
    setInput(val);
    setResults([]);
    setNotFound(false);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (val.trim().length < 2) return;
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(val.trim())}&count=6&language=en&format=json`
        );
        const data = await res.json() as { results?: GeoResult[] };
        const found = data.results ?? [];
        setResults(found);
        setNotFound(found.length === 0);
      } catch {
        // silent — don't block the user
      }
    }, 300);
  }

  function select(r: GeoResult) {
    onSelect(formatCity(r));
    setInput("");
    setResults([]);
    setNotFound(false);
  }

  return (
    <div className="relative">
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-[16px] text-muted-foreground pointer-events-none">
          search
        </span>
        <input
          type="text"
          value={input}
          onChange={(e) => handleInput(e.target.value)}
          onBlur={() => setTimeout(() => { setResults([]); setNotFound(false); }, 150)}
          placeholder={placeholder}
          autoComplete="off"
          className={`pl-8 ${inputClassName ?? ""}`}
        />
      </div>

      {(results.length > 0 || notFound) && (
        <ul className="absolute z-50 left-0 right-0 top-full mt-1 bg-background border border-border rounded-xl shadow-lg overflow-hidden">
          {notFound && (
            <li className="px-3 py-2.5 text-sm text-muted-foreground flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px] text-muted-foreground/60">location_off</span>
              No cities found — check the spelling
            </li>
          )}
          {results.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onMouseDown={() => select(r)}
                className="w-full px-3 py-2.5 text-left text-sm hover:bg-muted/60 transition-colors flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-[16px] text-muted-foreground shrink-0">location_city</span>
                <span className="font-medium text-foreground">{r.name}</span>
                {(r.admin1 || r.country_code) && (
                  <span className="text-muted-foreground">{[r.admin1, r.country_code].filter(Boolean).join(", ")}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
