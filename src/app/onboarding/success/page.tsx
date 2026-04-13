"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function OnboardingSuccessPage() {
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => {
      router.push("/");
    }, 2500);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-background">
      <div className="flex flex-col items-center gap-6 text-center max-w-sm">
        <div className="size-20 rounded-full bg-green-500/10 flex items-center justify-center">
          <span className="material-symbols-outlined text-[48px] text-green-500">check_circle</span>
        </div>
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground">You&apos;re all set!</h1>
          <p className="text-sm text-muted-foreground">
            Your subscription is active. Taking you to your dashboard…
          </p>
        </div>
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    </div>
  );
}
