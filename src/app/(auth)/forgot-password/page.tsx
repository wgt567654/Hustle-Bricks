"use client";

import { useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: { preventDefault(): void }) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/callback?next=/update-password`,
    });

    if (error) {
      setError(
        error.message.toLowerCase().includes("rate limit")
          ? "Too many reset emails requested. Please wait a few minutes and try again."
          : error.message
      );
      setLoading(false);
    } else {
      setSent(true);
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-background">
      <div className="w-full max-w-sm flex flex-col gap-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="size-14 rounded-2xl bg-primary text-white flex items-center justify-center shadow-lg shadow-primary/25 mb-2">
            <span className="material-symbols-outlined text-[32px]">lock_reset</span>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground">
            Reset your password
          </h1>
          <p className="text-sm text-muted-foreground">
            Enter your email and we&apos;ll send you a reset link
          </p>
        </div>

        <Card className="p-6 rounded-2xl border-border shadow-sm flex flex-col gap-4">
          {sent ? (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                <span className="material-symbols-outlined text-[28px]">mark_email_read</span>
              </div>
              <p className="text-sm font-medium text-foreground">
                Check your inbox
              </p>
              <p className="text-sm text-muted-foreground">
                If an account exists for <span className="font-semibold text-foreground">{email}</span>,
                a password reset link is on its way.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              {error && (
                <p className="text-sm text-red-500 bg-red-50 dark:bg-red-950/30 rounded-xl px-3 py-2">
                  {error}
                </p>
              )}

              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="email"
                  className="text-xs font-bold uppercase tracking-wider text-muted-foreground"
                >
                  Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                  className="flex h-12 w-full rounded-xl border border-border bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>

              <button
                type="submit"
                disabled={loading || !email.trim()}
                className="w-full mt-2 rounded-full font-bold py-3.5 text-sm bg-foreground text-background shadow-md hover:bg-foreground/90 active:scale-95 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? "Sending…" : "Send reset link"}
              </button>
            </form>
          )}
        </Card>

        <p className="text-center text-sm text-muted-foreground">
          Remembered it?{" "}
          <Link
            href="/login"
            className="font-bold text-primary hover:underline hover:text-primary/80 transition-colors"
          >
            Back to log in
          </Link>
        </p>
      </div>
    </div>
  );
}
