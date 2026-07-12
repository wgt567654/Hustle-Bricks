"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";
import {
  AUTOMATED_MESSAGES,
  type AutomatedMessageKey,
} from "@/lib/automated-messages";

type Flags = {
  follow_up_enabled: boolean;
  payment_reminders_enabled: boolean;
  review_requests_enabled: boolean;
  rebooking_enabled: boolean;
};

type FlowStep =
  | { type: "trigger"; label: string }
  | { type: "wait"; label: string }
  | { type: "sms"; templateKey: AutomatedMessageKey };

type Flow = {
  flag: keyof Flags;
  name: string;
  icon: string;
  iconClass: string;
  desc: string;
  steps: FlowStep[];
};

const FLOWS: Flow[] = [
  {
    flag: "follow_up_enabled",
    name: "Quote follow-ups",
    icon: "request_quote",
    iconClass: "icon-primary",
    desc: "Chase every quote automatically until they answer.",
    steps: [
      { type: "trigger", label: "Quote sent" },
      { type: "wait", label: "Wait 1 day" },
      { type: "sms", templateKey: "quote_follow_up_1" },
      { type: "wait", label: "Wait 2 more days" },
      { type: "sms", templateKey: "quote_follow_up_2" },
      { type: "wait", label: "Wait 4 more days" },
      { type: "sms", templateKey: "quote_follow_up_3" },
    ],
  },
  {
    flag: "payment_reminders_enabled",
    name: "Payment reminders",
    icon: "attach_money",
    iconClass: "icon-green",
    desc: "Politely collect on unpaid invoices, escalating over two weeks.",
    steps: [
      { type: "trigger", label: "Job completed & unpaid" },
      { type: "wait", label: "Wait 3 days" },
      { type: "sms", templateKey: "payment_reminder_1" },
      { type: "wait", label: "Wait 4 more days" },
      { type: "sms", templateKey: "payment_reminder_2" },
      { type: "wait", label: "Wait 7 more days" },
      { type: "sms", templateKey: "payment_reminder_3" },
    ],
  },
  {
    flag: "review_requests_enabled",
    name: "Review requests",
    icon: "star",
    iconClass: "icon-caution",
    desc: "Ask happy customers for a Google review the day after service.",
    steps: [
      { type: "trigger", label: "Job completed" },
      { type: "wait", label: "Wait ~1 day" },
      { type: "sms", templateKey: "review_request" },
    ],
  },
  {
    flag: "rebooking_enabled",
    name: "Win-back campaign",
    icon: "autorenew",
    iconClass: "icon-violet",
    desc: "Reach out when regulars go quiet.",
    steps: [
      { type: "trigger", label: "No booking in a while" },
      { type: "sms", templateKey: "rebooking" },
    ],
  },
];

const templateByKey = new Map(AUTOMATED_MESSAGES.map((m) => [m.key, m]));

