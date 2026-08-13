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
 * Entrée publique du produit : le parent répond à quelques questions et voit son
 * programme, **sans créer de compte** (cf. docs/ux-redesign.md §3.5).
 *
 * Les lectures passent par les clients **sans session** : c'est ce qui garde la
 * route prérendue au build, donc préchargée en entier et ouverte sans le moindre
 * aller-retour serveur — la promesse que `lib/routes.ts` fait à son sujet, et
 * que la cible de tous les CTA de la landing doit tenir. Avec `getFoods` et
 * `getAllergens`, qui lisent les cookies, la page redeviendrait dynamique et le
 * clic resterait sans effet visible une seconde durant.
 *
 * Conséquence assumée : un visiteur déjà connecté qui revient ici voit le
 * catalogue commun, pas celui de son foyer. C'est l'aperçu « sans compte » qu'on
 * lui montre — ses propres aliments l'attendent dans l'app.
 *
 * Le catalogue commun (`household_id is null`) est lisible sans être connecté :
 * la policy RLS `read foods` autorise ce cas. On le passe au client, qui calcule
 * le programme en mémoire — rien n'est écrit en base à ce stade.
 *
 * Mêmes contraintes que les deux pages éditoriales voisines, et même contrôle :
 * aucune API de requête ici, coquille écrite dans la page, et la route doit
 * ressortir statique de `next build` — pas `ƒ`.
 */
export const revalidate = 3600;

export default async function DecouvrirPage() {
  const [foods, allergens] = await Promise.all([
    getPublicFoods(),
    getPublicAllergens(),
  ]);

  // La page étant prérendue, un catalogue vide ne se rattrape pas à la requête
  // suivante : il serait figé dans le HTML jusqu'au prochain déploiement. Mieux
  // vaut faire échouer le build — Vercel ne promeut pas un build en échec, et la
  // version en ligne, elle, continue de servir le programme.
  if (foods.length === 0) {
    throw new Error(
      "Catalogue d'aliments vide : /decouvrir ne peut pas être prérendue.",
    );
  }

  return <DiscoverFlow foods={foods} allergens={allergens} />;
}
