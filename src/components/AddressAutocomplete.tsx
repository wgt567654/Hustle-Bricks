"use client";

import { useRef, useState } from "react";

type Prediction = { description: string; place_id: string };

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export default function AddressAutocomplete({ value, onChange, placeholder = "123 Main St, City, State", className }: Props) {
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleInput(val: string) {
    onChange(val);
    setPredictions([]);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (val.length < 3) return;
    debounceRef.current = setTimeout(async () => {
      const res = await fetch(`/api/places/autocomplete?q=${encodeURIComponent(val)}`);
      const json = await res.json() as { predictions: Prediction[] };
      setPredictions(json.predictions ?? []);
    }, 300);
  }

  function select(description: string) {
    onChange(description);
    setPredictions([]);
  }

  return (
    <div className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => handleInput(e.target.value)}
        onBlur={() => setTimeout(() => setPredictions([]), 150)}
        placeholder={placeholder}
        autoComplete="off"
        className={className}
      />
      {predictions.length > 0 && (
        <ul className="absolute z-50 left-0 right-0 top-full mt-1 bg-background border border-border rounded-xl shadow-lg overflow-hidden">
          {predictions.map((p) => (
            <li key={p.place_id}>
              <button
                type="button"
                onMouseDown={() => select(p.description)}
                className="w-full px-3 py-2.5 text-left text-sm hover:bg-muted/60 transition-colors flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-[16px] text-muted-foreground shrink-0">location_on</span>
                {p.description}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
