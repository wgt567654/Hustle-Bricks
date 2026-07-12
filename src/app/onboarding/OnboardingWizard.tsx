"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";
import {
  applyThemeToDocument,
  type ThemeSettings,
} from "@/lib/customization";
import {
  COUNTRIES,
  SECTIONS,
  STEPS,
  stepIndex,
  type StepId,
} from "@/lib/onboarding/config";
import { saveProgress, saveStep, stampCompleted, type OnboardingAnswers } from "./save";
import {
  STEP_COMPONENTS,
  stepCta,
  stepIsValid,
  type ConnectStatus,
} from "./OnboardingSteps";

type WizardInitial = {
  userId: string;
  stepId: StepId;
  businessId: string | null;
  answers: OnboardingAnswers;
  theme: ThemeSettings | null;
  connectStatus: ConnectStatus;
};

export default function OnboardingWizard({ initial }: { initial: WizardInitial }) {
  const router = useRouter();
  const [idx, setIdx] = useState(() => Math.max(0, stepIndex(initial.stepId)));
  const [direction, setDirection] = useState<1 | -1>(1);
  const [answers, setAnswers] = useState<OnboardingAnswers>(initial.answers);
  const [businessId, setBusinessId] = useState<string | null>(initial.businessId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const warnedSql = useRef<Set<string>>(new Set());

  const step = STEPS[idx];
  const StepComponent = STEP_COMPONENTS[step.id];
  const valid = stepIsValid(step.id, answers);
  const isPlan = step.id === "plan";

  // resume with the accent the user (or their industry template) already chose
  useEffect(() => {
    if (initial.theme) applyThemeToDocument(initial.theme);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function set(patch: Partial<OnboardingAnswers>) {
    setAnswers((prev) => ({ ...prev, ...patch }));
  }

  function warnMissingSql(files: string[]) {
    const fresh = files.filter((f) => !warnedSql.current.has(f));
    if (!fresh.length) return;
    fresh.forEach((f) => warnedSql.current.add(f));
    toast.info(`Run supabase/${fresh[0]} in Supabase to save every setup answer`);
  }

  async function goNext(skip: boolean) {
    if (saving || idx >= STEPS.length - 1) return;
    setSaving(true);
    setError(null);

    let bid = businessId;
    if (!skip) {
      const currency =
        COUNTRIES.find((c) => c.code === answers.country)?.currency ?? "USD";
      const res = await saveStep(createClient(), step.id, answers, {
        userId: initial.userId,
        businessId: bid,
        currency,
      });
      if (res.error) {
        setError(res.error);
        setSaving(false);
        return;
      }
      if (res.businessId) {
        bid = res.businessId;
        setBusinessId(res.businessId);
      }
      if (res.missingSql) warnMissingSql(res.missingSql);
    }

    const next = STEPS[idx + 1];
    if (bid) {
      const supabase = createClient();
      if (next.id === "plan") {
        const res = await stampCompleted(supabase, bid);
        if (res.missingSql) warnMissingSql(res.missingSql);
      } else {
        await saveProgress(supabase, bid, next.id);
      }
    }

    setDirection(1);
    setIdx(idx + 1);
    setSaving(false);
  }

  function goBack() {
    if (saving || idx === 0) return;
    setError(null);
    setDirection(-1);
    setIdx(idx - 1);
  }

  async function signOut() {
    await createClient().auth.signOut();
    router.push("/login");
  }

  const sectionIdx = SECTIONS.findIndex((s) => s.id === step.section);
  const progress = (idx + 1) / STEPS.length;

  return (
    <div className="flex min-h-screen bg-background">
      {/* ── Desktop section rail ── */}
      <aside className="hidden w-64 shrink-0 flex-col justify-between border-r border-border p-8 lg:flex">
        <div className="flex flex-col gap-10">
          <div className="flex items-center gap-2.5">
            <span
              className="material-symbols-outlined flex size-9 items-center justify-center rounded-xl text-[20px]"
              style={{
                color: "var(--brand-brick)",
                background: "color-mix(in oklch, var(--brand-brick) 14%, transparent)",
              }}
            >
              foundation
            </span>
            <span className="font-display text-base font-bold tracking-tight text-foreground">
              HustleBricks
            </span>
          </div>
          <nav className="flex flex-col gap-1" aria-label="Setup progress">
            {SECTIONS.map((s, i) => {
              const state = i < sectionIdx ? "done" : i === sectionIdx ? "active" : "todo";
              return (
                <div
                  key={s.id}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors ${
                    state === "active" ? "bg-primary/5" : ""
                  }`}
                >
                  <span
                    className={`material-symbols-outlined flex size-7 items-center justify-center rounded-full text-[15px] transition-colors ${
                      state === "done"
                        ? "bg-primary text-primary-foreground"
                        : state === "active"
                          ? "icon-primary"
                          : "bg-muted text-muted-foreground/60"
                    }`}
                  >
                    {state === "done" ? "check" : s.icon}
                  </span>
                  <span
                    className={`text-sm font-semibold transition-colors ${
                      state === "active"
                        ? "text-foreground"
                        : state === "done"
                          ? "text-muted-foreground"
                          : "text-muted-foreground/50"
                    }`}
                  >
                    {s.label}
                  </span>
                </div>
              );
            })}
          </nav>
        </div>
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="material-symbols-outlined text-[16px] text-green-600">cloud_done</span>
          Progress saves automatically
        </p>
      </aside>

      {/* ── Main pane ── */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile header: brand + progress */}
        <header className="flex items-center gap-4 px-5 pb-2 pt-5 lg:justify-end lg:px-10">
          <div className="flex flex-1 items-center gap-3 lg:hidden">
            <span
              className="material-symbols-outlined flex size-8 shrink-0 items-center justify-center rounded-lg text-[18px]"
              style={{
                color: "var(--brand-brick)",
                background: "color-mix(in oklch, var(--brand-brick) 14%, transparent)",
              }}
            >
              foundation
            </span>
            <div
              className="h-1.5 flex-1 overflow-hidden rounded-full bg-border"
              role="progressbar"
              aria-valuenow={Math.round(progress * 100)}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: `${progress * 100}%` }}
              />
            </div>
            <span className="tnum shrink-0 text-xs font-semibold text-muted-foreground">
              {idx + 1}/{STEPS.length}
            </span>
          </div>
          <button
            type="button"
            onClick={signOut}
            className="text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
          >
            Sign out
          </button>
        </header>

        <main className="flex flex-1 items-start justify-center px-5 py-8 sm:items-center lg:px-10">
          <form
            className={`w-full ${isPlan ? "max-w-3xl" : "max-w-md"}`}
            onSubmit={(e) => {
              e.preventDefault();
              if (valid) goNext(false);
            }}
          >
            <div key={idx} className={direction > 0 ? "step-in-fwd" : "step-in-back"}>
              <p className="mb-3 text-xs font-bold uppercase tracking-wider text-primary">
                {SECTIONS[sectionIdx].label}
              </p>

              <StepComponent
                a={answers}
                set={set}
                businessId={businessId}
                connectStatus={initial.connectStatus}
              />

              {error && (
                <p className="mt-5 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-500 dark:bg-red-950/30">
                  {error}
                </p>
              )}

              {!isPlan && (
                <div className="mt-8 flex flex-col gap-3">
                  <button
                    type="submit"
                    disabled={saving || !valid}
                    className="press w-full rounded-xl bg-primary py-3.5 text-sm font-bold text-white shadow-md shadow-primary/30 transition-all hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {saving ? "Saving…" : stepCta(step.id)}
                  </button>
                  <div className="flex min-h-6 items-center justify-between">
                    {idx > 0 ? (
                      <button
                        type="button"
                        onClick={goBack}
                        className="flex items-center gap-1 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
                      >
                        <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                        Back
                      </button>
                    ) : (
                      <span />
                    )}
                    {step.optional && (
                      <button
                        type="button"
                        onClick={() => goNext(true)}
                        disabled={saving}
                        className="text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
                      >
                        Skip for now
                      </button>
                    )}
                  </div>
                </div>
              )}

              {isPlan && (
                <div className="mt-6 flex min-h-6 items-center">
                  <button
                    type="button"
                    onClick={goBack}
                    className="flex items-center gap-1 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                    Back
                  </button>
                </div>
              )}
            </div>
          </form>
        </main>
      </div>
    </div>
  );
}