export default function AutomationsClient({
  businessId,
  initialFlags,
  initialRebookingDays,
}: {
  businessId: string;
  initialFlags: Flags;
  initialRebookingDays: number;
}) {
  const [flags, setFlags] = useState<Flags>(initialFlags);
  const [rebookingDays, setRebookingDays] = useState(initialRebookingDays);

  async function toggleFlag(flag: keyof Flags) {
    const next = !flags[flag];
    setFlags((f) => ({ ...f, [flag]: next }));
    const supabase = createClient();
    const { error } = await supabase
      .from("businesses")
      .update({ [flag]: next })
      .eq("id", businessId);
    if (error) {
      setFlags((f) => ({ ...f, [flag]: !next }));
      toast.error("Couldn't update automation");
      return;
    }
    toast.success(next ? "Automation turned on" : "Automation paused");
  }

  async function saveRebookingDays(days: number) {
    const clamped = Math.max(30, Math.min(720, Math.round(days) || 180));
    setRebookingDays(clamped);
    const supabase = createClient();
    const { error } = await supabase
      .from("businesses")
      .update({ rebooking_after_days: clamped })
      .eq("id", businessId);
    if (error) toast.error("Couldn't save timing");
    else toast.success(`Win-back triggers after ${clamped} days`);
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-6">
      <div className="reveal flex flex-col gap-1" style={{ "--reveal-i": 0 } as React.CSSProperties}>
        <Link
          href="/settings/customize"
          className="mb-2 inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          Customize Studio
        </Link>
        <h1 className="text-2xl">Automation Builder</h1>
        <p className="text-sm text-muted-foreground">
          Your follow-up machine, visualized. Toggle a sequence on and it runs
          on autopilot — every message is editable.
        </p>
      </div>

      {FLOWS.map((flow, fi) => {
        const enabled = flags[flow.flag];
        return (
          <section
            key={flow.flag}
            className={`reveal overflow-hidden rounded-2xl border bg-card transition-opacity ${
              enabled ? "border-border" : "border-border opacity-70"
            }`}
            style={{ "--reveal-i": fi + 1 } as React.CSSProperties}
          >
            <header className="flex items-center gap-3 border-b border-border/60 px-4 py-3">
              <span
                className={`material-symbols-outlined flex size-9 shrink-0 items-center justify-center rounded-xl text-[20px] ${flow.iconClass}`}
              >
                {flow.icon}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{flow.name}</p>
                <p className="truncate text-xs text-muted-foreground">{flow.desc}</p>
              </div>
              <button
                type="button"
                aria-label={`${enabled ? "Pause" : "Enable"} ${flow.name}`}
                aria-pressed={enabled}
                onClick={() => toggleFlag(flow.flag)}
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                  enabled ? "bg-primary" : "bg-muted-foreground/30"
                }`}
              >
                <span
                  className={`inline-block size-5 transform rounded-full bg-white shadow transition-transform ${
                    enabled ? "translate-x-[22px]" : "translate-x-0.5"
                  }`}
                />
              </button>
            </header>

            {/* Vertical flow */}
            <div className="flex flex-col px-5 py-4">
              {flow.steps.map((step, i) => (
                <div key={i} className="flex gap-3">
                  {/* Rail */}
                  <div className="flex w-8 flex-col items-center">
                    <span
                      className={`material-symbols-outlined z-10 flex size-8 items-center justify-center rounded-full text-[16px] ${
                        step.type === "trigger"
                          ? "bg-primary text-primary-foreground"
                          : step.type === "wait"
                            ? "bg-muted text-muted-foreground"
                            : "icon-teal"
                      }`}
                    >
                      {step.type === "trigger"
                        ? "bolt"
                        : step.type === "wait"
                          ? "hourglass_empty"
                          : "sms"}
                    </span>
                    {i < flow.steps.length - 1 && (
                      <span className="w-px flex-1 bg-border" aria-hidden />
                    )}
                  </div>

                  {/* Node */}
                  <div className={`min-w-0 flex-1 ${i < flow.steps.length - 1 ? "pb-4" : ""}`}>
                    {step.type === "sms" ? (
                      <div className="rounded-xl border border-border/70 bg-background px-3 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-semibold">
                            {templateByKey.get(step.templateKey)?.label ?? "Text message"}
                          </p>
                          <Link
                            href="/settings/customize/templates"
                            className="shrink-0 text-[11px] font-medium text-primary hover:underline"
                          >
                            Edit message
                          </Link>
                        </div>
                        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                          {templateByKey.get(step.templateKey)?.defaultBody}
                        </p>
                      </div>
                    ) : step.type === "trigger" && flow.flag === "rebooking_enabled" ? (
                      <div className="flex h-8 items-center gap-2 text-sm font-medium">
                        No booking in
                        <input
                          type="number"
                          min={30}
                          max={720}
                          value={rebookingDays}
                          onChange={(e) => setRebookingDays(Number(e.target.value))}
                          onBlur={(e) => saveRebookingDays(Number(e.target.value))}
                          className="w-16 rounded-lg border border-border bg-background px-2 py-1 text-center text-sm tnum"
                          aria-label="Days without a booking before win-back sends"
                        />
                        days
                      </div>
                    ) : (
                      <p className={`flex h-8 items-center text-sm ${step.type === "trigger" ? "font-semibold" : "text-muted-foreground"}`}>
                        {step.label}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        );
      })}

      <p className="text-xs text-muted-foreground">
        Morning briefing, auto-invoicing, and AI texting live in{" "}
        <Link href="/settings?sec=automations" className="text-primary underline-offset-2 hover:underline">
          Settings → Automations
        </Link>
        .
      </p>
    </div>
  );
}
