import type { Metadata } from "next";
import { getActiveBaby } from "@/lib/data/baby";
import { getAllergens } from "@/lib/data/allergens";
import {
  ALLERGENES_SEO,
  MethodAllergenesContent,
} from "@/components/method-allergenes";
import { ALLERGENES_URL, APP_METHODE_URL, METHODE_URL } from "@/lib/routes";

/**
 * The **signed-in** version of the allergens page: same copy, but inside the app
 * shell, with the child's name and the household catalogue (added allergens
 * included).
 *
 * The public, prerendered counterpart lives at `ALLERGENES_URL`: that is the one
 * visitors read and a search engine sees, hence the `canonical` and `noindex`
 * set here — two URLs for one text, one indexed.
 */
export const metadata: Metadata = {
  title: ALLERGENES_SEO.title,
  description: ALLERGENES_SEO.description,
  alternates: { canonical: ALLERGENES_URL },
  robots: { index: false },
  openGraph: {
    url: ALLERGENES_URL,
    title: ALLERGENES_SEO.ogTitle,
    description: ALLERGENES_SEO.description,
  },
};

export default async function Page() {
  const baby = await getActiveBaby();
  const allergens = await getAllergens();

  return (
    <MethodAllergenesContent
      name={baby?.prenom ?? "votre enfant"}
      allergens={allergens}
      /* See the "méthode" page: the back link follows the reader's real path. */
      methodeHref={baby ? APP_METHODE_URL : METHODE_URL}
    />
  );
}
