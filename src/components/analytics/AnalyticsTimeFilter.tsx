"use client";

export type Preset = "week" | "month" | "year" | "custom";

export type DateFilter = {
  preset: Preset;
  start: Date;
  end: Date;
};

export function getPresetRange(preset: Exclude<Preset, "custom">): { start: Date; end: Date } {
  const now = new Date();
  if (preset === "week") {
    const dayOfWeek = (now.getDay() + 6) % 7; // 0=Mon … 6=Sun
    const start = new Date(now);
    start.setDate(now.getDate() - dayOfWeek);
    start.setHours(0, 0, 0, 0);
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }
  if (preset === "month") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    start.setHours(0, 0, 0, 0);
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }
  // year
  const start = new Date(now.getFullYear(), 0, 1);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function toInputValue(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function fromInputValue(v: string): Date {
  return new Date(v + "T00:00:00");
}

const PRESETS: { label: string; value: Exclude<Preset, "custom"> }[] = [
  { label: "This Week",  value: "week"  },
  { label: "This Month", value: "month" },
  { label: "This Year",  value: "year"  },
];

type Props = {
  filter: DateFilter;
  onChange: (filter: DateFilter) => void;
};

export function AnalyticsTimeFilter({ filter, onChange }: Props) {
  function handlePreset(preset: Exclude<Preset, "custom">) {
    onChange({ preset, ...getPresetRange(preset) });
  }

  function handleCustomToggle() {
    if (filter.preset !== "custom") {
      onChange({ preset: "custom", start: filter.start, end: filter.end });
    }
  }

  function handleStartChange(v: string) {
    if (!v) return;
    const start = fromInputValue(v);
    if (isNaN(start.getTime())) return;
    onChange({ preset: "custom", start, end: filter.end });
  }

  function handleEndChange(v: string) {
    if (!v) return;
    const end = fromInputValue(v);
    if (isNaN(end.getTime())) return;
    end.setHours(23, 59, 59, 999);
    onChange({ preset: "custom", start: filter.start, end });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2 flex-wrap">
        {PRESETS.map(({ label, value }) => (
          <button
            key={value}
            onClick={() => handlePreset(value)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-colors ${
              filter.preset === value
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {label}
          </button>
        ))}
        <button
          onClick={handleCustomToggle}
          className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-colors ${
            filter.preset === "custom"
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          }`}
        >
          Custom
        </button>
      </div>

      {filter.preset === "custom" && (
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="date"
            value={!isNaN(filter.start.getTime()) ? toInputValue(filter.start) : ""}
            onChange={(e) => handleStartChange(e.target.value)}
            className="border border-border rounded-xl px-2.5 py-1.5 text-xs bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <span className="text-xs text-muted-foreground">to</span>
          <input
            type="date"
            value={!isNaN(filter.end.getTime()) ? toInputValue(filter.end) : ""}
            onChange={(e) => handleEndChange(e.target.value)}
            className="border border-border rounded-xl px-2.5 py-1.5 text-xs bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
      )}
    </div>
  );
}
