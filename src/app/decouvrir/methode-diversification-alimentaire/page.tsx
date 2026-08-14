import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import {
  DIVERSIFICATION_SEO,
  MethodDiversificationContent,
} from "@/components/method-diversification";
import { ALLERGENES_URL, METHODE_URL } from "@/lib/routes";

export const metadata: Metadata = {
  title: DIVERSIFICATION_SEO.title,
  description: DIVERSIFICATION_SEO.description,
  alternates: { canonical: METHODE_URL },
  openGraph: {
    url: METHODE_URL,
    title: DIVERSIFICATION_SEO.ogTitle,
    description: DIVERSIFICATION_SEO.description,
  },
};

/**
 * The **public** version of the method page, and the only indexed one.
 *
 * It is prerendered at build, which changes everything for a visitor: Next then
 * prefetches the whole route on link hover, and the click causes no server round
 * trip — the page is simply there. A route rendered on demand is only prefetched
 * as far as its skeleton.
 *
 * Hence the two constraints to hold here, on pain of falling back to dynamic
 * with nothing to flag it on re-reading:
 *
 *   1. no request API (`cookies()`, `headers()`, `searchParams`) — so no
 *      `getActiveBaby()`, and copy written for "votre enfant";
 *   2. the public shell is written into the page, not inherited from a layout
 *      that decides based on the visitor.
 *
 * The check happens at build: the route must be marked static in `next build`'s
 * output, not `ƒ`.
 *
 * The signed-in counterpart lives at `/methode`, inside the app shell.
 */
export default function Page() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      {/*
       * The column width is set by the content itself, as on the "méthode"
       * pages: we only tune margins and rhythm here.
       */}
      <main className="px-5 py-12 md:px-8 md:py-16">
        <MethodDiversificationContent
          name="votre enfant"
          il="il"
          allergenesHref={ALLERGENES_URL}
        />
      </main>
      <SiteFooter />
    </div>
  );
}
