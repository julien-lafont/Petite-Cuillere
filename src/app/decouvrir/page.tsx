import type { Metadata } from "next";
import { getPublicFoods } from "@/lib/data/foods";
import { getPublicAllergens } from "@/lib/data/allergens";
import { DiscoverFlow } from "@/components/discover-flow";

export const metadata: Metadata = {
  title: "Découvrir le programme de bébé",
  description:
    "Quelques questions et vous voyez le programme de diversification de votre bébé, tout de suite. Sans compte, sans engagement.",
};

/**
 * Public entry point to the product: the parent answers a few questions and sees
 * their programme, **without creating an account** (see docs/ux-redesign.md
 * §3.5).
 *
 * Reads go through the **session-less** clients: that is what keeps the route
 * prerendered at build, so prefetched whole and opened with no server round
 * trip — the promise `lib/routes.ts` makes about it, and the one the target of
 * every landing CTA has to keep. With `getFoods` and `getAllergens`, which read
 * cookies, the page would turn dynamic again and the click would do nothing
 * visible for a full second.
 *
 * Accepted consequence: a visitor already signed in who comes back here sees the
 * common catalogue, not their household's. This is the "no account" preview —
 * their own foods are waiting in the app.
 *
 * The common catalogue (`household_id is null`) is readable while signed out:
 * the `read foods` RLS policy allows that case. We pass it to the client, which
 * computes the programme in memory — nothing is written to the database at this
 * stage.
 *
 * Same constraints as the two neighbouring editorial pages, and the same check:
 * no request API here, the shell is written in the page, and the route must come
 * out static from `next build` — not `ƒ`.
 */
export const revalidate = 3600;

export default async function DecouvrirPage() {
  const [foods, allergens] = await Promise.all([
    getPublicFoods(),
    getPublicAllergens(),
  ]);

  // The page being prerendered, an empty catalogue is not recovered on the
  // next request: it would be frozen into the HTML until the next deploy.
  // Better to fail the build — Vercel does not promote a failed build, and the
  // live version keeps serving the programme.
  if (foods.length === 0) {
    throw new Error(
      "Catalogue d'aliments vide : /decouvrir ne peut pas être prérendue.",
    );
  }

  return <DiscoverFlow foods={foods} allergens={allergens} />;
}
