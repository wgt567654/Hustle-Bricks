"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";

function CheckEmailContent() {
  const params = useSearchParams();
  const email = params.get("email") ?? "your email";

  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-background">
      <div className="w-full max-w-sm flex flex-col items-center gap-6 text-center">

        {/* Icon */}
        <div className="size-20 rounded-3xl bg-[#3581f3]/10 border border-[#3581f3]/20 flex items-center justify-center">
          <span
            className="material-symbols-outlined text-[44px] text-[#3581f3]"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            mark_email_unread
          </span>
        </div>

        {/* Text */}
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground">Check your email</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            We sent a confirmation link to
          </p>
          <p className="text-sm font-bold text-foreground break-all">{email}</p>
          <p className="text-sm text-muted-foreground leading-relaxed mt-1">
            Click the link in that email to activate your account and get started.
          </p>
        </div>

        {/* Tips */}
        <div className="w-full rounded-2xl bg-card border border-border p-4 flex flex-col gap-2 text-left">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Didn&apos;t get it?</p>
          <p className="text-xs text-muted-foreground">• Check your spam or junk folder</p>
          <p className="text-xs text-muted-foreground">• Make sure you typed the right email</p>
          <p className="text-xs text-muted-foreground">• It may take a minute or two to arrive</p>
        </div>

        {/* Back to login */}
        <Link
          href="/login"
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-border bg-muted/40 text-sm font-bold text-foreground hover:bg-muted transition-colors"
        >
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          Back to login
        </Link>

      </div>
    </div>
  );
}

export default function CheckEmailPage() {
  return (
    <Suspense>
      <CheckEmailContent />
    </Suspense>
  );
}
