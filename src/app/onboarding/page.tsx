"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";

const BUSINESS_TYPES = [
  { value: "cleaning", label: "🧹 Cleaning" },
  { value: "landscaping", label: "🌿 Landscaping" },
  { value: "pressure_washing", label: "💧 Pressure Washing" },
  { value: "painting", label: "🎨 Painting" },
  { value: "handyman", label: "🔧 Handyman" },
  { value: "moving", label: "📦 Moving" },
  { value: "other", label: "✨ Other" },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [businessName, setBusinessName] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: { preventDefault(): void }) {
    e.preventDefault();
    if (!businessName.trim()) return;

    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return;
    }

    const { error } = await supabase.from("businesses").insert({
      owner_id: user.id,
      name: businessName.trim(),
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push("/");
      router.refresh();
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-background">
      <div className="w-full max-w-sm flex flex-col gap-6">

        {/* Branding */}
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="size-14 rounded-2xl bg-[#007AFF] text-white flex items-center justify-center shadow-lg shadow-[#007AFF]/25 mb-2">
            <span className="material-symbols-outlined text-[32px]">storefront</span>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground">Name your business</h1>
          <p className="text-sm text-muted-foreground">This is what your clients will see on quotes and invoices.</p>
        </div>

        <Card className="p-6 rounded-2xl border-border shadow-sm flex flex-col gap-5">
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">

            {error && (
              <p className="text-sm text-red-500 bg-red-50 dark:bg-red-950/30 rounded-xl px-3 py-2">{error}</p>
            )}

            <div className="flex flex-col gap-1.5">
              <label htmlFor="businessName" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Business Name
              </label>
              <input
                id="businessName"
                type="text"
                placeholder="e.g. Shine Pro Cleaning"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                required
                autoFocus
                className="flex h-12 w-full rounded-xl border border-border bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Business Type <span className="normal-case font-normal text-muted-foreground/60">(optional)</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                {BUSINESS_TYPES.map((type) => (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => setBusinessType(type.value)}
                    className={`rounded-xl border px-3 py-2.5 text-sm font-medium text-left transition-all active:scale-95 ${
                      businessType === type.value
                        ? "border-[#007AFF] bg-[#007AFF]/10 text-[#007AFF]"
                        : "border-border bg-muted/40 text-foreground hover:bg-muted"
                    }`}
                  >
                    {type.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !businessName.trim()}
              className="w-full mt-1 rounded-xl font-bold py-3.5 text-sm bg-[#007AFF] text-white shadow-md shadow-[#007AFF]/30 hover:bg-[#007AFF]/90 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Setting up…" : "Let's go →"}
            </button>

          </form>
        </Card>

      </div>
    </div>
  );
}
