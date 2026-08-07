import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Chemins publics (préfixes) accessibles sans être connecté. `/methode` en fait
 * partie : les pages qui expliquent sur quoi repose le programme doivent être
 * lisibles avant l'inscription, pas après.
 */
const PUBLIC_PATHS = [
  "/login",
  "/auth",
  "/rejoindre",
  "/decouvrir",
  "/methode",
];

/** Page d'accueil de l'app une fois connecté (le tableau de bord « Aujourd'hui »). */
const APP_HOME = "/aujourdhui";

/**
 * Rafraîchit la session à chaque requête et arbitre l'accès :
 * - `/` = landing publique (visible sans compte) ;
 * - chemins publics = accessibles sans compte ;
 * - le reste = protégé, redirigé vers /login si non connecté ;
 * - un visiteur connecté sur la landing ou /login est renvoyé dans l'app.
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

  // Déjà connecté et sur la landing ou /login → filer directement dans l'app.
  if (user && (isLanding || pathname === "/login")) {
    const url = request.nextUrl.clone();
    url.pathname = APP_HOME;
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
