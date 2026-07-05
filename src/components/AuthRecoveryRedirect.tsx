"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Supabase auth emails can land on the site root with the session in the URL
 * fragment (implicit flow: #access_token=...&type=recovery) when the redirect
 * allowlist doesn't match. The fragment never reaches the server, so this
 * client component forwards recovery links to /update-password with the
 * fragment intact for the browser client to consume.
 */
export default function AuthRecoveryRedirect() {
  const router = useRouter();

  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes("access_token") && hash.includes("type=recovery")) {
      router.replace(`/update-password${hash}`);
    }
  }, [router]);

  return null;
}
