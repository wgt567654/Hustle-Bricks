"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { checkEmailExists } from "./actions";

type View = "login" | "forgot" | "forgot-sent";

export default function EmployeeLoginPage() {
  const router = useRouter();
  const [view, setView] = useState<View>("login");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailExists, setEmailExists] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleEmailBlur() {
    if (!email || !email.includes("@")) return;
    setEmailError(null);

    const exists = await checkEmailExists(email);
    setEmailExists(exists);

    if (!exists) {
      setEmailError("No account found with this email.");
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (emailExists === false) return;

    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      // Email was verified to exist, so the password must be wrong
      setError(emailExists ? "Incorrect password." : error.message);
      setLoading(false);
    } else {
      router.push("/employee");
      router.refresh();
    }
  }

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback`,
    });

    setLoading(false);

    if (error) {
      setError(error.message);
    } else {
      setView("forgot-sent");
    }
  }

  // ── Sent confirmation ────────────────────────────────────────────────────────
  if (view === "forgot-sent") {
    return (
      <div className="flex min-h-screen items-center justify-center p-4 bg-background">
        <div className="w-full max-w-sm flex flex-col items-center gap-4 text-center">
          <div className="flex size-16 items-center justify-center rounded-full bg-primary/10 text-primary">
            <span className="material-symbols-outlined text-[32px]" style={{ fontVariationSettings: "'FILL' 1" }}>
              mark_email_read
            </span>
          </div>
          <h1 className="text-xl font-extrabold text-foreground">Check your email</h1>
          <p className="text-sm text-muted-foreground">
            We sent a password reset link to <strong>{email}</strong>. Click the link in the email to set a new password.
          </p>
          <button
            onClick={() => { setView("login"); setError(null); }}
            className="w-full mt-2 py-3 rounded-xl bg-foreground text-background font-bold text-sm hover:bg-foreground/90 transition-colors"
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  // ── Forgot password form ─────────────────────────────────────────────────────
  if (view === "forgot") {
    return (
      <div className="flex min-h-screen items-center justify-center p-4 bg-background">
        <div className="w-full max-w-sm flex flex-col gap-6">

          <div className="flex flex-col items-center gap-2 text-center">
            <div className="size-14 rounded-2xl bg-primary text-white flex items-center justify-center shadow-lg shadow-primary/25 mb-2">
              <span className="material-symbols-outlined text-[32px]">lock_reset</span>
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight text-foreground">Reset password</h1>
            <p className="text-sm text-muted-foreground">Enter your email and we&apos;ll send you a reset link</p>
          </div>

          <Card className="p-6 rounded-2xl border-border shadow-sm flex flex-col gap-4">
            <form onSubmit={handleForgotPassword} className="flex flex-col gap-4">
              {error && (
                <p className="text-sm text-red-500 bg-red-50 dark:bg-red-950/30 rounded-xl px-3 py-2">{error}</p>
              )}

              <div className="flex flex-col gap-1.5">
                <label htmlFor="reset-email" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Email Address</label>
                <input
                  id="reset-email"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                  className="flex h-12 w-full rounded-xl border border-border bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>

              <button
                type="submit"
                disabled={loading || !email}
                className="w-full mt-2 rounded-xl font-bold py-3.5 text-sm bg-foreground text-background shadow-md hover:bg-foreground/90 active:scale-95 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? "Sending…" : "Send reset link"}
              </button>

              <button
                type="button"
                onClick={() => { setView("login"); setError(null); }}
                className="text-center text-xs font-bold text-muted-foreground hover:text-foreground"
              >
                ← Back to Login
              </button>
            </form>
          </Card>

        </div>
      </div>
    );
  }

  // ── Login form ───────────────────────────────────────────────────────────────
  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-background">
      <div className="w-full max-w-sm flex flex-col gap-6">

        <div className="flex flex-col items-center gap-2 text-center">
          <div className="size-14 rounded-2xl bg-primary text-white flex items-center justify-center shadow-lg shadow-primary/25 mb-2">
            <span className="material-symbols-outlined text-[32px]" style={{ fontVariationSettings: "'FILL' 1" }}>badge</span>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground">Employee Login</h1>
          <p className="text-sm text-muted-foreground">Access your team portal</p>
        </div>

        <Card className="p-6 rounded-2xl border-border shadow-sm flex flex-col gap-4">
          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            {error && (
              <p className="text-sm text-red-500 bg-red-50 dark:bg-red-950/30 rounded-xl px-3 py-2">{error}</p>
            )}

            <div className="flex flex-col gap-1.5">
              <label htmlFor="email" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Email Address</label>
              <input
                id="email"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setEmailError(null); setEmailExists(null); }}
                onBlur={handleEmailBlur}
                required
                autoFocus
                className={`flex h-12 w-full rounded-xl border bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 ${
                  emailError ? "border-red-400 focus-visible:ring-red-400" : "border-border"
                }`}
              />
              {emailError && (
                <div className="flex flex-col gap-1">
                  <p className="text-xs text-red-500">{emailError}</p>
                  <p className="text-xs text-muted-foreground">
                    New employee?{" "}
                    <Link href="/employee-join" className="font-bold text-foreground hover:underline">
                      Join your team
                    </Link>
                  </p>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Password</label>
                <button
                  type="button"
                  onClick={() => { setView("forgot"); setError(null); }}
                  className="text-xs font-bold text-primary hover:underline hover:text-primary/80 transition-colors"
                >
                  Forgot password?
                </button>
              </div>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="flex h-12 w-full rounded-xl border border-border bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>

            <button
              type="submit"
              disabled={loading || emailExists === false}
              className="w-full mt-2 rounded-xl font-bold py-3.5 text-sm bg-foreground text-background shadow-md hover:bg-foreground/90 active:scale-95 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? "Logging in…" : "Log in"}
            </button>
          </form>
        </Card>

        <p className="text-center text-sm text-muted-foreground font-medium">
          New employee?{" "}
          <Link href="/employee-join" className="font-bold text-foreground hover:underline">
            Join your team
          </Link>
        </p>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-3 text-muted-foreground font-semibold">Business owner?</span>
          </div>
        </div>

        <Link
          href="/login"
          className="w-full flex items-center justify-center gap-2 rounded-xl font-bold py-3.5 text-sm border-2 border-border text-foreground hover:bg-muted/50 active:scale-95 transition-all"
        >
          <span className="material-symbols-outlined text-[18px]">storefront</span>
          Owner Login
        </Link>

      </div>
    </div>
  );
}
