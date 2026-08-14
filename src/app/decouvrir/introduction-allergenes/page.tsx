import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import {
  ALLERGENES_SEO,
  MethodAllergenesContent,
} from "@/components/method-allergenes";
import { getPublicAllergens } from "@/lib/data/allergens";
import { ALLERGENES_URL, METHODE_URL } from "@/lib/routes";

export const metadata: Metadata = {
  title: ALLERGENES_SEO.title,
  description: ALLERGENES_SEO.description,
  alternates: { canonical: ALLERGENES_URL },
  openGraph: {
    url: ALLERGENES_URL,
    title: ALLERGENES_SEO.ogTitle,
    description: ALLERGENES_SEO.description,
  },
};

/**
 * The **public** version of the allergens page, and the only indexed one.
 *
 * It is prerendered at build, which changes everything for a visitor: Next then
 * prefetches the whole route on link hover, and the click causes no server round
 * trip — the page is simply there. A route rendered on demand is only prefetched
 * as far as its skeleton.
 *
 * Hence the two constraints to hold here, on pain of falling back to dynamic
 * with nothing to flag it on re-reading:
 *
 *   1. no request API (`cookies()`, `headers()`, `searchParams`) — so the
 *      catalogue comes through `getPublicAllergens`, without a session;
 *   2. the public shell is written into the page, not inherited from a layout
 *      that decides based on the visitor.
 *
 * The check happens at build: the route must be marked static in `next build`'s
 * output, not `ƒ`.
 *
 * The signed-in counterpart lives at `/methode/allergenes`, inside the app shell.
 */
export const revalidate = 3600;

export default async function Page() {
  // Common catalogue only: a visitor without an account has no household, so no
  // allergens of their own to show.
  const allergens = await getPublicAllergens();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      {/*
       * The column width is set by the content itself, as on the "méthode"
       * pages: we only tune margins and rhythm here.
       */}
      <main className="px-5 py-12 md:px-8 md:py-16">
        <MethodAllergenesContent
          name="votre enfant"
          allergens={allergens}
          methodeHref={METHODE_URL}
        />
      </main>
      <SiteFooter />
    </div>
  );
}
