import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Retour du lien magique **et** de la connexion Google : dans les deux cas
 * Supabase renvoie ici avec un `code` qu'on échange contre une session
 * (cookies). Puis on redirige vers l'app.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  // `next` vient de l'URL : n'accepter qu'un chemin interne, sinon la page de
  // retour devient une redirection ouverte vers n'importe quel site.
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
