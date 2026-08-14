import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Return from the magic link **and** from Google sign-in: in both cases Supabase
 * comes back here with a `code` we exchange for a session (cookies). Then we
 * redirect into the app.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  // `next` comes from the URL: accept an internal path only, or the callback
  // page becomes an open redirect to any site.
  const requested = searchParams.get("next") ?? "/";
  const next =
    requested.startsWith("/") && !requested.startsWith("//") ? requested : "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
