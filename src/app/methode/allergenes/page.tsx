import type { Metadata } from "next";
import { getActiveBaby } from "@/lib/data/baby";
import { getAllergens } from "@/lib/data/allergens";
import {
  ALLERGENES_SEO,
  MethodAllergenesContent,
} from "@/components/method-allergenes";
import { ALLERGENES_URL, APP_METHODE_URL, METHODE_URL } from "@/lib/routes";

/**
 * Version **connectée** de la page allergènes : même texte, mais dans la
 * coquille de l'app, avec le prénom de l'enfant et le catalogue du foyer
 * (allergènes ajoutés compris).
 *
 * Le pendant public et prérendu vit sur `ALLERGENES_URL` : c'est lui que
 * lisent les visiteurs et que voit un moteur de recherche, d'où le `canonical`
 * et le `noindex` posés ici — deux URL pour un même texte, une seule indexée.
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
      /* Cf. la page « méthode » : le retour suit le parcours réel du lecteur. */
      methodeHref={baby ? APP_METHODE_URL : METHODE_URL}
    />
  );
}
