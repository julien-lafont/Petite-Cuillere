import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// Next.js 16 : convention « proxy » (ex-« middleware »).
export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Every route except static assets and images.
     *
     * `robots.txt`, `sitemap.xml` and the Open Graph image are excluded too:
     * they are files meant for crawlers and share previews, which obviously ask
     * for them without a session. Sent through the proxy they came back as a 307
     * to `/login` — the sitemap was never read and shared links showed no
     * thumbnail.
     */
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|opengraph-image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
