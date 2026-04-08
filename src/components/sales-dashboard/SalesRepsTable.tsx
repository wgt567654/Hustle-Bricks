"use client";

import { Card } from "@/components/ui/card";

export type SalesRep = {
  name: string;
  role: string;
  actual: number;    // revenue attributed (0 if no per-rep data)
  quota: number;     // monthly quota (mock)
  deals: number;     // deals closed (mock)
};

type Props = { reps: SalesRep[] };

// Deterministic avatar color palette based on name initial
const AVATAR_COLORS = [
  { bg: "rgba(0,122,255,0.12)",   text: "#007AFF" },
  { bg: "rgba(22,163,74,0.12)",   text: "#16a34a" },
  { bg: "rgba(234,88,12,0.12)",   text: "#ea580c" },
  { bg: "rgba(139,92,246,0.12)",  text: "#8b5cf6" },
  { bg: "rgba(245,158,11,0.12)",  text: "#f59e0b" },
];

function fmt(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export function SalesRepsTable({ reps }: Props) {
  if (reps.length === 0) {
    return (
      <Card className="rounded-2xl p-6 flex flex-col items-center gap-2 text-center">
        <span
          className="material-symbols-outlined text-[32px] text-muted-foreground/40"
          style={{ fontVariationSettings: "'FILL' 0" }}
        >
          group
        </span>
        <p className="text-sm text-muted-foreground">No team members yet</p>
        <p className="text-xs text-muted-foreground">Add team members to track sales performance</p>
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl overflow-hidden">
      <div className="p-4 flex items-center justify-between border-b">
        <div className="flex items-center gap-2">
          <span
            className="material-symbols-outlined text-[20px]"
            style={{ color: "#8b5cf6", fontVariationSettings: "'FILL' 1" }}
          >
            leaderboard
          </span>
          <h3 className="text-sm font-extrabold">Sales Reps</h3>
        </div>
        <span className="text-xs text-muted-foreground">Quota vs Actual</span>
      </div>

      <div className="flex flex-col divide-y">
        {reps.map((rep, i) => {
          const color = AVATAR_COLORS[i % AVATAR_COLORS.length];
          const progress = rep.quota > 0 ? Math.min((rep.actual / rep.quota) * 100, 100) : 0;
          const initial = rep.name.charAt(0).toUpperCase();

          return (
            <div key={rep.name} className="p-4 flex items-center gap-3">
              {/* Avatar */}
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold"
                style={{ background: color.bg, color: color.text }}
              >
                {initial}
              </div>

              {/* Name + progress */}
              <div className="flex-1 min-w-0 flex flex-col gap-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold truncate">{rep.name}</span>
                  <span className="text-xs text-muted-foreground flex-shrink-0">
                    {fmt(rep.actual)} / {fmt(rep.quota)}
                  </span>
                </div>

                {/* Progress bar */}
                <div className="h-1.5 rounded-full bg-muted/50 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${progress}%`,
                      background: progress >= 100 ? "#16a34a" : progress >= 60 ? "#007AFF" : "#ea580c",
                    }}
                  />
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-muted-foreground capitalize">{rep.role}</span>
                  {rep.deals > 0 && (
                    <>
                      <span className="text-[11px] text-muted-foreground">·</span>
                      <span className="text-[11px] text-muted-foreground">{rep.deals} deal{rep.deals !== 1 ? "s" : ""}</span>
                    </>
                  )}
                  {rep.actual === 0 && (
                    <span className="text-[11px] text-muted-foreground italic">(sample quota)</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
