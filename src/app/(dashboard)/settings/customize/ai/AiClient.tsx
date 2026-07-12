"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";
import type { AIPersonality } from "@/lib/customization";

const TONES: { id: AIPersonality["tone"]; label: string; desc: string; icon: string }[] = [
  { id: "professional", label: "Professional", desc: "Capable and to the point", icon: "work" },
  { id: "friendly", label: "Friendly", desc: "Warm and approachable", icon: "sentiment_satisfied" },
  { id: "luxury", label: "Luxury", desc: "Refined, white-glove service", icon: "diamond" },
  { id: "minimal", label: "Minimal", desc: "Short answers, zero filler", icon: "minimize" },
  { id: "technical", label: "Technical", desc: "Precise, numbers-first", icon: "engineering" },
  { id: "funny", label: "Funny", desc: "Lightly witty, still useful", icon: "mood" },
  { id: "formal", label: "Formal", desc: "Courteous and traditional", icon: "account_balance" },
];

const EXAMPLES = [
  "We never pressure customers.",
  "We always educate first.",
  "We recommend annual maintenance.",
];

export default function AiClient({
  businessId,
  initialPersonality,
}: {
  businessId: string;
  initialPersonality: AIPersonality;
}) {
  const [baseline, setBaseline] = useState<AIPersonality>(initialPersonality);
  const [tone, setTone] = useState<AIPersonality["tone"]>(initialPersonality.tone);
  const [instructions, setInstructions] = useState(initialPersonality.instructions);
  const [saving, setSaving] = useState(false);

  const dirty = tone !== baseline.tone || instructions !== baseline.instructions;

  async function save() {
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from("business_customization").upsert(
      {
        business_id: businessId,
        ai_personality: { tone, instructions },
      },
      { onConflict: "business_id" }
    );
    setSaving(false);
    if (error) {
      const missingTable =
        error.code === "42P01" ||
        error.code === "PGRST205" ||
        error.message?.includes("schema cache");
      toast.error(
        missingTable
          ? "Run customization.sql in Supabase to enable AI personality"
          : "Couldn't save AI personality"
      );
      return;
    }
    setBaseline({ tone, instructions });
    toast.success("Your assistant will follow these from now on");
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8 px-4 py-6 pb-28">
      <div className="reveal flex flex-col gap-1" style={{ "--reveal-i": 0 } as React.CSSProperties}>
        <Link
          href="/settings/customize"
          className="mb-2 inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          Customize Studio
        </Link>
        <h1 className="text-2xl">AI Personality</h1>
        <p className="text-sm text-muted-foreground">
          Your AI assistant represents your business. Choose how it sounds and
          give it permanent operating instructions.
        </p>
      </div>

      {/* Tone */}
      <section className="reveal flex flex-col gap-3" style={{ "--reveal-i": 1 } as React.CSSProperties}>
        <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
          Tone
        </h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {TONES.map((t) => {
            const selected = tone === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTone(t.id)}
                aria-pressed={selected}
                className={`press flex flex-col items-start gap-1.5 rounded-2xl border bg-card p-3 text-left transition-colors ${
                  selected
                    ? "border-primary"
                    : "border-border hover:border-muted-foreground/40"
                }`}
              >
                <span
                  className={`material-symbols-outlined text-[20px] ${
                    selected ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  {t.icon}
                </span>
                <span className={`text-sm ${selected ? "font-semibold" : "font-medium"}`}>
                  {t.label}
                </span>
                <span className="text-xs text-muted-foreground">{t.desc}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Permanent instructions */}
      <section className="reveal flex flex-col gap-3" style={{ "--reveal-i": 2 } as React.CSSProperties}>
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
            Permanent instructions
          </h3>
          <p className="text-sm text-muted-foreground">
            The assistant follows these in every conversation.
          </p>
        </div>
        <textarea
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          rows={5}
          maxLength={2000}
          placeholder={`e.g. ${EXAMPLES.join(" ")}`}
          className="w-full rounded-2xl border border-border bg-card p-4 text-sm leading-relaxed focus:outline-none focus-visible:border-primary"
        />
        <div className="flex flex-wrap gap-1.5">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() =>
                setInstructions((v) => (v ? `${v.replace(/\s+$/, "")} ${ex}` : ex))
              }
              className="press rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground hover:text-foreground"
            >
              + {ex}
            </button>
          ))}
        </div>
      </section>

      {dirty && (
        <div className="glass-sheet fixed inset-x-0 bottom-0 z-40 flex items-center justify-center gap-3 px-4 py-3 animate-in-down">
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="press rounded-xl bg-primary px-6 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save personality"}
          </button>
        </div>
      )}
    </div>
  );
}
