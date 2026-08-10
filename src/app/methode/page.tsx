import type { Metadata } from "next";
import { getActiveBaby } from "@/lib/data/baby";
import { subjectPronoun } from "@/lib/sexe";
import {
  DIVERSIFICATION_SEO,
  MethodDiversificationContent,
} from "@/components/method-diversification";
import { APP_ALLERGENES_URL, ALLERGENES_URL, METHODE_URL } from "@/lib/routes";

/**
 * Version **connectée** de la page méthode : même texte, mais dans la coquille
 * de l'app, avec le prénom de l'enfant et son pronom.
 *
 * Le pendant public et prérendu vit sur `METHODE_URL` : c'est lui que lisent
 * les visiteurs et que voit un moteur de recherche, d'où le `canonical` et le
 * `noindex` posés ici — deux URL pour un même texte, une seule indexée.
 *
 * Cette route reste malgré tout accessible sans compte : elle était l'adresse
 * publique de la méthode avant que les deux versions soient séparées, et les
 * liens entrants doivent continuer à ouvrir la page plutôt qu'un 404. La
 * canonique suffit à ce qu'une seule des deux soit référencée.
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
       * Un lecteur sans compte est envoyé sur la version prérendue, qui s'ouvre
       * sans attendre le serveur ; un lecteur connecté reste sur la vue de
       * l'app, avec le prénom et le catalogue de son foyer.
       */
      allergenesHref={baby ? APP_ALLERGENES_URL : ALLERGENES_URL}
    />
  );
}
