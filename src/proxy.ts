import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// Next.js 16 : convention « proxy » (ex-« middleware »).
export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Toutes les routes sauf les assets statiques et images.
     *
     * `robots.txt`, `sitemap.xml` et l'image Open Graph en sont exclus eux
     * aussi : ce sont des fichiers destinés aux robots et aux aperçus de
     * partage, qui les demandent évidemment sans session. Passés au proxy, ils
     * repartaient en 307 vers `/login` — le sitemap n'était jamais lu et les
     * liens partagés s'affichaient sans vignette.
     */
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|opengraph-image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
