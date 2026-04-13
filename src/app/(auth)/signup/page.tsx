"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";

function ProgressBar({ step }: { step: number }) {
  return (
    <div className="flex gap-1.5 w-full">
      {[1, 2, 3, 4].map((s) => (
        <div
          key={s}
          className={`h-1 flex-1 rounded-full transition-colors ${
            s <= step ? "bg-primary" : "bg-border"
          }`}
        />
      ))}
    </div>
  );
}

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleGoogleSignup() {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  async function handleAppleSignup() {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "apple",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  function handleContinueWithEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setShowPassword(true);
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signUp({ email, password });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push(`/check-email?email=${encodeURIComponent(email)}`);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-background">
      <div className="w-full max-w-sm flex flex-col gap-6">

        <ProgressBar step={1} />

        <div className="flex flex-col gap-1">
          <p className="text-xs font-bold uppercase tracking-wider text-primary">Step 1 of 4</p>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Create your account</h1>
          <p className="text-sm text-muted-foreground">Start managing your business on HustleBricks.</p>
        </div>

        <Card className="p-6 rounded-2xl border-border shadow-sm flex flex-col gap-4">

          {/* OAuth buttons */}
          <button
            type="button"
            onClick={handleGoogleSignup}
            className="w-full flex items-center justify-center gap-2.5 rounded-xl font-semibold py-3 text-sm bg-muted text-foreground border border-border hover:bg-muted/80 active:scale-95 transition-all"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Sign up with Google
          </button>

          <button
            type="button"
            onClick={handleAppleSignup}
            className="w-full flex items-center justify-center gap-2.5 rounded-xl font-semibold py-3 text-sm bg-muted text-foreground border border-border hover:bg-muted/80 active:scale-95 transition-all"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true" fill="currentColor">
              <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.7 9.05 7.4c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.39-1.32 2.76-2.53 3.99M12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25"/>
            </svg>
            Sign up with Apple
          </button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground font-semibold">or</span>
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-500 bg-red-50 dark:bg-red-950/30 rounded-xl px-3 py-2">{error}</p>
          )}

          {!showPassword ? (
            <form onSubmit={handleContinueWithEmail} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="email" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Email address
                </label>
                <input
                  id="email"
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                  className="flex h-12 w-full rounded-xl border border-border bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
              <button
                type="submit"
                className="w-full rounded-xl font-bold py-3.5 text-sm bg-primary text-white shadow-md shadow-primary/30 hover:bg-primary/90 active:scale-95 transition-all"
              >
                Continue with email →
              </button>
            </form>
          ) : (
            <form onSubmit={handleSignup} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Email address
                </label>
                <div className="flex h-12 w-full items-center rounded-xl border border-border bg-muted/40 px-3 text-sm text-muted-foreground">
                  {email}
                  <button
                    type="button"
                    onClick={() => { setShowPassword(false); setPassword(""); }}
                    className="ml-auto text-xs text-primary hover:underline font-semibold"
                  >
                    Change
                  </button>
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="password" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  placeholder="Min. 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoFocus
                  minLength={8}
                  className="flex h-12 w-full rounded-xl border border-border bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
              <button
                type="submit"
                disabled={loading || password.length < 8}
                className="w-full rounded-xl font-bold py-3.5 text-sm bg-primary text-white shadow-md shadow-primary/30 hover:bg-primary/90 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Creating account…" : "Create account →"}
              </button>
            </form>
          )}

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
