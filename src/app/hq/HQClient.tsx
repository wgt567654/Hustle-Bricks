"use client";

import { useState } from "react";

/**
 * Deal-flow "Scout Report" control for a single business row on the HQ
 * dashboard. Posts to /api/hq/scout, which recomputes the business's metrics
 * server-side and returns an AI-generated PE scouting memo. Degrades to a
 * disabled button with a tooltip when ANTHROPIC_API_KEY is unset.
 */
export default function ScoutButton({
  businessId,
  businessName,
  aiEnabled,
}: {
  businessId: string;
  businessName: string;
  aiEnabled: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [memo, setMemo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  async function runScout() {
    if (loading) return;
    setOpen(true);
    if (memo) return; // already generated — just re-open the panel
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/hq/scout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId }),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        setError(json.error ?? "Scout report failed. Try again.");
      } else {
        setMemo(json.report ?? "");
      }
    } catch {
      setError("Couldn't reach the scouting engine. Try again.");
    } finally {
      setLoading(false);
    }
  }

  if (!aiEnabled) {
    return (
      <button
        type="button"
        disabled
        title="Add ANTHROPIC_API_KEY to enable"
        className="cursor-not-allowed rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/30"
      >
        Scout Report
      </button>
    );
  }

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={() => (open ? setOpen(false) : runScout())}
        className="rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-3 py-1.5 text-xs font-semibold text-emerald-300 transition-colors hover:bg-emerald-400/20"
      >
        {loading ? "Scouting…" : open ? "Hide Scout Report" : "Scout Report"}
      </button>

      {open && (
        <div className="mt-3 rounded-xl border border-white/10 bg-black/40 p-4">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-emerald-300/80">
            Scouting Memo · {businessName}
          </p>
          {loading && (
            <p className="text-sm text-white/50">Analyzing signals…</p>
          )}
          {error && <p className="text-sm text-red-400">{error}</p>}
          {memo && (
            <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-white/80">
              {memo}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
