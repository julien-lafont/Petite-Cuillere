import type { Metadata } from "next";
import { getActiveBaby } from "@/lib/data/baby";
import { subjectPronoun } from "@/lib/sexe";
import {
  DIVERSIFICATION_SEO,
  MethodDiversificationContent,
} from "@/components/method-diversification";
import { APP_ALLERGENES_URL, ALLERGENES_URL, METHODE_URL } from "@/lib/routes";

/**
 * The **signed-in** version of the method page: same copy, but inside the app
 * shell, with the child's name and pronoun.
 *
 * The public, prerendered counterpart lives at `METHODE_URL`: that is the one
 * visitors read and a search engine sees, hence the `canonical` and `noindex`
 * set here — two URLs for one text, one indexed.
 *
 * This route stays reachable without an account all the same: it was the
 * method's public address before the two versions were split, and inbound links
 * must keep opening the page rather than a 404. The canonical is enough for only
 * one of the two to be indexed.
 */
export const metadata: Metadata = {
  title: DIVERSIFICATION_SEO.title,
  description: DIVERSIFICATION_SEO.description,
  alternates: { canonical: METHODE_URL },
  robots: { index: false },
  openGraph: {
    url: METHODE_URL,
    title: DIVERSIFICATION_SEO.ogTitle,
    description: DIVERSIFICATION_SEO.description,
  },
};

export default async function Page() {
  const baby = await getActiveBaby();

  return (
    <MethodDiversificationContent
      name={baby?.prenom ?? "votre enfant"}
      il={subjectPronoun(baby?.sexe)}
      /*
       * A reader without an account is sent to the prerendered version, which
       * opens without waiting for the server; a signed-in reader stays on the
       * app's view, with their child's name and their household catalogue.
       */
      allergenesHref={baby ? APP_ALLERGENES_URL : ALLERGENES_URL}
    />
  );
}
