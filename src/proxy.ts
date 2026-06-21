import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh the session and verify the JWT locally (ECC/ES256 signing keys
  // are enabled, so getClaims verifies the signature in-process via WebCrypto
  // instead of making a network round-trip to /auth/v1/user on every request).
  // getClaims() still calls getSession() first, so expired tokens are refreshed.
  const { data: claimsData } = await supabase.auth.getClaims();
  const user = claimsData?.claims ? { id: claimsData.claims.sub } : null;

  const { pathname } = request.nextUrl;
  const isPublicPath =
    pathname === "/" ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/update-password") ||
    pathname.startsWith("/check-email") ||
    pathname.startsWith("/employee-join") ||
    pathname.startsWith("/employee-login") ||
    pathname.startsWith("/employee-pending") ||
    pathname.startsWith("/team-portal") ||
    pathname.startsWith("/api/google-calendar/callback") ||
    pathname.startsWith("/api/cron") ||
    pathname.startsWith("/api/sms/webhook") ||
    pathname.startsWith("/api/weather-alerts") ||
    pathname.startsWith("/api/employee-join") ||
    pathname.startsWith("/api/quote-public") ||
    pathname.startsWith("/api/quote-respond") ||
    pathname.startsWith("/book/") ||
    pathname.startsWith("/api/leads/submit") ||
    pathname.startsWith("/api/booking/capacity") ||
    pathname.startsWith("/api/booking/public") ||
    pathname.startsWith("/api/quotes/request") ||
    pathname.startsWith("/q/");

  if (!user && !isPublicPath) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }


  return supabaseResponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
