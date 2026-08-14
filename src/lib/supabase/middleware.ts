import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Public path prefixes, reachable without signing in. The pages that explain
 * what the programme rests on must be readable before sign-up, not after: they
 * live under `/decouvrir`, and `/methode` stays open because it served that
 * public address before the two versions were split (see `src/lib/routes.ts`) —
 * an inbound link must open the page, not an invitation to sign in.
 */
const PUBLIC_PATHS = [
  "/login",
  "/auth",
  "/rejoindre",
  "/decouvrir",
  "/methode",
  // Voice metrics: an address no link gives out, but which opens without an
  // account for whoever knows it. It only shows aggregated durations.
  "/mesures",
];

/** The app's home once signed in (the "Aujourd'hui" dashboard). */
const APP_HOME = "/aujourdhui";

/**
 * Refreshes the session on every request and arbitrates access:
 * - `/` = public landing (visible without an account);
 * - public paths = reachable without an account;
 * - everything else = protected, redirected to /login when signed out;
 * - a signed-in visitor on the landing or /login is sent into the app.
 */
export async function updateSession(request: NextRequest) {
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
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isLanding = pathname === "/";
  const isPublic =
    isLanding || PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Already signed in and on the landing or /login → go straight into the app.
  if (user && (isLanding || pathname === "/login")) {
    const url = request.nextUrl.clone();
    url.pathname = APP_HOME;
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
