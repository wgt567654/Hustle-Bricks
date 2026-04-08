"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";

type Step = "code" | "signup" | "done";

export default function EmployeeJoinPage() {
  const router = useRouter();

  const [step, setStep] = useState<Step>("code");
  const [businessName, setBusinessName] = useState("");

  // Step 1
  const [code, setCode] = useState("");
  const [lookingUp, setLookingUp] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);

  // Step 2
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [signupError, setSignupError] = useState<string | null>(null);

  async function handleCodeSubmit(e: React.FormEvent) {
    e.preventDefault();
    setCodeError(null);
    setLookingUp(true);

    const supabase = createClient();
    const { data, error } = await supabase.rpc("lookup_business_by_code", {
      p_code: code.trim().toUpperCase(),
    });

    setLookingUp(false);

    if (error || !data) {
      setCodeError("Something went wrong. Please try again.");
      return;
    }

    if (!data.found) {
      setCodeError("No business found with that code. Double-check and try again.");
      return;
    }

    setBusinessName(data.name as string);
    setStep("signup");
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setSignupError(null);

    if (password !== confirmPassword) {
      setSignupError("Passwords don't match.");
      return;
    }
    if (password.length < 6) {
      setSignupError("Password must be at least 6 characters.");
      return;
    }

    setSubmitting(true);
    const supabase = createClient();

    // Create auth account
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { full_name: name.trim() } },
    });

    if (signUpError) {
      setSignupError(signUpError.message);
      setSubmitting(false);
      return;
    }

    const userId = signUpData.user?.id;
    if (!userId) {
      // Email confirmation required — tell user to confirm then come back
      setStep("done");
      setSubmitting(false);
      return;
    }

    // Create pending team_member via security-definer RPC
    const { data: joinData, error: joinError } = await supabase.rpc(
      "join_business_as_employee",
      { p_code: code.trim().toUpperCase(), p_name: name.trim() }
    );

    if (joinError || joinData?.error) {
      setSignupError(joinData?.error ?? joinError?.message ?? "Failed to join team.");
      setSubmitting(false);
      return;
    }

    setStep("done");
    setSubmitting(false);
  }

  // ── Done screen ─────────────────────────────────────────────────────────────
  if (step === "done") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="flex flex-col items-center gap-4 text-center max-w-xs">
          <div className="flex size-16 items-center justify-center rounded-full bg-primary/10 text-primary">
            <span className="material-symbols-outlined text-[32px]" style={{ fontVariationSettings: "'FILL' 1" }}>
              schedule
            </span>
          </div>
          <h1 className="text-xl font-extrabold text-foreground">Request sent!</h1>
          <p className="text-sm text-muted-foreground">
            Your account is created. Your manager at{" "}
            <strong>{businessName}</strong> will approve you shortly. You&apos;ll
            be able to log in once they activate your account.
          </p>
          <button
            onClick={() => router.push("/login")}
            className="w-full mt-2 py-3 rounded-xl bg-primary text-white font-bold text-sm hover:bg-primary/90 transition-colors"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  // ── Signup form ─────────────────────────────────────────────────────────────
  if (step === "signup") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4 py-8">
        <div className="w-full max-w-sm flex flex-col gap-6">
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="flex size-16 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20 text-primary">
              <span className="material-symbols-outlined text-[32px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                bolt
              </span>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-primary mb-1">Joining</p>
              <h1 className="text-2xl font-extrabold tracking-tight text-foreground">{businessName}</h1>
              <p className="text-sm text-muted-foreground mt-1">Create your employee account</p>
            </div>
          </div>

          <form onSubmit={handleSignup} className="flex flex-col gap-4">
            {signupError && (
              <p className="text-sm text-red-500 bg-red-50 dark:bg-red-950/30 rounded-xl px-3 py-2.5">
                {signupError}
              </p>
            )}

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Full Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoFocus
                placeholder="Your full name"
                className="flex h-12 w-full rounded-xl border border-border bg-transparent px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="your@email.com"
                className="flex h-12 w-full rounded-xl border border-border bg-transparent px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="At least 6 characters"
                className="flex h-12 w-full rounded-xl border border-border bg-transparent px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Confirm Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                placeholder="Repeat your password"
                className="flex h-12 w-full rounded-xl border border-border bg-transparent px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>

            <button
              type="submit"
              disabled={submitting || !name || !email || !password || !confirmPassword}
              className="w-full mt-2 py-3.5 rounded-xl bg-primary text-white font-bold text-sm shadow-md shadow-primary/30 hover:bg-primary/90 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? "Creating account…" : "Create Account & Request Access"}
            </button>

            <button
              type="button"
              onClick={() => setStep("code")}
              className="text-center text-xs font-bold text-muted-foreground hover:text-foreground"
            >
              ← Use a different code
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ── Access code entry ────────────────────────────────────────────────────────
  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-background">
      <div className="w-full max-w-sm flex flex-col gap-6">

        <div className="flex flex-col items-center gap-2 text-center">
          <div className="size-14 rounded-2xl bg-primary text-white flex items-center justify-center shadow-lg shadow-primary/25 mb-2">
            <span className="material-symbols-outlined text-[32px]" style={{ fontVariationSettings: "'FILL' 1" }}>badge</span>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground">Join your team</h1>
          <p className="text-sm text-muted-foreground">Enter the access code your manager gave you</p>
        </div>

        <Card className="p-6 rounded-2xl border-border shadow-sm">
          <form onSubmit={handleCodeSubmit} className="flex flex-col gap-4">
            {codeError && (
              <p className="text-sm text-red-500 bg-red-50 dark:bg-red-950/30 rounded-xl px-3 py-2">
                {codeError}
              </p>
            )}

            <div className="flex flex-col gap-1.5">
              <label htmlFor="code" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Team Access Code
              </label>
              <input
                id="code"
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))}
                required
                autoFocus
                placeholder="e.g. HB7X2K"
                maxLength={6}
                className="flex h-14 w-full rounded-xl border border-border bg-transparent px-4 text-center text-xl font-extrabold tracking-[0.3em] uppercase shadow-sm placeholder:text-muted-foreground/40 placeholder:tracking-normal placeholder:text-base placeholder:font-normal focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
              <p className="text-xs text-muted-foreground text-center">6-character code from your manager</p>
            </div>

            <button
              type="submit"
              disabled={lookingUp || code.length < 6}
              className="w-full mt-2 rounded-xl font-bold py-3.5 text-sm bg-foreground text-background shadow-md hover:bg-foreground/90 active:scale-95 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {lookingUp ? "Looking up…" : "Continue"}
            </button>
          </form>
        </Card>

        <p className="text-center text-sm text-muted-foreground font-medium">
          Already have an account?{" "}
          <Link href="/login" className="font-bold text-foreground hover:underline">
            Log in
          </Link>
        </p>

      </div>
    </div>
  );
}
